import { Data } from "effect"
import { Atom } from "effect/reactivity"

/** What is drawn over the view. One at a time; while open it owns the keys. */
export type Overlay = Data.TaggedEnum<{
  Palette: {}
  Confirm: {
    readonly title: string
    readonly message: string
    readonly confirm: string
    readonly run: () => void
  }
  Notice: { readonly title: string; readonly lines: ReadonlyArray<string> }
  Prompt: {
    readonly title: string
    readonly initial: string
    readonly submit: (value: string) => void
  }
}>

export const Overlay = Data.taggedEnum<Overlay>()

export const overlayAtom = Atom.make<Overlay | undefined>(undefined).pipe(
  Atom.keepAlive,
)

/** A short confirmation shown in the status line for a few seconds. */
export const flashAtom = Atom.make<string | undefined>(undefined).pipe(
  Atom.keepAlive,
)
