// Persistence layer — everything lives in localStorage, nothing leaves the browser.
const STORAGE_KEYS = {
  settings: '3dpcc.settings',
  filaments: '3dpcc.filaments',
  printers: '3dpcc.printers',
  inventory: '3dpcc.inventory',
  quotes: '3dpcc.quotes',
};

const DEFAULT_SETTINGS = {
  currency: '$',
  vatRate: 20,
  electricityRate: 0.30,
  laborRate: 15,
};

const DEFAULT_FILAMENTS = [
  { id: 'seed-pla', name: 'PLA', technology: 'FDM', costPerKg: 20 },
  { id: 'seed-petg', name: 'PETG', technology: 'FDM', costPerKg: 22 },
  { id: 'seed-abs', name: 'ABS', technology: 'FDM', costPerKg: 20 },
  { id: 'seed-asa', name: 'ASA', technology: 'FDM', costPerKg: 24 },
  { id: 'seed-tpu', name: 'TPU', technology: 'FDM', costPerKg: 28 },
  { id: 'seed-nylon', name: 'Nylon', technology: 'FDM', costPerKg: 35 },
  { id: 'seed-resin-standard', name: 'Standard Resin', technology: 'SLA', costPerKg: 35 },
  { id: 'seed-resin-tough', name: 'Tough Resin', technology: 'SLA', costPerKg: 45 },
];

const DEFAULT_PRINTERS = [
  { id: 'seed-fdm-generic', name: 'Generic FDM Printer', technology: 'FDM', powerWatts: 150, purchaseCost: 300, lifetimeHours: 3000 },
  { id: 'seed-sla-generic', name: 'Generic Resin Printer', technology: 'SLA', powerWatts: 50, purchaseCost: 250, lifetimeHours: 2000 },
];

const DEFAULT_INVENTORY = [];
const DEFAULT_QUOTES = [];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load', key, e);
    return structuredClone(fallback);
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedIfEmpty() {
  if (localStorage.getItem(STORAGE_KEYS.settings) === null) saveJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  if (localStorage.getItem(STORAGE_KEYS.filaments) === null) saveJSON(STORAGE_KEYS.filaments, DEFAULT_FILAMENTS);
  if (localStorage.getItem(STORAGE_KEYS.printers) === null) saveJSON(STORAGE_KEYS.printers, DEFAULT_PRINTERS);
  if (localStorage.getItem(STORAGE_KEYS.inventory) === null) saveJSON(STORAGE_KEYS.inventory, DEFAULT_INVENTORY);
  if (localStorage.getItem(STORAGE_KEYS.quotes) === null) saveJSON(STORAGE_KEYS.quotes, DEFAULT_QUOTES);
}

const Store = {
  getSettings: () => loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  setSettings: (v) => saveJSON(STORAGE_KEYS.settings, v),

  getFilaments: () => loadJSON(STORAGE_KEYS.filaments, DEFAULT_FILAMENTS),
  setFilaments: (v) => saveJSON(STORAGE_KEYS.filaments, v),

  getPrinters: () => loadJSON(STORAGE_KEYS.printers, DEFAULT_PRINTERS),
  setPrinters: (v) => saveJSON(STORAGE_KEYS.printers, v),

  getInventory: () => loadJSON(STORAGE_KEYS.inventory, DEFAULT_INVENTORY),
  setInventory: (v) => saveJSON(STORAGE_KEYS.inventory, v),

  getQuotes: () => loadJSON(STORAGE_KEYS.quotes, DEFAULT_QUOTES),
  setQuotes: (v) => saveJSON(STORAGE_KEYS.quotes, v),

  exportAll: () => ({
    exportedAt: new Date().toISOString(),
    settings: Store.getSettings(),
    filaments: Store.getFilaments(),
    printers: Store.getPrinters(),
    inventory: Store.getInventory(),
    quotes: Store.getQuotes(),
  }),

  importAll: (data) => {
    if (data.settings) Store.setSettings(data.settings);
    if (data.filaments) Store.setFilaments(data.filaments);
    if (data.printers) Store.setPrinters(data.printers);
    if (data.inventory) Store.setInventory(data.inventory);
    if (data.quotes) Store.setQuotes(data.quotes);
  },
};

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
