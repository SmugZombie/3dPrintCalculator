// App wiring: state, rendering, event handlers. Depends on storage.js and calc.js being loaded first.

let state = {
  partName: '',
  technology: 'FDM',
  printerId: null,
  materials: [],   // { id, filamentId, name, costPerKg, weightGrams }
  extras: [],      // { id, type: 'hardware'|'packaging', itemId, name, unitCost, qty }
  printHours: 0,
  printMinutes: 0,
  laborMinutes: 0,
  laborRate: 15,
  batchEnabled: false,
  batchQty: 1,
  batchSetupMin: 0,
  electricityRate: 0.30,
  vatRate: 20,
  customMargin: 50,
  currency: '$',
  deductStock: true,
  editingQuoteId: null,
  selectedTier: 'Standard',
};

let lastResult = null;

// ---------- helpers ----------

function $(id) { return document.getElementById(id); }
function fmt(value) { return `${state.currency}${(Number(value) || 0).toFixed(2)}`; }

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);background:#1b2430;color:#fff;padding:0.6rem 1.1rem;border-radius:8px;font-size:0.85rem;z-index:100;opacity:0;transition:opacity .2s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

function filamentsForTech(tech) {
  return Store.getFilaments().filter((f) => f.technology === tech);
}
function printersForTech(tech) {
  return Store.getPrinters().filter((p) => p.technology === tech);
}

// ---------- tabs ----------

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'quotes') renderQuotesTable();
      if (btn.dataset.tab === 'filaments') renderFilamentsTable();
      if (btn.dataset.tab === 'printers') renderPrintersTable();
      if (btn.dataset.tab === 'inventory') renderInventoryTable();
      if (btn.dataset.tab === 'settings') loadSettingsIntoForm();
    });
  });
}

// ---------- calculator: materials rows ----------

function addMaterialRow(prefill) {
  const tech = state.technology;
  const list = filamentsForTech(tech);
  const defaultFil = (prefill && list.find((f) => f.id === prefill.filamentId)) || list[0];
  state.materials.push({
    id: uid('mat'),
    filamentId: prefill?.filamentId ?? defaultFil?.id ?? null,
    name: prefill?.name ?? defaultFil?.name ?? 'Custom',
    costPerKg: prefill?.costPerKg ?? defaultFil?.costPerKg ?? 0,
    weightGrams: prefill?.weightGrams ?? 0,
  });
  renderMaterialsTable();
}

function renderMaterialsTable() {
  const tech = state.technology;
  const options = filamentsForTech(tech);
  const body = $('materials-body');
  body.innerHTML = '';
  if (state.materials.length === 0) addMaterialRow();

  state.materials.forEach((m) => {
    const tr = document.createElement('tr');
    tr.dataset.rowId = m.id;
    const subtotal = (Number(m.weightGrams) || 0) / 1000 * (Number(m.costPerKg) || 0);
    tr.innerHTML = `
      <td>
        <select data-field="filamentId">
          ${options.map((o) => `<option value="${o.id}" ${o.id === m.filamentId ? 'selected' : ''}>${o.name}</option>`).join('')}
          <option value="__custom" ${m.filamentId === '__custom' ? 'selected' : ''}>Custom…</option>
        </select>
      </td>
      <td><input type="number" min="0" step="1" data-field="weightGrams" value="${m.weightGrams}" /></td>
      <td><input type="number" min="0" step="0.1" data-field="costPerKg" value="${m.costPerKg}" ${m.filamentId !== '__custom' ? '' : ''} /></td>
      <td>${fmt(subtotal)}</td>
      <td><button class="btn-danger" data-action="removeMaterial">✕</button></td>
    `;
    body.appendChild(tr);
  });
  computeAndRender();
}

$('materials-body') && null; // placeholder, listeners attached in initCalculator via delegation

// ---------- calculator: extras (hardware/packaging) rows ----------

function addExtraRow() {
  state.extras.push({ id: uid('ext'), type: 'hardware', itemId: null, name: 'Custom item', unitCost: 0, qty: 1 });
  renderExtrasTable();
}

