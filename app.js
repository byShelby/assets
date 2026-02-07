// ✅ Stable base for GitHub Project Pages (/assets/) even if opened as /assets (no trailing slash)
const BASE = new URL(document.baseURI); // .../assets/
const MANIFEST_URL = new URL("data/manifest.json", BASE);

const $ = (id) => document.getElementById(id);

const state = {
  manifest: null,
  query: "",
  lang: "en",
};

// Minimal i18n (clean, product-like)
const I18N = {
  en: {
    title: "Asset Library",
    subtitle: "Search, preview, and copy direct links.",
    placeholder: "Search: category / group / filename",
    openRepo: "Open Repo",
    loadFailed: "Manifest load failed. Check /assets/data/manifest.json",
    empty: "No assets found",
    category: {
      avatars: "Avatars",
      icons: "Icons",
      photos: "Photos",
    },
  },
  zh: {
    title: "资源库",
    subtitle: "搜索、预览，并复制直链。",
    placeholder: "搜索：分类 / 分组 / 文件名",
    openRepo: "打开仓库",
    loadFailed: "资源清单加载失败：请检查 /assets/data/manifest.json",
    empty: "没有找到资源",
    category: {
      avatars: "头像",
      icons: "图标",
      photos: "图片",
    },
  },
};

function t() {
  return I18N[state.lang];
}

function absUrl(path) {
  // path like "avatars/avatar-1.jpg"
  return new URL(path.replace(/^\//, ""), BASE).toString();
}

function setStatus(text = "") {
  $("status").textContent = text;
}

function setLang(lang) {
  state.lang = lang;
  $("langBtn").textContent = lang.toUpperCase();
  $("title").textContent = t().title;
  $("subtitle").textContent = t().subtitle;
  $("q").placeholder = t().placeholder;
  $("repoBtn").textContent = t().openRepo;
  render();
}

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function matchesQuery(path, category, group) {
  const q = normalize(state.query);
  if (!q) return true;
  const hay = normalize(`${category} ${group} ${path}`);
  return hay.includes(q);
}

// UI rendering
function cardTemplate({ categoryKey, groupKey, items }) {
  const label = t().category[categoryKey] || categoryKey;
  const count = items.length;

  const thumbs = items.slice(0, 12).map((p) => {
    const url = absUrl(p);
    const name = p.split("/").pop();
    return `
      <button class="thumb" type="button" data-path="${p}" title="${name}">
        <img loading="lazy" decoding="async" src="${url}" alt="${name}" />
      </button>
    `;
  }).join("");

  const more = count > 12 ? `<div class="more">+${count - 12}</div>` : "";

  return `
    <article class="card">
      <div class="cardTop">
        <div>
          <div class="cardTitle">${label}</div>
          <div class="cardSub">${groupKey === "root" ? "root" : groupKey}</div>
        </div>
        <div class="chip">${count}</div>
      </div>

      <div class="thumbGrid">
        ${thumbs}
        ${more}
      </div>
    </article>
  `;
}

function flattenForCategory(catKey, catObj) {
  const groups = catObj?.groups || {};
  const entries = Object.entries(groups);
  // sort group names: root first
  entries.sort((a, b) => (a[0] === "root" ? -1 : b[0] === "root" ? 1 : a[0].localeCompare(b[0])));
  return entries.map(([groupKey, arr]) => ({ categoryKey: catKey, groupKey, items: arr || [] }));
}

function render() {
  const grid = $("grid");
  grid.innerHTML = "";

  if (!state.manifest?.categories) {
    return;
  }

  const cards = [];
  for (const catKey of ["avatars", "icons", "photos"]) {
    const catObj = state.manifest.categories[catKey];
    const groups = flattenForCategory(catKey, catObj);
    for (const g of groups) {
      const filtered = (g.items || []).filter((p) => matchesQuery(p, g.categoryKey, g.groupKey));
      if (filtered.length) {
        cards.push(cardTemplate({ categoryKey: g.categoryKey, groupKey: g.groupKey, items: filtered }));
      }
    }
  }

  if (!cards.length) {
    grid.innerHTML = `<div class="empty">${t().empty}</div>`;
    return;
  }

  grid.innerHTML = cards.join("");

  // bind click to open modal
  grid.querySelectorAll(".thumb").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.getAttribute("data-path")));
  });
}

// Modal
function openModal(path) {
  const name = path.split("/").pop();
  const url = absUrl(path);

  $("modalTitle").textContent = name;
  $("modalImg").src = url;
  $("openBtn").href = url;

  $("modal").classList.add("show");
  $("modal").setAttribute("aria-hidden", "false");

  // Copy direct link
  $("copyBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      $("copyBtn").textContent = "Copied";
      setTimeout(() => ($("copyBtn").textContent = "Copy link"), 900);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      $("copyBtn").textContent = "Copied";
      setTimeout(() => ($("copyBtn").textContent = "Copy link"), 900);
    }
  };
}

function closeModal() {
  $("modal").classList.remove("show");
  $("modal").setAttribute("aria-hidden", "true");
}

async function loadManifest() {
  setStatus("");

  try {
    const res = await fetch(MANIFEST_URL.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.manifest = await res.json();
    setStatus("");
    render();
  } catch (e) {
    console.error(e);
    setStatus(t().loadFailed);
  }
}

function main() {
  // Repo button
  $("repoBtn").href = "https://github.com/" + location.host.split(".")[0] + "/assets";

  // Search
  $("q").addEventListener("input", (ev) => {
    state.query = ev.target.value || "";
    render();
  });

  // Lang
  $("langBtn").addEventListener("click", () => {
    setLang(state.lang === "en" ? "zh" : "en");
  });

  // Modal close
  $("closeBtn").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // init UI text
  setLang(state.lang);

  // load
  loadManifest();
}

main();
