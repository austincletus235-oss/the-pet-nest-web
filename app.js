const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let salePets = [];
let adoptionPets = [];
let cart = [];

let currentView = "home";
const PAGE_SIZE = 8;
const visibleCounts = { sale: PAGE_SIZE, adoption: PAGE_SIZE };
const selectedCategory = { sale: "all", adoption: "all" };

function n(v) { return String(v || "").toLowerCase().trim(); }
function safeText(v = "") { return String(v).replace(/'/g, "\\'"); }
function numericPrice(v) {
  const parsed = parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatPrice(v) {
  const num = numericPrice(v);
  return num ? num.toLocaleString() : String(v ?? "");
}
function isVideo(url = "") {
  const u = url.toLowerCase();
  return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
}

function toggleMenu() {
  document.getElementById("navMenu")?.classList.toggle("active");
}

function switchPage(page) {
  currentView = page;
  document.querySelectorAll(".page-view").forEach((el) => el.classList.remove("active"));
  document.getElementById(`view-${page}`)?.classList.add("active");
  document.getElementById("navMenu")?.classList.remove("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  
  if (page === "home" && document.getElementById("globalSearch")) {
    document.getElementById("globalSearch").value = "";
  }
  
  renderCurrentView();
}

async function fetchPets() {
  // Added description to the select query
  const { data, error } = await supabaseClient
    .from("pets")
    .select("id,name,price,category,section,status,media_url,description,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return false;
  }

  const visible = (data || []).filter((p) => ["available", "reserved"].includes(n(p.status)));

  salePets = visible.filter((p) => n(p.section) === "sale");
  adoptionPets = visible.filter((p) => n(p.section) === "adoption");

  return true;
}

function getSearchTerm() {
  return String(document.getElementById("globalSearch")?.value || "").trim().toLowerCase();
}
function applySearch(list, term) {
  if (!term) return [...list];
  return list.filter((p) => n(p.name).includes(term) || n(p.category).includes(term));
}
function applyCategory(list, cat) {
  if (cat === "all") return [...list];
  return list.filter((p) => n(p.category) === cat);
}

// Media Modal Functions
function openMedia(url, isVid) {
  if (!url || url === "null" || url.includes("placehold.co")) return;
  const modal = document.getElementById("media-modal");
  const content = document.getElementById("media-modal-content");
  
  if (isVid) {
    content.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
  } else {
    content.innerHTML = `<img src="${url}" alt="Pet Media">`;
  }
  modal.classList.add("active");
}

function closeMedia() {
  const modal = document.getElementById("media-modal");
  const content = document.getElementById("media-modal-content");
  modal.classList.remove("active");
  content.innerHTML = ""; // Clear content to stop video playing
}

function petCardTemplate(p) {
  const media = p.media_url || "https://placehold.co/400x300?text=No+Image";
  const petName = p.name || "";
  const petPrice = formatPrice(p.price);
  const section = n(p.section);
  const desc = p.description || "";
  const isVid = isVideo(media);

  return `
    <div class="pet-card">
      <div class="pet-media-wrap" onclick="openMedia('${media}', ${isVid})">
        ${
          isVid
            ? `<video class="pet-image" src="${media}" autoplay muted loop playsinline preload="metadata"></video>`
            : `<img class="pet-image" src="${media}" alt="${petName}" loading="lazy" onerror="this.src='https://placehold.co/400x300?text=No+Image'">`
        }
      </div>
      <div class="pet-info">
        <h3 class="pet-name">${petName}</h3>
        <p class="pet-price">${petPrice}</p>
        <p class="pet-desc" title="${safeText(desc)}">${desc}</p>
        <div class="pet-actions">
          <button class="buy-btn" onclick="buyNow('${safeText(petName)}','${safeText(petPrice)}','${safeText(section)}')">Buy</button>
          <button class="cart-btn" onclick="addToCart('${safeText(petName)}','${safeText(petPrice)}')">Add to Cart</button>
        </div>
      </div>
    </div>
  `;
}

function renderGrid(containerId, items, emptyId = null) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = "";

  if (!items.length) {
    if (emptyId && document.getElementById(emptyId)) {
      document.getElementById(emptyId).style.display = "block";
    } else {
      box.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>No pets found.</p>";
    }
    return;
  }

  if (emptyId && document.getElementById(emptyId)) {
    document.getElementById(emptyId).style.display = "none";
  }

  box.innerHTML = items.map(petCardTemplate).join("");
}

function renderCurrentView() {
  const term = getSearchTerm();

  let sList = applyCategory(salePets, selectedCategory.sale);
  sList = applySearch(sList, term).slice(0, visibleCounts.sale);
  renderGrid("sale-pets-container", sList, "sale-empty");

  let aList = applyCategory(adoptionPets, selectedCategory.adoption);
  aList = applySearch(aList, term).slice(0, visibleCounts.adoption);
  renderGrid("adoption-pets-container", aList, "adoption-empty");
}

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
  if (currentView === "home" && getSearchTerm() !== "") {
    switchPage("sale");
  } else {
    visibleCounts.sale = PAGE_SIZE;
    visibleCounts.adoption = PAGE_SIZE;
    renderCurrentView();
  }
}

function loadMore(pageType) {
  visibleCounts[pageType] += PAGE_SIZE;
  renderCurrentView();
}

function toggleCart() { document.getElementById("cart-overlay")?.classList.toggle("active"); }

function addToCart(name, priceText) {
  cart.push({ name, priceText, price: numericPrice(priceText) });
  updateCartUI();
  alert(`Added ${name} to cart!`); 
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
    list.innerHTML = "<p style='text-align:center;opacity:.7;'>Your cart is empty.</p>";
    totalEl.textContent = "0";
    return;
  }

  let total = 0;
  cart.forEach((item, idx) => {
    total += item.price;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div><strong>${item.name}</strong><p>${item.priceText}</p></div>
      <button class="remove-btn" onclick="removeFromCart(${idx})">Remove</button>
    `;
    list.appendChild(row);
  });
  totalEl.textContent = total.toLocaleString();
}

function buyNow(name, priceText, section) {
  const whatsapp = "13075337422";
  const type = section === "adoption" ? "Adoption Inquiry" : "Purchase Inquiry";
  const msg = `Hello The Pet Nest!\n\n${type}\nPet: ${name}\nPrice: ${priceText}\n\nPlease confirm availability.`;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
}

function checkout() {
  if (!cart.length) return alert("Cart is empty.");
  const whatsapp = "13075337422";
  let total = 0; let lines = "";
  cart.forEach((item) => { total += item.price; lines += `• ${item.name} - ${item.priceText}\n`; });
  const msg = `Hello The Pet Nest!\n\nI want to order these pets:\n\n${lines}\nTotal: ${total.toLocaleString()}\n\nPlease confirm availability.`;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
}

window.onscroll = function () {
  const btn = document.getElementById("homeBtn");
  if (!btn) return;
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) btn.classList.add("visible");
  else btn.classList.remove("visible");
};

async function init() {
  await fetchPets();
  renderCurrentView();
  updateCartUI();

  setInterval(async () => {
    await fetchPets();
    renderCurrentView();
  }, 60000);
}

init();
