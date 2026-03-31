
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
const GOALS_KEY = "nomadComisionesGoals";
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
const commissionGoalInput = document.getElementById("commissionGoalInput");
const salesGoalInput = document.getElementById("salesGoalInput");
const saveGoalsBtn = document.getElementById("saveGoalsBtn");
const resetGoalsBtn = document.getElementById("resetGoalsBtn");
const goalStatusBadge = document.getElementById("goalStatusBadge");
const goalMotivator = document.getElementById("goalMotivator");
const commissionRing = document.getElementById("commissionRing");
const salesRing = document.getElementById("salesRing");
const commissionProgressPercent = document.getElementById("commissionProgressPercent");
const salesProgressPercent = document.getElementById("salesProgressPercent");
const commissionCurrentValue = document.getElementById("commissionCurrentValue");
const commissionGoalValue = document.getElementById("commissionGoalValue");
const commissionRemainingValue = document.getElementById("commissionRemainingValue");
const salesCurrentValue = document.getElementById("salesCurrentValue");
const salesGoalValue = document.getElementById("salesGoalValue");
const salesRemainingValue = document.getElementById("salesRemainingValue");
const commissionGoalMini = document.getElementById("commissionGoalMini");
const salesGoalMini = document.getElementById("salesGoalMini");
const weeklyChart = document.getElementById("weeklyChart");
const statusStack = document.getElementById("statusStack");
const statusLegend = document.getElementById("statusLegend");

const SELLER_DIRECTORY = [
  { email: "kam2.mx@nomadgenetics.com", name: "Angel Sánchez", aliases: ["angel", "angel sanchez", "angel sánchez"] },
  { email: "ger.genomica@nomadgenetics.com", name: "Marymar Martinez", aliases: ["marymar", "marymar martinez"] },
  { email: "kam.gdl1@nomadgenetics.com", name: "Claudia", aliases: ["claudia"] },
  { email: "kam3@sanaresalud.com", name: "BERENICE", aliases: ["berenice", "berenice ordaz naranjo"] }
];

const state = {
  seller: null,
  allQuotes: [],
  filteredQuotes: [],
  selectedQuoteId: null,
  goals: { commission: 50000, sales: 300000 }
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
    const emailMatch = normalizedEmail && normalize(entry.email) === normalizedEmail;
    const nameMatch = normalizedName && (
      normalize(entry.name) === normalizedName ||
      (entry.aliases || []).some((alias) => normalize(alias) === normalizedName)
    );

    if (normalizedEmail && normalizedName) return emailMatch && nameMatch;
    if (normalizedEmail) return emailMatch;
    if (normalizedName) return nameMatch;
    return false;
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

  state.lastSummary = totals;
  renderGoals(totals);
  renderWeeklyChart(rows);
  renderStatusMix(rows);

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


function loadGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.goals.commission = Number(parsed.commission || state.goals.commission || 0);
    state.goals.sales = Number(parsed.sales || state.goals.sales || 0);
  } catch (_) {}
}

function saveGoals() {
  state.goals.commission = Number(commissionGoalInput.value || 0);
  state.goals.sales = Number(salesGoalInput.value || 0);
  localStorage.setItem(GOALS_KEY, JSON.stringify(state.goals));
  renderGoals(state.lastSummary || { sales: 0, commercial: 0 });
}

function resetGoals() {
  state.goals = { commission: 50000, sales: 300000 };
  commissionGoalInput.value = state.goals.commission;
  salesGoalInput.value = state.goals.sales;
  localStorage.setItem(GOALS_KEY, JSON.stringify(state.goals));
  renderGoals(state.lastSummary || { sales: 0, commercial: 0 });
}

function setRingProgress(element, percent) {
  const safePercent = Math.max(0, Math.min(100, percent || 0));
  element.style.setProperty("--progress", `${(safePercent / 100) * 360}deg`);
}

function buildWeeklyBuckets(rows) {
  const buckets = [0, 0, 0, 0, 0];
  rows.forEach((quote) => {
    const raw = String(quote.fechaEmision || "");
    const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? new Date(`${raw.slice(0, 10)}T12:00:00`) : null;
    const day = date && !Number.isNaN(date.getTime()) ? date.getDate() : 1;
    const index = Math.min(4, Math.floor((Math.max(1, day) - 1) / 7));
    buckets[index] += Number(quote.matchedCommercial || 0);
  });
  return buckets;
}

function renderWeeklyChart(rows) {
  if (!rows.length) {
    weeklyChart.className = "bars-chart empty-chart";
    weeklyChart.innerHTML = "No hay datos suficientes para construir el ritmo del mes.";
    return;
  }
  const values = buildWeeklyBuckets(rows);
  const max = Math.max(...values, 1);
  const labels = ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"];
  weeklyChart.className = "bars-chart";
  weeklyChart.innerHTML = values.map((value, idx) => {
    const height = Math.max(10, Math.round((value / max) * 100));
    return `
      <div class="bar-col">
        <div class="bar-track"><div class="bar-fill" style="height:${height}%">${value > 0 ? `${Math.round((value / max) * 100)}%` : ""}</div></div>
        <div class="bar-label">${labels[idx]}</div>
        <div class="bar-value">${formatMoney(value)}</div>
      </div>
    `;
  }).join("");
}

