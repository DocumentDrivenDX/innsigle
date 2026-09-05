/**
 * Session journal: versioned JSONL (ADR convergence).
 */
import { readFileSync } from "node:fs";

const TYPES = new Set([
  "session_start",
  "session_end",
  "user_prompt",
  "assistant_turn",
  "tool_call",
  "skill_call",
  "file_write",
  "file_read",
  "model_switch",
  "note",
  "review",
]);

export function parseJournal(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  const events = [];
  for (let i = 0; i < lines.length; i++) {
    let ev;
    try {
      ev = JSON.parse(lines[i]);
    } catch {
      throw new Error(`journal line ${i + 1}: invalid JSON`);
    }
    validateEvent(ev, i + 1);
    events.push(ev);
  }
  events.sort((a, b) => a.sequence - b.sequence || a.t.localeCompare(b.t));
  return events;
}

export function loadJournal(path) {
  return parseJournal(readFileSync(path, "utf8"));
}

function validateEvent(ev, line) {
  if (ev.v !== 1) throw new Error(`line ${line}: v must be 1`);
  for (const k of ["session_id", "event_id", "sequence", "t", "type", "actor"]) {
    if (ev[k] === undefined || ev[k] === null || ev[k] === "") {
      throw new Error(`line ${line}: missing ${k}`);
    }
  }
  if (!TYPES.has(ev.type)) throw new Error(`line ${line}: unknown type ${ev.type}`);
  if (typeof ev.sequence !== "number" || ev.sequence < 0) {
    throw new Error(`line ${line}: sequence must be non-negative number`);
  }
  if (!ev.actor?.kind) throw new Error(`line ${line}: actor.kind required`);
  if (ev.type === "file_write") {
    if (!ev.path) throw new Error(`line ${line}: file_write requires path`);
    if (!ev.by) throw new Error(`line ${line}: file_write requires by`);
  }
  if (ev.type === "user_prompt" && !ev.summary) {
    throw new Error(`line ${line}: user_prompt requires summary`);
  }
  if (ev.type === "assistant_turn" && !ev.model) {
    throw new Error(`line ${line}: assistant_turn requires model`);
  }
  if (ev.type === "review") {
    if (!ev.summary) throw new Error(`line ${line}: review requires summary`);
    if (ev.actor?.kind !== "human") {
      throw new Error(`line ${line}: review requires a human actor`);
    }
    if (ev.verdict !== undefined && !["approved", "changes-requested"].includes(ev.verdict)) {
      throw new Error(`line ${line}: review verdict must be approved|changes-requested`);
    }
  }
  for (const k of ["chars", "chars_added", "chars_removed"]) {
    if (ev[k] !== undefined && (!Number.isInteger(ev[k]) || ev[k] < 0)) {
      throw new Error(`line ${line}: ${k} must be a non-negative integer`);
    }
  }
}

export function mergeJournals(eventLists) {
  const all = eventLists.flat();
  // Re-sequence globally while preserving relative order within each session
  all.sort((a, b) => a.t.localeCompare(b.t) || a.sequence - b.sequence);
  return all.map((ev, i) => ({ ...ev, sequence: i }));
}
