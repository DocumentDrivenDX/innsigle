/**
 * CLI for maker profiles (FEAT-005). File I/O lives here so src/profile.mjs
 * stays isomorphic for the browser builder.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addWork,
  bioCard,
  emptyProfile,
  footerLine,
  nowIso as defaultNowIso,
  ProfileError,
  renderProfileHtml,
  validateProfile,
  workToPlainClaim,
} from "./profile.mjs";

const EXIT = { ok: 0, usage: 1, badSchema: 5 };

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function requireArg(args, name, usageFn) {
  const v = arg(args, name);
  if (!v) usageFn(`missing ${name}`);
  return v;
}

function multiArg(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) out.push(args[++i]);
  }
  return out;
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error(`innsigle profile — maker page + plain seals (no keys)

  innsigle profile init --id <slug> --name <name> [--out-dir DIR] [--url URL] [--bio TEXT] [--force]
  innsigle profile add --title <title> --kind mixed|human-authored|model-primary
                       [--url URL] [--slug SLUG] [--model NAME] [--notes TEXT]
                       [--ingredient kind:name[:role]] [--profile FILE]
  innsigle profile render [--profile FILE] [--out FILE] [--marks-dir DIR]
  innsigle profile footer --slug <slug> [--profile FILE]
  innsigle profile bio [--profile FILE]
  innsigle profile validate [--profile FILE]
  innsigle profile claim --slug <slug> [--profile FILE] [--out FILE]

  Plain seals are unsigned declarations. verify MUST NOT print VALID for them.
`);
  process.exit(EXIT.usage);
}

function failSchema(e) {
  console.error(`INVALID: ${e.message}`);
  process.exit(EXIT.badSchema);
}

function defaultProfilePath(args) {
  return arg(args, "--profile") || "profile.json";
}

function loadProfile(path) {
  if (!existsSync(path)) {
    throw new ProfileError(`profile file missing: ${path}`);
  }
  try {
    return validateProfile(JSON.parse(readFileSync(path, "utf8")));
  } catch (e) {
    if (e instanceof ProfileError) throw e;
    throw new ProfileError(`cannot parse ${path}: ${e.message}`);
  }
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

export function packagedMarksDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "../docs/sample/assets/marks");
  return existsSync(dir) ? dir : null;
}

const MARK_FILES = [
  "innsigle-base.svg",
  "innsigle-human.svg",
  "innsigle-mixed.svg",
  "innsigle-model.svg",
];

function copyMarks(fromDir, toDir) {
  if (!fromDir || !existsSync(fromDir)) return false;
  mkdirSync(toDir, { recursive: true });
  let n = 0;
  for (const name of MARK_FILES) {
    const src = join(fromDir, name);
    if (!existsSync(src)) continue;
    cpSync(src, join(toDir, name));
    n += 1;
  }
  return n > 0;
}

function loadInlineMarks(marksDir) {
  if (!marksDir || !existsSync(marksDir)) return undefined;
  const out = {};
  for (const [key, file] of [
    ["base", "innsigle-base.svg"],
    ["human", "innsigle-human.svg"],
    ["mixed", "innsigle-mixed.svg"],
    ["model", "innsigle-model.svg"],
  ]) {
    const p = join(marksDir, file);
    if (existsSync(p)) out[key] = readFileSync(p, "utf8");
  }
  return Object.keys(out).length ? out : undefined;
}

function parseIngredient(spec, i) {
  const parts = String(spec).split(":");
  if (parts.length < 2) {
    throw new ProfileError(
      `--ingredient ${i} must be kind:name or kind:name:role (got ${spec})`,
    );
  }
  const [kind, name, role] = parts;
  const ing = { kind, name };
  if (role) ing.role = role;
  return ing;
}

function cmdInit(args, nowIso) {
  const id = requireArg(args, "--id", usage);
  const name = requireArg(args, "--name", usage);
  const outDir = arg(args, "--out-dir") || "innsigle-profile";
  const profilePath = join(outDir, "profile.json");
  if (existsSync(profilePath) && !args.includes("--force")) {
    console.error(`INVALID: ${profilePath} exists (pass --force to overwrite)`);
    process.exit(EXIT.badSchema);
  }
  let profile;
  try {
    profile = emptyProfile({
      id,
      name,
      bio: arg(args, "--bio"),
      profile_url: arg(args, "--url"),
      now: nowIso(),
    });
  } catch (e) {
    failSchema(e);
  }
  mkdirSync(outDir, { recursive: true });
  writeJson(profilePath, profile);
  const marksDest = join(outDir, "marks");
  const copied = copyMarks(packagedMarksDir(), marksDest);
  const html = renderProfileHtml(profile, {
    markHrefPrefix: copied ? "marks/" : undefined,
  });
  writeFileSync(join(outDir, "index.html"), html);
  console.error(`profile=${profilePath}`);
  console.error(`page=${join(outDir, "index.html")}`);
  console.error("next: innsigle profile add --profile " + profilePath + " --title … --kind mixed");
  return EXIT.ok;
}

function cmdAdd(args, nowIso) {
  const path = defaultProfilePath(args);
  const title = requireArg(args, "--title", usage);
  const kind = arg(args, "--kind") || arg(args, "--composition");
  if (!kind) usage("missing --kind");
  let profile;
  try {
    profile = loadProfile(path);
    const specs = multiArg(args, "--ingredient");
    const ingredients = specs.length
      ? specs.map((s, i) => parseIngredient(s, i))
      : undefined;
    profile = addWork(
      profile,
      {
        title,
        url: arg(args, "--url"),
        slug: arg(args, "--slug"),
        composition: kind,
        model: arg(args, "--model"),
        notes: arg(args, "--notes"),
        ingredients,
      },
      { now: nowIso() },
    );
  } catch (e) {
    failSchema(e);
  }
  writeJson(path, profile);
  const work = profile.works[profile.works.length - 1];
  const htmlPath = join(dirname(path), "index.html");
  if (existsSync(htmlPath) || arg(args, "--out")) {
    const marksDir = arg(args, "--marks-dir") || join(dirname(path), "marks");
    const html = renderProfileHtml(profile, {
      markHrefPrefix: existsSync(marksDir) ? `${basenameMarksPrefix(marksDir, dirname(path))}` : undefined,
    });
    writeFileSync(arg(args, "--out") || htmlPath, html);
  }
  console.error(`slug=${work.slug}`);
  console.log(footerLine(profile, work.slug));
  return EXIT.ok;
}

function basenameMarksPrefix(marksDir, profileDir) {
  // Prefer a relative prefix when marks live next to the profile.
  if (marksDir === join(profileDir, "marks")) return "marks/";
  return marksDir.endsWith("/") ? marksDir : `${marksDir}/`;
}

function cmdRender(args) {
  const path = defaultProfilePath(args);
  let profile;
  try {
    profile = loadProfile(path);
  } catch (e) {
    failSchema(e);
  }
  const marksDir = arg(args, "--marks-dir") || join(dirname(path), "marks");
  const inline = args.includes("--inline-marks");
  const html = renderProfileHtml(profile, inline
    ? { inlineMarks: loadInlineMarks(existsSync(marksDir) ? marksDir : packagedMarksDir()) }
    : { markHrefPrefix: existsSync(marksDir) ? basenameMarksPrefix(marksDir, dirname(path)) : undefined },
  );
  const out = arg(args, "--out");
  if (out) writeFileSync(out, html);
  else process.stdout.write(html.endsWith("\n") ? html : html + "\n");
  return EXIT.ok;
}

function cmdFooter(args) {
  const path = defaultProfilePath(args);
  const slug = requireArg(args, "--slug", usage);
  try {
    const profile = loadProfile(path);
    console.log(footerLine(profile, slug));
  } catch (e) {
    failSchema(e);
  }
  return EXIT.ok;
}

function cmdBio(args) {
  const path = defaultProfilePath(args);
  try {
    console.log(bioCard(loadProfile(path)));
  } catch (e) {
    failSchema(e);
  }
  return EXIT.ok;
}

function cmdValidate(args) {
  const path = defaultProfilePath(args);
  try {
    const p = loadProfile(path);
    console.log("OK");
    console.log(`id=${p.id}`);
    console.log(`works=${p.works.length}`);
  } catch (e) {
    failSchema(e);
  }
  return EXIT.ok;
}

function cmdClaim(args) {
  const path = defaultProfilePath(args);
  const slug = requireArg(args, "--slug", usage);
  try {
    const profile = loadProfile(path);
    const body = JSON.stringify(workToPlainClaim(profile, slug), null, 2) + "\n";
    const out = arg(args, "--out");
    if (out) writeFileSync(out, body);
    else process.stdout.write(body);
  } catch (e) {
    failSchema(e);
  }
  return EXIT.ok;
}

export function runProfile(args, { nowIso = defaultNowIso } = {}) {
  const sub = args[0];
  const rest = args.slice(1);
  try {
    switch (sub) {
      case "init":
        return cmdInit(rest, nowIso);
      case "add":
        return cmdAdd(rest, nowIso);
      case "render":
        return cmdRender(rest);
      case "footer":
        return cmdFooter(rest);
      case "bio":
        return cmdBio(rest);
      case "validate":
        return cmdValidate(rest);
      case "claim":
        return cmdClaim(rest);
      default:
        usage(sub ? `unknown profile subcommand: ${sub}` : undefined);
    }
  } catch (e) {
    if (e instanceof ProfileError) failSchema(e);
    throw e;
  }
  return EXIT.ok;
}
