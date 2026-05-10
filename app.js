// ====== CACHE CLEAR FIX: Permanently removes the "Viewing offline copy" bar ======
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

// Initialize favorites from browser LocalStorage to keep memory across refreshes
let favorites = JSON.parse(localStorage.getItem('petNestFavorites')) || [];

let currentView = "home";
const PAGE_SIZE = 8;
const visibleCounts = { sale: PAGE_SIZE, adoption: PAGE_SIZE };
const selectedCategory = { sale: "all", adoption: "all" };

// Check Online Status - Hides Website & Shows Dinosaur Screen perfectly
function updateNetworkStatus() {
  const dino = document.getElementById('dino-screen');
  const app = document.getElementById('app-wrapper');
  
  if (navigator.onLine) {
    dino.style.display = 'none';
    app.style.display = 'flex';
  } else {
    app.style.display = 'none';
    dino.style.display = 'flex';
  }
}
window.addEventListener('online', () => { updateNetworkStatus(); init(); });
window.addEventListener('offline', updateNetworkStatus);

// CUSTOM TOAST NOTIFICATION SYSTEM
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Remove toast from DOM after animation completes (3 seconds)
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function n(v) { return String(v || "").toLowerCase().trim(); }
function safeText(v = "") { return String(v).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function numericPrice(v) {
  const parsed = parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatPrice(v) {
  const num = numericPrice(v);
  return num ? `$${num.toLocaleString()}` : String(v ?? "");
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
  
  // Close sidebars if open
  document.getElementById("cart-overlay")?.classList.remove("active");
  document.getElementById("favorites-overlay")?.classList.remove("active");

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

  if (error) {
    console.error(error);
    return false;
  }

  const visible = (data || []).filter((p) => ["available", "reserved"].includes(n(p.status)));

  salePets = visible.filter((p) => n(p.section) === "sale");
  adoptionPets = visible.filter((p) => n(p.section) === "adoption");

  return true;
}

// REALTIME LISTENER FOR INSTANT ADMIN UPLOAD UPDATES
function setupRealtimeSubscription() {
  supabaseClient
    .channel('public:pets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, payload => {
      console.log('Realtime change received!', payload);
      fetchPets().then(() => renderCurrentView());
    })
    .subscribe();
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

// Favorites Logic - Persists to LocalStorage
function toggleFav(id, name, priceText, section) {
  const index = favorites.findIndex(f => f.id === id);
  if (index > -1) {
    favorites.splice(index, 1);
    showToast(`${name} removed from favorites 💔`);
  } else {
    favorites.push({ id, name, priceText, section });
    showToast(`${name} added to favorites ❤️`);
  }
  
  // Save immediately to memory
  localStorage.setItem('petNestFavorites', JSON.stringify(favorites));
  
  updateFavoritesUI();
  renderCurrentView(); // re-render to update the heart icons
}

function isFavorite(id) {
  return favorites.some(f => f.id === id);
}

function toggleFavorites() {
  document.getElementById("favorites-overlay")?.classList.toggle("active");
  document.getElementById("cart-overlay")?.classList.remove("active");
}

function goToFavSection(section) {
  switchPage(section);
}

function updateFavoritesUI() {
  const badge = document.getElementById("favorites-badge");
  const list = document.getElementById("favorites-items");
  if (!badge || !list) return;

  badge.textContent = favorites.length;
  list.innerHTML = "";

  if (!favorites.length) {
    list.innerHTML = "<p style='text-align:center;opacity:.7;'>No favorites yet.</p>";
    return;
  }

  favorites.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "cart-item fav-item";
    row.onclick = () => goToFavSection(item.section);
    
    const displaySection = item.section === 'sale' ? 'Pets for Sale' : 'Adoption';
    
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p>${item.priceText}</p>
        <span class="fav-section-tag">${displaySection}</span>
      </div>
      <button class="remove-btn" onclick="event.stopPropagation(); toggleFav('${item.id}', '${item.name}', '${item.priceText}', '${item.section}')">Remove</button>
    `;
    list.appendChild(row);
  });
}

function petCardTemplate(p) {
  const media = p.media_url || "https://placehold.co/400x300?text=No+Image";
  const petName = p.name || "";
  const petPrice = formatPrice(p.price);
  const section = n(p.section);
  const desc = p.description || "";
  const isVid = isVideo(media);
  const id = p.id;

  const safeName = safeText(petName);
  const safeDesc = safeText(desc);
  
  // Custom SVG Hearts
  const emptyHeartSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  const filledHeartSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="none" fill="#ef4444"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  
  const heartIcon = isFavorite(id) ? filledHeartSVG : emptyHeartSVG;

  const readMoreHtml = desc.trim() !== "" 
    ? `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">Read more</span>` 
    : `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">View Media</span>`;

  return `
    <div class="pet-card">
      <button class="heart-btn" onclick="toggleFav('${id}', '${safeName}', '${petPrice}', '${section}')">${heartIcon}</button>
      <div class="pet-media-wrap" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}')">
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

  // Clear all buttons first
  const filterBtns = document.getElementById(`view-${pageType}`).querySelectorAll('.filter-btn');
  filterBtns.forEach(b => b.classList.remove('active-filter'));
  
  if (btn) {
    btn.classList.add("active-filter");
  } else {
    // If no btn provided, try to find it by ID
    const targetBtn = document.getElementById(`btn-${pageType}-${category}`);
    if (targetBtn) targetBtn.classList.add("active-filter");
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

function toggleCart() { 
  document.getElementById("cart-overlay")?.classList.toggle("active"); 
  document.getElementById("favorites-overlay")?.classList.remove("active");
}

function addToCart(name, priceText) {
  cart.push({ name, priceText, price: numericPrice(priceText) });
  updateCartUI();
  // Using modern toast instead of alert
  showToast(`${name} added to cart 🛒`); 
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
  totalEl.textContent = `$${total.toLocaleString()}`;
}

function buyNow(name, priceText, section) {
  const whatsapp = "13075337422";
  const type = section === "adoption" ? "Adoption Inquiry" : "Purchase Inquiry";
  const msg = `Hello The Pet Nest!\n\n${type}\nPet: ${name}\nPrice: ${priceText}\n\nPlease confirm availability.`;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
}

function checkout() {
  if (!cart.length) return {
    // Show toast instead of alert if empty
    showToast("Your cart is empty!");
  }
  const whatsapp = "13075337422";
  let total = 0; let lines = "";
  cart.forEach((item) => { total += item.price; lines += `• ${item.name} - ${item.priceText}\n`; });
  const msg = `Hello The Pet Nest!\n\nI want to order these pets:\n\n${lines}\nTotal: $${total.toLocaleString()}\n\nPlease confirm availability.`;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
}

// Professional Testimonial Data
const testimonials = [
  { text: "“The Pet Nest made finding our Golden Retriever so incredibly easy. He arrived perfectly healthy and extremely well-socialized. We are beyond thrilled.”", author: "- Sarah & Mark T." },
  { text: "“I was hesitant about buying a pet online, but their 100% health guarantee and constant communication put me at ease. Best decision we've made!”", author: "- Jessica R." },
  { text: "“Our adopted tabby cat settled in immediately. You can tell she was raised in a loving, cage-free environment. Thank you, Pet Nest!”", author: "- Emily W." },
  { text: "“The delivery was smooth, climate-controlled, and on time. Our new puppy stepped out of the carrier happy and ready to play.”", author: "- David L." },
  { text: "“Five stars for customer care! They answered every question I had about parrot nutrition and care before we made our purchase.”", author: "- Amanda J." },
  { text: "“Highly professional team. The vet records were impeccable, and our new Frenchie is the star of the neighborhood.”", author: "- The Connor Family" },
  { text: "“If you are looking for an ethical place to find your next companion, this is it. No cages, just pure love and care.”", author: "- Michael P." },
  { text: "“We adopted two kittens from the adoption section. They were healthy, microchipped, and litter-trained. A seamless experience.”", author: "- Laura S." },
  { text: "“I appreciate the transparency and the premium food recommendations provided when we bought our Husky. Top tier service.”", author: "- Jason B." },
  { text: "“Simply the best place to find premium, healthy pets. The staff truly cares about the animals they place in new homes.”", author: "- Chloe M." }
];

function initTestimonials() {
  const wrapper = document.getElementById("testimonial-slideshow");
  if (!wrapper) return;
  
  wrapper.innerHTML = testimonials.map((t, i) => `
    <div class="testimonial-slide ${i === 0 ? 'active' : ''}">
      <p>${t.text}</p>
      <h4>${t.author}</h4>
    </div>
  `).join("");

  const slides = wrapper.querySelectorAll('.testimonial-slide');
  let currentSlide = 0;

  setInterval(() => {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }, 5000);
}

window.onscroll = function () {
  const btn = document.getElementById("homeBtn");
  if (!btn) return;
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) btn.classList.add("visible");
  else btn.classList.remove("visible");
};

function showSpinners() {
  const loaderHTML = '<div class="loader-container"><div class="loader"></div></div>';
  const saleBox = document.getElementById("sale-pets-container");
  const adoptBox = document.getElementById("adoption-pets-container");
  if(saleBox) saleBox.innerHTML = loaderHTML;
  if(adoptBox) adoptBox.innerHTML = loaderHTML;
}

async function init() {
  updateNetworkStatus();
  
  if (navigator.onLine) {
    showSpinners(); // Show loading UI before fetching
    await fetchPets();
    setupRealtimeSubscription(); // Init Realtime updates
  }
  
  initTestimonials();
  renderCurrentView();
  updateCartUI();
  updateFavoritesUI(); // Load saved favorites UI
}

init();
