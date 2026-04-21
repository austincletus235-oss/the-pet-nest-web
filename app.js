// ====== SUPABASE CONFIG ======
const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";
// =============================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allPets = [];
let salePets = [];
let adoptionPets = [];
let cart = [];
let currentView = "home";
let refreshInterval = null;
const AUTO_REFRESH_SECONDS = 60;
let lastScrollRefresh = 0;

function toggleMenu() {
  document.getElementById("navMenu").classList.toggle("active");
}

window.onscroll = function () {
  const btn = document.getElementById("homeBtn");
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    btn.classList.add("visible");
  } else {
    btn.classList.remove("visible");
  }
};

async function fetchPetData() {
  try {
    const { data, error } = await supabaseClient
      .from("pets")
      .select("id, name, price, category, section, media_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const visible = (data || []).filter((p) => {
      const st = (p.status || "").toLowerCase();
      return st !== "sold" && st !== "hidden";
    });

    allPets = visible;
    salePets = visible.filter((p) => (p.section || "").toLowerCase() !== "adoption");
    adoptionPets = visible.filter((p) => (p.section || "").toLowerCase() === "adoption");
    return true;
  } catch (error) {
    console.error("Supabase fetch error:", error);
    return false;
  }
}

async function silentUpdateInventory() {
  const success = await fetchPetData();
  if (!success) return;

  if (currentView === "home") renderGrid(allPets.slice(0, 8), "home-pets-container", null);
  else if (currentView === "sale") renderGrid(salePets, "sale-pets-container", "sale-empty");
  else if (currentView === "adoption") renderGrid(adoptionPets, "adoption-pets-container", "adoption-empty");
}

async function loadPets() {
  const success = await fetchPetData();
  const loading = document.getElementById("home-loading");
  if (loading) loading.style.display = "none";

  if (success) renderGrid(allPets.slice(0, 8), "home-pets-container", null);

  startAutoRefresh();

  window.addEventListener("scroll", () => {
    const now = Date.now();
    if (window.scrollY > 400 && now - lastScrollRefresh > 25000) {
      lastScrollRefresh = now;
      silentUpdateInventory();
    }
  });
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(silentUpdateInventory, AUTO_REFRESH_SECONDS * 1000);
}

function switchPage(pageId) {
  currentView = pageId;
  document.getElementById("navMenu").classList.remove("active");
  document.querySelectorAll(".page-view").forEach((view) => view.classList.remove("active"));
  document.getElementById("view-" + pageId).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (pageId === "sale") renderGrid(salePets, "sale-pets-container", "sale-empty");
  if (pageId === "adoption") renderGrid(adoptionPets, "adoption-pets-container", "adoption-empty");
}

function renderGrid(petsToDisplay, containerId, emptyStateId) {
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

    const petDiv = document.createElement("div");
    petDiv.className = "pet-card";

    const media = pet.media_url || "https://placehold.co/400x300?text=No+Image";
    const isVideo = media.toLowerCase().includes(".mp4") || media.toLowerCase().includes(".webm");

    petDiv.innerHTML = `
      ${
        isVideo
          ? `<video src="${media}" class="pet-image" autoplay loop muted playsinline></video>`
          : `<img src="${media}" class="pet-image" alt="${pet.name}" onerror="this.src='https://placehold.co/400x300?text=Image+Not+Found'">`
      }
      <div class="pet-info">
        <h3 class="pet-name">${pet.name}</h3>
        <p class="pet-price">${pet.price || ""}</p>
        <button class="buy-btn" onclick="addToCart('${escapeSingleQuotes(pet.name)}', '${escapeSingleQuotes(
      pet.price || ""
    )}')">Add to Cart</button>
      </div>
    `;

    container.appendChild(petDiv);
  });
}

function escapeSingleQuotes(value) {
  return String(value).replace(/'/g, "\\'");
}

function filterPage(pageType, category, buttonElement) {
  const filterGroup = buttonElement.parentElement;
  filterGroup.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active-filter"));
  buttonElement.classList.add("active-filter");

  let baseList = pageType === "sale" ? salePets : adoptionPets;
  let containerId = pageType === "sale" ? "sale-pets-container" : "adoption-pets-container";
  let emptyId = pageType === "sale" ? "sale-empty" : "adoption-empty";

  if (category === "all") {
    renderGrid(baseList, containerId, emptyId);
  } else {
    const filtered = baseList.filter((pet) =>
      (pet.category || "").toLowerCase().includes(category.toLowerCase())
    );
    renderGrid(filtered, containerId, emptyId);
  }
}

function handleGlobalSearch() {
  let input = (document.getElementById("globalSearch")?.value || "").toLowerCase();

  const match = (pet) =>
    (pet.name || "").toLowerCase().includes(input) ||
    (pet.category || "").toLowerCase().includes(input);

  if (currentView === "home") {
    renderGrid(allPets.filter(match), "home-pets-container", null);
  } else if (currentView === "sale") {
    renderGrid(salePets.filter(match), "sale-pets-container", "sale-empty");
  } else if (currentView === "adoption") {
    renderGrid(adoptionPets.filter(match), "adoption-pets-container", "adoption-empty");
  }
}

function toggleCart() {
  document.getElementById("cart-overlay").classList.toggle("active");
}

function addToCart(name, priceString) {
  const rawNumber = parseFloat(String(priceString).replace(/[^0-9.-]+/g, ""));
  cart.push({
    name,
    price: isNaN(rawNumber) ? 0 : rawNumber,
    originalPrice: priceString,
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
      </div>`;
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

updateCartUI();
loadPets();
