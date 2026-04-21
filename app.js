const SUPABASE_URL = "https://mbpdimmuuzrxgsraofew.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGRpbW11dXpyeGdzcmFvZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDYwNjAsImV4cCI6MjA5MTk4MjA2MH0.g54oYMrrChSGr_fRpMwFIYp5LAQcV1hzIJqvRXpjj6E";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function n(v) {
  return String(v || "").toLowerCase().trim();
}

async function loadNow() {
  const saleBox = document.getElementById("sale-pets-container");
  const adoptBox = document.getElementById("adoption-pets-container");
  const homeBox = document.getElementById("home-pets-container");

  if (!saleBox && !adoptBox && !homeBox) return;

  const { data, error } = await supabaseClient
    .from("pets")
    .select("id,name,price,category,section,status,media_url,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Fetch error: " + error.message);
    return;
  }

  const visible = (data || []).filter((p) => ["available", "reserved"].includes(n(p.status)));
  const sale = visible.filter((p) => n(p.section) === "sale");
  const adoption = visible.filter((p) => n(p.section) === "adoption");

  const card = (p) => `
    <div class="pet-card">
      <img class="pet-image" src="${p.media_url || "https://placehold.co/400x300?text=No+Image"}" alt="${p.name || ""}">
      <div class="pet-info">
        <h3 class="pet-name">${p.name || ""}</h3>
        <p class="pet-price">${p.price ?? ""}</p>
      </div>
    </div>`;

  if (homeBox) homeBox.innerHTML = visible.map(card).join("") || "<p>No pets found.</p>";
  if (saleBox) saleBox.innerHTML = sale.map(card).join("") || "<p>No sale pets found.</p>";
  if (adoptBox) adoptBox.innerHTML = adoption.map(card).join("") || "<p>No adoption pets found.</p>";
}

loadNow();
