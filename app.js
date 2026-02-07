// app.js — Production-ready asset library (GitHub Pages)
// Auto-detect base path (works for / or /<repo>/)

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getBasePath() {
  // Examples:
  // - https://byshelby.github.io/assets/           -> "/assets/"
  // - https://username.github.io/                 -> "/"
  const path = window.location.pathname;
  // Ensure trailing slash
  const normalized = path.endsWith("/") ? path : path + "/";
  // If this is a repo page, base is first segment: "/assets/"
  const parts = normalized.split("/").filter(Boolean); // ["assets", ...]
  if (parts.length >= 1) return `/${parts[0]}/`;
  return "/";
}

const BASE = getBasePath();
const MANIFEST_URL = `${BASE}data/manifest.json?v=${Date.now()}`;

const state = {
  manifest: null,
  lang: "zh",
  query: "",
  activeCategory: "avatars",
  activeGroup: "root",
};

const i18n = {
  zh: {
    title: "你的资源库",
    search: "搜索：分类 / 子分类 / 文件名（例如：avatar / icon / bg）",
    avatars: "Avatars",
    icons: "Icons",
    photos: "Photos",
    empty: "暂无内容",
    openRepo: "Open Repo",
    copy: "复制直链",
    open: "打开",
    close: "关闭",
    copied: "已复制",
    failed: "资源索引加载失败",
    retry: "重试",
  },
  en: {
    title: "Asset Library",
    search: "Search: category / group / filename (e.g. avatar / icon / bg)",
    avatars: "Avatars",
    icons: "Icons",
    photos: "Photos",
    empty: "No items",
    openRepo: "Open Repo",
    copy: "Copy link",
    open: "Open",
    close: "Close",
    copied: "Copied",
    failed: "Failed to load asset index",
    retry: "Retry",
  },
};

function t(key) {
  return (i18n[state.lang] && i18n[state.lang][key]) || key;
}

function repoUrlFromPages() {
  // https://username.github.io/repo/  -> https://github.com/username/repo
  const host = window.location.host; // username.github.io
  const username = host.split(".")[0];
  const parts = window.location.pathname.split("/").filter(Boolean);
  const repo = parts[0] || "";
  if (!repo) return `https://github.com/${username}`;
  return `https://github.com/${username}/${repo}`;
}

function assetPagesUrl(relPath) {
  // relPath: "avatars/avatar-1.jpg"
  return `${BASE}${relPath}`;
}

async function loadManifest() {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function normalizeManifest(m) {
  // Accept your current schema:
  // { generatedAt, categories: { avatars: { total, groups: { root: [...] } } } }
  // Also accept legacy:
  // { assets: { avatars: [], icons: [], photos: [] } }
  if (m?.categories) return m;
  if (m?.assets) {
    const toGroups = (arr) => ({ total: arr.length, groups: { root: arr } });
    return {
      generatedAt: new Date().toISOString(),
      categories: {
        avatars: toGroups(m.assets.avatars || []),
        icons: toGroups(m.assets.icons || []),
        photos: toGroups(m.assets.photos || []),
      },
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    categories: {
      avatars: { total: 0, groups: {} },
      icons: { total: 0, groups: {} },
      photos: { total: 0, groups: {} },
    },
  };
}

function setLang(next) {
  state.lang = next;
  render();
}

function setCategory(cat) {
  state.activeCategory = cat;
  // reset group to "root" or first available
  const groups = state.manifest?.categories?.[cat]?.groups || {};
  state.activeGroup = groups.root ? "root" : Object.keys(groups)[0] || "root";
  render();
}

function setGroup(group) {
  state.activeGroup = group;
  render();
}

function matchesQuery(path) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return path.toLowerCase().includes(q);
}

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  children.forEach((c) => el.appendChild(c));
  return el;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1200);
}

