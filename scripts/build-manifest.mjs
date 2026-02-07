const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "manifest.json");

const CATEGORIES = ["avatars", "icons", "photos"];
const IMAGE_EXT = new Set([".png",".jpg",".jpeg",".webp",".gif",".svg",".ico"]);

function listFiles(dir){
  const out = [];
  if(!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)){
    if(name.startsWith(".")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if(st.isDirectory()) continue; // ✅ 你要“不要子文件夹”，所以直接忽略目录
    const ext = path.extname(name).toLowerCase();
    if(IMAGE_EXT.has(ext)) out.push(name);
  }
  return out.sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}

function build(){
  const categories = {};
  for (const cat of CATEGORIES){
    const dir = path.join(ROOT, cat);
    const files = listFiles(dir);
    categories[cat] = {
      total: files.length,
      groups: {
        root: files.map(f => `${cat}/${f}`)
      }
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    categories
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(build(), null, 2), "utf8");
console.log("Wrote", OUT_FILE);