function renderExtrasTable() {
  const body = $('extras-body');
  body.innerHTML = '';
  state.extras.forEach((e) => {
    const inv = Store.getInventory().filter((i) => i.type === e.type);
    const subtotal = (Number(e.qty) || 0) * (Number(e.unitCost) || 0);
    const tr = document.createElement('tr');
    tr.dataset.rowId = e.id;
    tr.innerHTML = `
      <td>
        <select data-field="type">
          <option value="hardware" ${e.type === 'hardware' ? 'selected' : ''}>Hardware</option>
          <option value="packaging" ${e.type === 'packaging' ? 'selected' : ''}>Packaging</option>
        </select>
      </td>
      <td>
        <select data-field="itemId">
          <option value="__custom" ${!e.itemId ? 'selected' : ''}>Custom…</option>
          ${inv.map((i) => `<option value="${i.id}" ${i.id === e.itemId ? 'selected' : ''}>${i.name} (${i.qtyOnHand} in stock)</option>`).join('')}
        </select>
      </td>
      <td><input type="number" min="0" step="1" data-field="qty" value="${e.qty}" /></td>
      <td><input type="number" min="0" step="0.01" data-field="unitCost" value="${e.unitCost}" /></td>
      <td>${fmt(subtotal)}</td>
      <td><button class="btn-danger" data-action="removeExtra">✕</button></td>
    `;
    body.appendChild(tr);
  });
  computeAndRender();
}

// ---------- calculator: printer dropdown ----------

function renderPrinterDropdown() {
  const sel = $('f-printer');
  const list = printersForTech(state.technology);
  const prevSelected = state.printerId;
  sel.innerHTML = list.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  const stillValid = list.some((p) => p.id === prevSelected);
  state.printerId = stillValid ? prevSelected : (list[0]?.id ?? null);
  sel.value = state.printerId;
}

// ---------- calculator: compute + render results ----------

function gatherComputeInput() {
  const printer = Store.getPrinters().find((p) => p.id === state.printerId) || { powerWatts: 0, purchaseCost: 0, lifetimeHours: 1 };
  return {
    materials: state.materials.map((m) => ({ weightGrams: m.weightGrams, costPerKg: m.costPerKg })),
    extras: state.extras.map((e) => ({ type: e.type, qty: e.qty, unitCost: e.unitCost })),
    printHoursPerUnit: (Number(state.printHours) || 0) + (Number(state.printMinutes) || 0) / 60,
    laborMinutesPerUnit: Number(state.laborMinutes) || 0,
    laborRate: Number(state.laborRate) || 0,
    printer,
    electricityRate: Number(state.electricityRate) || 0,
    batch: { enabled: state.batchEnabled, qty: state.batchQty, setupMinutes: state.batchSetupMin },
    vatRate: Number(state.vatRate) || 0,
    customMarginPercent: Number(state.customMargin) || 0,
  };
}

function computeAndRender() {
  const result = computeQuote(gatherComputeInput());
  lastResult = result;
  renderBreakdown(result);
  renderPricingTable(result);
  renderBatchSummary(result);
  renderTierBreakdown(result);
  return result;
}

function renderBreakdown(result) {
  const rows = [
    ['Material', result.breakdown.material],
    ['Hardware', result.breakdown.hardware],
    ['Packaging', result.breakdown.packaging],
    ['Labor', result.breakdown.labor],
    ['Machine', result.breakdown.machine],
  ];
  const max = Math.max(1e-9, ...rows.map((r) => r[1]));
  $('cost-breakdown').innerHTML = rows.map(([label, value]) => `
    <div class="cb-row">
      <span>${label}</span>
      <span class="bar"><span class="bar-fill" style="width:${(value / max) * 100}%"></span></span>
      <span>${fmt(value)}</span>
    </div>
  `).join('');
  const totalLabel = result.qty > 1 ? `Total Landed Cost (×${result.qty})` : 'Total Landed Cost';
  $('total-cost-line').innerHTML = `<span>${totalLabel}</span><span>${fmt(result.totalCost)}</span>`;
}

