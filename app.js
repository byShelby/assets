(() => {
  const $ = (s) => document.querySelector(s);

  const cardsEl = $("#cards");
  const searchInput = $("#searchInput");
  const statusPill = $("#statusPill");

  const langBtn = $("#langBtn");
  const langText = langBtn.querySelector(".chip-text");
  const repoBtn = $("#repoBtn");

  const modal = $("#modal");
  const modalBackdrop = $("#modalBackdrop");
  const modalClose = $("#modalClose");
  const doneBtn = $("#doneBtn");
  const copyBtn = $("#copyBtn");
  const openBtn = $("#openBtn");
  const modalImg = $("#modalImg");
  const modalName = $("#modalName");
  const modalMeta = $("#modalMeta");
  const toast = $("#toast");

  const i18n = {
    en: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      searchPh: "Search: category / group / filename",
      ready: "Ready",
      loading: "Loading",
      failed: "Load failed",
      noFiles: "No files in this group.",
      copy: "Copy link",
      open: "Open",
      done: "Done",
      copied: "Copied to clipboard",
      copyFailed: "Copy failed (browser blocked)",
      avatarsDesc: "Avatars",
      iconsDesc: "Icons",
      photosDesc: "Photos",
    },
    zh: {
      title: "资源库",
      subtitle: "搜索、预览、一键复制直链。",
      searchPh: "搜索：分类 / 分组 / 文件名",
      ready: "就绪",
      loading: "加载中",
      failed: "加载失败",
      noFiles: "这个分组没有文件。",
      copy: "复制链接",
      open: "打开",
      done: "完成",
      copied: "已复制到剪贴板",
      copyFailed: "复制失败（浏览器限制）",
      avatarsDesc: "头像",
      iconsDesc: "图标",
      photosDesc: "图片",
    },
  };

  const state = {
    lang: "en",
    manifest: null,
    flatList: [], // {category, group, path, url}
    current: null,
    filter: "",
    activeGroup: { avatars: "root", icons: "root", photos: "root" },
  };

  function baseUrlFor(path) {
    // GitHub Pages 项目页：/assets/ + 相对路径
    return new URL("./" + path, window.location.href).toString();
  }

  function setStatus(kind) {
    const t = i18n[state.lang];
    if (kind === "loading") statusPill.textContent = t.loading;
    else if (kind === "failed") statusPill.textContent = t.failed;
    else statusPill.textContent = t.ready;
  }

  function setLang(next) {
    state.lang = next;
    const t = i18n[state.lang];
    $("#title").textContent = t.title;
    $("#subtitle").textContent = t.subtitle;
    searchInput.placeholder = t.searchPh;
    langText.textContent = state.lang === "en" ? "EN" : "中";
    setStatus(state.manifest ? "ready" : "loading");

    // 不让“语言切换”影响布局：按钮固定宽度 + 文案短
  }

  function toastShow(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 1400);
  }

  async function safeCopy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toastShow(i18n[state.lang].copied);
      return true;
    } catch (e) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        toastShow(ok ? i18n[state.lang].copied : i18n[state.lang].copyFailed);
        return ok;
      } catch {
        toastShow(i18n[state.lang].copyFailed);
        return false;
      }
    }
  }

  function openModal(item) {
    state.current = item;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    // 防止页面滚动（虽然 body 已 overflow hidden，但这里保险）
    document.body.style.overflow = "hidden";

    modalName.textContent = item.path;
    modalMeta.textContent = ` · ${item.category}/${item.group}`;
    modalImg.src = item.url;
    openBtn.href = item.url;

    copyBtn.textContent = i18n[state.lang].copy;
    openBtn.textContent = i18n[state.lang].open;
    doneBtn.textContent = i18n[state.lang].done;
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    state.current = null;
    document.body.style.overflow = "hidden";
  }

  function normalize(s) {
    return (s || "").toLowerCase().trim();
  }

  function buildFlatList(manifest) {
    const list = [];
    const cats = manifest?.categories || {};
    for (const category of Object.keys(cats)) {
      const groups = cats[category]?.groups || {};
      for (const group of Object.keys(groups)) {
        const files = groups[group] || [];
        for (const path of files) {
          list.push({
            category,
            group,
            path,
            url: baseUrlFor(path),
          });
        }
      }
    }
    state.flatList = list;
  }

  function matchesFilter(item) {
    const f = normalize(state.filter);
    if (!f) return true;
    const hay = normalize(`${item.category} ${item.group} ${item.path}`);
    return hay.includes(f);
  }

  function cardTitle(category) {
    const t = i18n[state.lang];
    if (category === "avatars") return t.avatarsDesc;
    if (category === "icons") return t.iconsDesc;
    if (category === "photos") return t.photosDesc;
    return category;
  }

  function render() {
    const t = i18n[state.lang];
    const manifest = state.manifest;
    if (!manifest) return;

    const cats = manifest.categories || {};
    cardsEl.innerHTML = "";

    const wanted = ["avatars", "icons", "photos"];
    for (const category of wanted) {
      const c = cats[category] || { total: 0, groups: {} };
      const groups = c.groups || {};
      const groupNames = Object.keys(groups).length ? Object.keys(groups) : ["root"];

      if (!state.activeGroup[category]) state.activeGroup[category] = groupNames[0] || "root";
      if (!groupNames.includes(state.activeGroup[category])) state.activeGroup[category] = groupNames[0] || "root";

      const card = document.createElement("div");
      card.className = "card";

      // head
      const head = document.createElement("div");
      head.className = "card-head";

      const title = document.createElement("div");
      title.className = "card-title";
      title.innerHTML = `<strong>${cardTitle(category)}</strong><span>${state.activeGroup[category]}</span>`;

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = String(c.total ?? 0);

      head.appendChild(title);
      head.appendChild(badge);

      // groups
      const groupRow = document.createElement("div");
      groupRow.className = "group-row";
      for (const g of groupNames) {
        const pill = document.createElement("div");
        pill.className = "group-pill" + (g === state.activeGroup[category] ? " active" : "");
        pill.textContent = g;
        pill.addEventListener("click", () => {
          state.activeGroup[category] = g;
          render();
        });
        groupRow.appendChild(pill);
      }

      // body
      const body = document.createElement("div");
      body.className = "card-body";

      const scroller = document.createElement("div");
      scroller.className = "scroller";

      // ✅ 关键：滚轮只滚 scroller，不滚页面
      scroller.addEventListener(
        "wheel",
        (e) => {
          // 允许内部滚动，阻止外层滚动链
          const atTop = scroller.scrollTop === 0;
          const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
          if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
            e.preventDefault();
          }
        },
        { passive: false }
      );

      const grid = document.createElement("div");
      grid.className = "grid";

      const files = (groups[state.activeGroup[category]] || []).map((path) => ({
        category,
        group: state.activeGroup[category],
        path,
        url: baseUrlFor(path),
      }));

      const shown = files.filter(matchesFilter);

      if (!shown.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = t.noFiles;
        scroller.appendChild(empty);
      } else {
        for (const item of shown) {
          const cell = document.createElement("div");
          cell.className = "thumb";
          const img = document.createElement("img");
          img.loading = "lazy";
          img.decoding = "async";
          img.src = item.url;
          img.alt = item.path;

          // 图片加载失败时，用占位，避免布局崩
          img.onerror = () => {
            img.remove();
            cell.style.background = "rgba(255,255,255,.04)";
          };

          cell.appendChild(img);
          cell.title = item.path;

          cell.addEventListener("click", () => openModal(item));
          grid.appendChild(cell);
        }
        scroller.appendChild(grid);
      }

      body.appendChild(scroller);

      card.appendChild(head);
      card.appendChild(groupRow);
      card.appendChild(body);

      cardsEl.appendChild(card);
    }
  }

  async function loadManifest() {
    setStatus("loading");
    try {
      // ✅ 强制走相对路径，避免 /assets/ 子路径错乱
      const url = baseUrlFor("data/manifest.json");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      state.manifest = manifest;
      buildFlatList(manifest);
      setStatus("ready");
      render();
    } catch (e) {
      console.error(e);
      setStatus("failed");
      // 页面仍然保持优雅，不要把错误文案堆屏幕中间
      cardsEl.innerHTML = "";
    }
  }

  function bind() {
    // lang toggle
    langBtn.addEventListener("click", () => {
      setLang(state.lang === "en" ? "zh" : "en");
      render();
    });

    // search
    searchInput.addEventListener("input", () => {
      state.filter = searchInput.value || "";
      render();
    });

    // modal
    modalBackdrop.addEventListener("click", closeModal);
    modalClose.addEventListener("click", closeModal);
    doneBtn.addEventListener("click", closeModal);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    copyBtn.addEventListener("click", async () => {
      if (!state.current) return;
      await safeCopy(state.current.url);
    });
  }

  // init
  setLang("en");
  bind();
  loadManifest();
})();
