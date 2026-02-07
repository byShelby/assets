const $ = (id) => document.getElementById(id);

const state = {
  lang: "en",
  manifest: null,
  base: "",
  repo: "",
  currentCategory: "avatars",
  currentGroup: "root",
  filtered: [],
  flat: [],
  modalIndex: -1,
};

const i18n = {
  en: {
    title: "Your Asset Library",
    subtitle: "Search, preview, and copy direct links. Clean, fast, and stable.",
    search: "Search: category / group / filename (e.g. avatar-1, icons, bg)",
    openRepo: "Open Repo",
    copy: "Copy link",
    open: "Open",
    done: "Done",
    empty: "No assets in this category.",
    loaded: (n) => `Loaded ${n} items`,
  },
  zh: {
    title: "你的资源库",
    subtitle: "搜索、预览、复制直链。干净、快速、稳定。",
    search: "搜索：分类 / 分组 / 文件名（例如 avatar-1 / icons / bg）",
    openRepo: "打开仓库",
    copy: "复制链接",
    open: "打开",
    done: "完成",
    empty: "该分类暂无资源。",
    loaded: (n) => `已加载 ${n} 个`,
  },
};

function text(key, ...args) {
  const t = i18n[state.lang][key];
  return typeof t === "function" ? t(...args) : t;
}

function computeBase() {
  // Ensures base ends with "/assets/" when hosted at https://xxx.github.io/assets/
  const url = new URL(window.location.href);
  // "." gives directory of current page (with trailing slash)
  const base = new URL(".", url).href;
  return base.endsWith("/") ? base : base + "/";
}

function computeRepoUrl() {
  // Best effort: infer owner/repo from /assets/ path => owner.github.io + repo = "assets"
  // If your repo name isn't "assets", set it manually below.
  const host = window.location.hostname; // byShelby.github.io
  const owner = host.split(".")[0];
  const repo = "assets"; // <-- if your repo name differs, change it here.
  return `https://github.com/${owner}/${repo}`;
}

function absUrl(relPath) {
  // manifest paths are like "avatars/avatar-1.jpg"
  return state.base + relPath.replace(/^\/+/, "");
}

async function loadManifest() {
  state.base = computeBase();
  state.repo = computeRepoUrl();

  const res = await fetch(state.base + "data/manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("manifest fetch failed");
  state.manifest = await res.json();

  // Build a flat list for search + modal navigation
  const cats = state.manifest.categories || {};
  state.flat = [];
  for (const [catName, cat] of Object.entries(cats)) {
    const groups = (cat && cat.groups) || {};
    for (const [groupName, items] of Object.entries(groups)) {
      for (const p of items) {
        state.flat.push({ category: catName, group: groupName, path: p, url: absUrl(p) });
      }
    }
  }
}

function renderTabs() {
  const tabs = $("tabs");
  tabs.innerHTML = "";

  const cats = state.manifest.categories || {};
  const catNames = Object.keys(cats);

  catNames.forEach((catName) => {
    const total = cats[catName]?.total ?? 0;
    const btn = document.createElement("button");
    btn.className = "chip" + (state.currentCategory === catName ? " active" : "");
    btn.type = "button";
    btn.textContent = `${catName} · ${total}`;
    btn.onclick = () => {
      state.currentCategory = catName;
      state.currentGroup = "root";
      $("search").value = "";
      renderAll();
    };
    tabs.appendChild(btn);
  });
}

function getCurrentItems() {
  const cats = state.manifest.categories || {};
  const cat = cats[state.currentCategory];
  const groups = (cat && cat.groups) || {};
  const groupNames = Object.keys(groups);

  // If currentGroup not exist, fallback to first group or "root"
  if (!groups[state.currentGroup]) {
    state.currentGroup = groupNames.includes("root") ? "root" : (groupNames[0] || "root");
  }

  const items = groups[state.currentGroup] || [];
  return { items, groupNames };
}

function renderGrid(list) {
  const grid = $("grid");
  grid.innerHTML = "";

  if (!list.length) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = text("empty");
    grid.appendChild(div);
    return;
  }

  list.forEach((it) => {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.className = "thumb";
    img.loading = "lazy";
    img.src = it.url;
    img.alt = it.path;

    const meta = document.createElement("div");
    meta.className = "meta";

    const tag = document.createElement("div");
    tag.className = "tag mono";
    tag.textContent = it.path.split("/").pop();

    const badge = document.createElement("div");
    badge.className = "badge mono";
    badge.textContent = it.category;

    meta.appendChild(tag);
    meta.appendChild(badge);

    card.appendChild(img);
    card.appendChild(meta);

    const open = () => openModalByPath(it.path);
    card.onclick = open;
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") open();
    };

    grid.appendChild(card);
  });
}

