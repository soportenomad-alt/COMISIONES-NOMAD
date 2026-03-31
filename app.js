
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfigNomad = {
  apiKey: "AIzaSyDhtKZlWpHdhFcnVzWovB93bRSVRkC1sDI",
  authDomain: "cotizador-nomad.firebaseapp.com",
  projectId: "cotizador-nomad",
  storageBucket: "cotizador-nomad.firebasestorage.app",
  messagingSenderId: "736481537624",
  appId: "1:736481537624:web:6f06667cf34bccc532642d"
};

const STORAGE_KEY = "nomadComisionesFirebaseSeller";
const COLLECTION_NAME = "cotizaciones";

const app = initializeApp(firebaseConfigNomad);
const db = getFirestore(app);

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const sellerNameInput = document.getElementById("sellerName");
const sellerEmailInput = document.getElementById("sellerEmail");
const currentSeller = document.getElementById("currentSeller");
const currentSellerEmail = document.getElementById("currentSellerEmail");
const monthFilter = document.getElementById("monthFilter");
const searchInput = document.getElementById("searchInput");
const acceptedOnly = document.getElementById("acceptedOnly");
const showAllSellerQuotes = document.getElementById("showAllSellerQuotes");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const logoutBtn = document.getElementById("logoutBtn");

const quotesCount = document.getElementById("quotesCount");
const acceptedLegend = document.getElementById("acceptedLegend");
const salesTotal = document.getElementById("salesTotal");
const commercialTotal = document.getElementById("commercialTotal");
const doctorTotal = document.getElementById("doctorTotal");
const unmatchedCount = document.getElementById("unmatchedCount");
const tableCount = document.getElementById("tableCount");
const quotesTableBody = document.getElementById("quotesTableBody");
const detailBox = document.getElementById("detailBox");
const unmatchedList = document.getElementById("unmatchedList");

const SELLER_DIRECTORY = [
  { email: "kam2.mx@nomadgenetics.com", name: "Angel Sánchez", aliases: ["angel", "angel sanchez", "angel sánchez"] },
  { email: "ger.genomica@nomadgenetics.com", name: "Marymar Martinez", aliases: ["marymar", "marymar martinez"] }
];

const state = {
  seller: null,
  allQuotes: [],
  filteredQuotes: [],
  selectedQuoteId: null
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2
});

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function normalize(text) {
  return (text || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function monthString(dateValue) {
  if (!dateValue) return "";
  const raw = String(dateValue);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return "";
}

function isAccepted(status1) {
  const value = normalize(status1);
  return value.includes("aceptada") || value.includes("cerrada") || value.includes("aceptado");
}

function getCommissionMap() {
  const map = new Map();
  (window.COMMISSIONS_DATA || []).forEach((item) => {
    map.set(normalize(item.prueba), item);
  });
  return map;
}

const commissionMap = getCommissionMap();

function findCommissionForTest(testName) {
  const normalized = normalize(testName);
  if (commissionMap.has(normalized)) return commissionMap.get(normalized);

  for (const [key, value] of commissionMap.entries()) {
    if (normalized.includes(key) || key.includes(normalized)) return value;
  }
  return null;
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.seller));
}

function loadSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    state.seller = JSON.parse(raw);
  } catch (_) {}
}

function findSellerDirectoryEntry({ email = "", name = "" } = {}) {
  const normalizedEmail = normalize(email);
  const normalizedName = normalize(name);
  return SELLER_DIRECTORY.find((entry) => {
    if (normalizedEmail && normalize(entry.email) === normalizedEmail) return true;
    if (normalizedName && normalize(entry.name) === normalizedName) return true;
    return (entry.aliases || []).some((alias) => normalize(alias) === normalizedName || normalize(alias) === normalizedEmail);
  }) || null;
}

