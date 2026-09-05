import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { defaultTranscriptDir, historicalPaths, sessionTouchesFile } from "../src/provenance/sync.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fixture = join(root, "tests/fixtures/provenance/claude-code-transcript.jsonl");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", ...opts });
}

/** Minimal one-prompt session transcript touching `path` with `model`. */
function makeTranscript({ sessionId, model, path, hour }) {
  const t = (s) => `2026-09-03T${hour}:00:${s}.000Z`;
  return (
    [
      JSON.stringify({
        type: "user",
        sessionId,
        cwd: "/home/user/projects/demo-site",
        message: { role: "user", content: "Another editing pass please" },
        uuid: `${sessionId}-u1`,
        timestamp: t("00"),
      }),
      JSON.stringify({
        type: "assistant",
        sessionId,
        message: {
          id: `msg_${sessionId}`,
          role: "assistant",
          model,
          content: [
            { type: "text", text: "Editing now." },
            {
              type: "tool_use",
              id: `${sessionId}-t1`,
              name: "Edit",
              input: { file_path: path, old_string: "a", new_string: "b" },
            },
          ],
        },
        timestamp: t("05"),
      }),
    ].join("\n") + "\n"
  );
}

/**
 * Repo with content file + transcript dir holding:
 * - the golden fixture session (relative path posts/demo/index.qmd, claude-opus-5)
 * - a second session touching the same file via its absolute path under the
 *   repo root (claude-fable-5)
 * - an unrelated session touching another file (must be excluded)
 */
function setupSyncRepo(name) {
  const repo = mkdtempSync(join(tmpdir(), `innsigle-sync-${name}-`));
  mkdirSync(join(repo, "posts/demo"), { recursive: true });
  writeFileSync(join(repo, "posts/demo/index.qmd"), "# demo post\n\nsealed by test\n");
  const tdir = join(repo, "transcripts");
  mkdirSync(tdir);
  copyFileSync(fixture, join(tdir, "session-one.jsonl"));
  writeFileSync(
    join(tdir, "session-two.jsonl"),
    makeTranscript({
      sessionId: "22222222-2222-4222-8222-222222222222",
      model: "claude-fable-5",
      path: join(repo, "posts/demo/index.qmd"),
      hour: "11",
    }),
  );
  writeFileSync(
    join(tdir, "session-unrelated.jsonl"),
    makeTranscript({
      sessionId: "33333333-3333-4333-8333-333333333333",
      model: "claude-other-model",
      path: "notes/other.md",
      hour: "12",
    }),
  );
  return { repo, tdir };
}