function renderPricingTable(result) {
  if (!result.tiers.some((t) => t.label === state.selectedTier)) {
    state.selectedTier = result.tiers[0].label;
  }
  $('pricing-body').innerHTML = result.tiers.map((t) => {
    const selected = t.label === state.selectedTier;
    return `
    <tr class="tier-row ${selected ? 'selected' : ''}" data-tier="${t.label}">
      <td><input type="radio" name="tierSelect" ${selected ? 'checked' : ''} /></td>
      <td>${t.label}</td>
      <td>+${t.margin}%</td>
      <td>${fmt(t.priceExVat)}</td>
      <td>${fmt(t.priceIncVat)}</td>
    </tr>
  `;
  }).join('');
}

function renderTierBreakdown(result) {
  const tier = result.tiers.find((t) => t.label === state.selectedTier) || result.tiers[0];
  const markupPerUnit = tier.priceExVat - result.perUnitCost;
  const vatPerUnit = tier.priceIncVat - tier.priceExVat;
  const qty = result.qty;

  let html = `
    <div class="tb-title">${tier.label} tier (+${tier.margin}% margin)</div>
    <div class="tb-row"><span>Cost per unit</span><span>${fmt(result.perUnitCost)}</span></div>
    <div class="tb-row"><span>Premium (+${tier.margin}%)</span><span>${fmt(markupPerUnit)}</span></div>
    <div class="tb-row muted"><span>Price per unit (ex. VAT)</span><span>${fmt(tier.priceExVat)}</span></div>
    <div class="tb-row muted"><span>VAT</span><span>${fmt(vatPerUnit)}</span></div>
    <div class="tb-total"><span>Charge per unit (incl. VAT)</span><span>${fmt(tier.priceIncVat)}</span></div>
  `;

  if (qty > 1) {
    html += `
      <div class="tb-subtitle">Batch total (×${qty})</div>
      <div class="tb-row"><span>Total cost</span><span>${fmt(result.totalCost)}</span></div>
      <div class="tb-row"><span>Total premium</span><span>${fmt(markupPerUnit * qty)}</span></div>
      <div class="tb-row muted"><span>Total (ex. VAT)</span><span>${fmt(tier.priceExVat * qty)}</span></div>
      <div class="tb-total"><span>Total to charge (incl. VAT)</span><span>${fmt(tier.priceIncVat * qty)}</span></div>
    `;
  }

  $('tier-breakdown').innerHTML = html;
}

