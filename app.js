// ====== CACHE CLEAR FIX ======
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) registration.unregister();
  });
}
// ==============================================================================

const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let salePets = [];
let adoptionPets = [];
let cart = [];
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let pendingScrollId = null;

let currentView = "home";
const PAGE_SIZE = 8;
const visibleCounts = { sale: PAGE_SIZE, adoption: PAGE_SIZE };
const selectedCategory = { sale: "all", adoption: "all" };

// ====== TESTIMONIALS ======
const testimonials = [
  { text: "We searched for months and found our perfect companion here. The process was transparent, the pet was healthy, and every promise was kept. Absolutely professional from start to finish.", name: "— Sarah M." },
  { text: "I was impressed by the care, the documentation, and the follow‑up. Our puppy arrived calm and well‑socialized. This is premium service done right.", name: "— Daniel O." },
  { text: "Trustworthy, responsive, and organized. They guided us through every step and matched us with the right pet for our family lifestyle.", name: "— Grace K." },
  { text: "From first inquiry to delivery, everything felt premium. We are truly grateful for the support and the healthy, happy pet.", name: "— Michael T." },
  { text: "The quality and attention to detail is unmatched. You can tell the pets are raised with real love and expert care.", name: "— Aisha N." },
  { text: "Smooth communication, fast updates, and a joyful new family member. Could not ask for a better experience.", name: "— Joseph P." },
  { text: "Professional, honest, and dependable. Our family feels complete. Highly recommended.", name: "— Lina R." },
  { text: "We received a healthy companion with all vaccines verified. The guidance we received made it stress‑free.", name: "— Emmanuel S." }
];
let testimonialIndex = 0;

function startTestimonialSlider() {
  const textEl = document.getElementById("testimonial-text");
  const nameEl = document.getElementById("testimonial-name");
  if (!textEl || !nameEl) return;

  function showTestimonial() {
    const t = testimonials[testimonialIndex];
    textEl.textContent = t.text;
    nameEl.textContent = t.name;
    testimonialIndex = (testimonialIndex + 1) % testimonials.length;
  }

  showTestimonial();
  setInterval(showTestimonial, 8000); // slow slideshow
}

// Check Online Status
function updateNetworkStatus() {
  const dino = document.getElementById('dino-screen');
  const app = document.getElementById('app-wrapper');
  
  if (navigator.onLine) {
    dino.style.display = 'none';
    app.style.display = 'flex';
    fetchPets().then(() => renderCurrentView());
  } else {
    app.style.display = 'none';
    dino.style.display = 'flex';
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

function n(v) { return String(v || "").toLowerCase().trim(); }
function safeText(v = "") { return String(v).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

function numericPrice(v) {
  const parsed = parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(v) {
  const str = String(v ?? "").trim();
  const num = numericPrice(str);
  if (!str) return "$0";
  if (str.toLowerCase() === "free") return "Free";
  return num ? "$" + num.toLocaleString() : (str.startsWith("$") ? str : "$" + str);
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
  renderCurrentView();
}

async function fetchPets() {
  if (!navigator.onLine) return false;

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

// Modal Logic
function openMedia(url, isVid, title, desc) {
  if (!url || url === "null" || url.includes("placehold.co")) return;
  const modal = document.getElementById("media-modal");
  const mediaContainer = document.getElementById("media-modal-media");
  const titleEl = document.getElementById("media-modal-title");
  const descEl = document.getElementById("media-modal-desc");
  
  if (isVid) {
    mediaContainer.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
  } else {
    mediaContainer.innerHTML = `<img src="${url}" alt="Pet Image">`;
  }

  titleEl.textContent = title || "Pet Details";
  descEl.textContent = desc || "No details provided.";
  modal.classList.add("active");
}

function closeMedia() {
  const modal = document.getElementById("media-modal");
  const mediaContainer = document.getElementById("media-modal-media");
  modal.classList.remove("active");
  setTimeout(() => { mediaContainer.innerHTML = ""; }, 300);
}

// FAVORITES
function isFavorite(id, section) {
  return favorites.some(f => f.id === id && f.section === section);
}
function toggleFavorite(p) {
  const exists = isFavorite(p.id, p.section);
  if (exists) {
    favorites = favorites.filter(f => !(f.id === p.id && f.section === p.section));
  } else {
    favorites.push({
      id: p.id,
      section: p.section,
      name: p.name,
      price: formatPrice(p.price),
      media_url: p.media_url
    });
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  updateFavoritesUI();
  renderCurrentView();
}

function updateFavoritesUI() {
  const badge = document.getElementById("fav-badge");
  const list = document.getElementById("fav-items");
  if (!badge || !list) return;

  badge.textContent = favorites.length;
  list.innerHTML = "";

  if (!favorites.length) {
    list.innerHTML = "<p style='text-align:center;opacity:.7;'>No favorites yet.</p>";
    return;
  }

  favorites.forEach((f) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong>${f.name}</strong>
        <p>${f.price}</p>
        <small>Section: ${f.section}</small>
      </div>
      <button class="remove-btn" onclick="removeFavorite('${f.id}','${f.section}')">Remove</button>
    `;
    row.onclick = () => goToFavorite(f.id, f.section);
    list.appendChild(row);
  });
}

function removeFavorite(id, section) {
  favorites = favorites.filter(f => !(String(f.id) === String(id) && f.section === section));
  localStorage.setItem("favorites", JSON.stringify(favorites));
  updateFavoritesUI();
  renderCurrentView();
}

function goToFavorite(id, section) {
  pendingScrollId = `pet-${section}-${id}`;
  switchPage(section === "adoption" ? "adoption" : "sale");
  toggleFavorites();
}

function toggleFavorites() {
  document.getElementById("fav-overlay")?.classList.toggle("active");
}

function petCardTemplate(p) {
  const media = p.media_url || "https://placehold.co/400x300?text=No+Image";
  const petName = p.name || "";
  const petPrice = formatPrice(p.price);
  const section = n(p.section);
  const desc = p.description || "";
  const isVid = isVideo(media);

  const safeName = safeText(petName);
  const safeDesc = safeText(desc);
  const favActive = isFavorite(p.id, section);

  const readMoreHtml = desc.trim() !== "" 
    ? `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">Read more</span>` 
    : `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">View Media</span>`;

  return `
    <div class="pet-card" id="pet-${section}-${p.id}">
      <button class="favorite-btn ${favActive ? "active" : ""}" onclick='toggleFavorite(${JSON.stringify(p)})'>
        ${favActive ? "♥" : "♡"}
      </button>
      <div class="pet-media-wrap" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">
        ${isVid
            ? `<video class="pet-image" src="${media}" autoplay muted loop playsinline preload="metadata"></video>`
            : `<img class="pet-image" src="${media}" alt="${petName}" loading="lazy" onerror="this.src='https://placehold.co/400x300?text=No+Image'">`
        }
      </div>
      <div class="pet-info">
        <h3 class="pet-name">${petName}</h3>
        <p class="pet-price">${petPrice}</p>
        <p class="pet-desc" title="${safeDesc}">${desc}</p>
        ${readMoreHtml}
        <div class="pet-actions">
          <button class="buy-btn" onclick="buyNow('${safeName}','${petPrice}','${section}')">Buy</button>
          <button class="cart-btn" onclick="addToCart('${safeName}','${petPrice}')">Add to Cart</button>
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

  if (pendingScrollId) {
    const el = document.getElementById(pendingScrollId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScrollId = null;
    }
  }
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
    totalEl.textContent = "$0";
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
  totalEl.textContent = "$" + total.toLocaleString();
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
  cart.forEach((item) => { total += item.price; lines += `• ${`*
