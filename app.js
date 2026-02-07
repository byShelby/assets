const OWNER = "byShelby";   // ← 你的用户名
const REPO  = "assets";     // ← 你的仓库名
const BASE  = `https://${OWNER}.github.io/${REPO}/`;

const I18N = {
  zh: {
    title: "你的资源库",
    desc: "像产品一样管理头像/图标/图片：自动索引、分类展示、点击放大预览，一键复制直链（GitHub Pages）。",
    searchPH: "搜索：分类 / 子分类 / 文件名（例如：people / avatar / logo / bg）",
    avatars: "Avatars",
    icons: "Icons",
    photos: "Photos",
    avatarsDesc: "头像（适合网站头像链接）",
    iconsDesc: "图标（小尺寸 / favicon / UI）",
    photosDesc: "照片（展示图 / 背景图）",
    empty: "这个分类还没有图片",
    openRepo: "Open Repo",
    copy: "复制直链",
    copied: "已复制",
    close: "关闭",
    prev: "上一个",
    next: "下一个",
  },
  en: {
    title: "Your Asset Library",
    desc: "A product-like gallery for avatars, icons and images. Auto-indexed, grouped, zoom preview, one-click direct links (GitHub Pages).",
    searchPH: "Search: category / subcategory / filename (e.g. people / avatar / logo / bg)",
    avatars: "Avatars",
    icons: "Icons",
    photos: "Photos",
    avatarsDesc: "Avatars (for profile/website)",
    iconsDesc: "Icons (favicon/UI)",
    photosDesc: "Photos (banners/backgrounds)",
    empty: "No assets in this section",
    openRepo: "Open Repo",
    copy: "Copy link",
    copied: "Copied",
    close: "Close",
    prev: "Prev",
    next: "Next",
  }
};