function renderBatchSummary(result) {
  const el = $('batch-summary');
  if (!state.batchEnabled || result.qty <= 1) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <div><span>Quantity</span><span>${result.qty}</span></div>
    <div><span>Total print time</span><span>${result.totalPrintHours.toFixed(2)} h</span></div>
    <div><span>Total labor time</span><span>${result.totalLaborMinutes.toFixed(0)} min</span></div>
    <div><span>Cost per unit</span><span>${fmt(result.perUnitCost)}</span></div>
    <div><span>Total batch cost</span><span>${fmt(result.totalCost)}</span></div>
  `;
}

// ---------- calculator: field wiring ----------

function initCalculatorFields() {
  $('f-partName').addEventListener('input', (e) => { state.partName = e.target.value; });

  $('f-technology').addEventListener('change', (e) => {
    state.technology = e.target.value;
    state.materials = [];
    renderPrinterDropdown();
    renderMaterialsTable();
  });

  $('f-printer').addEventListener('change', (e) => { state.printerId = e.target.value; computeAndRender(); });

  $('f-batchEnabled').addEventListener('change', (e) => {
    state.batchEnabled = e.target.checked;
    $('row-batch').hidden = !state.batchEnabled;
    computeAndRender();
  });
  $('f-batchQty').addEventListener('input', (e) => { state.batchQty = Number(e.target.value) || 1; computeAndRender(); });
  $('f-batchSetupMin').addEventListener('input', (e) => { state.batchSetupMin = Number(e.target.value) || 0; computeAndRender(); });

  $('btn-addMaterial').addEventListener('click', () => addMaterialRow());
  $('materials-body').addEventListener('input', onMaterialRowChange);
  $('materials-body').addEventListener('change', onMaterialRowChange);
  $('materials-body').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'removeMaterial') {
      const rowId = e.target.closest('tr').dataset.rowId;
      state.materials = state.materials.filter((m) => m.id !== rowId);
      renderMaterialsTable();
    }
  });

  $('btn-addExtra').addEventListener('click', () => addExtraRow());
  $('extras-body').addEventListener('input', onExtraRowChange);
  $('extras-body').addEventListener('change', onExtraRowChange);
  $('extras-body').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'removeExtra') {
      const rowId = e.target.closest('tr').dataset.rowId;
      state.extras = state.extras.filter((x) => x.id !== rowId);
      renderExtrasTable();
    }
  });

  $('f-deductStock').addEventListener('change', (e) => { state.deductStock = e.target.checked; });

  $('f-printHours').addEventListener('input', (e) => { state.printHours = Number(e.target.value) || 0; computeAndRender(); });
  $('f-printMinutes').addEventListener('input', (e) => { state.printMinutes = Number(e.target.value) || 0; computeAndRender(); });
  $('f-laborMinutes').addEventListener('input', (e) => { state.laborMinutes = Number(e.target.value) || 0; computeAndRender(); });
  $('f-laborRate').addEventListener('input', (e) => { state.laborRate = Number(e.target.value) || 0; computeAndRender(); });

  $('f-electricity').addEventListener('input', (e) => { state.electricityRate = Number(e.target.value) || 0; computeAndRender(); });
  $('f-vat').addEventListener('input', (e) => { state.vatRate = Number(e.target.value) || 0; computeAndRender(); });
  $('f-customMargin').addEventListener('input', (e) => { state.customMargin = Number(e.target.value) || 0; computeAndRender(); });
  $('f-currency').addEventListener('input', (e) => { state.currency = e.target.value || '$'; computeAndRender(); });

  $('pricing-body').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-tier]');
    if (!tr) return;
    state.selectedTier = tr.dataset.tier;
    if (lastResult) {
      renderPricingTable(lastResult);
      renderTierBreakdown(lastResult);
    }
  });

  $('btn-saveQuote').addEventListener('click', saveCurrentQuote);
  $('btn-newQuote').addEventListener('click', () => resetCalculator());
}

function onMaterialRowChange(e) {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const rowId = tr.dataset.rowId;
  const m = state.materials.find((x) => x.id === rowId);
  if (!m) return;
  const field = e.target.dataset.field;
  const isCommit = e.type === 'change';

  if (field === 'filamentId') {
    m.filamentId = e.target.value;
    if (e.target.value !== '__custom') {
      const fil = Store.getFilaments().find((f) => f.id === e.target.value);
      if (fil) { m.name = fil.name; m.costPerKg = fil.costPerKg; }
    } else {
      m.name = 'Custom';
    }
    renderMaterialsTable();
    return;
  }

  // Number fields: update state + the subtotal cell only, without rebuilding the
  // row's inputs — rebuilding on every keystroke ('input' event) would steal focus.
  if (field === 'weightGrams') m.weightGrams = Number(e.target.value) || 0;
  if (field === 'costPerKg') {
    m.costPerKg = Number(e.target.value) || 0;
    if (isCommit) m.filamentId = '__custom';
  }
  const subtotal = (Number(m.weightGrams) || 0) / 1000 * (Number(m.costPerKg) || 0);
  tr.children[3].textContent = fmt(subtotal);
  computeAndRender();
}

function onExtraRowChange(e) {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const rowId = tr.dataset.rowId;
  const ex = state.extras.find((x) => x.id === rowId);
  if (!ex) return;
  const field = e.target.dataset.field;
  const isCommit = e.type === 'change';

  if (field === 'type') { ex.type = e.target.value; ex.itemId = null; renderExtrasTable(); return; }
  if (field === 'itemId') {
    ex.itemId = e.target.value === '__custom' ? null : e.target.value;
    if (ex.itemId) {
      const item = Store.getInventory().find((i) => i.id === ex.itemId);
      if (item) { ex.name = item.name; ex.unitCost = item.unitCost; }
    }
    renderExtrasTable();
    return;
  }

  // Number fields: update state + the subtotal cell only, without rebuilding the
  // row's inputs — rebuilding on every keystroke ('input' event) would steal focus.
  if (field === 'qty') ex.qty = Number(e.target.value) || 0;
  if (field === 'unitCost') {
    ex.unitCost = Number(e.target.value) || 0;
    if (isCommit) ex.itemId = null;
  }
  const subtotal = (Number(ex.qty) || 0) * (Number(ex.unitCost) || 0);
  tr.children[4].textContent = fmt(subtotal);
  computeAndRender();
}

function resetCalculator() {
  const settings = Store.getSettings();
  state = {
    partName: '', technology: 'FDM', printerId: null,
    materials: [], extras: [],
    printHours: 0, printMinutes: 0, laborMinutes: 0, laborRate: settings.laborRate,
    batchEnabled: false, batchQty: 1, batchSetupMin: 0,
    electricityRate: settings.electricityRate, vatRate: settings.vatRate,
    customMargin: 50, currency: settings.currency, deductStock: true,
    editingQuoteId: null, selectedTier: 'Standard',
  };
  $('f-partName').value = '';
  $('f-technology').value = 'FDM';
  $('f-batchEnabled').checked = false;
  $('row-batch').hidden = true;
  $('f-batchQty').value = 1;
  $('f-batchSetupMin').value = 0;
  $('f-printHours').value = 0;
  $('f-printMinutes').value = 0;
  $('f-laborMinutes').value = 0;
  $('f-laborRate').value = settings.laborRate;
  $('f-electricity').value = settings.electricityRate;
  $('f-vat').value = settings.vatRate;
  $('f-customMargin').value = 50;
  $('f-currency').value = settings.currency;
  $('f-deductStock').checked = true;
  renderPrinterDropdown();
  renderMaterialsTable();
  renderExtrasTable();
}

// ---------- quotes ----------

function saveCurrentQuote() {
  const result = computeAndRender();
  const name = state.partName.trim() || 'Untitled part';
  const now = new Date().toISOString();
  const quote = {
    id: state.editingQuoteId || uid('quote'),
    name,
    technology: state.technology,
    printerId: state.printerId,
    materials: state.materials,
    extras: state.extras,
    printHours: state.printHours,
    printMinutes: state.printMinutes,
    laborMinutes: state.laborMinutes,
    laborRate: state.laborRate,
    batchEnabled: state.batchEnabled,
    batchQty: state.batchQty,
    batchSetupMin: state.batchSetupMin,
    electricityRate: state.electricityRate,
    vatRate: state.vatRate,
    customMargin: state.customMargin,
    currency: state.currency,
    selectedTier: state.selectedTier,
    createdAt: state.editingQuoteId ? undefined : now,
    updatedAt: now,
    result,
  };

  const quotes = Store.getQuotes();
  const idx = quotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) {
    quote.createdAt = quotes[idx].createdAt;
    quotes[idx] = quote;
  } else {
    quotes.push(quote);
  }
  Store.setQuotes(quotes);
  state.editingQuoteId = quote.id;

  if (state.deductStock) deductInventoryForQuote(quote);

  toast(`Quote "${name}" saved`);
}

function deductInventoryForQuote(quote) {
  const inv = Store.getInventory();
  let changed = false;
  quote.extras.forEach((e) => {
    if (!e.itemId) return;
    const item = inv.find((i) => i.id === e.itemId);
    if (item) {
      item.qtyOnHand = Math.max(0, (Number(item.qtyOnHand) || 0) - (Number(e.qty) || 0) * quote.batchQty * (quote.batchEnabled ? 1 : 1));
      changed = true;
    }
  });
  if (changed) Store.setInventory(inv);
}

function renderQuotesTable() {
  const search = ($('f-quoteSearch').value || '').toLowerCase();
  const quotes = Store.getQuotes()
    .filter((q) => q.name.toLowerCase().includes(search))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  $('quotes-body').innerHTML = quotes.map((q) => `
    <tr>
      <td>${q.name}</td>
      <td>${q.technology}</td>
      <td>${q.batchEnabled ? q.batchQty : 1}</td>
      <td>${q.currency}${(q.result?.totalCost ?? 0).toFixed(2)}</td>
      <td>${q.updatedAt ? new Date(q.updatedAt).toLocaleString() : ''}</td>
      <td>
        <button class="btn-small" data-action="load" data-id="${q.id}">Load</button>
        <button class="btn-small" data-action="duplicate" data-id="${q.id}">Duplicate</button>
        <button class="btn-danger" data-action="delete" data-id="${q.id}">✕</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="hint">No saved quotes yet.</td></tr>`;
}

function initQuotesTab() {
  $('f-quoteSearch').addEventListener('input', renderQuotesTable);
  $('quotes-body').addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const action = e.target.dataset.action;
    if (action === 'load') loadQuote(id);
    if (action === 'duplicate') duplicateQuote(id);
    if (action === 'delete') deleteQuote(id);
  });

  $('btn-exportQuotes').addEventListener('click', () => downloadJSON('quotes-backup.json', Store.getQuotes()));
  $('btn-importQuotes').addEventListener('click', () => $('file-importQuotes').click());
  $('file-importQuotes').addEventListener('change', (e) => {
    readJSONFile(e.target.files[0], (data) => {
      if (!Array.isArray(data)) { toast('Invalid quotes file'); return; }
      const existing = Store.getQuotes();
      const merged = [...existing, ...data.filter((d) => !existing.some((x) => x.id === d.id))];
      Store.setQuotes(merged);
      renderQuotesTable();
      toast('Quotes imported');
    });
  });
}

function loadQuote(id) {
  const q = Store.getQuotes().find((x) => x.id === id);
  if (!q) return;
  state = {
    partName: q.name, technology: q.technology, printerId: q.printerId,
    materials: q.materials.map((m) => ({ ...m })), extras: q.extras.map((e) => ({ ...e })),
    printHours: q.printHours, printMinutes: q.printMinutes, laborMinutes: q.laborMinutes, laborRate: q.laborRate,
    batchEnabled: q.batchEnabled, batchQty: q.batchQty, batchSetupMin: q.batchSetupMin,
    electricityRate: q.electricityRate, vatRate: q.vatRate, customMargin: q.customMargin,
    currency: q.currency, deductStock: false, editingQuoteId: q.id,
    selectedTier: q.selectedTier || 'Standard',
  };
  $('f-partName').value = state.partName;
  $('f-technology').value = state.technology;
  $('f-batchEnabled').checked = state.batchEnabled;
  $('row-batch').hidden = !state.batchEnabled;
  $('f-batchQty').value = state.batchQty;
  $('f-batchSetupMin').value = state.batchSetupMin;
  $('f-printHours').value = state.printHours;
  $('f-printMinutes').value = state.printMinutes;
  $('f-laborMinutes').value = state.laborMinutes;
  $('f-laborRate').value = state.laborRate;
  $('f-electricity').value = state.electricityRate;
  $('f-vat').value = state.vatRate;
  $('f-customMargin').value = state.customMargin;
  $('f-currency').value = state.currency;
  $('f-deductStock').checked = false;

  renderPrinterDropdown();
  $('f-printer').value = state.printerId;
  renderMaterialsTable();
  renderExtrasTable();

  document.querySelector('.tab-btn[data-tab="calculator"]').click();
  toast(`Loaded "${q.name}"`);
}

function duplicateQuote(id) {
  const quotes = Store.getQuotes();
  const q = quotes.find((x) => x.id === id);
  if (!q) return;
  const copy = { ...q, id: uid('quote'), name: `${q.name} (copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  quotes.push(copy);
  Store.setQuotes(quotes);
  renderQuotesTable();
  toast('Quote duplicated');
}

function deleteQuote(id) {
  if (!confirm('Delete this quote?')) return;
  Store.setQuotes(Store.getQuotes().filter((q) => q.id !== id));
  renderQuotesTable();
}

// ---------- filaments tab ----------

function renderFilamentsTable() {
  const list = Store.getFilaments();
  $('filaments-body').innerHTML = list.map((f) => `
    <tr data-row-id="${f.id}">
      <td><input type="text" data-field="name" value="${f.name}" /></td>
      <td>
        <select data-field="technology">
          <option value="FDM" ${f.technology === 'FDM' ? 'selected' : ''}>FDM</option>
          <option value="SLA" ${f.technology === 'SLA' ? 'selected' : ''}>SLA</option>
        </select>
      </td>
      <td><input type="number" min="0" step="0.1" data-field="costPerKg" value="${f.costPerKg}" /></td>
      <td><button class="btn-danger" data-action="delete">✕</button></td>
    </tr>
  `).join('');
}

function initFilamentsTab() {
  $('btn-addFilament').addEventListener('click', () => {
    const list = Store.getFilaments();
    list.push({ id: uid('fil'), name: 'New material', technology: 'FDM', costPerKg: 20 });
    Store.setFilaments(list);
    renderFilamentsTable();
  });
  $('filaments-body').addEventListener('input', onFilamentRowEdit);
  $('filaments-body').addEventListener('change', onFilamentRowEdit);
  $('filaments-body').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'delete') {
      const rowId = e.target.closest('tr').dataset.rowId;
      Store.setFilaments(Store.getFilaments().filter((f) => f.id !== rowId));
      renderFilamentsTable();
    }
  });
}

