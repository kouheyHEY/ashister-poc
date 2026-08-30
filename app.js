const STORAGE_KEY = "ashister-poc-state-v2";

const demoWishes = [
  { id: "wish-1", name: "ノイズキャンセリングイヤホン", reason: "移動中も落ち着いて本を聴きたい", price: 39800, priority: "high", status: "active", createdAt: "2026-08-18" },
  { id: "wish-2", name: "小さな観葉植物", reason: "机の上に緑を置きたい", price: 2800, priority: "medium", status: "active", createdAt: "2026-08-22" },
  { id: "wish-3", name: "温泉への小旅行", reason: "ゆっくり考える時間をつくりたい", price: 24000, priority: "low", status: "hold", createdAt: "2026-08-25" },
  { id: "wish-4", name: "書き心地のよいノート", reason: "毎日の気づきを手で残したい", price: 2200, priority: "medium", status: "purchased", createdAt: "2026-08-14" },
  { id: "wish-5", name: "デスクライト", reason: "夜も目に優しい環境で読みたい", price: 8900, priority: "medium", status: "active", createdAt: "2026-08-27" }
];

function initialState() {
  return { wishes: structuredClone(demoWishes) };
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

export function selectNextWish(wishes) {
  const order = { high: 0, medium: 1, low: 2 };
  return wishes
    .filter((wish) => wish.status === "active")
    .toSorted((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1) || a.createdAt.localeCompare(b.createdAt))[0] ?? null;
}

let state = loadState();
let currentFilter = "all";
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
  return price ? `${Number(price).toLocaleString("ja-JP")}円` : "価格未設定";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function navigate(view) {
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("is-visible", element.dataset.page === view));
  document.querySelectorAll("[data-view]").forEach((element) => element.classList.toggle("is-active", element.dataset.view === view));
  history.replaceState(null, "", `#${view}`);
  closeMenu();
}

function renderDashboard() {
  const stats = calculateWishStats(state.wishes);
  document.getElementById("activeWishCount").textContent = stats.active;
  document.getElementById("purchasedWishCount").textContent = stats.purchased;
  document.getElementById("wishRate").textContent = stats.rate;
  document.getElementById("homeWishRate").textContent = `${stats.rate}%`;
  document.getElementById("homeProgressRing").style.setProperty("--rate", stats.rate);
  document.getElementById("homeWishHeadline").textContent = `${stats.purchased}個、実現しました`;
  document.getElementById("homeWishDetail").textContent = stats.active ? `あと${stats.active}個の「欲しい」` : "新しい「欲しい」を置いてみましょう";

  const next = selectNextWish(state.wishes);
  document.getElementById("homeNextWishName").textContent = next?.name ?? "登録してみましょう";
  document.getElementById("homeNextWishReason").textContent = next?.reason || "欲しい理由も一緒に残せます";
  document.getElementById("homeNextWishPrice").textContent = next ? formatPrice(next.price) : "—";
}

function renderWishes() {
  const list = document.getElementById("wishList");
  const filtered = state.wishes.filter((wish) => currentFilter === "all" || wish.status === currentFilter);
  const pageSize = 2;
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
      <div class="wish-main"><h2>${escapeHtml(wish.name)}</h2><div class="wish-meta"><span>${formatPrice(wish.price)}</span><span class="priority">${priority}</span>${wish.reason ? `<span class="wish-reason">${escapeHtml(wish.reason)}</span>` : ""}</div></div>
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
  renderDashboard();
}

function updateWishStatus(id, status) {
  const wish = state.wishes.find((item) => item.id === id);
  if (!wish) return;
  const newlyPurchased = status === "purchased" && wish.status !== "purchased";
  wish.status = status;
  saveState();
  renderWishes();
  if (newlyPurchased) {
    updateAssistant("またひとつ、欲しいものが叶いましたね。", `${wish.name}、おめでとうございます！`, true);
    showToast(`${wish.name}、実現おめでとうございます！`);
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
  const name = document.getElementById("wishName").value.trim();
  if (!name) return false;
  const priceValue = document.getElementById("wishPrice").value.replace(/[^0-9]/g, "");
  state.wishes.unshift({
    id: `wish-${Date.now()}`,
    name,
    reason: document.getElementById("wishReason").value.trim(),
    price: priceValue ? Number(priceValue) : 0,
    priority: document.getElementById("wishPriority").value,
    status: "active",
    createdAt: new Date().toISOString().slice(0, 10)
  });
  wishPage = 0;
  currentFilter = "all";
  saveState();
  document.getElementById("wishForm").reset();
  document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === "all"));
  renderWishes();
  updateAssistant("新しい「欲しい」を覚えました。", "叶えたい理由も、大切にしていきましょう。");
  showToast("欲しいものに追加しました");
  return true;
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
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function resetDemo() {
  state = initialState();
  currentFilter = "all";
  wishPage = 0;
  saveState();
  document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === "all"));
  updateAssistant("欲しいものを、ひとつずつ叶えていきましょう。", "思いついたら、忘れないうちに置いておけます。");
  renderWishes();
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
  document.querySelectorAll("[data-view], [data-go]").forEach((element) => element.addEventListener("click", (event) => { event.preventDefault(); navigate(element.dataset.view || element.dataset.go); }));
  document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    wishPage = 0;
    document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderWishes();
  }));

  const dialog = document.getElementById("wishDialog");
  document.querySelectorAll("[data-open-wish]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
  document.getElementById("wishForm").addEventListener("submit", (event) => {
    if (event.submitter?.id !== "saveWish") return;
    event.preventDefault();
    if (addWish()) dialog.close();
  });
  document.getElementById("previousWishPage").addEventListener("click", () => { wishPage = Math.max(0, wishPage - 1); renderWishes(); });
  document.getElementById("nextWishPage").addEventListener("click", () => { wishPage += 1; renderWishes(); });
  document.getElementById("menuButton").addEventListener("click", toggleMenu);
  document.addEventListener("click", (event) => { if (!event.target.closest(".menu-wrap")) closeMenu(); });
  document.getElementById("resetButtonMenu").addEventListener("click", () => { resetDemo(); closeMenu(); });

  let swipeStartX = 0;
  const wishList = document.getElementById("wishList");
  wishList.addEventListener("touchstart", (event) => { swipeStartX = event.changedTouches[0].clientX; }, { passive: true });
  wishList.addEventListener("touchend", (event) => {
    const direction = getSwipeDirection(swipeStartX, event.changedTouches[0].clientX);
    if (!direction) return;
    const target = direction === "next" ? document.getElementById("nextWishPage") : document.getElementById("previousWishPage");
    if (!target.disabled) target.click();
  }, { passive: true });

  document.addEventListener("focusin", (event) => { if (event.target.matches("input, textarea, select")) document.body.classList.add("is-input-active"); });
  document.addEventListener("focusout", () => window.setTimeout(() => {
    if (!document.activeElement?.matches("input, textarea, select")) document.body.classList.remove("is-input-active");
  }, 120));
}

if (typeof document !== "undefined") {
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  bindEvents();
  renderWishes();
  const hash = location.hash.slice(1);
  navigate(["home", "wishes"].includes(hash) ? hash : "home");
}
