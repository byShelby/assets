(() => {
  const $ = (id) => document.getElementById(id);

  const grid = $("grid");
  const q = $("q");
  const status = $("status");
  const repoBtn = $("repoBtn");

  const modal = $("modal");
  const modalOverlay = $("modalOverlay");
  const modalImg = $("modalImg");
  const modalName = $("modalName");
  const modalPath = $("modalPath");
  const copyBtn = $("copyBtn");
  const openBtn = $("openBtn");
  const closeBtn = $("closeBtn");

  const toast = $("toast");
  const langBtn = $("langBtn");
  const langLabel = $("langLabel");
  const title = $("title");
  const subtitle = $("subtitle");

  // ===== Base URL (works on GitHub Pages subpath like /assets/) =====
  const base = new URL("./", window.location.href); // ends with /assets/
  const manifestURL = new URL("data/manifest.json", base);
  const repoURL = (() => {
    // Try to guess repo from location: https://username.github.io/repo/
    // -> https://github.com/username/repo
    const parts = window.location.pathname.split("/").filter(Boolean);
    // parts[0] should be repo name on GH pages (for project pages)
    // host contains username.github.io
    const user = window.location.hostname.split(".")[0];
    const repo = parts[0] || "assets";
    return `https://github.com/${user}/${repo}`;
  })();
  repoBtn.href = repoURL;

  // cache-bust via ?v=xxx
  const v = new URLSearchParams(location.search).get("v");
  if (v) manifestURL.searchParams.set("v", v);

  // ===== i18n =====
  const I18N = {
    EN: {
      title: "Asset Library",
      subtitle: "Search, preview, and copy direct links.",
      searchPH: "Search: category / group / filename",
      empty: "No files in this group.",
      copy: "Copy link",
      open: "Open",
      done: "Done",
      copied: "Copied!",
      copyFail: "Copy failed. Try again.",
    },
    ZH: {
      title: "你的资源库",
      subtitle: "搜索、预览并复制直链。干净、快速、稳定。",
      searchPH: "搜索：分类 / 子分类 / 文件名",
      empty: "这个分组暂无文件。",
      copy: "复制链接",
      open: "打开",
      done: "完成",
      copied: "已复制！",
      copyFail: "复制失败，请重试。",
    },
  };

  let lang = "EN";
  function t(key) {
    return I18N[lang][key] ?? key;
  }
  function applyLang() {
    title.textContent = t("title");
    subtitle.textContent = t("subtitle");
    q.placeholder = t("searchPH");
    copyBtn.textContent = t("copy");
    openBtn.textContent = t("open");
    closeBtn.textContent = t("done");
    langLabel.textContent = lang;
    // 不要让布局抖动：按钮宽度固定在 CSS 里了
  }

  langBtn.addEventListener("click", () => {
    lang = lang === "EN" ? "ZH" : "EN";
    applyLang();
    render(); // 切换语言时更新空状态文案
  });

  // ===== Toast =====
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 900);
  }

  // ===== Modal =====
  let currentLink = "";
  function openModal(name, path, url) {
    currentLink = url;
    modal.setAttribute("aria-hidden", "false");
    modalName.textContent = name;
    modalPath.textContent = url;
    modalImg.src = url;
    openBtn.href = url;
  }
  function closeModal() {
    modal.setAttribute("aria-hidden", "true");
    currentLink = "";
    modalImg.src = "";
  }
  modalOverlay.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeModal();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentLink);
      showToast(t("copied"));
    } catch {
      showToast(t("copyFail"));
    }
  });

  // ===== Data =====
  let manifest = null;
  let flat = []; // [{category, group, path, url, name}]
  let query = "";

  async function loadManifest() {
    status.textContent = "Loading…";
    const res = await fetch(manifestURL.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
    manifest = await res.json();
    buildFlat();
    status.textContent = "";
  }

  function buildFlat() {
    flat = [];
    const cats = manifest?.categories || {};
    for (const [catName, catObj] of Object.entries(cats)) {
      const groups = catObj?.groups || {};
      for (const [groupName, list] of Object.entries(groups)) {
        for (const p of list) {
          const url = new URL(p, base).toString();
          const name = p.split("/").pop();
          flat.push({ category: catName, group: groupName, path: p, url, name });
        }
      }
    }
  }

  // ===== Render =====
  function matches(item) {
    if (!query) return true;
    const hay = `${item.category}/${item.group}/${item.name}`.toLowerCase();
    return hay.includes(query);
  }

  function renderCard(categoryKey, groupName, items) {
    const total = items.length;

    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "cardTop";

    const left = document.createElement("div");
    const h = document.createElement("div");
    h.className = "cardTitle";
    h.textContent = categoryKey[0].toUpperCase() + categoryKey.slice(1);
    const sub = document.createElement("div");
    sub.className = "cardSub";
    sub.textContent = groupName;
    left.appendChild(h);
    left.appendChild(sub);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = String(total);

    top.appendChild(left);
    top.appendChild(badge);

    const groupRow = document.createElement("div");
    groupRow.className = "groupRow";
    const pill = document.createElement("div");
    pill.className = "groupPill";
    pill.textContent = groupName;
    groupRow.appendChild(pill);

    const body = document.createElement("div");
    body.className = "cardBody";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = t("empty");
      body.appendChild(empty);
    } else {
      const g = document.createElement("div");
      g.className = "thumbGrid";

      for (const item of items) {
        const a = document.createElement("a");
        a.className = "thumb";
        a.href = "javascript:void(0)";

        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = item.url;
        img.alt = item.name;

        a.appendChild(img);

        a.addEventListener("click", () => {
          openModal(item.name, item.path, item.url);
        });

        g.appendChild(a);
      }

      body.appendChild(g);
    }

    card.appendChild(top);
    card.appendChild(groupRow);
    card.appendChild(body);

    // 关键：滚轮优先滚卡片内部，不带动整页（body 已 overflow:hidden）
    return card;
  }

  function render() {
    grid.innerHTML = "";

    // 按分类渲染：avatars / icons / photos
    const cats = ["avatars", "icons", "photos"];
    for (const cat of cats) {
      const items = flat.filter((x) => x.category === cat).filter(matches);

      // 默认只渲染 root 组（你后面加子组也可以扩展）
      // 这里把所有 group 合并展示为 root（你现在就是 root）
      const byGroup = {};
      for (const it of items) {
        const g = it.group || "root";
        (byGroup[g] ||= []).push(it);
      }

      // 优先 root
      const groups = Object.keys(byGroup);
      const groupToShow = groups.includes("root") ? "root" : (groups[0] || "root");
      const list = byGroup[groupToShow] || [];

      grid.appendChild(renderCard(cat, groupToShow, list));
    }

    // 状态
    const count = flat.filter(matches).length;
    status.textContent = count ? `${count}` : "";
  }

  // ===== Search =====
  q.addEventListener("input", () => {
    query = (q.value || "").trim().toLowerCase();
    render();
  });

  // ===== Boot =====
  applyLang();
  loadManifest()
    .then(() => render())
    .catch((err) => {
      status.textContent = "Load failed";
      showToast("Manifest load failed. Check /data/manifest.json");
      console.error(err);
    });
})();
