(() => {
  // ---------- Config ----------
  // GitHub Pages project path: /assets/
  // We compute base from current path to avoid hardcoding username.
  const BASE_PATH = (() => {
    // if hosted at https://byshelby.github.io/assets/...
    // pathname begins with /assets/...
    const p = window.location.pathname;
    // keep "/assets/" as base if present, otherwise "/"
    const idx = p.indexOf("/assets/");
    if (idx >= 0) return "/assets/";
    // fallback
    return "/";
  })();

  const MANIFEST_URL = `${BASE_PATH}data/manifest.json`;

  const i18n = {
    en: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      searchPh: "Search: category / group / filename",
      ready: "Ready",
      loading: "Loading…",
      loadFail: "Load failed",
      emptyGroup: "No files in this group.",
      copy: "Copy link",
      open: "Open",
      done: "Done",
      copied: "Link copied",
      copyFail: "Copy failed",
      avatars: "Avatars",
      icons: "Icons",
      photos: "Photos",
    },
    zh: {
      title: "资源库",
      subtitle: "搜索、预览并复制直链。",
      searchPh: "搜索：分类 / 分组 / 文件名",
      ready: "就绪",
      loading: "加载中…",
      loadFail: "加载失败",
      emptyGroup: "该分组暂无文件。",
      copy: "复制链接",
      open: "打开",
      done: "完成",
      copied: "已复制链接",
      copyFail: "复制失败",
      avatars: "头像",
      icons: "图标",
      photos: "图片",
    },
  };

  // ---------- DOM ----------
  const el = {
    title: document.getElementById("title"),
    subtitle: document.getElementById("subtitle"),
    search: document.getElementById("searchInput"),
    cards: document.getElementById("cards"),
    status: document.getElementById("statusPill"),
    langBtn: document.getElementById("langBtn"),
    repoBtn: document.getElementById("repoBtn"),
    toast: document.getElementById("toast"),

    modal: document.getElementById("modal"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalClose: document.getElementById("modalClose"),
    modalImg: document.getElementById("modalImg"),
    modalName: document.getElementById("modalName"),
    modalPath: document.getElementById("modalPath"),
    copyBtn: document.getElementById("copyBtn"),
    openBtn: document.getElementById("openBtn"),
    doneBtn: document.getElementById("doneBtn"),
  };

  // ---------- State ----------
  let lang = localStorage.getItem("asset_lang") || "en";
  if (!i18n[lang]) lang = "en";

  let manifest = null;
  let flatItems = []; // for search
  let currentItem = null;

  // ---------- Helpers ----------
  const t = (k) => i18n[lang][k] || i18n.en[k] || k;

  function setStatus(text, mode = "ok") {
    el.status.textContent = text;
    el.status.style.opacity = "1";
    if (mode === "fail") el.status.style.color = "rgba(255,255,255,0.75)";
    else el.status.style.color = "rgba(255,255,255,0.75)";
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove("show"), 1200);
  }

  function toDirectUrl(relPath) {
    // direct URL on pages: https://byshelby.github.io/assets/<relPath>
    // manifest stores paths like "avatars/avatar-1.jpg"
    return `${window.location.origin}${BASE_PATH}${relPath}`.replace(/([^:]\/)\/+/g, "$1");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  // ---------- Render ----------
  function buildFlatItems(m) {
    const items = [];
    const cats = m?.categories || {};
    Object.keys(cats).forEach((catKey) => {
      const cat = cats[catKey];
      const groups = cat?.groups || {};
      Object.keys(groups).forEach((groupKey) => {
        const arr = groups[groupKey] || [];
        arr.forEach((path) => {
          const name = path.split("/").pop();
          items.push({
            category: catKey,
            group: groupKey,
            path,
            name,
            url: toDirectUrl(path),
          });
        });
      });
    });
    return items;
  }

  function render() {
    el.title.textContent = t("title");
    el.subtitle.textContent = t("subtitle");
    el.search.placeholder = t("searchPh");
    el.status.textContent = t("ready");

    // repo link
    el.repoBtn.href = `https://github.com${BASE_PATH.replace(/\/$/,"")}`.includes("/assets")
      ? "https://github.com/byShelby/assets"
      : "https://github.com/byShelby/assets";

    // language button fixed width already in CSS
    el.langBtn.textContent = lang === "en" ? "EN" : "中文";

    // cards
    if (!manifest) {
      el.cards.innerHTML = "";
      return;
    }

    const q = normalize(el.search.value);

    const categories = manifest.categories || {};
    const catOrder = ["avatars", "icons", "photos"];
    const ordered = [...catOrder, ...Object.keys(categories).filter(k => !catOrder.includes(k))];

    el.cards.innerHTML = ordered
      .filter((k) => categories[k])
      .map((catKey) => renderCategory(catKey, categories[catKey], q))
      .join("");
  }

  function renderCategory(catKey, cat, q) {
    const titleKey = catKey === "avatars" ? "avatars" : catKey === "icons" ? "icons" : catKey === "photos" ? "photos" : catKey;
    const title = t(titleKey) || catKey;
    const total = cat?.total ?? 0;

    // pick first group (usually "root") for display like your current UI
    const groups = cat?.groups || {};
    const groupKeys = Object.keys(groups);
    const groupKey = groupKeys.includes("root") ? "root" : groupKeys[0] || "root";
    const list = groups[groupKey] || [];

    // filter by search
    const filtered = list.filter((p) => {
      if (!q) return true;
      const name = p.split("/").pop();
      const target = normalize(`${catKey} ${groupKey} ${name}`);
      return target.includes(q);
    });

    const body = filtered.length
      ? `<div class="grid">
          ${filtered
            .map((p) => {
              const name = p.split("/").pop();
              const url = toDirectUrl(p);
              return `
                <button class="thumb" type="button"
                  data-path="${escapeHtml(p)}"
                  data-name="${escapeHtml(name)}"
                  data-cat="${escapeHtml(catKey)}"
                  data-group="${escapeHtml(groupKey)}"
                  data-url="${escapeHtml(url)}"
                  title="${escapeHtml(p)}"
                >
                  <img loading="lazy" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" />
                </button>`;
            })
            .join("")}
        </div>`
      : `<div class="emptyBox">${t("emptyGroup")}</div>`;

    return `
      <article class="card" data-cat="${escapeHtml(catKey)}">
        <div class="cardHead">
          <div>
            <div class="cardTitle">${escapeHtml(title)}</div>
            <div class="cardMeta">${escapeHtml(groupKey)}</div>
          </div>
          <div class="badge">${escapeHtml(String(total))}</div>
        </div>

        <div class="groupChip">${escapeHtml(groupKey)}</div>

        <div class="cardBody">
          ${body}
        </div>
      </article>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Modal ----------
  function openModal(item) {
    currentItem = item;

    el.modal.classList.add("show");
    el.modal.setAttribute("aria-hidden", "false");

    el.modalName.textContent = item.name;
    el.modalPath.textContent = item.path;

    el.modalImg.src = item.url;
    el.modalImg.alt = item.name;

    el.openBtn.href = item.url;

    el.copyBtn.textContent = t("copy");
    el.openBtn.textContent = t("open");
    el.doneBtn.textContent = t("done");
  }

  function closeModal() {
    el.modal.classList.remove("show");
    el.modal.setAttribute("aria-hidden", "true");
    currentItem = null;
  }

  // ---------- Load ----------
  async function loadManifest() {
    setStatus(t("loading"));
    try {
      const res = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
      flatItems = buildFlatItems(manifest);
      setStatus(t("ready"));
      render();
    } catch (e) {
      console.error(e);
      setStatus(t("loadFail"), "fail");
      el.cards.innerHTML = "";
      toast(`${t("loadFail")}`);
    }
  }

  // ---------- Events ----------
  el.langBtn.addEventListener("click", () => {
    lang = lang === "en" ? "zh" : "en";
    localStorage.setItem("asset_lang", lang);
    render();
  });

  el.search.addEventListener("input", () => render());

  el.cards.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".thumb");
    if (!btn) return;
    const item = {
      path: btn.dataset.path,
      name: btn.dataset.name,
      category: btn.dataset.cat,
      group: btn.dataset.group,
      url: btn.dataset.url,
    };
    openModal(item);
  });

  el.modalBackdrop.addEventListener("click", closeModal);
  el.modalClose.addEventListener("click", closeModal);
  el.doneBtn.addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.modal.classList.contains("show")) closeModal();
  });

  el.copyBtn.addEventListener("click", async () => {
    if (!currentItem) return;
    const ok = await copyText(currentItem.url);
    if (ok) toast(t("copied"));
    else toast(t("copyFail"));
  });

  // prevent page scroll by wheel when mouse is on stage background
  // (cards scroll themselves)
  window.addEventListener(
    "wheel",
    (e) => {
      const inCardBody = e.target.closest(".cardBody");
      if (inCardBody) return; // allow card internal scroll
      // otherwise block page scroll
      e.preventDefault();
    },
    { passive: false }
  );

  // ---------- Init ----------
  render();
  loadManifest();
})();
