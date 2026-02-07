(() => {
  const $ = (s) => document.querySelector(s);

  const cardsEl = $("#cards");
  const qEl = $("#q");
  const statusEl = $("#status");
  const toastEl = $("#toast");

  const langBtn = $("#langBtn");
  const repoBtn = $("#repoBtn");

  const modal = $("#modal");
  const modalOverlay = $("#modalOverlay");
  const modalImg = $("#modalImg");
  const modalTitle = $("#modalTitle");
  const modalPath = $("#modalPath");
  const copyBtn = $("#copyBtn");
  const openBtn = $("#openBtn");
  const closeBtn = $("#closeBtn");

  // ====== Config ======
  const REPO_OWNER = "byShelby";
  const REPO_NAME = "assets";
  const BASE = `${location.origin}${location.pathname.replace(/\/$/, "")}/`; // https://.../assets/
  const MANIFEST_URL = `${BASE}data/manifest.json`;

  repoBtn.href = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

  // ====== i18n (固定长度，避免布局抖动) ======
  const I18N = {
    en: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      placeholder: "Search: category / group / filename",
      openRepo: "Open Repo",
      copied: "Copied",
      copyLink: "Copy link",
      open: "Open",
      done: "Done",
      empty: "No files in this group."
    },
    zh: {
      title: "资源库",
      subtitle: "搜索、预览并复制直链。",
      placeholder: "搜索：分类 / 分组 / 文件名",
      openRepo: "打开仓库",
      copied: "已复制",
      copyLink: "复制链接",
      open: "打开",
      done: "完成",
      empty: "这个分组没有文件。"
    }
  };

  let lang = "en";
  function t(key){ return I18N[lang][key] || I18N.en[key] || key; }
  function applyLang(){
    $("#title").textContent = t("title");
    $("#subtitle").textContent = t("subtitle");
    qEl.placeholder = t("placeholder");
    repoBtn.textContent = t("openRepo");
    copyBtn.textContent = t("copyLink");
    openBtn.textContent = t("open");
    closeBtn.textContent = t("done");
    langBtn.textContent = lang.toUpperCase();
  }

  langBtn.addEventListener("click", () => {
    lang = (lang === "en") ? "zh" : "en";
    applyLang();
    // 不触发布局变化：按钮宽度固定、标题区域高度稳定
  });

  // ====== Toast ======
  let toastTimer = null;
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1100);
  }

  // ====== Copy ======
  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      toast(t("copied"));
      return true;
    }catch(e){
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try{
        document.execCommand("copy");
        toast(t("copied"));
        return true;
      }catch(_){
        toast("Copy failed");
        return false;
      }finally{
        document.body.removeChild(ta);
      }
    }
  }

  // ====== Modal ======
  let currentUrl = "";
  function openModal({ url, name, path }){
    currentUrl = url;
    modalTitle.textContent = name || "Preview";
    modalPath.textContent = path || "";
    modalImg.src = url;
    modalImg.alt = name || "";
    openBtn.href = url;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
    currentUrl = "";
  }
  modalOverlay.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  window.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeModal();
  });
  copyBtn.addEventListener("click", () => {
    if(currentUrl) copyText(currentUrl);
  });

  // ====== Rendering ======
  function fileNameFromPath(p){
    const parts = String(p).split("/");
    return parts[parts.length - 1] || p;
  }

  function buildFileUrl(relPath){
    // relPath like "avatars/avatar-1.jpg"
    return `${BASE}${relPath}`;
  }

  function normalizeManifest(manifest){
    // expected:
    // categories: { avatars: { total, groups: { root: [...] } }, ... }
    if(!manifest || !manifest.categories) return null;
    return manifest;
  }

  function render(manifest){
    cardsEl.innerHTML = "";

    const categories = manifest.categories || {};
    const catKeys = Object.keys(categories);

    catKeys.forEach((catKey) => {
      const cat = categories[catKey];
      const groups = (cat && cat.groups) ? cat.groups : {};
      const groupKeys = Object.keys(groups);

      const card = document.createElement("section");
      card.className = "card";
      card.dataset.cat = catKey;

      const head = document.createElement("div");
      head.className = "cardHead";

      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "cardTitle";
      title.textContent = cap(catKey);
      const meta = document.createElement("div");
      meta.className = "cardMeta";
      meta.textContent = "root";
      left.appendChild(title);
      left.appendChild(meta);

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = String(cat.total ?? 0);

      head.appendChild(left);
      head.appendChild(badge);

      const groupsEl = document.createElement("div");
      groupsEl.className = "groups";

      // default group: root if exists else first
      let activeGroup = groupKeys.includes("root") ? "root" : (groupKeys[0] || "root");

      const body = document.createElement("div");
      body.className = "cardBody";

      function renderGroup(gName){
        body.innerHTML = "";
        const files = groups[gName] || [];
        if(!files.length){
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = t("empty");
          body.appendChild(empty);
          return;
        }

        const grid = document.createElement("div");
        grid.className = "grid";

        files.forEach((p) => {
          const url = buildFileUrl(p);
          const name = fileNameFromPath(p);

          const tile = document.createElement("div");
          tile.className = "tile";
          tile.tabIndex = 0;

          const img = document.createElement("img");
          img.className = "thumb";
          img.loading = "lazy";
          img.src = url;
          img.alt = name;

          const label = document.createElement("div");
          label.className = "tileLabel";
          label.textContent = p;

          tile.appendChild(img);
          tile.appendChild(label);

          tile.addEventListener("click", () => {
            openModal({ url, name, path: p });
          });

          tile.addEventListener("keydown", (e) => {
            if(e.key === "Enter" || e.key === " "){
              e.preventDefault();
              openModal({ url, name, path: p });
            }
          });

          grid.appendChild(tile);
        });

        body.appendChild(grid);
      }

      // groups pills
      if(groupKeys.length){
        groupKeys.forEach((g) => {
          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = "groupPill" + (g === activeGroup ? " isActive" : "");
          pill.textContent = g;
          pill.addEventListener("click", () => {
            activeGroup = g;
            [...groupsEl.children].forEach((x) => x.classList.remove("isActive"));
            pill.classList.add("isActive");
            renderGroup(activeGroup);
          });
          groupsEl.appendChild(pill);
        });
      }else{
        // no groups at all
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "groupPill isActive";
        pill.textContent = "root";
        groupsEl.appendChild(pill);
      }

      renderGroup(activeGroup);

      card.appendChild(head);
      card.appendChild(groupsEl);
      card.appendChild(body);

      cardsEl.appendChild(card);
    });

    statusEl.textContent = "Ready";
  }

  // ====== Search ======
  function cap(s){
    if(!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function applySearch(query){
    const q = String(query || "").trim().toLowerCase();
    const cards = [...cardsEl.querySelectorAll(".card")];
    if(!q){
      cards.forEach((c) => c.style.display = "");
      // show all tiles
      [...cardsEl.querySelectorAll(".tile")].forEach((t) => t.style.display = "");
      return;
    }

    cards.forEach((card) => {
      let any = false;
      const tiles = [...card.querySelectorAll(".tile")];
      tiles.forEach((tile) => {
        const path = tile.querySelector(".tileLabel")?.textContent || "";
        const ok = path.toLowerCase().includes(q) || card.dataset.cat.toLowerCase().includes(q);
        tile.style.display = ok ? "" : "none";
        if(ok) any = true;
      });
      card.style.display = any ? "" : "none";
    });
  }

  qEl.addEventListener("input", () => applySearch(qEl.value));

  // ====== Load manifest ======
  async function loadManifest(){
    statusEl.textContent = "Loading…";
    try{
      // cache-bust: 防止你一直看到旧版本
      const url = `${MANIFEST_URL}?v=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const manifest = normalizeManifest(json);
      if(!manifest) throw new Error("Bad manifest");
      render(manifest);
    }catch(err){
      console.error(err);
      statusEl.textContent = "Load failed";
      cardsEl.innerHTML = "";
      const fail = document.createElement("div");
      fail.className = "empty";
      fail.style.padding = "18px";
      fail.textContent = "Manifest load failed.";
      cardsEl.appendChild(fail);
    }
  }

  // init
  applyLang();
  loadManifest();

  // expose for quick debug
  window.__assetlib = { loadManifest };
})();
