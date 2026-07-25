---
title: Walkthrough — conversation to colophon
nav: use
weight: 27
parent: use
description: How agent prompts become a document with an Innsigle colophon.
---

# Walkthrough: conversation → document → colophon

**Reader mode:** Start. **Feature:** FEAT-004.

This page is the story—not the raw JSON. Three human prompts go into agent
sessions (Claude and Codex in the fixture). Each session produces a markdown
page. The Innsigle skill builds **session provenance** and **proposes a colophon**
you can seal to the file bytes.

```text
Human prompts  →  agent writes markdown  →  journal + L2 provenance  →  colo.json
                                                              ↓
                                                    review · optional sign
```

---

## Step 1 — Human prompts

The operator types these (same sequence for each agent in the fixture):

<div class="story-convo" role="list">
<div class="story-bubble human" role="listitem">
<span class="story-who">You</span>
<p>Draft a short markdown page titled <strong>Sealed Notes</strong> explaining what an Innsigle colophon is in two paragraphs.</p>
</div>
<div class="story-bubble human" role="listitem">
<span class="story-who">You</span>
<p>Add a bullet list of three non-goals: no AI detection, no purity score, no claim of content truth.</p>
</div>
<div class="story-bubble human" role="listitem">
<span class="story-who">You</span>
<p>Tighten the opening sentence; keep model-primary honesty.</p>
</div>
</div>

Full list: [human-inputs.json](/examples/provenance/human-inputs.json).

---

## Step 2 — Agent writes the document

The model produces a markdown file (model-primary: the agent wrote the bytes).

<div class="story-bubble agent" role="listitem">
<span class="story-who">Claude (fixture)</span>
<p>Writes <code>sealed-notes-claude.md</code> — two paragraphs on the colophon, then the non-goals list.</p>
</div>

### The document (Claude session)

<div class="story-doc">
<p class="story-doc-title">Sealed Notes</p>
<p>An Innsigle colophon declares how a piece of work was made—composition and ingredients—not whether the prose is true or pure.</p>
<p>It lists models, tools, and human roles so readers can see how the piece was produced.</p>
<p class="story-doc-h">Non-goals</p>
<ul>
<li>No AI detection</li>
<li>No purity score</li>
<li>No claim of content truth</li>
</ul>
</div>

Codex produces a parallel page: [sealed-notes-codex.md](/examples/provenance/artifacts/sealed-notes-codex.md).  
Claude artifact: [sealed-notes-claude.md](/examples/provenance/artifacts/sealed-notes-claude.md).

---

## Step 3 — Skill captures the session

The harness records a **journal** (JSONL): each human prompt, assistant turn,
file write (`by: model`), tool/skill calls. That is not the colo yet—it is the
raw machine log.

<div class="story-flow" aria-hidden="true">
<span>journal.jsonl</span>
<span class="story-arrow">→</span>
<span>provenance build</span>
<span class="story-arrow">→</span>
<span>session-provenance.json (L2)</span>
<span class="story-arrow">→</span>
<span>propose-colo</span>
<span class="story-arrow">→</span>
<span>colo.json (L1)</span>
</div>

From the **merged** Claude + Codex journals the driver reports:

| Metric | Value |
|--------|--------|
| User prompts | 6 (3 per agent) |
| Assistant turns | 5 |
| Models | Claude, Codex |
| Composition suggestion | **model-primary** |

Rewrite tools (e.g. sloptimizer) appear as ingredients. They do **not** turn the
work into `human-authored`.

---

## Step 4 — Proposed colophon

This is what a reader (or claim) should show next to the document:

<div class="story-colo">
<p class="story-colo-head">Colophon · model-primary</p>
<table>
<thead><tr><th>Kind</th><th>Name</th><th>Role</th></tr></thead>
<tbody>
<tr><td>model</td><td>Claude</td><td>primary</td></tr>
<tr><td>model</td><td>Codex</td><td>primary</td></tr>
<tr><td>tool</td><td>innsigle-session</td><td>provenance-capture</td></tr>
<tr><td>tool</td><td>sloptimizer</td><td>rewrite</td></tr>
<tr><td>human</td><td>operator</td><td>prompter</td></tr>
</tbody>
</table>
<p class="note">session metrics: user_prompts=6; assistant_turns=5</p>
<p class="note">Linked provenance: <a href="/examples/provenance/session-provenance.json">session-provenance.json</a></p>
</div>

Machine form: [colo.json](/examples/provenance/colo.json).

---

## Step 5 — How it looks on a sealed page

Footer pattern (same idea as the [Sample](../../sample/) signed page):

<div class="story-footer-demo">
<img src="/assets/marks/innsigle-model.svg" width="48" height="48" alt="Innsigle model-primary seal" />
<span>
<strong>Innsigle</strong>
<span class="cue">The maker's seal · model-primary · Claude + Codex</span>
</span>
</div>

When you **sign**, the claim binds **content SHA-256** + this colo + absolute
issuer `key_url`. Verification checks the seal—not whether the prose is true.

---

## Reproduce

```bash
npm run test:provenance-driver
```

More on layers, CLI, and FR-4a: [Session provenance](../provenance/).  
Issuer without a server: [Issuer identity](../issuer/).

## Machine pack

| File | Role |
|------|------|
| [human-inputs.json](/examples/provenance/human-inputs.json) | Prompts |
| [session-claude.jsonl](/examples/provenance/session-claude.jsonl) | Claude journal |
| [session-codex.jsonl](/examples/provenance/session-codex.jsonl) | Codex journal |
| [session-provenance.json](/examples/provenance/session-provenance.json) | L2 |
| [colo.json](/examples/provenance/colo.json) | L1 colo |
