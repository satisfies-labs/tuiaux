# VHS tape for the README GIF — https://github.com/charmbracelet/vhs
# Run from the repo root (needs vhs, ttyd, ffmpeg): bun run demo:gif
Output docs/design/demo.gif

Require bun

Set Shell "bash"
Set FontFamily "Geist Mono, JetBrains Mono, monospace"
Set FontSize 15
Set Width 1400
Set Height 820
Set Padding 16
Set Theme "TokyoNight"
Set TypingSpeed 60ms

# Run the local sources as `tuiaux` without showing the setup.
Hide
Type 'alias tuiaux="bun run src/cli/index.ts"' Enter
Type "clear" Enter
Show

Type "tuiaux --demo --theme tokyo-night"
Sleep 400ms
Enter
Sleep 3s
Down
Sleep 1s
Down
Sleep 1s
Enter
Sleep 2.5s
Escape
Sleep 1s
Type "t"
Sleep 1.5s
Type "t"
Sleep 1.5s
Type "q"
Sleep 500ms
