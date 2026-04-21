// =========================
// THE PET NEST - WEB APP
// Full version with:
// - Home / Sale / Adoption rendering
// - Category filters in Sale + Adoption
// - Buy + Add to Cart buttons on cards
// - Image/video card rendering
// - Proper section/status filtering
// - Cart drawer + WhatsApp checkout
// =========================

const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- State ----------
let allPets = [];
let salePets = [];
let adoptionPets = [];
let featuredPets = [];
let cart = [];
let currentView = "home";
const PAGE_SIZE = 8;
const visibleCounts = { home: PAGE_SIZE, sale: PAGE_SIZE, adoption: PAGE_SIZE };
const selectedCategory = { sale: "all", adoption: "all" };

// ---------- Helpers ----------
const norm = (v) => String(v || "").toLowerCase().trim();

function isVideo(url = "") {
  const u = url.toLowerCase();
  return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
}

function safeText(v = "") {
  return String(v).replace(/'/g, "\\'");
}

function numericPrice(v) {
  const n = parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatPrice(v) {
  const n = numericPrice(v);
  return n.toLocaleString();
}

// ---------- Navigation ----------
function switchPage(page) {
  currentView = page;

  document.querySelectorAll(".page-view").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(`view-${page}`);
  if (target) target.classList.add("active");

  // close mobile menu if any
  document.getElementById("navMenu")?.classList.remove("active");

  renderCurrentView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleMenu() {
  document.getElementById("navMenu")?.classList.toggle("active");
}

// ---------- Data ----------
async function fetchPets() {
  const { data, error } = await supabaseClient
    .from("pets")
    .select("id,name,price,category,section,status,media_url,is_featured,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch pets error:", error.message);
    return false;
  }

  const visible = (data || []).filter((p) => {
    const s = norm(p.status);
    return s === "available" || s === "reserved";
  });

  allPets = visible;
  salePets = visible.filter((p) => norm(p.section) === "sale");
  adoptionPets = visible.filter((p) => norm(p.section) === "adoption");

  const explicitFeatured = visible.filter((p) => p.is_featured === true);
  featuredPets = explicitFeatured.length ? explicitFeatured.slice(0, 8) : visible.slice(0, 8);

  return true;
}

// ---------- Filters ----------
function filterByCategory(list, category) {
  if (category === "all") return [...list];
  return list.filter((p) => norm(p.category) === category);
}

function getSearchTerm() {
  return norm(document.getElementById("globalSearch")?.value || "");
}

function applySearch(list, term) {
  if (!term) return [...list];
  return list.filter((p) => norm(p.name).includes(term) || norm(p.category).includes(term));
}

// ---------- Rendering ----------
function petCardTemplate(pet, withBuy = true) {
  const media = pet.media_url || "https://placehold.co/600x400?text=No+Image";
  const name = pet.name || "Unnamed pet";
  const priceText = `${formatPrice(pet.price)}`;
  const section = norm(pet.section);

  const buyBtn = withBuy
    ? `<button class="buy-btn" onclick="buyNow('${safeText(name)}','${safeText(priceText)}','${safeText(section)}')">Buy</button>`
    : "";

  return `
    <article class="pet-card">
      <div class="pet-media-wrap">
        ${
          isVideo(media)
            ? `<video class="pet-image" src="${media}" autoplay muted loop playsinline preload="metadata"></video>`
            : `<img class="pet-image" src="${media}" alt="${name}" loading="lazy" onerror="this.src='https://placehold.co/600x400?text=Image+Error'">`
        }
      </div>

      <div class="pet-info">
        <h3 class="pet-name">${name}</h3>
        <p class="pet-price">${priceText}</p>

        <div class="pet-actions">
          ${buyBtn}
          <button class="cart-btn" onclick="addToCart('${safeText(name)}','${safeText(priceText)}')">Add to Cart</button>
        </div>
      </div>
    </article>
  `;
}

function renderGrid(containerId, items, emptyId = null, withBuy = true) {
  const box = document.getElementById(containerId);
  if (!box) return;

  box.innerHTML = "";

  if (!items.length) {
    if (emptyId && document.getElementById(emptyId)) {
      document.getElementById(emptyId).style.display = "block";
    } else {
      box.innerHTML = `<p style="text-align:center;opacity:.7;">No pets found.</p>`;
    }
    return;
  }

  if (emptyId && document.getElementById(emptyId)) {
    document.getElementById(emptyId).style.display = "none";
  }

  box.innerHTML = items.map((p) => petCardTemplate(p, withBuy)).join("");
}

function renderCurrentView() {
  const term = getSearchTerm();

  // HOME
  const homeList = applySearch(allPets, term).slice(0, visibleCounts.home);
  renderGrid("home-pets-container", homeList, null, true);
  renderGrid("featured-pets-container", featuredPets, null, true);

  // SALE
  let saleList = filterByCategory(salePets, selectedCategory.sale);
  saleList = applySearch(saleList, term);
  renderGrid("sale-pets-container", saleList.slice(0, visibleCounts.sale), "sale-empty", true);

  // ADOPTION
  let adoptList = filterByCategory(adoptionPets, selectedCategory.adoption);
  adoptList = applySearch(adoptList, term);
  renderGrid("adoption-pets-container", adoptList.slice(0, visibleCounts.adoption), "adoption-empty", true);
}

// ---------- Public actions ----------
function filterPage(pageType, category, btn) {
  selectedCategory[pageType] = category;
  visibleCounts[pageType] = PAGE_SIZE;

  if (btn?.parentElement) {
    btn.parentElement.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active-filter"));
    btn.classList.add("active-filter");
  }

  renderCurrentView();
}

function handleGlobalSearch() {
  visibleCounts.home = PAGE_SIZE;
  visibleCounts.sale = PAGE_SIZE;
  visibleCounts.adoption = PAGE_SIZE;
  renderCurrentView();
}

function loadMore(pageType) {
  visibleCounts[pageType] += PAGE_SIZE;
  renderCurrentView();
}

// ---------- Cart + Buy ----------
function toggleCart() {
  document.getElementById("cart-overlay")?.classList.toggle("active");
}

function addToCart(name, priceText) {
  cart.push({ name, priceText, price: numericPrice(priceText) });
  updateCartUI();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
}

function updateCartUI() {
  const badge = document.getElementById("cart-badge");
  const list = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total-price");
  if (!badge || !list || !totalEl) return;

  badge.textContent = cart.length;
  list.innerHTML = "";

  if (!cart.length) {
    list.innerHTML = `<p style="text-align:center;opacity:.7;">Your cart is empty.</p>`;
    totalEl.textContent = "0";
    return;
  }

  let total = 0;
  cart.forEach((item, idx) => {
    total += item.price;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p>${item.priceText}</p>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${idx})">Remove</button>
    `;
    list.appendChild(row);
  });

  totalEl.textContent = total.toLocaleString();
}

function buyNow(name, priceText, section) {
  const whatsapp = "13075337422";
  const type = section === "adoption" ? "Adoption Inquiry" : "Purchase Inquiry";
  const msg =
    `Hello The Pet Nest,%0A%0A` +
    `${type}%0A` +
    `Pet: ${encodeURIComponent(name)}%0A` +
    `Price: ${encodeURIComponent(priceText)}%0A%0A` +
    `Please confirm availability.`;

  window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
}

function checkout() {
  if (!cart.length) {
    alert("Cart is empty.");
    return;
  }

  const whatsapp = "13075337422";
  let total = 0;
  let lines = "";

  cart.forEach((c) => {
    total += c.price;
    lines += `• ${c.name} - ${c.priceText}\n`;
  });

  const message =
    `Hello The Pet Nest!\n\nI want to order these pets:\n\n${lines}\nTotal: ${total.toLocaleString()}\n\nPlease confirm availability.`;

  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
}

// ---------- Init ----------
async function init() {
  const ok = await fetchPets();
  const loading = document.getElementById("home-loading");
  if (loading) loading.style.display = "none";

  if (ok) renderCurrentView();
  updateCartUI();

  // periodic refresh
  setInterval(async () => {
    const done = await fetchPets();
    if (done) renderCurrentView();
  }, 60000);
}

init();
