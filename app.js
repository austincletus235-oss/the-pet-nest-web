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

// Check Online Status
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
  
  // Remove toast from DOM after animation completes
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

// UPGRADED MEDIA MODAL LOGIC
function openMedia(url, isVid, title, desc, price, section) {
  if (!url || url === "null") return;
  
  const modal = document.getElementById("media-modal");
  const mediaContainer = document.getElementById("media-modal-media");
  const titleEl = document.getElementById("media-modal-title");
  const descEl = document.getElementById("media-modal-desc");
  const priceEl = document.getElementById("media-modal-price");
  const buyBtn = document.getElementById("media-modal-buy-btn");
  
  if (isVid) {
    mediaContainer.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
  } else {
    mediaContainer.innerHTML = `<img src="${url}" alt="Pet Image">`;
  }

  titleEl.textContent = title || "Pet Details";
  descEl.textContent = desc || "No details provided.";
  priceEl.textContent = price || "";
  
  buyBtn.onclick = () => {
    buyNow(title, price, section);
  };
  
  modal.classList.add("active");
}

function closeMedia() {
  const modal = document.getElementById("media-modal");
  const mediaContainer = document.getElementById("media-modal-media");
  
  modal.classList.remove("active");
  setTimeout(() => { mediaContainer.innerHTML = ""; }, 300);
}

// Info / Legal Modal Logic (For Footer Links)
function openInfoModal(type) {
  const modal = document.getElementById("info-modal");
  const titleEl = document.getElementById("info-modal-title");
  const contentEl = document.getElementById("info-modal-content");

  if(type === 'privacy') {
    titleEl.textContent = "Privacy Policy";
    contentEl.innerHTML = "<p>We value your privacy. All personal information collected is securely stored and never shared with third parties without your explicit consent. We only use your data to process orders, provide customer support, and improve your experience on our platform.</p><br><p>Your payment information is encrypted and handled by secure third-party processors.</p>";
  } else if(type === 'terms') {
    titleEl.textContent = "Terms of Service";
    contentEl.innerHTML = "<p>By using The Pet Nest, you agree to our terms of service. All pet sales are subject to our comprehensive health guarantee and return policy.</p><br><p>We reserve the right to refuse service to ensure the safety and well-being of our animals. Prices are subject to change without prior notice.</p>";
  } else if(type === 'faqs') {
    titleEl.textContent = "Frequently Asked Questions";
    contentEl.innerHTML = "<strong>How does delivery work?</strong><br><p style='margin-bottom: 10px;'>We use safe, climate-controlled pet transport directly to your door. A specialist will accompany your pet to ensure they are stress-free.</p><strong>Are the pets vaccinated?</strong><br><p style='margin-bottom: 10px;'>Yes, all pets are 100% vet-checked, fully vaccinated up to their age, and microchipped.</p><strong>Do you offer a health guarantee?</strong><br><p>Yes! We offer a comprehensive health guarantee against genetic defects. Details will be provided during purchase.</p>";
  }

  modal.classList.add("active");
}

function closeInfoModal() {
  document.getElementById("info-modal").classList.remove("active");
}

// Favorites Logic
function toggleFav(id, name, priceText, section) {
  const index = favorites.findIndex(f => f.id === id);
  if (index > -1) {
    favorites.splice(index, 1);
    showToast(`${name} removed from favorites 💔`);
  } else {
    favorites.push({ id, name, priceText, section });
    showToast(`${name} added to favorites ❤️`);
  }
  
  localStorage.setItem('petNestFavorites', JSON.stringify(favorites));
  updateFavoritesUI();
  renderCurrentView(); 
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
  
  const emptyHeartSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  const filledHeartSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="none" fill="#ef4444"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  
  const heartIcon = isFavorite(id) ? filledHeartSVG : emptyHeartSVG;

  const readMoreHtml = desc.trim() !== "" 
    ? `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}', '${petPrice}', '${section}')">Read more</span>` 
    : `<span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}', '${petPrice}', '${section}')">View Media</span>`;

  return `
    <div class="pet-card">
      <button class="heart-btn" onclick="toggleFav('${id}', '${safeName}', '${petPrice}', '${section}')">${heartIcon}</button>
      <div class="pet-media-wrap" onclick="openMedia('${media}', ${isVid}, '${safeName}', '${safeDesc}', '${petPrice}', '${section}')">
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

  const filterBtns = document.getElementById(`view-${pageType}`).querySelectorAll('.filter-btn');
  filterBtns.forEach(b => b.classList.remove('active-filter'));
  
  if (btn) {
    btn.classList.add("active-filter");
  } else {
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
  if (!cart.length) {
    showToast("Your cart is empty!");
    return; 
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

// PREMIUM SKELETON LOADERS
function showSpinners() {
  const skeletonCards = Array(8).fill(`
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-info">
        <div class="skeleton-line"></div>
        <div class="skeleton-line price"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-btn-wrap">
          <div class="skeleton-btn"></div>
          <div class="skeleton-btn"></div>
        </div>
      </div>
    </div>
  `).join('');

  const saleBox = document.getElementById("sale-pets-container");
  const adoptBox = document.getElementById("adoption-pets-container");
  if(saleBox) saleBox.innerHTML = skeletonCards;
  if(adoptBox) adoptBox.innerHTML = skeletonCards;
}

async function init() {
  updateNetworkStatus();
  
  if (navigator.onLine) {
    showSpinners(); 
    
    // Force the skeleton loaders to display for exactly 3 seconds so the premium animation is visible to the user
    await Promise.all([
      fetchPets(),
      new Promise(resolve => setTimeout(resolve, 3000)) // Changed from 1000 to 3000
    ]);
    
    setupRealtimeSubscription(); 
  }
  
  initTestimonials();
  renderCurrentView();
  updateCartUI();
  updateFavoritesUI(); 
}

init();
