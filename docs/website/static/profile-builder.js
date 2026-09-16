/**
 * Browser builder for maker profiles. Imports the isomorphic src/profile.mjs
 * copied to /assets/js/profile.mjs at site build.
 */
import {
  addWork,
  bioCard,
  emptyProfile,
  footerLine,
  INTEGRITY_LINE,
  nowIso,
  ProfileError,
  renderProfileHtml,
  UNSIGNED_LABEL,
  validateProfile,
} from "./profile.mjs";

const root = document.getElementById("innsigle-profile-builder");
if (root) {
  mount(root);
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function mount(root) {
  root.innerHTML = "";
  const form = el(`<form class="pb-form" novalidate>
    <fieldset>
      <legend>You</legend>
      <p>
        <label for="pb-name">Name</label>
        <input id="pb-name" name="name" required autocomplete="name" />
      </p>
      <p>
        <label for="pb-id">Profile id</label>
        <input id="pb-id" name="id" required pattern="[a-z][a-z0-9-]{0,63}" placeholder="ada" />
      </p>
      <p>
        <label for="pb-bio">Bio (optional)</label>
        <input id="pb-bio" name="bio" maxlength="280" />
      </p>
      <p>
        <label for="pb-url">Published profile URL (optional)</label>
        <input id="pb-url" name="profile_url" type="url" placeholder="https://you.github.io/innsigle/" />
      </p>
    </fieldset>
    <fieldset>
      <legend>Links</legend>
      <div id="pb-links"></div>
      <button type="button" id="pb-add-link">Add link</button>
    </fieldset>
    <fieldset>
      <legend>Add a work (plain seal)</legend>
      <p>
        <label for="pb-title">Work title</label>
        <input id="pb-title" name="title" />
      </p>
      <p>
        <label for="pb-work-url">Work URL (Docs, slides, mail archive)</label>
        <input id="pb-work-url" name="work_url" type="url" placeholder="https://docs.google.com/…" />
      </p>
      <fieldset class="pb-kind">
        <legend>Composition</legend>
        <label><input type="radio" name="kind" value="mixed" checked /> mixed</label>
        <label><input type="radio" name="kind" value="human-authored" /> human-authored</label>
        <label><input type="radio" name="kind" value="model-primary" /> model-primary</label>
      </fieldset>
      <p>
        <label for="pb-model">Named model (optional)</label>
        <input id="pb-model" name="model" placeholder="Claude" />
      </p>
      <p>
        <label for="pb-notes">Notes (optional)</label>
        <input id="pb-notes" name="notes" />
      </p>
      <button type="button" id="pb-add-work">Add this work</button>
      <p id="pb-work-error" class="pb-error" hidden></p>
    </fieldset>
    <fieldset>
      <legend>Works on this profile</legend>
      <ul id="pb-works" class="pb-works"></ul>
    </fieldset>
    <fieldset>
      <legend>Copy and download</legend>
      <p class="pb-hint">Unsigned declaration. Recipients do not run verify. Put the bio card in X, LinkedIn, or Slack.</p>
      <label for="pb-bio-card">Bio card</label>
      <pre id="pb-bio-card" class="pb-pre"></pre>
      <label for="pb-footer">Footer line (last work)</label>
      <pre id="pb-footer" class="pb-pre"></pre>
      <p class="pb-actions">
        <button type="button" id="pb-dl-json">Download profile.json</button>
        <button type="button" id="pb-dl-html">Download index.html</button>
      </p>
    </fieldset>
    <p class="pb-integrity">${escapeText(INTEGRITY_LINE)}</p>
  </form>`);

  const previewWrap = el(`<div class="pb-preview-wrap">
    <p class="pb-label">Preview</p>
    <iframe id="profile-preview" title="Profile preview" sandbox></iframe>
  </div>`);

  root.append(form, previewWrap);

  const state = {
    links: [],
    works: [],
  };

  form.querySelector("#pb-add-link").addEventListener("click", () => {
    state.links.push({ label: "", url: "" });
    renderLinks();
    refresh();
  });
  form.querySelector("#pb-add-work").addEventListener("click", () => {
    addWorkFromForm();
  });
  form.querySelector("#pb-dl-json").addEventListener("click", () => download("innsigle-profile.json", jsonBlob(), "application/json"));
  form.querySelector("#pb-dl-html").addEventListener("click", async () => {
    const html = await renderHtml({ inline: true });
    download("index.html", html, "text/html");
  });
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);

  function renderLinks() {
    const box = form.querySelector("#pb-links");
    box.innerHTML = "";
    state.links.forEach((link, i) => {
      const row = el(`<p class="pb-row">
        <label>Link label <input data-link="${i}" data-k="label" value="${escapeAttr(link.label)}" /></label>
        <label>URL <input data-link="${i}" data-k="url" type="url" value="${escapeAttr(link.url)}" /></label>
        <button type="button" data-del-link="${i}">Remove</button>
      </p>`);
      box.append(row);
    });
    box.querySelectorAll("[data-link]").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.getAttribute("data-link"));
        state.links[i][input.getAttribute("data-k")] = input.value;
        refresh();
      });
    });
    box.querySelectorAll("[data-del-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.links.splice(Number(btn.getAttribute("data-del-link")), 1);
        renderLinks();
        refresh();
      });
    });
  }

  function renderWorks() {
    const box = form.querySelector("#pb-works");
    box.innerHTML = "";
    const profile = tryProfile();
    state.works.forEach((w, i) => {
      const line = profile ? footerLine(profile, w.slug) : w.title;
      const li = el(`<li>
        <strong>${escapeText(w.title)}</strong>
        <span> · ${escapeText(w.colophon.composition)} · ${UNSIGNED_LABEL}</span>
        <code>${escapeText(line)}</code>
        <button type="button" data-del-work="${i}">Remove</button>
      </li>`);
      box.append(li);
    });
    box.querySelectorAll("[data-del-work]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.works.splice(Number(btn.getAttribute("data-del-work")), 1);
        refresh();
      });
    });
  }

  function addWorkFromForm() {
    const err = form.querySelector("#pb-work-error");
    err.hidden = true;
    err.textContent = "";
    const title = form.querySelector("#pb-title").value.trim();
    if (!title) {
      err.hidden = false;
      err.textContent = "Work title is required.";
      return;
    }
    try {
      const draft = currentDraft();
      const next = addWork(draft, {
        title,
        url: form.querySelector("#pb-work-url").value.trim() || undefined,
        composition: form.querySelector("input[name=kind]:checked").value,
        model: form.querySelector("#pb-model").value.trim() || undefined,
        notes: form.querySelector("#pb-notes").value.trim() || undefined,
      });
      state.works = next.works;
      form.querySelector("#pb-title").value = "";
      form.querySelector("#pb-work-url").value = "";
      form.querySelector("#pb-model").value = "";
      form.querySelector("#pb-notes").value = "";
      refresh();
    } catch (e) {
      err.hidden = false;
      err.textContent = e instanceof ProfileError ? e.message : String(e.message || e);
    }
  }

  function currentDraft() {
    const id = form.querySelector("#pb-id").value.trim() || "maker";
    const name = form.querySelector("#pb-name").value.trim() || "Maker";
    const bio = form.querySelector("#pb-bio").value.trim();
    const profile_url = form.querySelector("#pb-url").value.trim();
    const links = state.links.filter((l) => l.label.trim() && l.url.trim());
    return {
      innsigle_profile: "1",
      id,
      name,
      ...(bio ? { bio } : {}),
      ...(profile_url ? { profile_url } : {}),
      links,
      issuer: null,
      works: state.works,
      generated_at: nowIso(),
    };
  }

  function tryProfile() {
    try {
      return validateProfile(currentDraft());
    } catch {
      return null;
    }
  }

  function jsonBlob() {
    const p = tryProfile();
    if (!p) return JSON.stringify(currentDraft(), null, 2) + "\n";
    return JSON.stringify(p, null, 2) + "\n";
  }

  async function renderHtml({ inline }) {
    let p = tryProfile();
    if (!p) {
      try {
        p = emptyProfile({
          id: form.querySelector("#pb-id").value.trim() || "maker",
          name: form.querySelector("#pb-name").value.trim() || "Maker",
        });
      } catch {
        p = emptyProfile({ id: "maker", name: "Maker" });
      }
    }
    let inlineMarks;
    if (inline) {
      inlineMarks = await fetchMarks();
    }
    const markHrefPrefix = new URL("../marks/", import.meta.url).href;
    return renderProfileHtml(p, inlineMarks ? { inlineMarks } : { markHrefPrefix });
  }

  async function fetchMarks() {
    const base = new URL("../marks/", import.meta.url);
    const keys = ["base", "human", "mixed", "model"];
    const out = {};
    await Promise.all(
      keys.map(async (k) => {
        const res = await fetch(new URL(`innsigle-${k}.svg`, base));
        if (res.ok) out[k] = await res.text();
      }),
    );
    return out;
  }

  async function refresh() {
    renderWorks();
    const p = tryProfile();
    const bioEl = form.querySelector("#pb-bio-card");
    const footEl = form.querySelector("#pb-footer");
    if (p) {
      bioEl.textContent = bioCard(p);
      const last = p.works[p.works.length - 1];
      footEl.textContent = last ? footerLine(p, last.slug) : "(add a work)";
    } else {
      bioEl.textContent = "(fill in name and id)";
      footEl.textContent = "(add a work)";
    }
    const iframe = previewWrap.querySelector("#profile-preview");
    iframe.srcdoc = await renderHtml({ inline: true });
  }

  renderLinks();
  refresh();
}

function download(filename, body, type) {
  const blob = new Blob([body], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeText(s).replace(/"/g, "&quot;");
}
