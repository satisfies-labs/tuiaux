# VHS tape for the README GIF — https://github.com/charmbracelet/vhs
# Run from the repo root (needs vhs, ttyd, ffmpeg, and `gh auth login`): vhs docs/demo.tape
# There is no demo mode: it records a real repo with busy CI, through a throwaway checkout of its remote.
Output docs/design/demo.gif

Require bun
Require gh

Set Shell "bash"
Set FontFamily "Geist Mono, JetBrains Mono, monospace"
Set FontSize 15
Set Width 1400
Set Height 820
Set Padding 16
Set Theme "TokyoNight"
Set TypingSpeed 60ms

# Run the local sources as `tuiaux`, inside an empty repo pointing at a busy remote.
Hide
Type `alias tuiaux="bun run $PWD/src/main.ts"` Enter
Type "cd $(mktemp -d) && git init -q && git remote add origin https://github.com/Effect-TS/effect.git" Enter
Type "clear" Enter
Show

Type "tuiaux"
Sleep 400ms
Enter
Sleep 4s
Tab
Sleep 1s
Down
Sleep 1s
Enter
Sleep 3s
Type "w"
Sleep 3s
Escape
Sleep 1s
Type "?"
Sleep 2s
Escape
Sleep 1s
Type "q"
Sleep 500ms
