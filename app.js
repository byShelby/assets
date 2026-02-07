/* ========= Helpers ========= */
const $ = (s) => document.querySelector(s);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[m]));

function toast(msg, type="ok") {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("ok","err");
  el.classList.add(type === "err" ? "err" : "ok");
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1200);
}

/* ========= i18n (NO extra testing text) ========= */
const i18n = {
  en: {
    title: "Asset Library",
    subtitle: "Search, preview, and copy direct links.",
    searchPH: "Search: category / group / filename",
    openRepo: "Open Repo",
    avatars: "Avatars",
    icons: "Icons",
    photos: "Photos",
    groupRoot: "root",
    empty: "No files in this group.",
    loadFail: "Load failed",
    manifestFail: "Manifest load failed. Check /data/manifest.json.",
    copy: "Copy link",
    copied: "Copied",
    open: "Open",
    done: "Done",
    copyFail: "Copy failed (permission)"
  },
  zh: {
    title: "资源库",
    subtitle: "搜索、预览并复制直链。",
    searchPH: "搜索：分类 / 分组 / 文件名",
    openRepo: "打开仓库",
    avatars: "头像",
    icons: "图标",
    photos: "照片",
    groupRoot: "root",
    empty: "这个分组暂无文件。",
    loadFail: "加载失败",
    manifestFail: "资源索引加载失败：请检查 /data/manifest.json",
    copy: "复制链接",
    copied: "已复制",
    open: "打开",
    done: "完成",
    copyFail: "复制失败（浏览器权限）"
  }
};

const state = {
  lang: "en",
  manifest: null,
  activeGroup: { avatars: "root", icons: "root", photos: "root" },
  query: ""
};

/* ========= Repo link ========= */
(function initRepoLink(){
  // Best effort: build repo URL from current host path
  // Example: https://byshelby.github.io/assets/ -> repo likely https://github.com/byShelby/assets
  const owner = location.hostname.split(".")[0];
  const repo = location.pathname.split("/").filter(Boolean)[0] || "assets";
  $("#repoBtn").href = `https://github.com/${owner}/${repo}`;
})();

/* ========= Language ========= */
function applyLang(){
  const t = i18n[state.lang];
  $("#title").textContent = t.title;
  $("#subtitle").textContent = t.subtitle;
  $("#search").placeholder = t.searchPH;
  $("#repoBtn").textContent = t.openRepo;
  $("#copyBtn").textContent = t.copy;
  $("#openBtn").textContent = t.open;
  $("#doneBtn").textContent = t.done;

  $("#langBtn").textContent = state.lang.toUpperCase();
}

$("#langBtn").addEventListener("click", () => {
  state.lang = state.lang === "en" ? "zh" : "en";
  applyLang();
  render();
});

/* ========= Manifest load ========= */
async function loadManifest(){
  const v = Date.now();
  const url = `./data/manifest.json?v=${v}`;
  $("#status").textContent = " ";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.manifest = json;
    $("#status").textContent = " ";
  } catch (e) {
    state.manifest = null;
    $("#status").textContent = i18n[state.lang].loadFail;
  }
}

/* ========= Render ========= */
function getCategoryLabel(key){
  const t = i18n[state.lang];
  if(key === "avatars") return t.avatars;
  if(key === "icons") return t.icons;
  if(key === "photos") return t.photos;
  return key;
}

function normalizeGroupName(g){
  if(!g) return "root";
  return g;
}

function matchQuery(path, cat, group){
  if(!state.query) return true;
  const q = state.query.toLowerCase().trim();
  const hay = `${cat}/${group}/${path}`.toLowerCase();
  return hay.includes(q);
}

