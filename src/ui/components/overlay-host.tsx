import { useAtom } from "@effect/atom-react"
import { useKeyboard } from "@opentui/react"

import type { Command } from "../commands"
import { Overlay, overlayAtom } from "../overlay"
import { useTheme } from "../theme"
import { CommandPalette } from "./command-palette"
import { Dialog } from "./dialog"

const ConfirmDialog = ({
  overlay,
  close,
}: {
  readonly overlay: Extract<Overlay, { _tag: "Confirm" }>
  readonly close: () => void
}) => {
  const theme = useTheme()

  useKeyboard(key => {
    if (key.name === "y" || key.name === "return") {
      close()
      overlay.run()
    } else if (key.name === "n" || key.name === "escape") close()
  })

  return (
    <Dialog
      title={overlay.title}
      width={64}
      footer={[
        ["y", overlay.confirm],
        ["n", "cancel"],
      ]}
    >
      <text fg={theme.text}>{overlay.message}</text>
    </Dialog>
  )
}

const NoticeDialog = ({
  overlay,
  close,
}: {
  readonly overlay: Extract<Overlay, { _tag: "Notice" }>
  readonly close: () => void
}) => {
  const theme = useTheme()

  useKeyboard(key => {
    if (key.name === "escape" || key.name === "return") close()
  })

  return (
    <Dialog title={overlay.title} width={72} footer={[["escape", "close"]]}>
      {overlay.lines.map((line, index) => (
        <text
          key={`${index}-${line}`}
          fg={index === 0 ? theme.muted : theme.text}
        >
          {line}
        </text>
      ))}
    </Dialog>
  )
}

const PromptDialog = ({
  overlay,
  close,
}: {
  readonly overlay: Extract<Overlay, { _tag: "Prompt" }>
  readonly close: () => void
}) => {
  const theme = useTheme()
  useKeyboard(key => {
    if (key.name === "escape") close()
  })

  return (
    <Dialog
      title={overlay.title}
      width={56}
      footer={[
        ["return", "apply"],
        ["escape", "cancel"],
      ]}
    >
      <box flexDirection="row">
        <text fg={theme.accent}>{"› "}</text>
        <input
          focused
          flexGrow={1}
          value={overlay.initial}
          textColor={theme.text}
          focusedTextColor={theme.text}
          backgroundColor={theme.surface}
          focusedBackgroundColor={theme.surface}
          cursorColor={theme.accent}
          onSubmit={value => {
            close()
            overlay.submit(value)
          }}
        />
      </box>
    </Dialog>
  )
}

/** Draws the open overlay, if any. `commands` feeds the palette. */
export const OverlayHost = ({
  commands,
}: {
  readonly commands: ReadonlyArray<Command>
}) => {
  const [overlay, setOverlay] = useAtom(overlayAtom)
  const close = () => setOverlay(undefined)

  if (overlay === undefined) return null

  return Overlay.$match(overlay, {
    Palette: () => <CommandPalette commands={commands} close={close} />,
    Confirm: confirm => <ConfirmDialog overlay={confirm} close={close} />,
    Notice: notice => <NoticeDialog overlay={notice} close={close} />,
    Prompt: prompt => <PromptDialog overlay={prompt} close={close} />,
  })
}
