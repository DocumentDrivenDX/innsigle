--[[
Innsigle Colophon Filter for Quarto

Appends a colophon footer to any document covered by a verified Innsigle
claim in .innsigle/public/claims/. A claim matches when one of its
subjects' URIs ends with the document's project-relative source path AND
the subject's sha256 digest matches the current source bytes. A matching
URI with a stale digest produces a render warning and no footer, so an
edited-but-not-resealed post never displays a seal that fails
verification. Re-run `innsigle seal <source>` after editing.

Claim filenames follow the canonical slug contract shared with
`innsigle seal` (PLAN-001 A1): the project-relative source path with
every run of non-alphanumeric characters collapsed to "-", plus
".attestation.json" (posts/hello/index.qmd →
posts-hello-index-qmd.attestation.json). The slug-named claim is checked
first; the remaining *.json files in the claims directory are scanned as
a fallback so legacy basename-named attestations keep working.

The attestation link points at /.well-known/innsigle/claims/<file>, which
the publish-innsigle post-render script copies into every rendered site.
--]]

local CLAIMS_DIR = ".innsigle/public/claims"

local function read_file(path)
  local f = io.open(path, "rb")
  if not f then
    return nil
  end
  local data = f:read("a")
  f:close()
  return data
end

-- sha256 via openssl (present on macOS and typical Linux hosts); pandoc's
-- Lua only ships sha1. Returns lowercase hex or nil.
local function sha256_hex(data)
  local ok, out = pcall(pandoc.pipe, "openssl", { "dgst", "-sha256" }, data)
  if not ok or not out then
    return nil
  end
  -- openssl prints "SHA2-256(stdin)= <hex>" (or "(stdin)= <hex>" on LibreSSL)
  return out:match("(%x+)%s*$")
end

local function warn(msg)
  io.stderr:write("WARNING (innsigle.lua): " .. msg .. "\n")
end

-- Canonical attestation filename for a project-relative source path
-- (PLAN-001 A1): non-alphanumeric runs → "-".
local function attestation_slug(rel)
  return (rel:gsub("[^%w]+", "-")) .. ".attestation.json"
end

-- True when the URI's path component equals "/<rel>" exactly. A suffix
-- match is not enough: the site homepage index.qmd would collide with any
-- post's index.qmd.
local function uri_matches(uri, rel)
  local path = uri:match("^%a[%w+.-]*://[^/]*(/.*)$")
  return path == "/" .. rel
end

local function html_escape(s)
  return (tostring(s):gsub("[&<>\"]", {
    ["&"] = "&amp;",
    ["<"] = "&lt;",
    [">"] = "&gt;",
    ["\""] = "&quot;",
  }))
end

local function truncate_middle(s, keep)
  if not s or #s <= keep * 2 + 1 then
    return s or ""
  end
  return s:sub(1, keep) .. "…" .. s:sub(-keep)
end

-- A small stamp-like seal mark: solid outer ring, perforated inner ring,
-- check. Inherits text color so it stays subtle in the muted footer.
local SEAL_GLYPH = [[<svg class="innsigle-glyph" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 1.6"/><path d="M8.2 12.4l2.4 2.4 5-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>]]

