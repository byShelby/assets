import fs from "fs";
import path from "path";

const ROOTS = ["avatars", "icons", "photos"];
const EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".avif"
]);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walk(full));
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (EXTS.has(ext)) out.push(full.replaceAll("\\", "/"));
    }
  }
  return out;
}

function groupBySubfolder(files, root) {
  // root = "avatars"
  // "avatars/avatar-1.jpg" => sub = "root"
  // "avatars/people/a.jpg" => sub = "people"
  const groups = {};
  for (const f of files) {
    const rel = f.replace(root + "/", "");
    const parts = rel.split("/");
    const sub = parts.length === 1 ? "root" : parts[0];
    groups[sub] ??= [];
    groups[sub].push(f);
  }
  // sort for stability
  for (const k of Object.keys(groups)) groups[k].sort();
  return groups;
}

const manifest = {
  generatedAt: new Date().toISOString(),
  categories: {}
};

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  const files = walk(root).map(p => p); // e.g. "avatars/avatar-1.jpg"
  manifest.categories[root] = {
    total: files.length,
    groups: groupBySubfolder(files, root)
  };
}

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/manifest.json", JSON.stringify(manifest, null, 2));
console.log("✅ data/manifest.json updated");
