const $ = (s) => document.querySelector(s);

const state = {
  manifest: null,
  lang: "en",
  query: "",
  activeGroup: { avatars: "root", icons: "root", photos: "root" },
};

const i18n = {
  en: {
    title: "Asset Library",
    subtitle: "Search, preview, and copy direct links.",
    searchPh: "Search: category / group / filename",
    loadFail: "Load failed",
    empty: "No items",
    copy: "Copy link",
    open: "Open",
    done: "Done",
    copied: "Copied",
    foot: "Direct links are GitHub Pages URLs.",
  },
  zh: {
    title: "资源库",
    subtitle: "搜索、预览并一键复制直链。",
    searchPh: "搜索：分类 / 分组 / 文件名",
    loadFail: "加载失败",
    empty: "暂无内容",
    copy: "复制链接",
    open: "打开",
    done: "完成",
    copied: "已复制",
    foot: "直链使用 GitHub Pages 域名。",
  }
};

function detectBase() {
  // project pages: https://user.github.io/repo/
  // ensure we build urls correctly no matter trailing slash or query
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  let path = u.pathname;
  if (!path.endsWith("/")) path += "/";
  return u.origin + path;
}

const BASE = detectBase();

function assetUrl(relPath) {
  // relPath like "avatars/avatar-1.jpg"
  return BASE + relPath.replace(/^\/+/, "");
}

async function loadManifest() {
  // fetch relative to current directory, safe for project pages.
  const url = BASE + "data/manifest.json?_=" + Date.now();
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("manifest http " + r.status);
  return r.json();
}

function setLang(next) {
  state.lang = next;
  const t = i18n[state.lang];
  $("#title").textContent = t.title;
  $("#subtitle").textContent = t.subtitle;
  $("#q").placeholder = t.searchPh;
  $("#copyBtn").textContent = t.copy;
  $("#openBtn").textContent = t.open;
  $("#closeBtn").textContent = t.done;
  $("#footLeft").textContent = t.foot;
  $("#langBtn").textContent = state.lang.toUpperCase();
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1100);
}

function normalizeGroups(cat) {
  // ensure groups exists; if empty, create root group from any arrays if present
  if (!cat.groups) cat.groups = {};
  if (!Object.keys(cat.groups).length) cat.groups.root = [];
  if (!state.activeGroup[cat._name]) state.activeGroup[cat._name] = "root";
  if (!cat.groups[state.activeGroup[cat._name]]) state.activeGroup[cat._name] = Object.keys(cat.groups)[0] || "root";
}

function buildCard(categoryName, cat) {
  cat._name = categoryName;
  normalizeGroups(cat);

  const card = document.createElement("div");
  card.className = "card";

  const total = cat.total ?? Object.values(cat.groups).reduce((a, arr) => a + (arr?.length || 0), 0);

  const head = document.createElement("div");
  head.className = "cardHead";
  head.innerHTML = `
    <div>
      <div class="cardTitle">${categoryName[0].toUpperCase() + categoryName.slice(1)}</div>
      <div class="cardSub">${categoryName === "avatars" ? "Avatars / profile images" : categoryName === "icons" ? "Icons / UI assets" : "Photos / backgrounds"}</div>
    </div>
    <div class="badge">${total}</div>
  `;

  const groupRow = document.createElement("div");
  groupRow.className = "groupRow";

  const groups = Object.keys(cat.groups);
  groups.forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "groupChip" + (g === state.activeGroup[categoryName] ? " active" : "");
    btn.textContent = g;
    btn.onclick = () => {
      state.activeGroup[categoryName] = g;
      render();
    };
    groupRow.appendChild(btn);
  });

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumbWrap";

  const grid = document.createElement("div");
  grid.className = "thumbGrid";

  const items = (cat.groups[state.activeGroup[categoryName]] || []).slice();

  // filter by search
  const q = state.query.trim().toLowerCase();
  const filtered = q
    ? items.filter((p) => (categoryName + "/" + state.activeGroup[categoryName] + "/" + p).toLowerCase().includes(q) || p.toLowerCase().includes(q))
    : items;

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = i18n[state.lang].empty;
    thumbWrap.appendChild(empty);
  } else {
    filtered.forEach((rel) => {
      const name = rel.split("/").pop();
      const div = document.createElement("div");
      div.className = "thumb";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = assetUrl(rel);
      img.alt = name;

      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = name;

      div.appendChild(img);
      div.appendChild(cap);

      div.onclick = () => openModal(rel);

      grid.appendChild(div);
    });

    thumbWrap.appendChild(grid);
  }

  card.appendChild(head);
  card.appendChild(groupRow);
  card.appendChild(thumbWrap);
  return card;
}

function render() {
  const grid = $("#grid");
  grid.innerHTML = "";

  const m = state.manifest;
  if (!m?.categories) return;

  const cats = ["avatars", "icons", "photos"].filter((k) => m.categories[k]);
  cats.forEach((k) => {
    grid.appendChild(buildCard(k, m.categories[k]));
  });

  $("#status").textContent = "";
}

function openModal(rel) {
  const url = assetUrl(rel);
  const name = rel.split("/").pop();

  $("#modalName").textContent = name;
  $("#modalPath").textContent = rel;
  $("#modalImg").src = url;
  $("#openBtn").href = url;

  $("#copyBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(i18n[state.lang].copied);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast(i18n[state.lang].copied);
    }
  };

  $("#modal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modal").setAttribute("aria-hidden", "true");
  $("#modalImg").src = "";
  document.body.style.overflow = "";
}

function initUi() {
  // repo button auto-detect
  const repoUrl = `https://github.com/${location.hostname.split(".")[0]}/${location.pathname.split("/")[1]}`;
  $("#repoBtn").href = repoUrl;

  $("#langBtn").onclick = () => {
    setLang(state.lang === "en" ? "zh" : "en");
    render();
  };

  $("#q").addEventListener("input", (e) => {
    state.query = e.target.value || "";
    render();
  });

  $("#modalBackdrop").onclick = closeModal;
  $("#closeBtn").onclick = closeModal;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // default language: browser
  const preferZh = (navigator.language || "").toLowerCase().startsWith("zh");
  setLang(preferZh ? "zh" : "en");
}

(async function main(){
  initUi();
  try {
    state.manifest = await loadManifest();
    render();
  } catch (e) {
    $("#status").textContent = i18n[state.lang].loadFail;
    // minimal visible error (no “测试文案”)
    const grid = $("#grid");
    grid.innerHTML = `<div class="card"><div class="cardHead">
      <div><div class="cardTitle">Assets</div><div class="cardSub">${i18n[state.lang].loadFail}</div></div>
      <div class="badge">!</div></div>
      <div class="thumbWrap"><div class="empty">manifest.json: ${BASE}data/manifest.json</div></div></div>`;
    console.error(e);
  }
})();