function onFilamentRowEdit(e) {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const list = Store.getFilaments();
  const f = list.find((x) => x.id === tr.dataset.rowId);
  if (!f) return;
  const field = e.target.dataset.field;
  if (field === 'name') f.name = e.target.value;
  if (field === 'technology') f.technology = e.target.value;
  if (field === 'costPerKg') f.costPerKg = Number(e.target.value) || 0;
  Store.setFilaments(list);
}

// ---------- printers tab ----------

function renderPrintersTable() {
  const list = Store.getPrinters();
  $('printers-body').innerHTML = list.map((p) => {
    const depPerHour = (Number(p.purchaseCost) || 0) / (Number(p.lifetimeHours) || 1);
    return `
    <tr data-row-id="${p.id}">
      <td><input type="text" data-field="name" value="${p.name}" /></td>
      <td>
        <select data-field="technology">
          <option value="FDM" ${p.technology === 'FDM' ? 'selected' : ''}>FDM</option>
          <option value="SLA" ${p.technology === 'SLA' ? 'selected' : ''}>SLA</option>
        </select>
      </td>
      <td><input type="number" min="0" step="1" data-field="powerWatts" value="${p.powerWatts}" /></td>
      <td><input type="number" min="0" step="1" data-field="purchaseCost" value="${p.purchaseCost}" /></td>
      <td><input type="number" min="1" step="1" data-field="lifetimeHours" value="${p.lifetimeHours}" /></td>
      <td>${fmt(depPerHour)}</td>
      <td><button class="btn-danger" data-action="delete">✕</button></td>
    </tr>
  `;
  }).join('');
}

