(() => {
  const MANIFEST_PATH = "./data/manifest.json";

  const elCards = document.getElementById("cards");
  const elStatus = document.getElementById("status");
  const elSearch = document.getElementById("search");
  const elToast = document.getElementById("toast");

  const elLangBtn = document.getElementById("langBtn");
  const elRepoBtn = document.getElementById("repoBtn");
  const elTitle = document.getElementById("title");
  const elSubtitle = document.getElementById("subtitle");

  const modal = document.getElementById("modal");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalClose = document.getElementById("modalClose");
  const modalImg = document.getElementById("modalImg");
  const modalName = document.getElementById("modalName");
  const modalPath = document.getElementById("modalPath");
  const copyBtn = document.getElementById("copyBtn");
  const openBtn = document.getElementById("openBtn");
  const doneBtn = document.getElementById("doneBtn");

  let manifest = null;
  let lang = localStorage.getItem("assets_lang") || "en";
  let currentItem = null;
  let toastTimer = null;

  // ✅ Track selected thumbnail element
  let selectedThumbEl = null;

  const I18N = {
    en: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      searchPH: "Search: category / group / filename",
      loading: "Loading…",
      ready: "Ready",
      loadFailed: "Load failed",
      copy: "Copy link",
      open: "Open",
      done: "Done",
      copied: "Link copied",
      copyFail: "Copy failed",
      empty: "No files in this group.",
      imgFail: "Image failed to load"
    },
    zh: {
      title: "资源库",
      subtitle: "搜索、预览并复制直链。",
      searchPH: "搜索：分类 / 分组 / 文件名",
      loading: "加载中…",
      ready: "就绪",
      loadFailed: "加载失败",
      copy: "复制链接",
      open: "打开",
      done: "完成",
      copied: "链接已复制",
      copyFail: "复制失败",
      empty: "此分组暂无文件。",
      imgFail: "图片加载失败"
    }
  };

  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function setLang(next) {
    lang = next;
    localStorage.setItem("assets_lang", lang);
    elLangBtn.textContent = lang === "zh" ? "中文" : "EN";
    elTitle.textContent = t("title");
    elSubtitle.textContent = t("subtitle");
    elSearch.placeholder = t("searchPH");
    copyBtn.textContent = t("copy");
    openBtn.textContent = t("open");
    doneBtn.textContent = t("done");
    render(); // 文案刷新，不改布局
  }

  function baseUrl() {
    // GitHub Pages: https://xxx.github.io/assets/  -> 保证以 /assets/ 结尾
    let p = location.pathname;
    if (!p.endsWith("/")) p = p.replace(/\/[^/]*$/, "/");
    return location.origin + p;
  }

  function absUrl(path) {
    return baseUrl() + path.replace(/^\/+/, "");
  }

  // ✅ Always keep toast above modal (even if CSS got messy later)
  function ensureToastOnTop() {
    if (!elToast) return;
    elToast.style.position = "fixed";
    elToast.style.zIndex = "9999";
  }

  function toast(msg, ok = true) {
    ensureToastOnTop();
    elToast.textContent = msg;
    elToast.classList.add("show");
    elToast.setAttribute("data-ok", ok ? "1" : "0");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove("show"), 1200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("copied"), true);
      return true;
    } catch (e) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) {
          toast(t("copied"), true);
          return true;
        }
      } catch (_) {}
      toast(t("copyFail"), false);
      return false;
    }
  }

  // ✅ helpers for selected state
  function clearSelectedThumb() {
    if (selectedThumbEl) selectedThumbEl.classList.remove("selected");
    selectedThumbEl = null;
  }
  function setSelectedThumb(el) {
    if (!el) return;
    clearSelectedThumb();
    selectedThumbEl = el;
    selectedThumbEl.classList.add("selected");
  }

  function openModal(item, thumbEl) {
    currentItem = item;

    // ✅ selected feedback
    if (thumbEl) setSelectedThumb(thumbEl);

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    const url = absUrl(item.path);

    // ✅ modal image load feedback
    modalImg.onerror = () => {
      toast(t("imgFail"), false);
    };
    modalImg.onload = () => {
      // no toast, keep clean
    };
    modalImg.src = url;

    modalName.textContent = item.name;
    modalPath.textContent = item.path;
    openBtn.href = url;
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    currentItem = null;

    // ✅ clear selected when closing modal
    clearSelectedThumb();
  }

  function normalizeQuery(q) {
    return String(q || "").trim().toLowerCase();
  }

  function buildItems() {
    const out = [];
    if (!manifest?.categories) return out;

    for (const [catName, cat] of Object.entries(manifest.categories)) {
      const groups = cat.groups || {};
      for (const [groupName, arr] of Object.entries(groups)) {
        const files = Array.isArray(arr) ? arr : [];
        for (const p of files) {
          const name = String(p).split("/").pop();
          out.push({
            category: catName,
            group: groupName,
            path: p,
            name,
            url: absUrl(p)
          });
        }
      }
    }
    return out;
  }

  function groupByCategory(items) {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, new Map());
      const gmap = map.get(it.category);
      if (!gmap.has(it.group)) gmap.set(it.group, []);
      gmap.get(it.group).push(it);
    }
    return map;
  }

  function cardTitle(cat) {
    if (lang === "zh") {
      if (cat === "avatars") return "头像";
      if (cat === "icons") return "图标";
      if (cat === "photos") return "图片";
    }
    if (cat === "avatars") return "Avatars";
    if (cat === "icons") return "Icons";
    if (cat === "photos") return "Photos";
    return cat;
  }

  function createCard(cat, total, groupName, items) {
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "cardHead";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "cardTitle";
    title.textContent = cardTitle(cat);

    const meta = document.createElement("div");
    meta.className = "cardMeta";
    meta.textContent = groupName;

    left.appendChild(title);
    left.appendChild(meta);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = String(total || 0);

    head.appendChild(left);
    head.appendChild(badge);

    const groupChip = document.createElement("div");
    groupChip.className = "groupChip";
    groupChip.textContent = groupName;

    const body = document.createElement("div");
    body.className = "cardBody";

    if (!items || items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "emptyBox";
      empty.textContent = t("empty");
      body.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "grid";

      for (const it of items) {
        const thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.title = it.path;

        // ✅ keyboard focus support (does not change layout)
        thumb.tabIndex = 0;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = it.url;
        img.alt = it.name;

        // ✅ image fail feedback (non-intrusive)
        img.onerror = () => {
          // only show a toast if user is likely interacting (avoid spam)
          // still: keep it simple
          toast(t("imgFail"), false);
        };

        thumb.appendChild(img);

        thumb.addEventListener("click", () => openModal(it, thumb));
        thumb.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(it, thumb);
          }
        });

        grid.appendChild(thumb);
      }

      body.appendChild(grid);
    }

    card.appendChild(head);
    card.appendChild(groupChip);
    card.appendChild(body);
    return card;
  }

  function pickMainGroup(groupsMap) {
    if (groupsMap.has("root")) return "root";
    const it = groupsMap.keys().next();
    return it.done ? "root" : it.value;
  }

  function render() {
    elCards.innerHTML = "";
    clearSelectedThumb(); // ✅ avoid stale selection after search/filter

    if (!manifest) return;

    const allItems = buildItems();
    const q = normalizeQuery(elSearch.value);

    const filtered = q
      ? allItems.filter((x) => {
          const hay = `${x.category}/${x.group}/${x.name}`.toLowerCase();
          return hay.includes(q);
        })
      : allItems;

    const byCat = groupByCategory(filtered);

    const categories = ["avatars", "icons", "photos"];
    for (const cat of categories) {
      const catObj = manifest.categories?.[cat] || { total: 0, groups: {} };
      const gmap = byCat.get(cat) || new Map();

      const mainGroup = pickMainGroup(
        gmap.size ? gmap : new Map(Object.entries(catObj.groups || {}))
      );
      const list = gmap.get(mainGroup) || [];
      const total = catObj.total || 0;

      elCards.appendChild(createCard(cat, total, mainGroup, list));
    }
  }

  async function loadManifest() {
    try {
      elStatus.textContent = t("loading");

      elRepoBtn.href =
        "https://github.com/" +
        (location.hostname.split(".github.io")[0] || "byShelby") +
        "/assets";

      const res = await fetch(MANIFEST_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error("manifest http " + res.status);
      manifest = await res.json();

      elStatus.textContent = t("ready");
      render();
    } catch (e) {
      console.error(e);
      elStatus.textContent = t("loadFailed");
      manifest =
        manifest || {
          categories: {
            avatars: { total: 0, groups: {} },
            icons: { total: 0, groups: {} },
            photos: { total: 0, groups: {} }
          }
        };
      render();
    }
  }

  // events
  elSearch.addEventListener("input", () => render());

  elLangBtn.addEventListener("click", () => {
    setLang(lang === "en" ? "zh" : "en");
  });

  modalBackdrop.addEventListener("click", closeModal);
  modalClose.addEventListener("click", closeModal);
  doneBtn.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  copyBtn.addEventListener("click", async () => {
    if (!currentItem) return;
    await copyText(absUrl(currentItem.path));
  });

  // init
  ensureToastOnTop();
  setLang(lang);
  loadManifest();
})();
