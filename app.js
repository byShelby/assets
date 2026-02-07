(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const cardsEl = $("#cards");
  const statusPill = $("#statusPill");
  const searchInput = $("#searchInput");

  const langBtn = $("#langBtn");
  const langLabel = $("#langLabel");

  const repoBtn = $("#repoBtn");

  const modal = $("#modal");
  const modalBackdrop = $("#modalBackdrop");
  const modalClose = $("#modalClose");
  const modalImg = $("#modalImg");
  const modalName = $("#modalName");
  const modalUrl = $("#modalUrl");

  const btnCopy = $("#btnCopy");
  const btnOpen = $("#btnOpen");
  const btnDone = $("#btnDone");

  const toast = $("#toast");

  const TEXT = {
    en: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      searchPh: "Search: category / group / filename",
      ready: "Ready",
      loading: "Loading…",
      loadFailed: "Load failed",
      noFiles: "No files in this group.",
      copy: "Copy link",
      open: "Open",
      done: "Done",
      copied: "Copied",
      copyFailed: "Copy failed"
    },
    zh: {
      title: "资源库",
      subtitle: "搜索、预览并复制直链。",
      searchPh: "搜索：分类 / 分组 / 文件名",
      ready: "就绪",
      loading: "加载中…",
      loadFailed: "加载失败",
      noFiles: "这个分组没有文件。",
      copy: "复制链接",
      open: "打开",
      done: "完成",
      copied: "已复制",
      copyFailed: "复制失败"
    }
  };

  let lang = "en";
  let manifest = null;

  const state = {
    selected: { category: "avatars", group: "root" },
    query: "",
    modalItem: null
  };

  function setText() {
    const t = TEXT[lang];
    $("#title").textContent = t.title;
    $("#subtitle").textContent = t.subtitle;
    searchInput.placeholder = t.searchPh;
    statusPill.textContent = t.ready;
    btnCopy.textContent = t.copy;
    btnDone.textContent = t.done;
    btnOpen.textContent = t.open;
    langLabel.textContent = lang === "en" ? "EN" : "中文";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toast.classList.remove("show"), 1300);
  }

  function baseUrl() {
    // assets 页面的 base：.../assets/
    return new URL("./", window.location.href);
  }

  function urlFor(path) {
    return new URL(path, baseUrl()).href;
  }

  async function loadManifest() {
    const t = TEXT[lang];
    statusPill.textContent = t.loading;
    try {
      const u = urlFor("data/manifest.json");
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
      statusPill.textContent = t.ready;
      render();
    } catch (e) {
      console.error(e);
      statusPill.textContent = t.loadFailed;
      cardsEl.innerHTML = "";
      const fail = document.createElement("div");
      fail.className = "mono";
      fail.style.opacity = "0.75";
      fail.style.padding = "14px 6px";
      fail.textContent = `${t.loadFailed}: data/manifest.json`;
      cardsEl.appendChild(fail);
    }
  }

  function categoryTitle(key) {
    if (key === "avatars") return "Avatars";
    if (key === "icons") return "Icons";
    if (key === "photos") return "Photos";
    return key;
  }

  function filterList(list) {
    const q = state.query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p => p.toLowerCase().includes(q));
  }

  function makeCard(categoryKey, cat) {
    const total = cat?.total || 0;
    const groups = cat?.groups || {};
    const groupNames = Object.keys(groups);
    const activeGroup = (state.selected.category === categoryKey) ? state.selected.group : (groupNames[0] || "root");
    const files = filterList(groups[activeGroup] || []);

    const card = document.createElement("div");
    card.className = "card";

    // head
    const head = document.createElement("div");
    head.className = "card-head";

    const title = document.createElement("div");
    title.className = "card-title";

    const strong = document.createElement("strong");
    strong.textContent = categoryTitle(categoryKey);

    const sub = document.createElement("span");
    sub.textContent = activeGroup;

    title.appendChild(strong);
    title.appendChild(sub);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = String(total);

    head.appendChild(title);
    head.appendChild(badge);

    // group pills
    const groupRow = document.createElement("div");
    groupRow.className = "group-row";

    (groupNames.length ? groupNames : ["root"]).forEach(g => {
      const pill = document.createElement("div");
      pill.className = "group-pill" + (g === activeGroup ? " active" : "");
      pill.textContent = g;

      pill.addEventListener("click", () => {
        state.selected.category = categoryKey;
        state.selected.group = g;
        render();
      });

      groupRow.appendChild(pill);
    });

    // body
    const body = document.createElement("div");
    body.className = "card-body";

    const scroller = document.createElement("div");
    scroller.className = "scroller";

    const grid = document.createElement("div");
    grid.className = "grid";

    if (!files.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = TEXT[lang].noFiles;
      scroller.innerHTML = "";
      scroller.appendChild(empty);
    } else {
      files.forEach(p => {
        const thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.title = p;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = urlFor(p);
        img.alt = p;

        thumb.appendChild(img);

        thumb.addEventListener("click", () => openModal(p));
        grid.appendChild(thumb);
      });

      scroller.appendChild(grid);
    }

    body.appendChild(scroller);

    card.appendChild(head);
    card.appendChild(groupRow);
    card.appendChild(body);

    return card;
  }

  function render() {
    if (!manifest) return;
    const cats = manifest.categories || {};
    cardsEl.innerHTML = "";

    const order = ["avatars", "icons", "photos"];
    order.forEach(k => {
      cardsEl.appendChild(makeCard(k, cats[k] || { total: 0, groups: {} }));
    });
  }

  function openModal(path) {
    const full = urlFor(path);
    state.modalItem = { path, full };

    modalName.textContent = path;
    modalUrl.textContent = full;
    modalImg.src = full;
    btnOpen.href = full;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    state.modalItem = null;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${TEXT[lang].copied}`);
    } catch (e) {
      console.error(e);
      showToast(TEXT[lang].copyFailed);
    }
  }

  function bindEvents() {
    // language
    langBtn.addEventListener("click", () => {
      lang = (lang === "en") ? "zh" : "en";
      setText();
      render();
    });

    // search
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      render();
    });

    // modal controls
    modalBackdrop.addEventListener("click", closeModal);
    modalClose.addEventListener("click", closeModal);
    btnDone.addEventListener("click", closeModal);

    btnCopy.addEventListener("click", () => {
      if (!state.modalItem) return;
      copyToClipboard(state.modalItem.full);
    });

    // ESC close
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("show")) closeModal();
    });
  }

  function setRepoLink() {
    // 自动从当前 URL 推断 repo：byshelby.github.io/assets => github.com/byShelby/assets
    // 如果推断失败，就保持为 byShelby/assets
    const fallback = "https://github.com/byShelby/assets";
    try {
      // 你当前页面域名是 xxx.github.io
      const host = window.location.host; // byshelby.github.io
      const user = host.split(".")[0];   // byshelby
      // 仓库名通常就是 /assets/
      const repo = window.location.pathname.split("/").filter(Boolean)[0] || "assets";
      repoBtn.href = `https://github.com/${user}/${repo}`;
    } catch {
      repoBtn.href = fallback;
    }
  }

  // init
  setRepoLink();
  bindEvents();
  setText();
  loadManifest();
})();
