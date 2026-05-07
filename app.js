const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let salePets = [];
let adoptionPets = [];
let cart = [];
let currentView = "home";

function n(v) { return String(v || "").toLowerCase().trim(); }
function safeText(v = "") { return String(v).replace(/'/g, "\'").replace(/"/g, '"'); }
function numericPrice(v) { const p = parseFloat(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(p) ? p : 0; }
function formatPrice(v) { const num = numericPrice(v); return num ? "$" + num.toLocaleString() : String(v||""); }
function isVideo(url = "") { const u = url.toLowerCase(); return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov"); }

function toggleMenu() { document.getElementById("navMenu")?.classList.toggle("active"); }

function switchPage(page) {
    currentView = page;
    document.querySelectorAll(".page-view").forEach(el => el.classList.remove("active"));
    const view = document.getElementById(`view-${page}`);
    if(view) view.classList.add("active");
    
    document.getElementById("navMenu")?.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    if (page !== "home" && page !== "contact" && document.getElementById("globalSearch")) {
        document.getElementById("globalSearch").value = "";
    }
    renderCurrentView();
}

async function fetchPets() {
    const { data, error } = await supabaseClient
        .from("pets")
        .select("id,name,price,category,section,status,media_url,description,created_at")
        .order("created_at", { ascending: false });

    if (error) { console.error(error); return; }

    const visible = (data || []).filter(p => ["available", "reserved"].includes(n(p.status)) || !p.status);
    salePets = visible.filter(p => n(p.section) === "sale");
    adoptionPets = visible.filter(p => n(p.section) === "adoption");
}

function renderGrid(containerId, items, emptyId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    
    if (!items.length) {
        box.innerHTML = "";
        if(document.getElementById(emptyId)) document.getElementById(emptyId).style.display = "block";
        return;
    }
    if(document.getElementById(emptyId)) document.getElementById(emptyId).style.display = "none";

    box.innerHTML = items.map(p => {
        const media = p.media_url || "https://placehold.co/600x400?text=No+Image"; 
        const isVid = isVideo(media);
        const name = safeText(p.name);
        const desc = safeText(p.description);
        const price = formatPrice(p.price);
        
        return `
        <div class="pet-card">
            <div class="pet-media-wrap" onclick="openMedia('${media}', ${isVid}, '${name}', '${desc}')">
                ${ isVid ? `<video class="pet-image" src="${media}" muted playsinline></video>` : `<img class="pet-image" src="${media}" alt="${name}">` }
            </div>
            <div class="pet-info">
                <h3 class="pet-name">${p.name}</h3>
                <p class="pet-price">${price}</p>
                <p class="pet-desc" title="${desc}">${p.description || ""}</p>
                <span class="read-more-btn" onclick="openMedia('${media}', ${isVid}, '${name}', '${desc}')">Read more</span>
                <div class="pet-actions">
                    <button class="buy-btn" onclick="buyNow('${name}','${price}','${p.section}')">${p.section === 'adoption' ? 'Adopt' : 'Buy'}</button>
                    <button class="cart-btn" onclick="addToCart('${name}','${price}')">Add to Cart</button>
                </div>
            </div>
        </div>`;
    }).join("");
}

function renderCurrentView() {
    renderGrid("sale-pets-container", salePets, "sale-empty");
    renderGrid("adoption-pets-container", adoptionPets, "adoption-empty");
}

function filterPage(pageType, cat, btn) {
    if (btn) {
        btn.parentElement.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active-filter"));
        btn.classList.add("active-filter");
    }
    const source = pageType === 'sale' ? salePets : adoptionPets;
    const filtered = cat === 'all' ? source : source.filter(p => n(p.category) === cat);
    renderGrid(`${pageType}-pets-container`, filtered, `${pageType}-empty`);
}

function handleGlobalSearch() {
    const term = n(document.getElementById("globalSearch")?.value);
    if(currentView === 'home' && term !== "") switchPage('sale');
    
    const sList = salePets.filter(p => n(p.name).includes(term) || n(p.category).includes(term));
    const aList = adoptionPets.filter(p => n(p.name).includes(term) || n(p.category).includes(term));
    
    renderGrid("sale-pets-container", sList, "sale-empty");
    renderGrid("adoption-pets-container", aList, "adoption-empty");
}

async function uploadMedia(file) {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const filePath = `pets/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    
    const { data, error } = await supabaseClient.storage.from('media').upload(filePath, file);
    if (error) { console.error("Upload error:", error); return null; }
    
    const { data: publicUrlData } = supabaseClient.storage.from('media').getPublicUrl(filePath);
    return publicUrlData.publicUrl;
}

async function handleUploadSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('upload-btn');
    if(btn) { btn.textContent = "Uploading..."; btn.disabled = true; }

    const name = document.getElementById('upload-name').value;
    const price = document.getElementById('upload-price').value;
    const category = document.getElementById('upload-category').value;
    const section = document.getElementById('upload-section').value;
    const desc = document.getElementById('upload-desc').value;
    const file = document.getElementById('upload-media').files[0];

    const mediaUrl = await uploadMedia(file);

    const { error } = await supabaseClient.from('pets').insert([{
        name, price, category, section, description: desc, media_url: mediaUrl, status: 'available'
    }]);

    if(btn) { btn.textContent = "Upload Pet"; btn.disabled = false; }

    if (error) {
        alert("Error uploading pet: " + error.message);
    } else {
        alert("Pet successfully listed!");
        e.target.reset();
        await fetchPets();
        renderCurrentView();
    }
}

// Cart logic
function toggleCart() { document.getElementById("cart-overlay")?.classList.toggle("active"); }
function addToCart(name, priceText) { cart.push({ name, priceText, price: numericPrice(priceText) }); updateCartUI(); alert(`Added ${name} to cart!`); }
function removeFromCart(idx) { cart.splice(idx, 1); updateCartUI(); }

function updateCartUI() {
    const badge = document.getElementById("cart-badge");
    if(badge) badge.textContent = cart.length;
    
    const list = document.getElementById("cart-items");
    let total = 0;
    
    if (!list) return;

    if (!cart.length) { list.innerHTML = "<p>Cart is empty.</p>"; }
    else {
        list.innerHTML = cart.map((item, i) => {
            total += item.price;
            return `<div class="cart-item">
                <div><strong>${item.name}</strong><p style="color:var(--accent); margin-top:2px;">${item.priceText}</p></div>
                <button class="remove-btn" onclick="removeFromCart(${i})">Remove</button>
            </div>`;
        }).join("");
    }
    const totalPriceEl = document.getElementById("cart-total-price");
    if(totalPriceEl) totalPriceEl.textContent = "$" + total.toLocaleString();
}

function buyNow(name, price, section) {
    const t = section === "adoption" ? "Adoption Inquiry" : "Purchase Inquiry";
    window.open(`https://wa.me/13075337422?text=${encodeURIComponent(`Hello!\n\n${t}\nPet: ${name}\nPrice: ${price}`)}`, "_blank");
}

function checkout() {
    if (!cart.length) return alert("Cart is empty.");
    let total = 0, lines = "";
    cart.forEach(i => { total += i.price; lines += `• ${i.name} - ${i.priceText}\n`; });
    window.open(`https://wa.me/13075337422?text=${encodeURIComponent(`Hello!\nI want to order:\n${lines}\nTotal: $${total.toLocaleString()}`)}`, "_blank");
}

// Media Modal
function openMedia(url, isVid, title, desc) {
    const modal = document.getElementById("media-modal");
    if(!modal) return;
    document.getElementById("media-modal-media").innerHTML = isVid ? `<video src="${url}" controls autoplay></video>` : `<img src="${url}">`;
    document.getElementById("media-modal-title").textContent = title;
    document.getElementById("media-modal-desc").textContent = desc;
    modal.classList.add("active");
}
function closeMedia() { 
    const modal = document.getElementById("media-modal");
    if(modal) {
        modal.classList.remove("active"); 
        setTimeout(() => document.getElementById("media-modal-media").innerHTML = "", 300);
    }
}

window.onscroll = function () {
    const btn = document.getElementById("homeBtn");
    if (btn) btn.classList.toggle("visible", document.body.scrollTop > 300 || document.documentElement.scrollTop > 300);
};

init();
async function init() {
    await fetchPets();
    renderCurrentView();
}