function initPrintersTab() {
  $('btn-addPrinter').addEventListener('click', () => {
    const list = Store.getPrinters();
    list.push({ id: uid('printer'), name: 'New printer', technology: 'FDM', powerWatts: 150, purchaseCost: 300, lifetimeHours: 3000 });
    Store.setPrinters(list);
    renderPrintersTable();
  });
  $('printers-body').addEventListener('input', onPrinterRowEdit);
  $('printers-body').addEventListener('change', onPrinterRowEdit);
  $('printers-body').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'delete') {
      const rowId = e.target.closest('tr').dataset.rowId;
      Store.setPrinters(Store.getPrinters().filter((p) => p.id !== rowId));
      renderPrintersTable();
    }
  });
}

function onPrinterRowEdit(e) {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const list = Store.getPrinters();
  const p = list.find((x) => x.id === tr.dataset.rowId);
  if (!p) return;
  const field = e.target.dataset.field;
  if (field === 'name') p.name = e.target.value;
  if (field === 'technology') p.technology = e.target.value;
  if (field === 'powerWatts') p.powerWatts = Number(e.target.value) || 0;
  if (field === 'purchaseCost') p.purchaseCost = Number(e.target.value) || 0;
  if (field === 'lifetimeHours') p.lifetimeHours = Number(e.target.value) || 1;
  Store.setPrinters(list);

  // Update the computed depreciation/hour cell in place — do NOT rebuild the
  // whole table here, that would steal focus from the input on every keystroke.
  const depPerHour = (Number(p.purchaseCost) || 0) / (Number(p.lifetimeHours) || 1);
  const depCell = tr.children[5];
  if (depCell) depCell.textContent = fmt(depPerHour);
}

