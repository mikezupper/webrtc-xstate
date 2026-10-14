import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function assertPublicDeclarations(entry) {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const declaration = readFileSync(file, "utf8");
    if (/xstate|ActorRef|SnapshotFrom|StateMachine/.test(declaration)) {
      throw new Error(`Internal state machine types escaped into public declarations: ${file}`);
    }
    for (const [, specifier] of declaration.matchAll(
      /(?:\bfrom\s+|\bimport\s*\(\s*)["']([^"']+)["']/g,
    )) {
      if (specifier.startsWith(".")) {
        visit(resolve(dirname(file), specifier.replace(/\.js$/, ".d.ts")));
      }
    }
  }
  visit(resolve(entry));
}
