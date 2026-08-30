const STORAGE_KEY = "ashister-poc-state-v1";

const demoWishes = [
  { id: "wish-1", name: "ノイズキャンセリングイヤホン", reason: "移動中も落ち着いて本を聴きたい", price: 39800, priority: "high", status: "active", createdAt: "2026-08-18" },
  { id: "wish-2", name: "小さな観葉植物", reason: "机の上に緑を置きたい", price: 2800, priority: "medium", status: "active", createdAt: "2026-08-22" },
  { id: "wish-3", name: "文章術の本", reason: "説明する力を伸ばしたい", price: 1760, priority: "high", status: "purchased", createdAt: "2026-08-10" },
  { id: "wish-4", name: "温泉への小旅行", reason: "ゆっくり考える時間をつくる", price: 24000, priority: "low", status: "hold", createdAt: "2026-08-25" },
  { id: "wish-5", name: "書き心地のよいノート", reason: "毎日の気づきを手で残したい", price: 2200, priority: "medium", status: "purchased", createdAt: "2026-08-14" },
  { id: "wish-6", name: "デスクライト", reason: "夜も目に優しい環境で読みたい", price: 8900, priority: "medium", status: "active", createdAt: "2026-08-27" }
];

const prompts = {
  explain: {
    title: "最近気に入っているものを、知らない人にも伝わるように説明してください。",
    hint: "「何か」「なぜ好きか」「どんな人にすすめたいか」の順に考えてみましょう。"
  },
  understand: {
    title: "『便利な道具が増えるほど、使わない時間を意識して作ることも大切になる』とは、どういう意味でしょう？",
    hint: "書かれている内容を、具体的な場面に置き換えて説明してみましょう。"
  },
  words: {
    title: "『端的』という言葉を使って、仕事や日常の一場面を表す文を作ってください。",
    hint: "端的：要点をおさえて、短くはっきりしている様子。"
  }
};

function initialState() {
  return { wishes: structuredClone(demoWishes), practiceCount: 4, lastMode: "explain" };
}

export function calculateWishStats(wishes) {
  const active = wishes.filter((wish) => wish.status === "active").length;
  const purchased = wishes.filter((wish) => wish.status === "purchased").length;
  const denominator = active + purchased;
  return { active, purchased, rate: denominator ? Math.round((purchased / denominator) * 100) : 0 };
}

export function getSwipeDirection(startX, endX, threshold = 48) {
  const distance = endX - startX;
  if (Math.abs(distance) < threshold) return null;
  return distance < 0 ? "next" : "previous";
}

export function buildFeedback(answer, mode = "explain") {
  const cleaned = answer.trim();
  const length = [...cleaned].length;
  const hasStructure = /まず|結論|理由|なぜなら|たとえば|具体的|一方/.test(cleaned);
  const good = length >= 45
    ? "具体的な情報があり、聞き手が場面を想像しやすくなっています。"
    : "伝えたい中心が一つにまとまっていて、読み手が迷いにくい文章です。";
  const next = hasStructure
    ? "最後に一文で結論を言い直すと、さらに印象に残ります。"
    : "最初に結論を置き、そのあとに理由や具体例を続けてみましょう。";
  const excerpt = cleaned
    .replace(/^(結論から言うと|まず|端的に言うと)[、,:：\s]*/, "")
    .split(/[。！？]/)[0]
    .replace(/です$/, "")
    .slice(0, 52) || "自分がよいと感じたもの";
  const rewrite = mode === "understand"
    ? `この文章が伝えているのは、「${excerpt}」ということです。具体例を一つ添えると、さらに理解しやすくなります。`
    : mode === "words"
      ? `「端的」を使うなら、「${excerpt}」のように言えます。前後の状況も一文だけ添えてみましょう。`
      : `結論から言うと、${excerpt}です。そう考える理由を一つ添えると、さらに伝わりやすくなります。`;
  return { good, next, rewrite };
}