describe("provenance sync (PLAN-001 B2)", () => {
  it("derives the default transcript dir from the cwd (every / → -)", () => {
    assert.equal(
      defaultTranscriptDir("/home/erik/Projects/aibadge"),
      join(homedir(), ".claude", "projects", "-home-erik-Projects-aibadge"),
    );
  });

  it("escapes every non-alphanumeric character like Claude Code does (F3/F10)", () => {
    // dots, underscores, and spaces become "-" too — not only slashes
    assert.equal(
      defaultTranscriptDir("/home/erik/my.site"),
      join(homedir(), ".claude", "projects", "-home-erik-my-site"),
    );
    assert.equal(
      defaultTranscriptDir("/home/erik/.cache/ddx"),
      join(homedir(), ".claude", "projects", "-home-erik--cache-ddx"),
    );
    assert.equal(
      defaultTranscriptDir("/home/e_u/a b"),
      join(homedir(), ".claude", "projects", "-home-e-u-a-b"),
    );
  });

  it("matches event paths exactly against the repo root, redacted form included (F2)", () => {
    const ev = (path) => [{ type: "file_write", path }];
    const root = "/home/erik/proj";
    assert.ok(sessionTouchesFile(ev("docs/a.md"), "docs/a.md", root));
    assert.ok(sessionTouchesFile(ev("/home/erik/proj/docs/a.md"), "docs/a.md", root));
    // imported events pass through redactEvents, so the redacted root matches too
    assert.ok(sessionTouchesFile(ev("/home/[REDACTED]/proj/docs/a.md"), "docs/a.md", root));
    // a deeper same-named file (mirror tree) must never match
    assert.ok(!sessionTouchesFile(ev("/home/erik/proj/site/docs/a.md"), "docs/a.md", root));
    assert.ok(!sessionTouchesFile(ev("site/docs/a.md"), "docs/a.md", root));
    // an equal-tail path under a different root must never match
    assert.ok(!sessionTouchesFile(ev("/other/root/docs/a.md"), "docs/a.md", root));
  });

  it("two transcripts touching one file merge into one L2 with both models", () => {
    const { repo, tdir } = setupSyncRepo("merge");
    const r = run(["provenance", "sync", "posts/demo/index.qmd", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /ok: synced 2 session\(s\)/);

    const l2Path = join(repo, ".innsigle/provenance/posts-demo-index-qmd.l2.json");
    assert.ok(existsSync(l2Path), "L2 written under .innsigle/provenance/");
    const l2 = JSON.parse(readFileSync(l2Path, "utf8"));
    assert.equal(l2.kind, "session");
    const models = l2.models.map((m) => m.name).sort();
    assert.deepEqual(models, ["claude-fable-5", "claude-opus-5"]);
    // fixture has 3 user prompts, second session adds 1; unrelated is excluded
    assert.equal(l2.metrics.user_prompts, 4);
    assert.equal(l2.metrics.files_touched, 1);
    assert.equal(l2.artifacts.length, 1);
    assert.ok(l2.artifacts[0].path.endsWith("posts/demo/index.qmd"));
    assert.equal(l2.artifacts[0].by, "model");
    // excluded model never appears
    assert.ok(!models.includes("claude-other-model"));
    rmSync(repo, { recursive: true, force: true });
  });

  it("re-sync after a new session folds it into the same L2 (accumulation)", () => {
    const { repo, tdir } = setupSyncRepo("accum");
    let r = run(["provenance", "sync", "posts/demo/index.qmd", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.equal(r.status, 0, r.stderr);
    const l2Path = join(repo, ".innsigle/provenance/posts-demo-index-qmd.l2.json");
    let l2 = JSON.parse(readFileSync(l2Path, "utf8"));
    assert.equal(l2.metrics.user_prompts, 4);
    assert.equal(l2.models.length, 2);

    // more conversation lands as a new session touching the same file
    writeFileSync(
      join(tdir, "session-three.jsonl"),
      makeTranscript({
        sessionId: "44444444-4444-4444-8444-444444444444",
        model: "claude-haiku-x",
        path: "posts/demo/index.qmd",
        hour: "13",
      }),
    );
    r = run(["provenance", "sync", "posts/demo/index.qmd", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: synced 3 session\(s\)/);
    l2 = JSON.parse(readFileSync(l2Path, "utf8"));
    assert.equal(l2.metrics.user_prompts, 5);
    assert.deepEqual(
      l2.models.map((m) => m.name).sort(),
      ["claude-fable-5", "claude-haiku-x", "claude-opus-5"],
    );
    rmSync(repo, { recursive: true, force: true });
  });

  it("--out overrides the L2 path", () => {
    const { repo, tdir } = setupSyncRepo("out");
    const out = join(repo, "custom.l2.json");
    const r = run(
      ["provenance", "sync", "posts/demo/index.qmd", "--transcript-dir", tdir, "--out", out],
      { cwd: repo },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(out));
    assert.equal(
      existsSync(join(repo, ".innsigle/provenance/posts-demo-index-qmd.l2.json")),
      false,
    );
    rmSync(repo, { recursive: true, force: true });
  });

  it("no sessions touching the file → INVALID, nonzero exit, no L2", () => {
    const { repo, tdir } = setupSyncRepo("none");
    writeFileSync(join(repo, "README.md"), "# untouched\n");
    const r = run(["provenance", "sync", "README.md", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /INVALID: no Claude Code sessions touching README\.md/);
    assert.equal(existsSync(join(repo, ".innsigle/provenance/README-md.l2.json")), false);
    rmSync(repo, { recursive: true, force: true });
  });

  it("a mirror-tree write (site/docs/index.md) never matches docs/index.md (F2)", () => {
    const repo = mkdtempSync(join(tmpdir(), "innsigle-sync-mirror-"));
    mkdirSync(join(repo, "docs"), { recursive: true });
    writeFileSync(join(repo, "docs/index.md"), "# the source file\n");
    const tdir = join(repo, "transcripts");
    mkdirSync(tdir);
    // the session's only Write went to the mirrored publish copy
    writeFileSync(
      join(tdir, "mirror.jsonl"),
      makeTranscript({
        sessionId: "55555555-5555-4555-8555-555555555555",
        model: "claude-fable-5",
        path: join(repo, "site/docs/index.md"),
        hour: "10",
      }),
    );
    const r = run(["provenance", "sync", "docs/index.md", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /INVALID: no Claude Code sessions touching docs\/index\.md/);
    assert.equal(
      existsSync(join(repo, ".innsigle/provenance/docs-index-md.l2.json")),
      false,
    );
    rmSync(repo, { recursive: true, force: true });
  });

  it("content outside the repo root → clear INVALID error, not a no-sessions result (F4)", () => {
    const outer = mkdtempSync(join(tmpdir(), "innsigle-sync-outside-"));
    const repo = join(outer, "repo");
    mkdirSync(join(repo, "posts/demo"), { recursive: true });
    writeFileSync(join(repo, "posts/demo/index.qmd"), "# demo\n");
    writeFileSync(join(outer, "outside.md"), "# outside the repo\n");
    const tdir = join(repo, "transcripts");
    mkdirSync(tdir);
    copyFileSync(fixture, join(tdir, "session-one.jsonl"));
    const r = run(["provenance", "sync", "../outside.md", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /INVALID: content must be inside the repository/);
    assert.doesNotMatch(r.stderr, /no Claude Code sessions/);
    rmSync(outer, { recursive: true, force: true });
  });

  it("missing transcript dir → INVALID with a --transcript-dir hint", () => {
    const { repo } = setupSyncRepo("nodir");
    const r = run(
      ["provenance", "sync", "posts/demo/index.qmd", "--transcript-dir", join(repo, "nope")],
      { cwd: repo },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /INVALID: no Claude Code transcript dir/);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("provenance sync follows renames (git log --follow)", () => {
  const git = (repo, ...args) =>
    spawnSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
      { cwd: repo, encoding: "utf8" },
    );

  function setupRenamedRepo() {
    const repo = mkdtempSync(join(tmpdir(), "innsigle-sync-rename-"));
    assert.equal(git(repo, "init", "-q").status, 0);
    mkdirSync(join(repo, "posts/old-slug"), { recursive: true });
    writeFileSync(join(repo, "posts/old-slug/index.qmd"), "# post\n\nfirst draft\n");
    assert.equal(git(repo, "add", "-A").status, 0);
    assert.equal(git(repo, "commit", "-q", "-m", "draft").status, 0);
    assert.equal(git(repo, "mv", "posts/old-slug", "posts/new-slug").status, 0);
    assert.equal(git(repo, "commit", "-q", "-m", "rename").status, 0);
    const tdir = join(repo, "transcripts");
    mkdirSync(tdir);
    writeFileSync(
      join(tdir, "session-before-rename.jsonl"),
      makeTranscript({
        sessionId: "55555555-5555-4555-8555-555555555555",
        model: "claude-fable-5",
        path: "posts/old-slug/index.qmd",
        hour: "09",
      }),
    );
    return { repo, tdir };
  }

  it("lists earlier paths of a renamed file and nothing for untracked or non-git", () => {
    const { repo } = setupRenamedRepo();
    assert.deepEqual(historicalPaths(repo, "posts/new-slug/index.qmd"), ["posts/old-slug/index.qmd"]);
    assert.deepEqual(historicalPaths(repo, "posts/never-tracked.qmd"), []);
    const plain = mkdtempSync(join(tmpdir(), "innsigle-nogit-"));
    assert.deepEqual(historicalPaths(plain, "a.md"), []);
    rmSync(repo, { recursive: true, force: true });
    rmSync(plain, { recursive: true, force: true });
  });

  it("attributes writes recorded under the old path to the renamed artifact", () => {
    const { repo, tdir } = setupRenamedRepo();
    const r = run(["provenance", "sync", "posts/new-slug/index.qmd", "--transcript-dir", tdir], {
      cwd: repo,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const l2 = JSON.parse(
      readFileSync(join(repo, ".innsigle/provenance/posts-new-slug-index-qmd.l2.json"), "utf8"),
    );
    assert.equal(l2.artifacts.length, 1);
    assert.ok(l2.artifacts[0].path.endsWith("posts/new-slug/index.qmd"));
    assert.equal(l2.metrics.files_touched, 1);
    rmSync(repo, { recursive: true, force: true });
  });
});
