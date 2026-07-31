# VHS: narrated Hugo × Innsigle walkthrough
# Pacing is owned by THIS tape (typed narration + sleeps), not a dump script.
# Prep: bash scripts/prepare-hugo-demo.sh  (init + hugo only)
# Record: bash scripts/record-hugo-walkthrough.sh

Output docs/website/static/captures/walkthrough-hugo.gif
Output docs/website/static/captures/walkthrough-hugo.mp4

Set Shell bash
Set FontSize 17
Set Width 1280
Set Height 720
Set Theme "Catppuccin Mocha"
Set Padding 20
Set Framerate 24
Set PlaybackSpeed 1.0
Set TypingSpeed 40ms

Hide
Type "export PATH=/tmp/innsigle-hugo-demo/bin:$PATH"
Enter
Type "cd /tmp/innsigle-hugo-demo"
Enter
Type "clear"
Enter
Sleep 500ms
Show

# ── TITLE ─────────────────────────────────────────────────────────
Set TypingSpeed 45ms
Type "echo"
Enter
Type "echo '  Innsigle × Hugo'"
Enter
Sleep 1.2s
Type "echo '  Seal a static homepage with a house key in 1Password.'"
Enter
Sleep 2.5s
Type "echo '  After one-time init, daily commands stay short.'"
Enter
Sleep 2.5s
Type "echo"
Enter
Sleep 800ms

# ── STEP 1: one-time init (already prepared; show result) ─────────
Type "echo '━━ 1/4  One-time setup (already done here)  ━━'"
Enter
Sleep 1.5s
Type "echo '    innsigle init --onepassword --site-url https://yoursite.example'"
Enter
Sleep 2.2s
Type "echo '    → private key in 1Password'"
Enter
Sleep 1.8s
Type "echo '    → public material under .innsigle/  (commit this)'"
Enter
Sleep 2s
Type "echo"
Enter
Type "ls -la .innsigle/"
Enter
Sleep 3.5s
Type "echo"
Enter
Type "echo 'Issuer + op:// ref (no secrets in git):'"
Enter
Sleep 1.5s
Type "sed -n '1,20p' .innsigle/config.json"
Enter
Sleep 5s
Type "clear"
Enter
Sleep 600ms

# ── STEP 2: publish wire ──────────────────────────────────────────
Type "echo '━━ 2/4  Wire into your site build  ━━'"
Enter
Sleep 1.5s
Type "echo '    Innsigle does not learn Hugo/Quarto/Next.'"
Enter
Sleep 2s
Type "echo '    Your build copies:  .innsigle/public/  →  /.well-known/innsigle/'"
Enter
Sleep 2.8s
Type "echo"
Enter
Type "ls static/.well-known/innsigle/"
Enter
Sleep 3s
Type "echo '    (Hugo already copied static/ → public/ for this demo)'"
Enter
Sleep 2.5s
Type "clear"
Enter
Sleep 600ms

# ── STEP 3: seal ──────────────────────────────────────────────────
Type "echo '━━ 3/4  Seal the built page  ━━'"
Enter
Sleep 1.5s
Type "echo '    Config + 1Password supply issuer and the private key.'"
Enter
Sleep 2.2s
Type "echo"
Enter
Set TypingSpeed 55ms
Type "innsigle seal public/index.html"
Enter
# seal is fast; hold so viewers can read ok: lines
Sleep 5s
Set TypingSpeed 40ms
Type "echo"
Enter
Type "ls .innsigle/public/claims/"
Enter
Sleep 3s
Type "clear"
Enter
Sleep 600ms

# ── STEP 4: verify ────────────────────────────────────────────────
Type "echo '━━ 4/4  Verify  ━━'"
Enter
Sleep 1.5s
Type "echo '    Short form finds att + keys from .innsigle/ or public/.well-known/'"
Enter
Sleep 2.5s
Type "echo"
Enter
Set TypingSpeed 55ms
Type "innsigle verify public/index.html"
Enter
Sleep 5s
Set TypingSpeed 40ms
Type "echo"
Enter
Sleep 1s

# ── CLOSE ─────────────────────────────────────────────────────────
Type "echo '━━ Recap  ━━'"
Enter
Sleep 1.2s
Type "echo '  init once   →  .innsigle/ + 1Password'"
Enter
Sleep 2s
Type "echo '  build wire  →  copy .innsigle/public to site well-known'"
Enter
Sleep 2s
Type "echo '  innsigle seal   <page>'"
Enter
Sleep 2s
Type "echo '  innsigle verify <page>   →  VALID'"
Enter
Sleep 2.5s
Type "echo"
Enter
Type "echo '  Docs: documentdrivendx.github.io/innsigle/use/walkthrough-hugo/'"
Enter
Sleep 5s