let state = loadState();
let currentFilter = "all";
let currentMode = state.lastMode || "explain";
let wishPage = 0;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialState(), ...JSON.parse(saved) } : initialState();
  } catch {
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatPrice(price) {
  if (!price) return "価格未設定";
  return `${Number(price).toLocaleString("ja-JP")}円`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function navigate(view) {
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("is-visible", el.dataset.page === view));
  document.querySelectorAll("[data-view]").forEach((el) => el.classList.toggle("is-active", el.dataset.view === view));
  history.replaceState(null, "", `#${view}`);
  closeMenu();
}

function renderStats() {
  const stats = calculateWishStats(state.wishes);
  document.getElementById("activeWishCount").textContent = stats.active;
  document.getElementById("purchasedWishCount").textContent = stats.purchased;
  document.getElementById("wishRate").textContent = stats.rate;
  document.getElementById("wishRateBar").style.width = `${stats.rate}%`;
  document.getElementById("homeWishRate").textContent = `${stats.rate}%`;
  document.getElementById("homeProgressRing").style.setProperty("--rate", stats.rate);
  document.getElementById("homeWishHeadline").textContent = `${stats.purchased}個、実現しました`;
  document.getElementById("homeWishDetail").textContent = stats.active ? `あと${stats.active}個の「欲しい」があります` : "新しい「欲しい」を置いてみましょう";
  document.getElementById("practiceCount").textContent = state.practiceCount;
}

function renderWishes() {
  const list = document.getElementById("wishList");
  const filtered = state.wishes.filter((wish) => currentFilter === "all" || wish.status === currentFilter);
  const pageSize = document.querySelector(".app-shell").getBoundingClientRect().width <= 620 ? 2 : 3;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  wishPage = Math.min(wishPage, totalPages - 1);
  const visible = filtered.slice(wishPage * pageSize, (wishPage + 1) * pageSize);
  document.getElementById("wishEmpty").hidden = filtered.length !== 0;
  document.getElementById("wishPagination").hidden = filtered.length === 0;
  document.getElementById("wishPageLabel").textContent = `${wishPage + 1} / ${totalPages}`;
  document.getElementById("previousWishPage").disabled = wishPage === 0;
  document.getElementById("nextWishPage").disabled = wishPage >= totalPages - 1;
  list.innerHTML = visible.map((wish) => {
    const icon = wish.status === "purchased" ? "✓" : wish.status === "hold" ? "…" : "◇";
    const priority = { high: "優先度 高め", medium: "優先度 ふつう", low: "いつか" }[wish.priority] || "優先度 ふつう";
    return `<article class="wish-item" data-status="${escapeHtml(wish.status)}">
      <div class="wish-visual" aria-hidden="true">${icon}</div>
      <div class="wish-main"><h2>${escapeHtml(wish.name)}</h2><div class="wish-meta"><span>${formatPrice(wish.price)}</span><span class="priority">${priority}</span>${wish.reason ? `<span>${escapeHtml(wish.reason)}</span>` : ""}</div></div>
      <div class="wish-actions">
        <label class="sr-only" for="status-${escapeHtml(wish.id)}">${escapeHtml(wish.name)}の状態</label>
        <select class="status-select" id="status-${escapeHtml(wish.id)}" data-wish-status="${escapeHtml(wish.id)}">
          <option value="active" ${wish.status === "active" ? "selected" : ""}>欲しい</option>
          <option value="purchased" ${wish.status === "purchased" ? "selected" : ""}>買えた</option>
          <option value="hold" ${wish.status === "hold" ? "selected" : ""}>保留</option>
          <option value="retired" ${wish.status === "retired" ? "selected" : ""}>手放した</option>
        </select>
        <button class="delete-button" data-delete-wish="${escapeHtml(wish.id)}" type="button">削除</button>
      </div>
    </article>`;
  }).join("");

  list.querySelectorAll("[data-wish-status]").forEach((select) => select.addEventListener("change", () => updateWishStatus(select.dataset.wishStatus, select.value)));
  list.querySelectorAll("[data-delete-wish]").forEach((button) => button.addEventListener("click", () => deleteWish(button.dataset.deleteWish)));
  renderStats();
}

function updateWishStatus(id, status) {
  const wish = state.wishes.find((item) => item.id === id);
  if (!wish) return;
  const wasPurchased = wish.status === "purchased";
  wish.status = status;
  saveState();
  renderWishes();
  if (status === "purchased" && !wasPurchased) {
    celebrate(`${wish.name}、実現おめでとうございます！`);
    updateAssistant("「買えた」が、またひとつ増えましたね。", "うれしかった理由も、あとで聞かせてください。", true);
  } else {
    showToast("状態を更新しました");
  }
}

function deleteWish(id) {
  state.wishes = state.wishes.filter((wish) => wish.id !== id);
  saveState();
  renderWishes();
  showToast("リストから削除しました");
}

function addWish() {
  const input = document.getElementById("wishName");
  if (!input.value.trim()) return false;
  const priceValue = document.getElementById("wishPrice").value.replace(/[^0-9]/g, "");
  state.wishes.unshift({
    id: `wish-${Date.now()}`,
    name: input.value.trim(),
    reason: document.getElementById("wishReason").value.trim(),
    price: priceValue ? Number(priceValue) : 0,
    priority: document.getElementById("wishPriority").value,
    status: "active",
    createdAt: new Date().toISOString().slice(0, 10)
  });
  saveState();
  wishPage = 0;
  renderWishes();
  document.getElementById("wishForm").reset();
  showToast("欲しいものに追加しました");
  return true;
}

function submitPractice() {
  const answer = document.getElementById("practiceAnswer").value;
  if (!answer.trim()) {
    showToast("まずは自分の言葉で書いてみましょう");
    document.getElementById("practiceAnswer").focus();
    return;
  }
  const feedback = buildFeedback(answer, currentMode);
  document.getElementById("feedbackGood").textContent = feedback.good;
  document.getElementById("feedbackNext").textContent = feedback.next;
  document.getElementById("feedbackRewrite").textContent = feedback.rewrite;
  const panel = document.getElementById("feedbackPanel");
  document.getElementById("learningWorkspace").hidden = true;
  panel.hidden = false;
  state.practiceCount += 1;
  saveState();
  renderStats();
  updateAssistant("今日も、自分の言葉で考えられましたね。", "完璧さより、言葉にしたことが前進です。", true);
  panel.focus();
}

function setMode(mode) {
  currentMode = mode;
  state.lastMode = mode;
  saveState();
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.getElementById("practiceTitle").textContent = prompts[mode].title;
  document.getElementById("practiceHint").textContent = prompts[mode].hint;
  document.getElementById("practiceAnswer").value = "";
  document.getElementById("characterCount").textContent = "0文字";
  document.getElementById("feedbackPanel").hidden = true;
  document.getElementById("learningWorkspace").hidden = false;
}

function updateAssistant(message, submessage, happy = false) {
  document.getElementById("assistantMessage").textContent = message;
  document.getElementById("assistantSubmessage").textContent = submessage;
  document.getElementById("character").classList.toggle("is-happy", happy);
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function celebrate(message) {
  showToast(message);
}

function resetDemo() {
  state = initialState();
  saveState();
  currentFilter = "all";
  wishPage = 0;
  setMode("explain");
  renderWishes();
  updateAssistant("今日は、伝える練習を3分だけやってみませんか？", "短くても大丈夫。考えを言葉にするところから始めましょう。");
  document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === "all"));
  showToast("体験データを最初に戻しました");
}