function pickLang(){
  const saved = localStorage.getItem("lang");
  if (saved && (saved === "zh" || saved === "en")) return saved;
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

let LANG = pickLang();
let T = I18N[LANG];

const $ = (sel) => document.querySelector(sel);

function setText(){
  $("#title").textContent = T.title;
  $("#desc").textContent = T.desc;
  $("#q").placeholder = T.searchPH;
  $("#btnRepo").textContent = T.openRepo;
  $("#langBtn").textContent = LANG === "zh" ? "EN" : "中";
}

async function loadManifest(){
  const res = await fetch("data/manifest.json?_=" + Date.now());
  if (!res.ok) throw new Error("manifest load failed");
  return await res.json();
}

function labelFor(cat){
  if (cat === "avatars") return { name: T.avatars, desc: T.avatarsDesc };
  if (cat === "icons") return { name: T.icons, desc: T.iconsDesc };
  return { name: T.photos, desc: T.photosDesc };
}

function normalizeGroups(groups){
  // ensure root first
  const keys = Object.keys(groups || {});
  keys.sort((a,b)=> (a==="root"?-1:0) - (b==="root"?-1:0) || a.localeCompare(b));
  return keys.map(k => ({ key:k, files: groups[k] || [] }));
}

let STATE = {
  manifest: null,
  q: "",
  activeGroup: { avatars:"root", icons:"root", photos:"root" },
  flatListForModal: [],
  modalIndex: 0
};

function matchQuery(path, cat, groupKey){
  const q = STATE.q.trim().toLowerCase();
  if (!q) return true;
  return (
    path.toLowerCase().includes(q) ||
    cat.toLowerCase().includes(q) ||
    groupKey.toLowerCase().includes(q)
  );
}

function buildCategoryCard(cat){
  const meta = labelFor(cat);
  const info = STATE.manifest.categories[cat] || { groups:{} };
  const groups = normalizeGroups(info.groups);

  const wrap = document.createElement("div");
  wrap.className = "card";

  const head = document.createElement("div");
  head.className = "cardHead";
  head.innerHTML = `
    <div>
      <div class="cardTitle">${meta.name}</div>
      <div class="cardDesc">${meta.desc}</div>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.55)">${info.total || 0}</div>
  `;
  wrap.appendChild(head);

  const pills = document.createElement("div");
  pills.className = "pills";

  const current = STATE.activeGroup[cat] || "root";
  groups.forEach(g => {
    // pill appears even if empty, so you can navigate future growth
    const pill = document.createElement("div");
    pill.className = "pill" + (g.key === current ? " active" : "");
    pill.textContent = g.key;
    pill.onclick = () => {
      STATE.activeGroup[cat] = g.key;
      render();
    };
    pills.appendChild(pill);
  });
  wrap.appendChild(pills);

  const grid = document.createElement("div");
  grid.className = "thumbGrid";

  const active = groups.find(g => g.key === current) || groups[0] || { key:"root", files:[] };
  const visible = (active.files || []).filter(p => matchQuery(p, cat, active.key));

  if (!visible.length){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = T.empty;
    wrap.appendChild(empty);
    return wrap;
  }

  visible.forEach((p) => {
    const url = BASE + p;
    const d = document.createElement("div");
    d.className = "thumb";
    d.innerHTML = `<img loading="lazy" src="${url}" alt="" />`;
    d.onclick = () => openModal(visible, p);
    grid.appendChild(d);
  });

  wrap.appendChild(grid);
  return wrap;
}

function openModal(list, selectedPath){
  STATE.flatListForModal = list.slice();
  STATE.modalIndex = Math.max(0, list.indexOf(selectedPath));
  showModal();
}

function showModal(){
  const dlg = $("#dlg");
  const img = $("#modalImg");
  const url = BASE + STATE.flatListForModal[STATE.modalIndex];
  img.src = url;
  $("#modalUrl").textContent = url;
  dlg.showModal();
}

async function copyLink(){
  const url = BASE + STATE.flatListForModal[STATE.modalIndex];
  await navigator.clipboard.writeText(url);
  const btn = $("#btnCopy");
  btn.textContent = T.copied;
  setTimeout(()=> btn.textContent = T.copy, 900);
}

function modalPrev(){
  if (!STATE.flatListForModal.length) return;
  STATE.modalIndex = (STATE.modalIndex - 1 + STATE.flatListForModal.length) % STATE.flatListForModal.length;
  showModal();
}

function modalNext(){
  if (!STATE.flatListForModal.length) return;
  STATE.modalIndex = (STATE.modalIndex + 1) % STATE.flatListForModal.length;
  showModal();
}

function render(){
  T = I18N[LANG];
  setText();

  const root = $("#cards");
  root.innerHTML = "";
  ["avatars","icons","photos"].forEach(cat => root.appendChild(buildCategoryCard(cat)));

  // modal buttons
  $("#btnCopy").textContent = T.copy;
  $("#btnClose").textContent = T.close;
  $("#btnPrev").textContent = T.prev;
  $("#btnNext").textContent = T.next;
}

async function main(){
  $("#btnRepo").onclick = () => window.open(`https://github.com/${OWNER}/${REPO}`, "_blank");

  $("#langBtn").onclick = () => {
    LANG = (LANG === "zh") ? "en" : "zh";
    localStorage.setItem("lang", LANG);
    render();
  };

  $("#q").addEventListener("input", (e) => {
    STATE.q = e.target.value || "";
    render();
  });

  // modal wiring
  $("#btnCopy").onclick = copyLink;
  $("#btnClose").onclick = () => $("#dlg").close();
  $("#btnPrev").onclick = modalPrev;
  $("#btnNext").onclick = modalNext;

  $("#dlg").addEventListener("click", (e) => { if (e.target === $("#dlg")) $("#dlg").close(); });
  window.addEventListener("keydown", (e) => {
    const dlg = $("#dlg");
    if (!dlg.open) return;
    if (e.key === "ArrowLeft") modalPrev();
    if (e.key === "ArrowRight") modalNext();
    if (e.key === "Escape") dlg.close();
  });

  // load
  STATE.manifest = await loadManifest();
  render();
}

main().catch(err => {
  console.error(err);
  $("#cards").innerHTML = `<div class="card" style="padding:16px">Manifest load failed. Check Actions + data/manifest.json</div>`;
});