// ---------- inventory tab ----------

function renderInventoryTable() {
  const list = Store.getInventory();
  $('inventory-body').innerHTML = list.map((i) => `
    <tr data-row-id="${i.id}">
      <td>
        <select data-field="type">
          <option value="hardware" ${i.type === 'hardware' ? 'selected' : ''}>Hardware</option>
          <option value="packaging" ${i.type === 'packaging' ? 'selected' : ''}>Packaging</option>
        </select>
      </td>
      <td><input type="text" data-field="name" value="${i.name}" /></td>
      <td><input type="number" min="0" step="0.01" data-field="unitCost" value="${i.unitCost}" /></td>
      <td><input type="number" min="0" step="1" data-field="qtyOnHand" value="${i.qtyOnHand}" /></td>
      <td><button class="btn-danger" data-action="delete">✕</button></td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="hint">No inventory items yet.</td></tr>`;
}

function initInventoryTab() {
  $('btn-addInventory').addEventListener('click', () => {
    const list = Store.getInventory();
    list.push({ id: uid('inv'), type: 'hardware', name: 'New item', unitCost: 0, qtyOnHand: 0 });
    Store.setInventory(list);
    renderInventoryTable();
  });
  $('inventory-body').addEventListener('input', onInventoryRowEdit);
  $('inventory-body').addEventListener('change', onInventoryRowEdit);
  $('inventory-body').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'delete') {
      const rowId = e.target.closest('tr').dataset.rowId;
      Store.setInventory(Store.getInventory().filter((i) => i.id !== rowId));
      renderInventoryTable();
    }
  });
}