-- Seal watermark plus an expandable attestation viewer. The attestation
-- JSON is embedded at render time so the viewer needs no fetch (and works
-- on sites behind an auth proxy). <details>/<summary> keeps it usable
-- without JS, on touch screens, and via keyboard; hover only highlights
-- the seal.
local function colophon_block(claim, raw_json, claim_file, subject)
  local payload = claim.payload or {}
  local colo = payload.colophon or {}
  local issuer = payload.issuer or {}
  local sig = (claim.signatures or {})[1] or {}
  local digest = subject.digest or {}

  local composition = html_escape(colo.composition or "unknown")
  local issuer_name = html_escape(issuer.name or "unknown issuer")

  -- Declared human-input measure (CONTRACT-001 v1.1): colophon chrome text
  -- only — a maker declaration from the session journal, never a detection
  -- score, and never a new seal cue (COLO-05).
  local hi = colo.human_input
  local hi_pct = nil
  if type(hi) == "table" and type(hi.percent) == "number" then
    hi_pct = string.format("%d", hi.percent)
  end
  local seal_class = hi_pct and "innsigle-seal innsigle-seal--hi" or "innsigle-seal"
  local summary_extra = hi_pct
      and (' \194\183 <strong>' .. hi_pct .. '% human input</strong>')
    or ""
  local hi_row = ""
  if hi_pct then
    local function sub_pct(x)
      if type(x) == "table" and type(x.percent) == "number" then
        return string.format("%d%%", x.percent)
      end
      return "\226\128\147"
    end
    hi_row = '<dt>Human input</dt><dd>' .. hi_pct .. '% \226\128\148 direction '
      .. sub_pct(hi.direction) .. ' \194\183 contribution ' .. sub_pct(hi.contribution)
      .. ' \194\183 review ' .. sub_pct(hi.review)
      .. ' (method ' .. html_escape(tostring(hi.method or "?"))
      .. ', declared from the maker&#39;s session journal)</dd>'
  end
  local att_href = "/.well-known/innsigle/claims/" .. claim_file
  local keys_href = html_escape(issuer.key_url or "/.well-known/innsigle/keys.json")

  local html = table.concat({
    '<div class="innsigle-colophon">',
    '<details class="', seal_class, '">',
    '<summary title="View Innsigle attestation">',
    SEAL_GLYPH,
    '<span>Innsigle seal: <strong>', composition, '</strong>', summary_extra, ' by ', issuer_name, '</span>',
    '</summary>',
    '<div class="innsigle-viewer">',
    '<dl>',
    '<dt>Composition</dt><dd>', composition, '</dd>',
    hi_row,
    '<dt>Issuer</dt><dd>', issuer_name, ' <code>', html_escape(issuer.id or ""), '</code></dd>',
    '<dt>Signing key</dt><dd><a href="', keys_href, '"><code>',
    html_escape(truncate_middle(issuer.key_id or "", 12)), '</code></a></dd>',
    '<dt>Signed</dt><dd>', html_escape(sig.signed_at or payload.issued_at or "unknown"), '</dd>',
    '<dt>Content digest</dt><dd><code>', html_escape(digest.alg or ""), ":",
    html_escape(truncate_middle(digest.value or "", 8)), '</code></dd>',
    '</dl>',
    '<details class="innsigle-raw"><summary>Raw attestation JSON</summary>',
    '<pre>', html_escape(raw_json), '</pre></details>',
    '<p class="innsigle-links"><a href="', att_href, '">attestation file</a> · ',
    '<a href="', keys_href, '">issuer keys</a></p>',
    '</div>',
    '</details>',
    '</div>',
  })

  return pandoc.RawBlock("html", html)
end

-- Try one claim file. Returns the modified doc when the claim covers
-- `rel` with a fresh digest; nil otherwise (warning on digest drift).
local function try_claim(doc, claims_dir, name, rel, input)
  local raw = read_file(pandoc.path.join({ claims_dir, name }))
  local parsed, claim = pcall(quarto.json.decode, raw or "")
  local payload = parsed and claim and claim.payload or nil
  for _, subject in ipairs(payload and payload.subjects or {}) do
    if uri_matches(subject.uri or "", rel) then
      local digest = subject.digest or {}
      if digest.alg ~= "sha256" then
        warn(rel .. ": claim " .. name .. " uses unsupported digest alg '"
          .. tostring(digest.alg) .. "'; no colophon rendered")
      elseif sha256_hex(read_file(input)) ~= digest.value then
        warn(rel .. ": source bytes no longer match claim " .. name
          .. " (edited since sealing?); re-run `innsigle seal` "
          .. "-- no colophon rendered")
      else
        doc.blocks:insert(colophon_block(claim, raw, name, subject))
        return doc
      end
    end
  end
  return nil
end

function Pandoc(doc)
  if not quarto.doc.is_format("html") then
    return nil
  end

  local project_dir = quarto.project.directory
  local input = quarto.doc.input_file
  if not project_dir or not input then
    return nil
  end

  local rel = pandoc.path.make_relative(input, project_dir)
  local claims_dir = pandoc.path.join({ project_dir, CLAIMS_DIR })
  local ok, entries = pcall(pandoc.system.list_directory, claims_dir)
  if not ok then
    return nil
  end

  -- Canonical slug name first (PLAN-001 A1), then everything else so
  -- legacy basename-named attestations still match by subject URI.
  local slug = attestation_slug(rel)
  local ordered = {}
  for _, name in ipairs(entries) do
    if name == slug then
      table.insert(ordered, 1, name)
    elseif name:match("%.attestation%.json$") or
        (name:match("%.json$") and not name:match("%.claim%.json$")) then
      table.insert(ordered, name)
    end
  end

  for _, name in ipairs(ordered) do
    local sealed = try_claim(doc, claims_dir, name, rel, input)
    if sealed then
      return sealed
    end
  end

  return nil
end
