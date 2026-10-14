import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const packages = ["peer", "media", "call", "signaling-websocket"];
const allowed = {
  peer: new Set(),
  media: new Set(),
  "signaling-websocket": new Set(),
  call: new Set(["@peerweave/peer", "@peerweave/media", "xstate"]),
};

function files(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path, extension) : path.endsWith(extension) ? [path] : [];
  });
}

for (const name of packages) {
  const directory = resolve(root, "packages", name);
  const manifest = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
  for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
    if (!allowed[name].has(dependency)) errors.push(`${name}: unexpected dependency ${dependency}`);
    if (dependency.startsWith("@peerweave/") && !version.startsWith("workspace:")) {
      errors.push(`${name}: ${dependency} must use workspace: linking`);
    }
  }
  for (const file of files(resolve(directory, "src"), ".ts")) {
    const source = readFileSync(file, "utf8");
    const specifiers = [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*)["']([^"']+)["']/g)];
    for (const [, specifier] of specifiers) {
      if (specifier.startsWith(".")) {
        if (!resolve(dirname(file), specifier).startsWith(`${directory}${sep}src${sep}`)) {
          errors.push(`${file}: relative import escapes its package source: ${specifier}`);
        }
      } else {
        const dependency = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (!allowed[name].has(dependency)) errors.push(`${file}: forbidden import ${specifier}`);
        if (specifier.startsWith("@peerweave/") && specifier !== dependency) {
          errors.push(`${file}: use the public package entry point, not ${specifier}`);
        }
      }
    }
  }
}

const documents = [
  resolve(root, "README.md"),
  resolve(root, "AGENTS.md"),
  resolve(root, "ARCHITECTURE.md"),
  resolve(root, "apps/demo/README.md"),
  ...files(resolve(root, "docs"), ".md"),
  ...packages.map((name) => resolve(root, "packages", name, "README.md")),
];
for (const file of documents) {
  const content = readFileSync(file, "utf8");
  for (const [, target] of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:|^#/i.test(target)) continue;
    const path = target.split("#")[0];
    if (!existsSync(resolve(dirname(file), path)))
      errors.push(`${file}: broken local link ${target}`);
  }
}
if (readFileSync(resolve(root, "AGENTS.md"), "utf8").split("\n").length > 100) {
  errors.push("AGENTS.md must remain a short navigation map (at most 100 lines)");
}

if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `Repository checks passed: ${packages.length} package boundaries and ${documents.length} documents.`,
);
