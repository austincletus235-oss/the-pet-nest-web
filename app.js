// ====== CACHE CLEAR FIX ======
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
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
let favorites = []; // ADDED FAVORITES ARRAY

let currentView = "home";
const PAGE_SIZE = 8;
const visibleCounts = { sale: PAGE_SIZE, adoption: PAGE_SIZE };
const selectedCategory = { sale: "all", adoption: "all" };

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
  const num = numericPrice(v);
  return num ? num.toLocaleString() : String(v ?? "");
}
function isVideo(url = "") {
  const u = url.toLowerCase();
  return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
}

function toggleMenu() { document.getElementById("navMenu")?.classList.toggle("active"); }

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
  if (!navigator.onLine) return false;
  const { data, error } = await supabaseClient
    .from("pets")
    .select("id,name,price,category,section,status,media_url,description,created_at")
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return false; }

  const visible = (data || []).filter((p) => ["available", "reserved"].includes(n(p.status)));
  salePets = visible.filter((p) => n(p.section) === "sale");
  adoptionPets = visible.filter((p) => n(p.section) === "adoption");
  return true;
}

function getSearchTerm() { return String(document.getElementById("globalSearch")?.value || "").trim().toLowerCase(); }
function applySearch(list, term) {
  if (!term) return [...list];
  return list.filter((p) => n(p.name).includes(term) || n(p.category).includes(term));
}
function applyCategory(list, cat) {
  if (cat === "all") return [...list];
  return list.filter((p) => n(p.category) === cat);
}

function openMedia(url, isVid, title, desc) {
  if (!url || url === "null" || url.includes("placehold.co")) return;
  const modal = document.getElementById("media-modal");
  const mediaContainer = document.getElementById("media-modal-media");
  const titleEl = document.getElementById("media-modal-title");
  const descEl = document.getElementById("media-modal-desc");
  
  if (isVid) mediaContainer.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
  else mediaContainer.innerHTML = `<img src="${url}" alt="Pet Image">`;

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

function petCardTemplate(p) {
  const media = p.media_url || "https://placehold.co/400x300?text=No+Image";
  const petName = p.name || "";
  const petPrice = formatPrice(p.price);
  const section = n(p.section);
  const desc = p.description || "";
  const isVid = isVideo(media);

  const safeName = safeText(petName);
  const safeDesc = safeText(desc);

  // CHECK IF FAVORITED FOR FILLED HEART
  const isFav = favorites.some(f => f.name === safeName);
  const heartIcon = isFav ? "❤️" : "🤍";

  const readMoreHtml = desc.trim() !== "" 
    ? `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">Read more</span>` 
    : `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">View Media</span>`;

  return `
    <div class="pet-card">
      <div class="pet-media-wrap" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">
        <button class="fav-btn" onclick="event.stopPropagation(); toggleFavoriteItem('${safeName}', '${media}', '${petPrice}')">${heartIcon}</button>
        ${
          isVid
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
    if (emptyId && document.getElementById(emptyId)) document.getElementById(emptyId).style.display = "block";
    else box.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>No pets found.</p>";
    return;
  }

  if (emptyId && document.getElementById(emptyId)) document.getElementById(emptyId).style.display = "none";
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
  if (currentView === "home" && getSearchTerm() !== "") switchPage("sale");
  else { visibleCounts.sale = PAGE_SIZE; visibleCounts.adoption = PAGE_SIZE; renderCurrentView(); }
}

function loadMore(pageType) { visibleCounts[pageType] += PAGE_SIZE; renderCurrentView(); }

// --- CART LOGIC ---
function toggleCart() { document.getElementById("cart-overlay")?.classList.toggle("active"); }

function addToCart(name, priceText) {
  cart.push({ name, priceText, price: numericPrice(priceText) });
  updateCartUI();
  alert(`Added ${name} to cart!`); 
}
function removeFromCart(index) { cart.splice(index, 1); updateCartUI(); }

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

// --- FAVORITES LOGIC (ADDED) ---
function toggleFav() { document.getElementById("fav-overlay")?.classList.toggle("active"); }

function toggleFavoriteItem(name, media, priceText) {
  const idx = favorites.findIndex(f => f.name === name);
  if (idx > -1) favorites.splice(idx, 1); // Remove if exists
  else favorites.push({ name, media, priceText }); // Add if not
  updateFavUI();
  renderCurrentView(); // Updates the heart icons visually
}

function updateFavUI() {
  const badge = document.getElementById("fav-badge");
  const list = document.getElementById("fav-items");
  if (!badge || !list) return;

  badge.textContent = favorites.length;
  list.innerHTML = "";

  if (!favorites.length) {
    list.innerHTML = "<p style='text-align:center;opacity:.7;'>Your favorites list is empty.</p>";
    return;
  }

  favorites.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${item.media}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;">
        <div><strong>${item.name}</strong><p>${item.priceText}</p></div>
      </div>
      <button class="remove-btn" onclick="toggleFavoriteItem('${safeText(item.name)}')">Remove</button>
    `;
    list.appendChild(row);
  });
}

// --- GENERATE 150 TESTIMONIALS (ADDED) ---
function loadTestimonials() {
  const track = document.getElementById("testimonial-track");
  if (!track) return;
  const names = ["Sarah J.", "Michael T.", "Emily R.", "David L.", "Jessica M.", "Chris B.", "Amanda K.", "Daniel W.", "Laura S.", "James P."];
  const reviews = [
    "Absolutely wonderful experience. My new puppy is healthy and so happy!",
    "The delivery was safe and transparent. Highly recommend The Pet Nest.",
    "I found my perfect companion here. The vet checks gave me absolute peace of mind.",
    "Very professional service from start to finish. The cage-free environment shows in their temperament.",
    "Best decision we ever made. Our kitten is the sweetest addition to our family."
  ];
  
  let html = "";
  // Loops to create exactly 150 blocks dynamically
  for(let i = 0; i < 150; i++) {
    const name = names[i % names.length] + (i > 9 ? ` ${Math.floor(Math.random()*90)+10}` : "");
    const review = reviews[i % reviews.length];
    html += `
      <div class="testimonial-card">
        <h4>${name}</h4>
        <div class="stars">★★★★★</div>
        <p>"${review}"</p>
      </div>
    `;
  }
  track.innerHTML = html + html; // Duplicate to allow seamless infinite CSS scrolling
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
  updateNetworkStatus();
  loadTestimonials(); // Load the 150 testimonials
  
  if (navigator.onLine) {
    await fetchPets();
  }
  
  renderCurrentView();
  updateCartUI();
  updateFavUI();

  // REALTIME ADMIN UPLOAD FIX (ADDED)
  // This listens for any changes in your database and instantly refreshes the page content without reloading
  supabaseClient
    .channel('public:pets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, payload => {
      fetchPets().then(() => renderCurrentView());
    })
    .subscribe();

  // Fallback check
  setInterval(async () => {
    if (navigator.onLine) {
      await fetchPets();
      renderCurrentView();
    }
  }, 60000);
}

init();