function resolveSellerSession(rawSeller = {}) {
  const entry = findSellerDirectoryEntry(rawSeller);
  const name = (entry?.name || rawSeller.name || "").trim();
  const email = (entry?.email || rawSeller.email || "").trim();
  const aliases = [...new Set([
    name,
    email,
    ...(entry?.aliases || []),
    rawSeller.name || "",
    rawSeller.email || ""
  ].filter(Boolean).map((value) => normalize(value)))];

  return { name, email, aliases };
}

function renderAppState() {
  const loggedIn = !!state.seller;
  loginView.classList.toggle("hidden", loggedIn);
  appView.classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    currentSeller.textContent = state.seller.name || "-";
    currentSellerEmail.textContent = state.seller.email || "Sin correo";
  }
}

function getKamValue(quote) {
  return normalize(quote.kam || quote.vendedor || quote.asesor || quote.kamEmail || quote.email || "");
}

function quoteMatchesSeller(quote, seller) {
  const haystack = [
    quote.kam,
    quote.vendedor,
    quote.asesor,
    quote.kamEmail,
    quote.email
  ].map((value) => normalize(value)).filter(Boolean);

  return (seller.aliases || []).some((alias) => haystack.some((item) => item.includes(alias) || alias.includes(item)));
}

function getSearchText(quote) {
  const testsText = (quote.tests || []).map(t => t.prueba).join(" | ");
  return normalize([
    quote.folio,
    quote.paciente,
    quote.medico,
    quote.kam,
    quote.status1,
    testsText
  ].join(" "));
}

function mapQuote(docSnap) {
  const data = docSnap.data();
  const rawTests = Array.isArray(data.pruebas) ? data.pruebas : [];
  const tests = rawTests.map((item) => {
    const prueba = (item?.prueba || item?.nombre || item?.descripcion || "").toString().trim();
    const subtotal = Number(item?.subtotal || item?.total || item?.precio || 0);
    const quantity = Number(item?.cantidad || item?.cant || 1) || 1;
    const commission = findCommissionForTest(prueba);

    return {
      prueba,
      quantity,
      subtotal,
      matched: !!commission,
      precioSinIva: commission ? Number(commission.precioSinIva || 0) : 0,
      comisionMedico: commission ? Number(commission.comisionMedico || 0) : 0,
      comisionComercial: commission ? Number(commission.comisionComercial || 0) : 0,
      comisionMedicoTotal: commission ? Number(commission.comisionMedico || 0) * quantity : 0,
      comisionComercialTotal: commission ? Number(commission.comisionComercial || 0) * quantity : 0
    };
  });

  const unmatchedTests = tests.filter(t => t.prueba && !t.matched).map(t => t.prueba);
  const matchedCommercial = tests.reduce((sum, item) => sum + item.comisionComercialTotal, 0);
  const matchedDoctor = tests.reduce((sum, item) => sum + item.comisionMedicoTotal, 0);

  return {
    id: docSnap.id,
    folio: data.folio || "",
    fechaEmision: data.fechaEmision || "",
    paciente: data.paciente || "",
    medico: data.medico || "",
    kam: data.kam || "",
    status1: data.status1 || "Sin seguimiento",
    total: Number(data.total || 0),
    tests,
    unmatchedTests,
    matchedCommercial,
    matchedDoctor,
    accepted: isAccepted(data.status1 || "")
  };
}

async function loadQuotes() {
  quotesTableBody.innerHTML = `<tr><td colspan="9" class="empty">Cargando cotizaciones de Firebase...</td></tr>`;
  detailBox.textContent = "Cargando detalle...";
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    state.allQuotes = snapshot.docs.map(mapQuote);
    applyFilters();
  } catch (error) {
    console.error(error);
    quotesTableBody.innerHTML = `<tr><td colspan="9" class="empty">No se pudo leer Firebase. Revisa reglas/permisos del proyecto.</td></tr>`;
    detailBox.textContent = "Sin acceso a los datos.";
  }
}

