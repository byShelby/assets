(() => {
  const $ = (s) => document.querySelector(s);

  const grid = $("#grid");
  const searchInput = $("#searchInput");
  const statusPill = $("#statusPill");
  const langBtn = $("#langBtn");
  const repoBtn = $("#repoBtn");

  const modal = $("#modal");
  const modalImg = $("#modalImg");
  const modalName = $("#modalName");
  const modalPath = $("#modalPath");
  const copyBtn = $("#copyBtn");
  const openBtn = $("#openBtn");
  const toast = $("#toast");

  // === i18n（最小化，不放“测试文案”，不影响布局） ===
  const I18N = {
    en: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      searchPH: "Search: category / group / filename",
      ready: "Ready",
      loadFail: "Load failed",
      empty: "No files in this group.",
      copy: "Copy link",
      copied: "Copied ✅",
      copyFailed: "Copy failed",
      open: "Open",
      done: "Done",
    },
    zh: {
      title: "资源库",
      subtitle: "搜索、预览、一键复制直链。",
      searchPH: "搜索：分类 / 分组 / 文件名",
      ready: "就绪",
      loadFail: "加载失败",
      empty: "该分组暂无文件。",
      copy: "复制链接",
      copied: "已复制 ✅",
      copyFailed: "复制失败",
      open: "打开",
      done: "完成",
    }
  };

  let lang = "en";
  function t(key){ return I18N[lang][key] || I18N.en[key] || key; }

  function applyLang(){
    $("#title").textContent = t("title");
    $("#subtitle").textContent = t("subtitle");
    searchInput.placeholder = t("searchPH");
    statusPill.textContent = t("ready");
    copyBtn.textContent = t("copy");
    openBtn.textContent = t("open");
  }

  // === Base URL for direct links on GitHub Pages ===
  // Example: https://byshelby.github.io/assets/ + avatars/avatar-1.jpg
  function baseUrl(){
    // ensure trailing slash
    let p = location.pathname;
    // If on /assets/index.html -> use /assets/
    if (p.endsWith("index.html")) p = p.slice(0, -("index.html".length));
    if (!p.endsWith("/")) p += "/";
    return location.origin + p;
  }

  function assetLink(assetPath){
    return new URL(assetPath.replace(/^\//, ""), baseUrl()).href;
  }

  // === Toast ===
  let toastTimer = null;
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1200);
  }

  // === Clipboard ===
  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      showToast(t("copied"));
      return true;
    }catch(e){
      // fallback
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(t("copied"));
        return true;
      }catch(err){
        showToast(t("copyFailed"));
        return false;
      }
    }
  }

  // === Modal ===
  let currentLink = "";
  function openModal({ name, path }){
    const link = assetLink(path);
    currentLink = link;

    modalName.textContent = name;
    modalPath.textContent = link;
    modalImg.src = link;
    openBtn.href = link;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
    currentLink = "";
  }

  modal.addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) closeModal();
  });

  copyBtn.addEventListener("click", () => {
    if (!currentLink) return;
    copyToClipboard(currentLink);
  });

  // === Render ===
  let manifest = null;

  function setStatus(type, msg){
    statusPill.classList.remove("pill-muted", "pill-bad", "pill-ok");
    if (type === "bad") statusPill.classList.add("pill-bad");
    else if (type === "ok") statusPill.classList.add("pill-ok");
    else statusPill.classList.add("pill-muted");
    statusPill.textContent = msg;
  }

  function normalize(str){ return (str || "").toLowerCase(); }

  function buildCard(categoryName, categoryObj, query){
    const groups = categoryObj?.groups || {};
    const groupNames = Object.keys(groups);
    const firstGroup = groupNames[0] || "root";
    const files = groups[firstGroup] || [];

    const total = categoryObj?.total ?? files.length ?? 0;

    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = categoryName[0].toUpperCase() + categoryName.slice(1);

    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = firstGroup;

    left.appendChild(title);
    left.appendChild(sub);

    const badge = document.createElement("div");
    badge.className = "card-badge";

    const groupPill = document.createElement("div");
    groupPill.className = "group-pill";
    groupPill.textContent = firstGroup;

    const count = document.createElement("div");
    count.className = "count";
    count.textContent = String(total);

    badge.appendChild(groupPill);
    badge.appendChild(count);

    head.appendChild(left);
    head.appendChild(badge);

    const body = document.createElement("div");
    body.className = "card-body";

    // Filter by search query
    const q = normalize(query);
    const filtered = files.filter((p) => {
      const hay = normalize(`${categoryName}/${firstGroup}/${p}`);
      return !q || hay.includes(q);
    });

    if (!filtered.length){
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = t("empty");
      body.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "thumb-grid";

      filtered.forEach((path) => {
        const name = path.split("/").pop();

        const a = document.createElement("button");
        a.type = "button";
        a.className = "thumb";
        a.title = path;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = name;
        img.src = assetLink(path);

        a.appendChild(img);
        a.addEventListener("click", () => openModal({ name, path }));

        grid.appendChild(a);
      });

      body.appendChild(grid);
    }

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  function render(){
    if (!manifest) return;

    const query = searchInput.value || "";
    grid.innerHTML = "";

    const cats = manifest.categories || {};
    const order = ["avatars", "icons", "photos"];
    order.forEach((k) => {
      if (!cats[k]) {
        // still show empty card if missing
        cats[k] = { total: 0, groups: { root: [] } };
      }
      grid.appendChild(buildCard(k, cats[k], query));
    });
  }

  // === Load manifest.json (cache safe) ===
  async function loadManifest(){
    setStatus("muted", "Loading…");

    const v = new URLSearchParams(location.search).get("v") || String(Date.now());
    const url = new URL(`data/manifest.json?v=${encodeURIComponent(v)}`, baseUrl()).href;

    try{
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
      setStatus("ok", t("ready"));
      render();
    }catch(e){
      console.error(e);
      setStatus("bad", t("loadFail"));
      // still render empty
      manifest = {
        categories: {
          avatars: { total: 0, groups: { root: [] } },
          icons: { total: 0, groups: { root: [] } },
          photos: { total: 0, groups: { root: [] } },
        }
      };
      render();
    }
  }

  // === Wire ===
  searchInput.addEventListener("input", () => render());

  langBtn.addEventListener("click", () => {
    lang = (lang === "en") ? "zh" : "en";
    langBtn.textContent = (lang === "en") ? "EN" : "中";
    applyLang();
    render();
  });

  // repo button points to GitHub repo if available
  repoBtn.href = "https://github.com" + location.pathname.replace(/\/assets\/.*/, "/byshelby/assets");

  // Init
  applyLang();
  loadManifest();
})();
