// scripts/build-manifest.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, "data", "manifest.json");

// 你页面固定用这三个类别（app.js 里 categories = ["avatars","icons","photos"]）
const CATEGORIES = ["avatars", "icons", "photos"];

// ✅ 关键：把 .jpeg 也算进去（并且大小写都支持）
const ALLOW_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

function isAllowedFile(name) {
  const base = path.basename(name);
  if (base.startsWith(".")) return false; // .DS_Store / .gitkeep ...
  const ext = path.extname(base).toLowerCase();
  return ALLOW_EXT.has(ext);
}

async function listFiles(dirAbs, dirRel) {
  // 只扫描一层：avatars/*  icons/*  photos/*
  // 如果你未来想支持子目录（photos/wallpapers/...），我也可以给你递归版
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return out; // 目录不存在就当空
  }

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!isAllowedFile(ent.name)) continue;

    // 输出相对路径，和你现有 manifest 风格一致： "photos/xxx.jpeg"
    out.push(path.posix.join(dirRel, ent.name));
  }

  // 稳定排序（不然每次生成顺序都可能变）
  out.sort((a, b) => a.localeCompare(b, "en"));
  return out;
}

async function main() {
  const categories = {};

  for (const cat of CATEGORIES) {
    const dirAbs = path.join(ROOT, cat);
    const files = await listFiles(dirAbs, cat);

    categories[cat] = {
      total: files.length,
      groups: files.length ? { root: files } : {}
    };
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    categories
  };

  // 确保 data/ 存在
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`✅ manifest updated: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(
    `avatars=${categories.avatars.total}, icons=${categories.icons.total}, photos=${categories.photos.total}`
  );
}

main().catch((err) => {
  console.error("❌ build manifest failed:", err);
  process.exit(1);
});