function openModal(itemPath) {
  const modal = $("#modal");
  const img = $("#modalImg");
  const link = $("#modalLink");

  const url = assetPagesUrl(itemPath);
  img.src = url;
  link.value = url;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = $("#modal");
  const img = $("#modalImg");
  img.src = "";
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function buildGroupChips(category) {
  const groups = state.manifest?.categories?.[category]?.groups || {};
  const names = Object.keys(groups);
  // hide if only root
  if (names.length <= 1 && names[0] === "root") return createEl("div", { class: "chips hidden" });

  const wrap = createEl("div", { class: "chips" });
  names.forEach((g) => {
    const btn = createEl("button", {
      class: `chip ${g === state.activeGroup ? "active" : ""}`,
      onClick: () => setGroup(g),
      type: "button",
    });
    btn.textContent = g;
    wrap.appendChild(btn);
  });
  return wrap;
}

function buildGrid(category, group) {
  const groups = state.manifest?.categories?.[category]?.groups || {};
  const list = (groups[group] || []).filter(matchesQuery);

  if (!list.length) {
    return createEl("div", { class: "empty" }, [createEl("div", { class: "emptyText", html: t("empty") })]);
  }

  const grid = createEl("div", { class: "grid" });
  list.forEach((p) => {
    const url = assetPagesUrl(p);

    const card = createEl("button", {
      class: "tile",
      type: "button",
      onClick: () => openModal(p),
      title: p,
    });

    const img = createEl("img", {
      class: "thumb",
      loading: "lazy",
      src: url,
      alt: p,
    });

    const name = p.split("/").pop();
    const cap = createEl("div", { class: "cap", html: `<span>${name}</span>` });

    card.appendChild(img);
    card.appendChild(cap);

    grid.appendChild(card);
  });

  return grid;
}

function buildCategoryPanel(categoryKey) {
  const cat = state.manifest?.categories?.[categoryKey] || { total: 0, groups: {} };
  const total = cat.total || 0;

  const header = createEl("div", { class: "panelHeader" }, [
    createEl("div", { class: "panelTitle" }, [
      createEl("div", { class: "panelName", html: t(categoryKey) }),
      createEl("div", { class: "panelCount", html: String(total) }),
    ]),
  ]);

  const chips = buildGroupChips(categoryKey);

  const body = createEl("div", { class: "panelBody noScrollBar" }, [
    chips,
    buildGrid(categoryKey, categoryKey === state.activeCategory ? state.activeGroup : "root"),
  ]);

  const panel = createEl("div", {
    class: `panel ${categoryKey === state.activeCategory ? "active" : ""}`,
  });

  panel.addEventListener("click", (e) => {
    // clicking inside should not switch category
    if (categoryKey !== state.activeCategory) setCategory(categoryKey);
    e.stopPropagation();
  });

  panel.appendChild(header);
  panel.appendChild(body);
  return panel;
}

function renderHeader() {
  $("#title").textContent = t("title");
  $("#search").setAttribute("placeholder", t("search"));
  $("#repoBtn").textContent = t("openRepo");
  $("#langBtn").textContent = state.lang.toUpperCase();
}

function renderMain() {
  const wrap = $("#panels");
  wrap.innerHTML = "";

  wrap.appendChild(buildCategoryPanel("avatars"));
  wrap.appendChild(buildCategoryPanel("icons"));
  wrap.appendChild(buildCategoryPanel("photos"));
}

function renderError() {
  $("#errorTitle").textContent = t("failed");
  $("#retryBtn").textContent = t("retry");
}

function render() {
  renderHeader();
  renderError();

  $("#repoBtn").setAttribute("href", repoUrlFromPages());

  if (!state.manifest) {
    $("#error").classList.add("show");
    $("#panels").innerHTML = "";
    return;
  }
  $("#error").classList.remove("show");
  renderMain();
}

async function boot() {
  $("#repoBtn").setAttribute("href", repoUrlFromPages());

  $("#langBtn").addEventListener("click", () => setLang(state.lang === "zh" ? "en" : "zh"));
  $("#search").addEventListener("input", (e) => {
    state.query = e.target.value || "";
    render();
  });

  $("#retryBtn").addEventListener("click", async () => {
    try {
      $("#error").classList.remove("show");
      const m = await loadManifest();
      state.manifest = normalizeManifest(m);
      setCategory(state.activeCategory);
    } catch (err) {
      $("#error").classList.add("show");
    }
  });

  // Modal
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  $("#copyBtn").addEventListener("click", async () => {
    const v = $("#modalLink").value;
    try {
      await navigator.clipboard.writeText(v);
      toast(t("copied"));
    } catch {
      // fallback
      $("#modalLink").select();
      document.execCommand("copy");
      toast(t("copied"));
    }
  });

  $("#openBtn").addEventListener("click", () => {
    window.open($("#modalLink").value, "_blank", "noopener,noreferrer");
  });

  try {
    const m = await loadManifest();
    state.manifest = normalizeManifest(m);
    setCategory("avatars");
  } catch (err) {
    state.manifest = null;
  }

  render();
}

boot();