function onInventoryRowEdit(e) {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const list = Store.getInventory();
  const i = list.find((x) => x.id === tr.dataset.rowId);
  if (!i) return;
  const field = e.target.dataset.field;
  if (field === 'type') i.type = e.target.value;
  if (field === 'name') i.name = e.target.value;
  if (field === 'unitCost') i.unitCost = Number(e.target.value) || 0;
  if (field === 'qtyOnHand') i.qtyOnHand = Number(e.target.value) || 0;
  Store.setInventory(list);
}

// ---------- settings tab ----------

function loadSettingsIntoForm() {
  const s = Store.getSettings();
  $('s-currency').value = s.currency;
  $('s-vat').value = s.vatRate;
  $('s-electricity').value = s.electricityRate;
  $('s-laborRate').value = s.laborRate;
}

function initSettingsTab() {
  $('btn-saveSettings').addEventListener('click', () => {
    Store.setSettings({
      currency: $('s-currency').value || '$',
      vatRate: Number($('s-vat').value) || 0,
      electricityRate: Number($('s-electricity').value) || 0,
      laborRate: Number($('s-laborRate').value) || 0,
    });
    toast('Defaults saved — used for new quotes going forward');
  });

  $('btn-exportAll').addEventListener('click', () => downloadJSON('3dpcc-backup.json', Store.exportAll()));
  $('btn-importAll').addEventListener('click', () => $('file-importAll').click());
  $('file-importAll').addEventListener('change', (e) => {
    readJSONFile(e.target.files[0], (data) => {
      Store.importAll(data);
      loadSettingsIntoForm();
      renderFilamentsTable();
      renderPrintersTable();
      renderInventoryTable();
      renderQuotesTable();
      resetCalculator();
      toast('Backup imported');
    });
  });
}

// ---------- file helpers ----------

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readJSONFile(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { cb(JSON.parse(reader.result)); }
    catch (e) { toast('Could not parse file'); }
  };
  reader.readAsText(file);
}

// ---------- init ----------

function init() {
  seedIfEmpty();
  const settings = Store.getSettings();
  state.laborRate = settings.laborRate;
  state.electricityRate = settings.electricityRate;
  state.vatRate = settings.vatRate;
  state.currency = settings.currency;

  $('f-laborRate').value = settings.laborRate;
  $('f-electricity').value = settings.electricityRate;
  $('f-vat').value = settings.vatRate;
  $('f-currency').value = settings.currency;

  initTabs();
  initCalculatorFields();
  initQuotesTab();
  initFilamentsTab();
  initPrintersTab();
  initInventoryTab();
  initSettingsTab();

  renderPrinterDropdown();
  $('f-printer').value = state.printerId;
  renderMaterialsTable();
  renderExtrasTable();
}

document.addEventListener('DOMContentLoaded', init);