function renderStatus(n) {
  $("status").textContent = text("loaded", n);
}

function renderAll() {
  // Top copy & text
  $("title").textContent = text("title");
  $("subtitle").textContent = text("subtitle");
  $("search").placeholder = text("search");
  $("repoBtn").textContent = text("openRepo");
  $("repoBtn").href = state.repo;
  $("langBtn").textContent = state.lang.toUpperCase();
  $("copyBtn").textContent = text("copy");
  $("openBtn").textContent = text("open");
  $("closeBtn").textContent = text("done");

  renderTabs();

  const q = $("search").value.trim().toLowerCase();
  let list = [];

  if (q) {
    list = state.flat.filter((x) => {
      const s = `${x.category}/${x.group}/${x.path}`.toLowerCase();
      return s.includes(q);
    });
  } else {
    const { items } = getCurrentItems();
    list = items.map((p) => ({
      category: state.currentCategory,
      group: state.currentGroup,
      path: p,
      url: absUrl(p),
    }));
  }

  state.filtered = list;
  renderGrid(list);
  renderStatus(list.length);
}

function openModalByPath(path) {
  // Prefer current filtered list order for navigation
  const idx = state.filtered.findIndex((x) => x.path === path);
  state.modalIndex = idx >= 0 ? idx : 0;
  showModal();
}

function showModal() {
  const modal = $("modal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  syncModal();
}

function closeModal() {
  const modal = $("modal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function syncModal() {
  const it = state.filtered[state.modalIndex];
  if (!it) return;

  $("modalImg").src = it.url;
  $("modalPath").textContent = it.path;
  $("modalMeta").textContent = `${it.category}${it.group ? ` / ${it.group}` : ""}`;
  $("openBtn").href = it.url;

  // Copy
  $("copyBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(it.url);
      $("copyBtn").textContent = "Copied ✓";
      setTimeout(() => ($("copyBtn").textContent = text("copy")), 900);
    } catch {
      // fallback
      prompt("Copy this link:", it.url);
    }
  };
}

function prev() {
  if (!state.filtered.length) return;
  state.modalIndex = (state.modalIndex - 1 + state.filtered.length) % state.filtered.length;
  syncModal();
}
function next() {
  if (!state.filtered.length) return;
  state.modalIndex = (state.modalIndex + 1) % state.filtered.length;
  syncModal();
}

function bindEvents() {
  $("search").addEventListener("input", () => renderAll());
  $("langBtn").onclick = () => {
    state.lang = state.lang === "en" ? "zh" : "en";
    renderAll();
  };

  $("modalBackdrop").onclick = closeModal;
  $("closeBtn").onclick = closeModal;
  $("prevBtn").onclick = prev;
  $("nextBtn").onclick = next;

  window.addEventListener("keydown", (e) => {
    const modalOpen = $("modal").classList.contains("show");
    if (!modalOpen) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });
}

(async function init() {
  try {
    bindEvents();
    await loadManifest();
    renderAll();
  } catch (e) {
    $("status").textContent = "Load failed";
    $("grid").innerHTML = `<div class="empty">Manifest load failed. Check <span class="mono">/data/manifest.json</span>.</div>`;
    console.error(e);
  }
})();