function closeMenu() {
  const popover = document.getElementById("menuPopover");
  const button = document.getElementById("menuButton");
  popover.hidden = true;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "メニューを開く");
}

function toggleMenu() {
  const popover = document.getElementById("menuPopover");
  const opening = popover.hidden;
  popover.hidden = !opening;
  const button = document.getElementById("menuButton");
  button.setAttribute("aria-expanded", String(opening));
  button.setAttribute("aria-label", opening ? "メニューを閉じる" : "メニューを開く");
}

function bindEvents() {
  document.querySelectorAll("[data-view], [data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view || button.dataset.go)));
  document.querySelectorAll(".mode-tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    wishPage = 0;
    document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderWishes();
  }));
  const dialog = document.getElementById("wishDialog");
  document.getElementById("openWishForm").addEventListener("click", () => dialog.showModal());
  document.querySelectorAll("[data-open-wish]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
  document.getElementById("wishForm").addEventListener("submit", (event) => {
    if (event.submitter?.id !== "saveWish") return;
    event.preventDefault();
    if (addWish()) dialog.close();
  });
  document.getElementById("practiceAnswer").addEventListener("input", (event) => { document.getElementById("characterCount").textContent = `${[...event.target.value].length}文字`; });
  document.getElementById("submitPractice").addEventListener("click", submitPractice);
  document.getElementById("nextPractice").addEventListener("click", () => { document.getElementById("practiceAnswer").value = ""; document.getElementById("characterCount").textContent = "0文字"; document.getElementById("feedbackPanel").hidden = true; document.getElementById("learningWorkspace").hidden = false; document.getElementById("practiceAnswer").focus(); });
  document.getElementById("previousWishPage").addEventListener("click", () => { wishPage = Math.max(0, wishPage - 1); renderWishes(); });
  document.getElementById("nextWishPage").addEventListener("click", () => { wishPage += 1; renderWishes(); });
  document.getElementById("menuButton").addEventListener("click", toggleMenu);
  document.addEventListener("click", (event) => { if (!event.target.closest(".menu-wrap")) closeMenu(); });
  document.getElementById("resetButtonMenu").addEventListener("click", () => { resetDemo(); closeMenu(); });
  window.addEventListener("resize", renderWishes);

  let swipeStartX = 0;
  const wishList = document.getElementById("wishList");
  wishList.addEventListener("touchstart", (event) => { swipeStartX = event.changedTouches[0].clientX; }, { passive: true });
  wishList.addEventListener("touchend", (event) => {
    const direction = getSwipeDirection(swipeStartX, event.changedTouches[0].clientX);
    if (!direction) return;
    const target = direction === "next" ? document.getElementById("nextWishPage") : document.getElementById("previousWishPage");
    if (!target.disabled) target.click();
  }, { passive: true });

  document.addEventListener("focusin", (event) => {
    if (event.target.matches("input, textarea, select")) document.body.classList.add("is-input-active");
  });
  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!document.activeElement?.matches("input, textarea, select")) document.body.classList.remove("is-input-active");
    }, 120);
  });
}

if (typeof document !== "undefined") {
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  bindEvents();
  renderWishes();
  setMode(currentMode);
  const hash = location.hash.slice(1);
  navigate(["home", "learning", "wishes"].includes(hash) ? hash : "home");
}
