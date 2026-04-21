// ==============================
// SUPABASE CONFIG
// ==============================
const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================
// STATE
// ==============================
let allPets = [];
let salePets = [];
let adoptionPets = [];
let featuredPets = [];

let currentView = "home";

let cart = [];
let refreshInterval = null;
const AUTO_REFRESH_SECONDS = 60;
let lastScrollRefresh = 0;

// Pagination
const PAGE_SIZE = 8;
let visibleCounts = {
  home: 8,
  sale: 8,
  adoption: 8,
};

// Active filtered lists (for load more + sorting + searching)
let activeLists = {
  home: [],
  sale: [],
  adoption: [],
};

// ==============================
// UI HELPERS
// ==============================
function toggleMenu() {
  document.getElementById("navMenu")?.classList.toggle("active");
}

window.onscroll = function () {
  const btn = document.getElementById("homeBtn");
  if (!btn) return;
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    btn.classList.add("visible");
  } else {
    btn.classList.remove("visible");
  }
};

function parsePriceToNumber(priceValue) {
  if (priceValue === null || priceValue === undefined) return Number.MAX_SAFE_INTEGER;
  const num = parseFloat(String(priceValue).replace(/[^0-9.-]+/g, ""));
  return Number.isNaN(num) ? Number.MAX_SAFE_INTEGER : num;
}

function escapeSingleQuotes(value) {
  return String(value ?? "").replace(/'/g, "\\'");
}

function isVideoFile(url = "") {
  const u = url.toLowerCase();
  return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov");
}

function normalizeSection(value = "") {
  return String(value).toLowerCase().trim();
}

// ==============================
// DATA FETCH
// ==============================
async function fetchPetData() {
  try {
    const { data, error } = await supabaseClient
      .from("pets")
      .select("id, name, price, category, section, media_url, status, is_featured, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const visible = (data || []).filter((p) => {
      const st = (p.status || "").toLowerCase();
      // hide sold/hidden
      return st !== "sold" && st !== "hidden";
    });

    allPets = visible;
    salePets = visible.filter((p) => normalizeSection(p.section) !== "adoption");
    adoptionPets = visible.filter((p) => normalizeSection(p.section) === "adoption");

    // featured logic: is_featured true OR top 4 newest
    const explicitFeatured = visible.filter((p) => p.is_featured === true);
    featuredPets = explicitFeatured.length > 0 ? explicitFeatured.slice(0, 4) : visible.slice(0, 4);

    // initialize active lists
    activeLists.home = [...allPets];
    activeLists.sale = [...salePets];
    activeLists.adoption = [...adoptionPets];

    return true;
  } catch (err) {
    console.error("Supabase fetch error:", err);
    return false;
  }
}

