import { z } from "zod";

const color = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|default|ansi:(1[0-5]|[0-9]))$/, 'expected "#rrggbb", "default" or "ansi:0..15"');

export const TOKENS = [
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
] as const;
export type ColorToken = (typeof TOKENS)[number];

const repoEntry = z.union([
  z.string().min(3), // "github:owner/name" | "gitlab:group/project" | "gitlab.example.org:group/project"
  z.object({
    provider: z.enum(["github", "gitlab"]),
    path: z.string().min(3),
    host: z.string().optional(),
    branch: z.string().optional(),
  }),
]);

export const configSchema = z
  .object({
    theme: z
      .object({
        name: z.string().default("terminal"),
        colors: z.partialRecord(z.enum(TOKENS), color).default({}),
      })
      .default({ name: "terminal", colors: {} }),
    refresh: z
      .object({
        /** Seconds between polls while something is running. */
        active: z.number().min(2).max(300).default(5),
        /** Seconds between polls when everything is settled. */
        idle: z.number().min(5).max(3600).default(30),
      })
      .default({ active: 5, idle: 30 }),
    notifications: z
      .object({
        enabled: z.boolean().default(true),
        bell: z.boolean().default(true),
        /** Notify only on these transitions. */
        on: z.array(z.enum(["failure", "success", "recovered"])).default(["failure", "recovered"]),
      })
      .default({ enabled: true, bell: true, on: ["failure", "recovered"] }),
    github: z
      .object({
        host: z.string().default("github.com"),
        token_command: z.string().optional(),
      })
      .default({ host: "github.com" }),
    gitlab: z
      .object({
        host: z.string().default("gitlab.com"),
        token_command: z.string().optional(),
      })
      .default({ host: "gitlab.com" }),
    /** Repos for the multi-repo dashboard. Empty → current git repo only. */
    repos: z.array(repoEntry).default([]),
  })
  .strict();

export type Config = z.infer<typeof configSchema>;
export type RepoEntry = z.infer<typeof repoEntry>;