function applyFilters() {
  if (!state.seller) return;

  const sellerAliases = state.seller.aliases || [normalize(state.seller.name)];
  const search = normalize(searchInput.value);
  const month = monthFilter.value;
  const acceptedFilter = acceptedOnly.checked;
  const includeNonAcceptedSellerQuotes = showAllSellerQuotes.checked;

  let rows = [...state.allQuotes].filter((quote) => quoteMatchesSeller(quote, state.seller));

  if (!includeNonAcceptedSellerQuotes && acceptedFilter) {
    rows = rows.filter((quote) => quote.accepted);
  } else if (acceptedFilter) {
    rows = rows.filter((quote) => quote.accepted);
  }

  if (month) {
    rows = rows.filter((quote) => monthString(quote.fechaEmision) === month);
  }

  if (search) {
    rows = rows.filter((quote) => getSearchText(quote).includes(search));
  }

  rows.sort((a, b) => (b.fechaEmision || "").localeCompare(a.fechaEmision || ""));

  state.filteredQuotes = rows;
  if (!rows.find(q => q.id === state.selectedQuoteId)) {
    state.selectedQuoteId = rows[0]?.id || null;
  }
  renderSummary();
  renderTable();
  renderDetail();
}

function renderSummary() {
  const rows = state.filteredQuotes;
  const totals = rows.reduce((acc, quote) => {
    acc.sales += Number(quote.total || 0);
    acc.commercial += Number(quote.matchedCommercial || 0);
    acc.doctor += Number(quote.matchedDoctor || 0);
    quote.unmatchedTests.forEach((name) => acc.unmatched.add(name));
    return acc;
  }, { sales: 0, commercial: 0, doctor: 0, unmatched: new Set() });

  quotesCount.textContent = String(rows.length);
  acceptedLegend.textContent = acceptedOnly.checked ? "Solo aceptadas" : "Incluye otros estatus";
  salesTotal.textContent = formatMoney(totals.sales);
  commercialTotal.textContent = formatMoney(totals.commercial);
  doctorTotal.textContent = formatMoney(totals.doctor);
  unmatchedCount.textContent = String(totals.unmatched.size);
  tableCount.textContent = `${rows.length} resultado${rows.length === 1 ? "" : "s"}`;

  if (!totals.unmatched.size) {
    unmatchedList.innerHTML = `<span class="empty-chip">Sin diferencias por ahora.</span>`;
  } else {
    unmatchedList.innerHTML = [...totals.unmatched]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `<span class="chip">${escapeHtml(name)}</span>`)
      .join("");
  }
}

function statusClass(quote) {
  if (quote.accepted) return "status-pill status-ok";
  const val = normalize(quote.status1);
  if (val.includes("negoci")) return "status-pill status-pending";
  return "status-pill status-other";
}

function renderTable() {
  const rows = state.filteredQuotes;
  if (!rows.length) {
    quotesTableBody.innerHTML = `<tr><td colspan="9" class="empty">No se encontraron cotizaciones para este vendedor con los filtros actuales.</td></tr>`;
    return;
  }

  quotesTableBody.innerHTML = rows.map((quote) => `
    <tr>
      <td>${escapeHtml(quote.fechaEmision || "-")}</td>
      <td>${escapeHtml(quote.folio || "-")}</td>
      <td>${escapeHtml(quote.paciente || "-")}</td>
      <td>${escapeHtml(quote.medico || "-")}</td>
      <td>${escapeHtml(quote.kam || "-")}</td>
      <td><span class="${statusClass(quote)}">${escapeHtml(quote.status1 || "-")}</span></td>
      <td>${formatMoney(quote.total)}</td>
      <td>${formatMoney(quote.matchedCommercial)}</td>
      <td><button class="link-btn" data-id="${quote.id}">Ver detalle</button></td>
    </tr>
  `).join("");
}

