# VHS tape: Hugo + Innsigle workflow screencast
# Render: bash scripts/record-hugo-walkthrough.sh
# Docs: https://github.com/charmbracelet/vhs

Output docs/website/static/captures/walkthrough-hugo.gif
Output docs/website/static/captures/walkthrough-hugo.mp4

Set Shell bash
Set FontSize 15
Set Width 1280
Set Height 720
Set TypingSpeed 18ms
Set Theme "Catppuccin Mocha"
Set Padding 16
Set Framerate 24
Set PlaybackSpeed 1.0

# Run from repo root: bash scripts/record-hugo-walkthrough.sh
Hide
Type "clear"
Enter
Sleep 300ms
Show

Type "# Seal a trivial Hugo site with Innsigle"
Enter
Sleep 600ms

Type "bash scripts/demo-hugo-innsigle.sh"
Enter
# Workflow includes hugo build + sign; allow wall time
Sleep 25s

Type "echo"
Enter
Type "# Public keys + attestation under Hugo public/"
Enter
Sleep 400ms
Type "ls -la /tmp/innsigle-hugo-demo/public/.well-known/innsigle/"
Enter
Sleep 1500ms
Type "ls -la /tmp/innsigle-hugo-demo/public/.well-known/innsigle/claims/"
Enter
Sleep 1500ms

Type "# Verify again"
Enter
Sleep 300ms
Type "node src/cli.mjs verify --attestation /tmp/innsigle-hugo-demo/public/.well-known/innsigle/claims/index.attestation.json --content /tmp/innsigle-hugo-demo/public/index.html --keys /tmp/innsigle-hugo-demo/public/.well-known/innsigle/keys.json"
Enter
Sleep 2s

Type "# Agent publish rule: .innsigle/public → site /.well-known/innsigle/"
Enter
Sleep 1200ms
Type "head -20 /tmp/innsigle-hugo-demo/.innsigle/AGENTS.md"
Enter
Sleep 3s

Sleep 1s