function render(){
  const t = i18n[state.lang];
  const root = $("#cards");
  root.innerHTML = "";

  if(!state.manifest){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-head">
          <div>
            <div class="card-title">${escapeHtml(t.loadFail)}</div>
            <div class="card-meta">${escapeHtml(t.manifestFail)}</div>
          </div>
          <span class="badge">!</span>
        </div>
      </div>
    `;
    root.appendChild(card);
    return;
  }

  const categories = state.manifest.categories || {};
  const order = ["avatars","icons","photos"].filter(k => k in categories);

  for(const cat of order){
    const info = categories[cat] || { total:0, groups:{} };
    const groups = info.groups || {};
    const groupNames = Object.keys(groups);
    const active = state.activeGroup[cat] || (groupNames[0] || "root");
    state.activeGroup[cat] = active;

    // filter count for badge (optional)
    const total = info.total ?? 0;

    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-inner";
    head.innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(getCategoryLabel(cat))}</div>
          <div class="card-meta">${escapeHtml(active)}</div>
        </div>
        <span class="badge">${total}</span>
      </div>
    `;

    // group buttons
    const groupRow = document.createElement("div");
    groupRow.className = "groupRow";

    // ensure root always present if files exist under root
    const sortedGroups = groupNames.length ? groupNames.slice().sort() : ["root"];

    for(const g of sortedGroups){
      const g2 = normalizeGroupName(g);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "groupBtn" + (g2 === active ? " active" : "");
      btn.textContent = g2;
      btn.addEventListener("click", () => {
        state.activeGroup[cat] = g2;
        render();
      });
      groupRow.appendChild(btn);
    }

    head.appendChild(groupRow);

    // grid
    const grid = document.createElement("div");
    grid.className = "grid";

    const list = (groups[active] || []).slice();
    const filtered = list.filter(p => matchQuery(p, cat, active));

    if(filtered.length === 0){
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = t.empty;
      head.appendChild(empty);
    }else{
      for(const rel of filtered){
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.title = rel;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = rel;

        // Use Pages direct URL (stable)
        img.src = `./${rel}`;

        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "Preview";

        tile.appendChild(img);
        tile.appendChild(hint);
        tile.addEventListener("click", () => openModal(rel));

        grid.appendChild(tile);
      }

      head.appendChild(grid);
    }

    card.appendChild(head);
    root.appendChild(card);
  }
}

/* ========= Search ========= */
$("#search").addEventListener("input", (e) => {
  state.query = e.target.value || "";
  render();
});

/* ========= Modal ========= */
function openModal(rel){
  const t = i18n[state.lang];
  const modal = $("#modal");
  const img = $("#modalImg");

  const url = new URL(rel, location.href).toString();

  $("#modalName").textContent = rel.split("/").pop();
  $("#modalPath").textContent = rel;

  img.src = url;
  $("#openBtn").href = url;

  // Copy feedback: toast + button temporary text
  $("#copyBtn").textContent = t.copy;
  $("#copyBtn").onclick = async () => {
    const btn = $("#copyBtn");
    const originalText = t.copy;

    const setBtn = (text) => { btn.textContent = text; };

    try {
      await navigator.clipboard.writeText(url);
      setBtn(state.lang === "zh" ? "已复制 ✓" : "Copied ✓");
      toast(t.copied, "ok");
      setTimeout(() => setBtn(originalText), 900);
    } catch (e) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();

        setBtn(state.lang === "zh" ? "已复制 ✓" : "Copied ✓");
        toast(t.copied, "ok");
        setTimeout(() => setBtn(originalText), 900);
      } catch {
        toast(t.copyFail, "err");
        setBtn(state.lang === "zh" ? "复制失败" : "Failed");
        setTimeout(() => setBtn(originalText), 1200);
      }
    }
  };

  $("#doneBtn").onclick = closeModal;
  $("#modalClose").onclick = closeModal;
  $("#modalBackdrop").onclick = closeModal;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(){
  const modal = $("#modal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

window.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeModal();
});

/* ========= Boot ========= */
(async function boot(){
  // default language: keep EN first (no layout jump)
  state.lang = "en";
  applyLang();

  await loadManifest();

  // Make sure root group exists if manifest groups empty (still render)
  for(const k of ["avatars","icons","photos"]){
    if(!state.activeGroup[k]) state.activeGroup[k] = "root";
  }

  render();
})();
