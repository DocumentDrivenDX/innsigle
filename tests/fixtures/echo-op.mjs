#!/usr/bin/env node
/**
 * op shim for 1Password bridging tests (PLAN-001 A3).
 * Appends each invocation's argv (JSON, one line) to $INNSIGLE_ECHO_OP_LOG,
 * then answers just enough of the op CLI surface to satisfy readPrivateKeyPem.
 */
import { appendFileSync } from "node:fs";

const argv = process.argv.slice(2);
const log = process.env.INNSIGLE_ECHO_OP_LOG;
if (log) appendFileSync(log, JSON.stringify(argv) + "\n");

if (argv.includes("--version")) {
  process.stdout.write("2.0.0-echo\n");
  process.exit(0);
}

if (argv.includes("whoami")) {
  process.stdout.write(JSON.stringify({ email: "echo@example.com" }) + "\n");
  process.exit(0);
}

if (argv.includes("read")) {
  process.stdout.write(
    "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIEcho\n-----END PRIVATE KEY-----\n",
  );
  process.exit(0);
}

process.stderr.write("echo-op: unhandled " + argv.join(" ") + "\n");
process.exit(1);
