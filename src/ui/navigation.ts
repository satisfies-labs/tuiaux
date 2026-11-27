import { Data, Equal } from "effect"
import { Atom } from "effect/reactivity"

import { useAtom } from "@effect/atom-react"

import type { RunRef } from "../domain"

/** The screen on show. Lives in `ui` because views switch to each other. */
export type View = Data.TaggedEnum<{
  Dashboard: {}
  RunDetail: { readonly run: RunRef }
  Watch: { readonly run: RunRef }
}>

export const View = Data.taggedEnum<View>()

/** The view on show, the ones before it (newest last) and the last run opened, which the Run and Watch tabs reopen. */
export interface Navigation {
  readonly view: View
  readonly history: ReadonlyArray<View>
  readonly lastRun: RunRef | undefined
}

const HISTORY = 10

const runOf = (view: View): RunRef | undefined =>
  View.$match(view, {
    Dashboard: () => undefined,
    RunDetail: ({ run }) => run,
    Watch: ({ run }) => run,
  })

export const go = (nav: Navigation, view: View): Navigation =>
  Equal.equals(nav.view, view)
    ? nav
    : {
        view,
        history: [...nav.history, nav.view].slice(-HISTORY),
        lastRun: runOf(view) ?? nav.lastRun,
      }

export const back = (nav: Navigation): Navigation => ({
  ...nav,
  view: nav.history.at(-1) ?? View.Dashboard(),
  history: nav.history.slice(0, -1),
})

export const navigationAtom = Atom.make<Navigation>({
  view: View.Dashboard(),
  history: [],
  lastRun: undefined,
}).pipe(Atom.keepAlive)

export const useNavigation = () => {
  const [nav, setNav] = useAtom(navigationAtom)

  return {
    view: nav.view,
    lastRun: nav.lastRun,
    go: (view: View) => setNav(current => go(current, view)),
    back: () => setNav(back),
  }
}
