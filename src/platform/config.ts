import {
  Context,
  Effect,
  FileSystem,
  Layer,
  Match,
  Option,
  Path,
  Result,
  Schema,
  SchemaIssue,
} from "effect"
import { Toml } from "effect/encoding"

import { readFileIfExists } from "./files"
import { Paths } from "./paths"

// ── Values ────────────────────────────────────────────────────────────────────────────────────────

export const COLOR_TOKENS = [
  "bg",
  "surface",
  "selection",
  "line",
  "text",
  "muted",
  "accent",
  "success",
  "running",
  "failure",
  "idle",
] as const

export type ColorToken = (typeof COLOR_TOKENS)[number]

/** `#rrggbb`, the terminal's default fg/bg, or an index into the terminal's 16-color palette. */
export const ColorValue = Schema.String.check(
  Schema.isPattern(/^(#[0-9a-fA-F]{6}|default|ansi:(1[0-5]|[0-9]))$/),
)

export const NotifyOn = Schema.Literals(["failure", "success", "recovered"])

export type NotifyOn = typeof NotifyOn.Type

export interface Config {
  readonly theme: {
    readonly name: string
    readonly colors: Partial<Record<ColorToken, string>>
  }
  readonly refresh: {
    /** Seconds between polls of a hot repo while something runs. */
    readonly active: number
    /** Seconds between polls of a hot repo when nothing runs. */
    readonly idle: number
  }
  readonly notifications: {
    readonly enabled: boolean
    readonly bell: boolean
    readonly on: ReadonlyArray<NotifyOn>
  }
}

export const DEFAULT_CONFIG: Config = {
  theme: { name: "terminal", colors: {} },
  refresh: { active: 5, idle: 30 },
  notifications: { enabled: true, bell: true, on: ["failure", "recovered"] },
}

// ── Issues ────────────────────────────────────────────────────────────────────────────────────────

/** A key whose value is invalid; the default is used instead. */
export class InvalidValue extends Schema.TaggedClass<
  InvalidValue,
  { readonly brand: unique symbol }
>()("InvalidValue", {
  key: Schema.String,
  expected: Schema.String,
  got: Schema.String,
  fallback: Schema.String,
}) {}

/** A key tuiaux doesn't know (typo, or removed option); it is ignored. */
export class UnknownKey extends Schema.TaggedClass<
  UnknownKey,
  { readonly brand: unique symbol }
>()("UnknownKey", {
  key: Schema.String,
}) {}

/** The file isn't valid TOML; every setting uses its default. */
export class InvalidToml extends Schema.TaggedClass<
  InvalidToml,
  { readonly brand: unique symbol }
>()("InvalidToml", {
  /** Position of the error, when the parser reports one (it always does today). */
  line: Schema.UndefinedOr(Schema.Int),
  column: Schema.UndefinedOr(Schema.Int),
  /** The parser's message without the position: "Invalid value '='". */
  message: Schema.String,
}) {}

/** `effect/encoding/Toml` puts the position at the end of its message: "… at line 3, column 9". */
const invalidToml = (parserMessage: string): InvalidToml => {
  const match = /^(.*) at line (\d+), column (\d+)$/s.exec(parserMessage)

  return match?.[1] !== undefined
    ? new InvalidToml({
        line: Number(match[2]),
        column: Number(match[3]),
        message: match[1],
      })
    : new InvalidToml({
        line: undefined,
        column: undefined,
        message: parserMessage,
      })
}

/** The file exists but can't be read (permissions, it's a directory, …); every setting uses its default. */
export class Unreadable extends Schema.TaggedClass<
  Unreadable,
  { readonly brand: unique symbol }
>()("Unreadable", {
  message: Schema.String,
}) {}

export type ConfigIssue = InvalidValue | UnknownKey | InvalidToml | Unreadable

// ── Decoding: one schema, decoded twice ───────────────────────────────────────────────────────────
//
// `configDocument(wrap)` describes the file. Each section and setting goes through `wrap`:
// - `strict` rethrows its failure: decoding reports every problem, with its path and the value found;
// - `lenient` drops the failing part: decoding always succeeds and keeps only the valid settings.
// So one bad value never discards the others, and both passes come from the same description.

type Wrap = <S extends Schema.Top>(
  schema: S,
) => Schema.middlewareDecoding<S, S["DecodingServices"]>

const strict: Wrap = schema =>
  schema.pipe(Schema.catchDecoding(issue => Effect.fail(issue)))

const lenient: Wrap = schema =>
  schema.pipe(Schema.catchDecoding(() => Effect.succeedNone))

const ThemeName = Schema.NonEmptyString

const seconds = (minimum: number, maximum: number) =>
  Schema.Int.check(Schema.isBetween({ minimum, maximum }))

const ActiveSeconds = seconds(2, 300)
const IdleSeconds = seconds(5, 3600)

const configDocument = (wrap: Wrap) => {
  const setting = <S extends Schema.Top>(schema: S) =>
    Schema.optionalKey(wrap(schema))

  const section = <Fields extends Schema.Struct.Fields>(fields: Fields) =>
    Schema.optionalKey(wrap(Schema.Struct(fields)))

  return Schema.Struct({
    theme: section({
      name: setting(ThemeName),
      colors: section({
        bg: setting(ColorValue),
        surface: setting(ColorValue),
        selection: setting(ColorValue),
        line: setting(ColorValue),
        text: setting(ColorValue),
        muted: setting(ColorValue),
        accent: setting(ColorValue),
        success: setting(ColorValue),
        running: setting(ColorValue),
        failure: setting(ColorValue),
        idle: setting(ColorValue),
      }),
    }),
    refresh: section({
      active: setting(ActiveSeconds),
      idle: setting(IdleSeconds),
    }),
    notifications: section({
      enabled: setting(Schema.Boolean),
      bell: setting(Schema.Boolean),
      on: setting(Schema.Array(NotifyOn)),
    }),
  })
}

const StrictDocument = configDocument(strict)
const LenientDocument = configDocument(lenient)

// ── Messages ──────────────────────────────────────────────────────────────────────────────────────

interface Expectation {
  readonly expected: string
  readonly fallback: string
}

const SECTION: Expectation = { expected: "a table", fallback: "defaults" }

const COLOR: Expectation = {
  expected: '"#rrggbb", "default" or "ansi:0".."ansi:15"',
  fallback: "the theme's color",
}

const secondsBetween = (
  minimum: number,
  maximum: number,
  fallback: number,
): Expectation => ({
  expected: `a whole number of seconds from ${minimum} to ${maximum}`,
  fallback: String(fallback),
})

const BOOLEAN = (fallback: boolean): Expectation => ({
  expected: "true or false",
  fallback: String(fallback),
})

/** What each section and setting expects, by dotted key. A key missing here is an unknown key. */
const EXPECTATIONS = new Map<string, Expectation>([
  ["theme", SECTION],
  ["theme.name", { expected: "a theme name", fallback: '"terminal"' }],
  ["theme.colors", SECTION],
  ...COLOR_TOKENS.map(token => [`theme.colors.${token}`, COLOR] as const),
  ["refresh", SECTION],
  ["refresh.active", secondsBetween(2, 300, DEFAULT_CONFIG.refresh.active)],
  ["refresh.idle", secondsBetween(5, 3600, DEFAULT_CONFIG.refresh.idle)],
  ["notifications", SECTION],
  ["notifications.enabled", BOOLEAN(DEFAULT_CONFIG.notifications.enabled)],
  ["notifications.bell", BOOLEAN(DEFAULT_CONFIG.notifications.bell)],
  [
    "notifications.on",
    {
      expected: 'a list of "failure", "success", "recovered"',
      fallback: JSON.stringify(DEFAULT_CONFIG.notifications.on),
    },
  ],
])

/** The value the parser found, shortened for a one-line message. */
const found = (issue: SchemaIssue.Issue): string => {
  if (!SchemaIssue.hasInput(issue)) return "nothing"

  const json = JSON.stringify(issue.input) ?? String(issue.input)

  return json.length > 40 ? `${json.slice(0, 39)}…` : json
}

/** Turns the issue tree of a strict decode into config issues, one per bad key. */
const configIssues = (
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
): ReadonlyArray<ConfigIssue> => {
  const key = path.map(String).join(".")
  const expectation = EXPECTATIONS.get(key)

  const descend = (children: ReadonlyArray<SchemaIssue.Issue>) =>
    children.flatMap(child => configIssues(child, path))

  const invalid = (): ReadonlyArray<ConfigIssue> =>
    expectation === undefined
      ? []
      : [new InvalidValue({ key, got: found(issue), ...expectation })]

  return Match.valueTags(issue, {
    Pointer: pointer => configIssues(pointer.issue, [...path, ...pointer.path]),
    // The `wrap` middleware puts its rethrown failure behind an Encoding node: look through it.
    Encoding: encoding => configIssues(encoding.issue, path),
    UnexpectedKey: () => [new UnknownKey({ key })],
    // A table with problems inside is reported key by key; anything else at a known key is invalid.
    Composite: composite =>
      expectation === undefined || expectation === SECTION
        ? descend(composite.issues)
        : invalid(),
    AnyOf: invalid,
    OneOf: invalid,
    Filter: invalid,
    InvalidType: invalid,
    InvalidValue: invalid,
    MissingKey: invalid,
    Forbidden: invalid,
  })
}

export interface DecodedConfig {
  readonly config: Config
  readonly issues: ReadonlyArray<ConfigIssue>
}

/** Pure: TOML text → config with defaults for anything invalid, plus what was wrong. */
export const decodeConfig = (source: string): DecodedConfig => {
  const parsed = Toml.parse(source)

  if (Result.isFailure(parsed)) {
    return {
      config: DEFAULT_CONFIG,
      issues: [invalidToml(parsed.failure.message)],
    }
  }

  const checked = Schema.decodeUnknownResult(StrictDocument)(parsed.success, {
    errors: "all",
    onExcessProperty: "error",
    reportInput: true,
  })

  const issues = Result.isFailure(checked)
    ? configIssues(checked.failure.issue, [])
    : []

  const valid = Schema.decodeUnknownOption(LenientDocument)(
    parsed.success,
  ).pipe(Option.getOrElse((): typeof LenientDocument.Type => ({})))

  const d = DEFAULT_CONFIG

  const config: Config = {
    theme: {
      name: valid.theme?.name ?? d.theme.name,
      colors: { ...valid.theme?.colors },
    },
    refresh: {
      active: valid.refresh?.active ?? d.refresh.active,
      idle: valid.refresh?.idle ?? d.refresh.idle,
    },
    notifications: {
      enabled: valid.notifications?.enabled ?? d.notifications.enabled,
      bell: valid.notifications?.bell ?? d.notifications.bell,
      on: valid.notifications?.on ?? d.notifications.on,
    },
  }

  return { config, issues }
}

// ── Service ───────────────────────────────────────────────────────────────────────────────────────

/** The settings, read once at startup. Never fails: problems become `issues`, shown when the TUI opens. */
export class AppConfig extends Context.Service<
  AppConfig,
  {
    readonly config: Config
    readonly issues: ReadonlyArray<ConfigIssue>
    readonly path: string
  }
>()("tuiaux/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const { configFile } = yield* Paths
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const source = yield* readFileIfExists(configFile).pipe(
        Effect.map(content => ({ content })),
        Effect.catch(error => Effect.succeed({ error })),
      )

      if ("error" in source) {
        yield* Effect.logWarning("config: unreadable", source.error)

        return {
          config: DEFAULT_CONFIG,
          issues: [new Unreadable({ message: source.error.message })],
          path: configFile,
        }
      }

      if (Option.isNone(source.content)) {
        yield* fs
          .makeDirectory(path.dirname(configFile), { recursive: true })
          .pipe(
            Effect.andThen(fs.writeFileString(configFile, "")),
            Effect.tap(() =>
              Effect.logInfo("config: created empty file", configFile),
            ),
            Effect.catch(error =>
              Effect.logWarning("config: could not create file", error),
            ),
          )

        return { config: DEFAULT_CONFIG, issues: [], path: configFile }
      }

      const { config, issues } = decodeConfig(source.content.value)

      if (issues.length > 0) yield* Effect.logWarning("config: issues", issues)

      return { config, issues, path: configFile }
    }),
  )
}