function renderDetail() {
  const quote = state.filteredQuotes.find((item) => item.id === state.selectedQuoteId);
  if (!quote) {
    detailBox.textContent = "Selecciona una cotización para ver el desglose de pruebas y comisiones.";
    return;
  }

  const testsHtml = quote.tests.length
    ? quote.tests.map((test) => `
      <div class="detail-item">
        <strong>${escapeHtml(test.prueba || "Sin nombre")}</strong>
        <div class="detail-amounts">
          <div class="kv"><span>Cantidad</span>${test.quantity}</div>
          <div class="kv"><span>Subtotal detectado</span>${formatMoney(test.subtotal)}</div>
          <div class="kv"><span>Match Excel</span>${test.matched ? "Sí" : "No"}</div>
          <div class="kv"><span>Comisión comercial</span>${formatMoney(test.comisionComercialTotal)}</div>
          <div class="kv"><span>Comisión médico</span>${formatMoney(test.comisionMedicoTotal)}</div>
          <div class="kv"><span>Precio base Excel</span>${test.matched ? formatMoney(test.precioSinIva) : "-"}</div>
        </div>
      </div>
    `).join("")
    : `<p class="muted">Esta cotización no trae arreglo de pruebas.</p>`;

  detailBox.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(quote.folio || "Sin folio")}</h3>
      <p class="muted">Paciente: <strong>${escapeHtml(quote.paciente || "-")}</strong></p>
      <p class="muted">Médico: <strong>${escapeHtml(quote.medico || "-")}</strong> · KAM: <strong>${escapeHtml(quote.kam || "-")}</strong></p>
      <p class="muted">Estatus: <strong>${escapeHtml(quote.status1 || "-")}</strong> · Total cotización: <strong>${formatMoney(quote.total)}</strong></p>
      <div class="detail-amounts">
        <div class="kv"><span>Comisión comercial total</span>${formatMoney(quote.matchedCommercial)}</div>
        <div class="kv"><span>Comisión médico total</span>${formatMoney(quote.matchedDoctor)}</div>
        <div class="kv"><span>Pruebas sin match</span>${quote.unmatchedTests.length}</div>
      </div>
    </div>
    ${testsHtml}
  `;
}

function exportCsv() {
  const rows = state.filteredQuotes;
  const headers = [
    "fechaEmision","folio","paciente","medico","kam","status1","totalCotizacion",
    "prueba","cantidad","subtotalDetectado","comisionComercial","comisionMedico","matchExcel"
  ];

  const lines = [headers.join(",")];
  rows.forEach((quote) => {
    if (!quote.tests.length) {
      lines.push([
        quote.fechaEmision, quote.folio, quote.paciente, quote.medico, quote.kam, quote.status1, quote.total,
        "", "", "", quote.matchedCommercial, quote.matchedDoctor, ""
      ].map(csvEscape).join(","));
      return;
    }

    quote.tests.forEach((test) => {
      lines.push([
        quote.fechaEmision, quote.folio, quote.paciente, quote.medico, quote.kam, quote.status1, quote.total,
        test.prueba, test.quantity, test.subtotal, test.comisionComercialTotal, test.comisionMedicoTotal, test.matched ? "SI" : "NO"
      ].map(csvEscape).join(","));
    });
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const sellerSafe = normalize(state.seller.name || "vendedor").replace(/\s+/g, "_");
  a.href = url;
  a.download = `comisiones_nomad_${sellerSafe}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.seller = resolveSellerSession({
    name: sellerNameInput.value.trim(),
    email: sellerEmailInput.value.trim()
  });
  saveSession();
  renderAppState();
  applyFilters();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state.seller = null;
  state.filteredQuotes = [];
  state.selectedQuoteId = null;
  renderAppState();
});

refreshBtn.addEventListener("click", loadQuotes);
exportBtn.addEventListener("click", exportCsv);
[monthFilter, searchInput, acceptedOnly, showAllSellerQuotes].forEach((el) => el.addEventListener("input", applyFilters));
quotesTableBody.addEventListener("click", (event) => {
  const button = event.target.closest(".link-btn");
  if (!button) return;
  state.selectedQuoteId = button.dataset.id;
  renderDetail();
});

loadSession();
if (state.seller) state.seller = resolveSellerSession(state.seller);
renderAppState();
monthFilter.value = new Date().toISOString().slice(0, 7);
await loadQuotes();