function renderStatusMix(rows) {
  const accepted = rows.filter((quote) => quote.accepted).length;
  const pending = rows.filter((quote) => {
    const val = normalize(quote.status1);
    return !quote.accepted && (val.includes("negoci") || val.includes("seguimiento") || val.includes("pend"));
  }).length;
  const other = Math.max(0, rows.length - accepted - pending);
  const total = Math.max(1, rows.length);
  const segments = [
    { cls: "seg-accepted", count: accepted, label: "Aceptadas", dot: "dot-accepted" },
    { cls: "seg-pending", count: pending, label: "Seguimiento", dot: "dot-pending" },
    { cls: "seg-other", count: other, label: "Otros", dot: "dot-other" }
  ];
  statusStack.innerHTML = segments.map((item) => `<div class="status-segment ${item.cls}" style="width:${(item.count / total) * 100}%"></div>`).join("");
  statusLegend.innerHTML = segments.map((item) => `
    <div class="legend-row">
      <div class="legend-left"><span class="legend-dot ${item.dot}"></span>${item.label}</div>
      <strong>${item.count} · ${Math.round((item.count / total) * 100)}%</strong>
    </div>
  `).join("");
}

function renderGoals(summary) {
  const currentCommercial = Number(summary.commercial || 0);
  const currentSales = Number(summary.sales || 0);
  const goalCommission = Number(state.goals.commission || 0);
  const goalSales = Number(state.goals.sales || 0);

  commissionGoalInput.value = goalCommission || 0;
  salesGoalInput.value = goalSales || 0;

  const commissionPercent = goalCommission > 0 ? (currentCommercial / goalCommission) * 100 : 0;
  const salesPercent = goalSales > 0 ? (currentSales / goalSales) * 100 : 0;
  const remainingCommission = Math.max(0, goalCommission - currentCommercial);
  const remainingSales = Math.max(0, goalSales - currentSales);

  setRingProgress(commissionRing, commissionPercent);
  setRingProgress(salesRing, salesPercent);
  commissionProgressPercent.textContent = `${Math.round(Math.min(999, commissionPercent || 0))}%`;
  salesProgressPercent.textContent = `${Math.round(Math.min(999, salesPercent || 0))}%`;

  commissionCurrentValue.textContent = formatMoney(currentCommercial);
  commissionGoalValue.textContent = formatMoney(goalCommission);
  commissionRemainingValue.textContent = formatMoney(remainingCommission);
  salesCurrentValue.textContent = formatMoney(currentSales);
  salesGoalValue.textContent = formatMoney(goalSales);
  salesRemainingValue.textContent = formatMoney(remainingSales);
  commissionGoalMini.textContent = goalCommission > 0 ? `Meta: ${formatMoney(goalCommission)}` : "Sin meta";
  salesGoalMini.textContent = goalSales > 0 ? `Meta: ${formatMoney(goalSales)}` : "Sin meta";

  const topPercent = Math.max(commissionPercent, salesPercent);
  if (topPercent >= 100) {
    goalStatusBadge.textContent = "Meta cumplida";
    goalStatusBadge.className = "badge success";
    goalMotivator.textContent = `Excelente. Ya alcanzaste una de tus metas del mes y llevas ${formatMoney(currentCommercial)} de comisión comercial.`;
  } else if (topPercent >= 70) {
    goalStatusBadge.textContent = "Muy buen ritmo";
    goalStatusBadge.className = "badge";
    goalMotivator.textContent = `Vas muy bien. Te faltan ${formatMoney(remainingCommission)} de comisión o ${formatMoney(remainingSales)} de venta para cerrar tu objetivo.`;
  } else if (topPercent > 0) {
    goalStatusBadge.textContent = "En ruta";
    goalStatusBadge.className = "badge";
    goalMotivator.textContent = `Buen arranque. Cada cotización aceptada suma al cierre del mes. Mantén el ritmo y revisa tus semanas más fuertes.`;
  } else {
    goalStatusBadge.textContent = "Sin avance";
    goalStatusBadge.className = "badge";
    goalMotivator.textContent = "Todavía no hay avance con los filtros actuales. Revisa otro mes o habilita más cotizaciones para medir mejor.";
  }
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
  const rawSeller = {
    name: sellerNameInput.value.trim(),
    email: sellerEmailInput.value.trim()
  };
  const entry = findSellerDirectoryEntry(rawSeller);

  if (!rawSeller.name || !rawSeller.email) {
    alert("Captura nombre y correo para ingresar.");
    return;
  }

  if (!entry) {
    alert("Tu nombre y correo no coinciden con un acceso autorizado.");
    return;
  }

  state.seller = resolveSellerSession(rawSeller);
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
saveGoalsBtn.addEventListener("click", saveGoals);
resetGoalsBtn.addEventListener("click", resetGoals);
exportBtn.addEventListener("click", exportCsv);
[monthFilter, searchInput, acceptedOnly, showAllSellerQuotes].forEach((el) => el.addEventListener("input", applyFilters));
quotesTableBody.addEventListener("click", (event) => {
  const button = event.target.closest(".link-btn");
  if (!button) return;
  state.selectedQuoteId = button.dataset.id;
  renderDetail();
});

loadGoals();
loadSession();
if (state.seller) {
  const persistedEntry = findSellerDirectoryEntry(state.seller);
  state.seller = persistedEntry ? resolveSellerSession(state.seller) : null;
}
renderAppState();
monthFilter.value = new Date().toISOString().slice(0, 7);
await loadQuotes();
if (state.seller) {
  applyFilters();
}
