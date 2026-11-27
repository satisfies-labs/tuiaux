import { Data } from "effect"
import { Atom } from "effect/reactivity"

import type { RunRef } from "../domain"

/** The screen on show. Lives in `ui` because views switch to each other. */
export type View = Data.TaggedEnum<{
  Dashboard: {}
  RunDetail: { readonly run: RunRef }
  Watch: { readonly run: RunRef }
}>

export const View = Data.taggedEnum<View>()

export const viewAtom = Atom.make<View>(View.Dashboard()).pipe(Atom.keepAlive)