// ==============================
// RENDER
// ==============================
function renderGrid(petsToDisplay, containerId, emptyStateId, mode = "normal") {
  const container = document.getElementById(containerId);
  const emptyState = emptyStateId ? document.getElementById(emptyStateId) : null;
  if (!container) return;

  container.innerHTML = "";

  if (!petsToDisplay || petsToDisplay.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  } else {
    if (emptyState) emptyState.style.display = "none";
  }

  petsToDisplay.forEach((pet) => {
    if (!pet || !pet.name) return;

    const card = document.createElement("div");
    card.className = "pet-card";

    const media = pet.media_url || "https://placehold.co/400x300?text=No+Image";
    const isVideo = isVideoFile(media);

    const actionButtons =
      mode === "inquiryOnly"
        ? `
          <button class="buy-btn" style="margin-bottom:10px;" onclick="sendPetInquiry('${escapeSingleQuotes(
            pet.name
          )}', '${escapeSingleQuotes(pet.price || "")}', '${escapeSingleQuotes(normalizeSection(pet.section))}')">
            Inquire on WhatsApp
          </button>
          <button class="buy-btn" onclick="addToCart('${escapeSingleQuotes(pet.name)}', '${escapeSingleQuotes(
            pet.price || ""
          )}')">
            Add to Cart
          </button>
        `
        : `
          <button class="buy-btn" onclick="addToCart('${escapeSingleQuotes(pet.name)}', '${escapeSingleQuotes(
            pet.price || ""
          )}')">
            Add to Cart
          </button>
        `;

    card.innerHTML = `
      ${
        isVideo
          ? `<video src="${media}" class="pet-image" autoplay loop muted playsinline preload="metadata"></video>`
          : `<img src="${media}" class="pet-image" alt="${pet.name}" loading="lazy" decoding="async" onerror="this.src='https://placehold.co/400x300?text=Image+Not+Found'">`
      }
      <div class="pet-info">
        <h3 class="pet-name">${pet.name}</h3>
        <p class="pet-price">${pet.price || ""}</p>
        ${actionButtons}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderCurrentView() {
  if (currentView === "home") {
    const list = activeLists.home.slice(0, visibleCounts.home);
    renderGrid(list, "home-pets-container", null, "normal");
    renderGrid(featuredPets, "featured-pets-container", null, "normal");
  }

  if (currentView === "sale") {
    const list = activeLists.sale.slice(0, visibleCounts.sale);
    renderGrid(list, "sale-pets-container", "sale-empty", "inquiryOnly");
  }

  if (currentView === "adoption") {
    const list = activeLists.adoption.slice(0, visibleCounts.adoption);
    renderGrid(list, "adoption-pets-container", "adoption-empty", "inquiryOnly");
  }
}

// ==============================
// LOAD + AUTO REFRESH
// ==============================
async function loadPets() {
  const success = await fetchPetData();

  const loading = document.getElementById("home-loading");
  if (loading) loading.style.display = "none";

  if (success) {
    renderCurrentView();
  }

  startAutoRefresh();

  window.addEventListener("scroll", () => {
    const now = Date.now();
    if (window.scrollY > 400 && now - lastScrollRefresh > 25000) {
      lastScrollRefresh = now;
      silentUpdateInventory();
    }
  });
}

async function silentUpdateInventory() {
  const success = await fetchPetData();
  if (!success) return;

  // keep current sort settings when refreshing
  const saleSort = document.getElementById("sale-sort")?.value || "newest";
  const adoptionSort = document.getElementById("adoption-sort")?.value || "newest";

  applySortToList("sale", saleSort, false);
  applySortToList("adoption", adoptionSort, false);

  renderCurrentView();
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(silentUpdateInventory, AUTO_REFRESH_SECONDS * 1000);
}

// ==============================
// NAVIGATION
// ==============================
function switchPage(pageId) {
  currentView = pageId;

  document.getElementById("navMenu")?.classList.remove("active");
  document.querySelectorAll(".page-view").forEach((view) => view.classList.remove("active"));

  const target = document.getElementById("view-" + pageId);
  if (target) target.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  renderCurrentView();
}

// ==============================
// FILTER / SORT / SEARCH / PAGINATION
// ==============================
function filterPage(pageType, category, buttonElement) {
  const filterGroup = buttonElement?.parentElement;
  if (filterGroup) {
    filterGroup.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active-filter"));
    buttonElement.classList.add("active-filter");
  }

  let baseList = pageType === "sale" ? salePets : adoptionPets;

  if (category === "all") {
    activeLists[pageType] = [...baseList];
  } else {
    activeLists[pageType] = baseList.filter((pet) =>
      (pet.category || "").toLowerCase().includes(category.toLowerCase())
    );
  }

  // re-apply sort currently selected
  const sortVal = document.getElementById(`${pageType}-sort`)?.value || "newest";
  applySortToList(pageType, sortVal, false);

  visibleCounts[pageType] = PAGE_SIZE;
  renderCurrentView();
}

function applySortToList(pageType, sortValue, reRender = true) {
  if (!["sale", "adoption"].includes(pageType)) return;

  if (sortValue === "priceLow") {
    activeLists[pageType].sort((a, b) => parsePriceToNumber(a.price) - parsePriceToNumber(b.price));
  } else {
    // newest
    activeLists[pageType].sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
  }

  if (reRender) {
    visibleCounts[pageType] = PAGE_SIZE;
    renderCurrentView();
  }
}

function sortPage(pageType, sortValue) {
  applySortToList(pageType, sortValue, true);
}

function loadMore(pageType) {
  visibleCounts[pageType] += PAGE_SIZE;
  renderCurrentView();
}

function handleGlobalSearch() {
  const input = (document.getElementById("globalSearch")?.value || "").toLowerCase().trim();

  const matcher = (pet) =>
    (pet.name || "").toLowerCase().includes(input) ||
    (pet.category || "").toLowerCase().includes(input);

  if (currentView === "home") {
    activeLists.home = input ? allPets.filter(matcher) : [...allPets];
    visibleCounts.home = PAGE_SIZE;
  } else if (currentView === "sale") {
    // preserve currently filtered sale set base from salePets
    activeLists.sale = input ? salePets.filter(matcher) : [...salePets];
    const sortVal = document.getElementById("sale-sort")?.value || "newest";
    applySortToList("sale", sortVal, false);
    visibleCounts.sale = PAGE_SIZE;
  } else if (currentView === "adoption") {
    activeLists.adoption = input ? adoptionPets.filter(matcher) : [...adoptionPets];
    const sortVal = document.getElementById("adoption-sort")?.value || "newest";
    applySortToList("adoption", sortVal, false);
    visibleCounts.adoption = PAGE_SIZE;
  }

  renderCurrentView();
}

// ==============================
// CART
// ==============================
function toggleCart() {
  document.getElementById("cart-overlay")?.classList.toggle("active");
}

function addToCart(name, priceString) {
  const raw = parseFloat(String(priceString || "").replace(/[^0-9.-]+/g, ""));
  cart.push({
    name,
    price: Number.isNaN(raw) ? 0 : raw,
    originalPrice: priceString || "",
  });
  updateCartUI();
  toggleCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
}

function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartBadge = document.getElementById("cart-badge");
  const cartTotal = document.getElementById("cart-total-price");
  if (!cartItemsDiv || !cartBadge || !cartTotal) return;

  cartItemsDiv.innerHTML = "";
  let sum = 0;

  if (cart.length === 0) {
    cartItemsDiv.innerHTML =
      "<p style='text-align:center; color:#888; margin-top:20px;'>Your cart is empty.</p>";
  }

  cart.forEach((item, index) => {
    sum += item.price || 0;
    cartItemsDiv.innerHTML += `
      <div class="cart-item">
        <div>
          <h4 style="color: var(--primary);">${item.name}</h4>
          <p style="font-weight: 600;">${item.originalPrice}</p>
        </div>
        <button class="remove-btn" onclick="removeFromCart(${index})">Remove</button>
      </div>
    `;
  });

  cartBadge.innerText = cart.length;
  cartTotal.innerText = sum.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function checkout(whatsappNumber) {
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  let message = "Hello The Pet Nest! I would like to order the following items from my cart:\n\n";
  let total = 0;

  cart.forEach((item) => {
    message += `▪️ ${item.name} - ${item.originalPrice}\n`;
    total += item.price || 0;
  });

  message += `\n*Total Due: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}*`;
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
}

// ==============================
// WHATSAPP INQUIRY-ONLY MODE
// ==============================
function sendPetInquiry(petName, petPrice, section) {
  const whatsappNumber = "13075337422";
  const typeLabel = section === "adoption" ? "Adoption Inquiry" : "Sale Inquiry";

  const message =
    `Hello The Pet Nest!%0A%0A` +
    `I want to make a ${typeLabel}.%0A` +
    `Pet: ${encodeURIComponent(petName)}%0A` +
    `Price: ${encodeURIComponent(petPrice || "N/A")}%0A%0A` +
    `Please share full details and availability.`;

  window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
}

// ==============================
// INIT
// ==============================
updateCartUI();
loadPets();
