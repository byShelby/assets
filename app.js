(() => {
  const $ = (id) => document.getElementById(id);

  const grid = $("grid");
  const statusEl = $("status");
  const q = $("q");

  const modal = $("modal");
  const modalImg = $("modalImg");
  const modalPath = $("modalPath");
  const copyBtn = $("copyBtn");
  const openBtn = $("openBtn");
  const closeBtn = $("closeBtn");
  const repoBtn = $("repoBtn");
  const langBtn = $("langBtn");

  // Base URL for project pages: https://byshelby.github.io/assets/
  const BASE = new URL(".", window.location.href);
  const MANIFEST_URL = new URL("data/manifest.json", BASE);

  // Your repo url (optional)
  repoBtn.href = "https://github.com/byShelby/assets";

  const i18n = {
    en: {
      title: "Asset Library",
      sub: "Search, preview, and copy direct links.",
      search: "Search: category / group / filename",
      empty: "No items",
      copyOk: "Copied",
      copyFail: "Copy failed",
      loadFail: "Manifest load failed. Check Actions + data/manifest.json",
    },
    zh: {
      title: "资源库",
      sub: "搜索、预览、复制直链。",
      search: "搜索：分类 / 子分类 / 文件名",
      empty: "暂无内容",
      copyOk: "已复制",
      copyFail: "复制失败",
      loadFail: "清单加载失败：请检查 Actions 是否生成 data/manifest.json",
    },
  };

  let lang = "en";
  const applyLang = () => {
    $("title").textContent = i18n[lang].title;
    $("subtitle").textContent = i18n[lang].sub;
    q.placeholder = i18n[lang].search;
    langBtn.textContent = lang.toUpperCase();
  };

  langBtn.addEventListener("click", () => {
    lang = lang === "en" ? "zh" : "en";
    applyLang();
    render();
  });

  const state = {
    manifest: null,
    items: [], // flattened
    filter: "",
  };

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.dataset.type = type;
  }

  function absUrl(path) {
    // Make asset urls work under /assets/
    return new URL(path.replace(/^\//, ""), BASE).toString();
  }

  async function loadManifest() {
    try {
      setStatus("");
      const res = await fetch(MANIFEST_URL.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      state.manifest = json;
      flatten(json);
      render();
    } catch (e) {
      console.error(e);
      setStatus(i18n[lang].loadFail, "err");
    }
  }

  function flatten(m) {
    const out = [];
    const cats = (m && m.categories) || {};
    for (const [cat, catObj] of Object.entries(cats)) {
      const groups = (catObj && catObj.groups) || {};
      for (const [group, arr] of Object.entries(groups)) {
        for (const p of arr || []) {
          out.push({
            cat,
            group,
            path: p,
            url: absUrl(p),
            name: p.split("/").pop(),
          });
        }
      }
    }
    state.items = out;
  }

  function groupByCategory(items) {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.cat)) map.set(it.cat, []);
      map.get(it.cat).push(it);
    }
    return map;
  }

  function cardTitle(cat, total) {
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `${label} · ${total}`;
  }

  function render() {
    const f = (state.filter || "").trim().toLowerCase();
    const items = f
      ? state.items.filter((it) =>
          `${it.cat}/${it.group}/${it.name}`.toLowerCase().includes(f)
        )
      : state.items;

    const catMap = groupByCategory(items);

    grid.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = i18n[lang].empty;
      grid.appendChild(empty);
      return;
    }

    for (const [cat, list] of catMap.entries()) {
      const card = document.createElement("section");
      card.className = "card";

      const top = document.createElement("div");
      top.className = "cardTop";

      const h = document.createElement("div");
      h.className = "cardTitle";
      h.textContent = cardTitle(cat, list.length);

      const gset = new Set(list.map((x) => x.group));
      const meta = document.createElement("div");
      meta.className = "cardMeta";
      meta.textContent = `${gset.size} groups`;

      top.appendChild(h);
      top.appendChild(meta);

      const body = document.createElement("div");
      body.className = "cardBody";

      // sort: group then name
      list.sort((a, b) =>
        `${a.group}/${a.name}`.localeCompare(`${b.group}/${b.name}`)
      );

      for (const it of list) {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.title = `${it.cat}/${it.group}/${it.name}`;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = it.url;
        img.alt = it.name;

        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = it.group === "root" ? it.name : `${it.group}/${it.name}`;

        tile.appendChild(img);
        tile.appendChild(badge);

        tile.addEventListener("click", () => openPreview(it));
        body.appendChild(tile);
      }

      card.appendChild(top);
      card.appendChild(body);
      grid.appendChild(card);
    }
  }

  function openPreview(it) {
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("show");
    modalImg.src = it.url;
    modalPath.textContent = it.path;
    openBtn.href = it.url;

    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(it.url);
        copyBtn.textContent = i18n[lang].copyOk;
        setTimeout(() => (copyBtn.textContent = "Copy link"), 800);
      } catch {
        alert(i18n[lang].copyFail);
      }
    };
  }

  function closePreview() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
  }

  closeBtn.addEventListener("click", closePreview);
  modal.querySelector(".modalBackdrop").addEventListener("click", closePreview);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePreview();
  });

  q.addEventListener("input", (e) => {
    state.filter = e.target.value || "";
    render();
  });

  applyLang();
  loadManifest();
})();
