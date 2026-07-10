// Pure calculation functions — no DOM, no storage. Easy to reason about and unit-test.

/** Sum of weight/1000 * costPerKg across material lines, for one unit. */
function materialCostPerUnit(materialLines) {
  return materialLines.reduce((sum, m) => sum + (Number(m.weightGrams) || 0) / 1000 * (Number(m.costPerKg) || 0), 0);
}

/** Machine hourly rate = depreciation/hour + electricity/hour. */
function machineHourlyRate(printer, electricityRatePerKwh) {
  const lifetimeHours = Number(printer.lifetimeHours) || 1;
  const depreciationPerHour = (Number(printer.purchaseCost) || 0) / lifetimeHours;
  const electricityPerHour = ((Number(printer.powerWatts) || 0) / 1000) * (Number(electricityRatePerKwh) || 0);
  return depreciationPerHour + electricityPerHour;
}

function laborCost(minutes, hourlyRate) {
  return (Number(minutes) || 0) / 60 * (Number(hourlyRate) || 0);
}

function machineCost(hours, hourlyRate) {
  return (Number(hours) || 0) * (Number(hourlyRate) || 0);
}

/**
 * Extras = hardware + packaging line items.
 * Returns { hardware, packaging } cost per unit.
 */
function extrasCostPerUnit(extraLines) {
  return extraLines.reduce((acc, e) => {
    const cost = (Number(e.qty) || 0) * (Number(e.unitCost) || 0);
    if (e.type === 'packaging') acc.packaging += cost;
    else acc.hardware += cost;
    return acc;
  }, { hardware: 0, packaging: 0 });
}

/**
 * Batch totals: setup time counted once per batch, per-unit time repeated per unit.
 */
function batchTotals({ qty, perUnitPrintHours, setupMinutes, perUnitLaborMinutes }) {
  const q = Math.max(1, Number(qty) || 1);
  const totalPrintHours = (Number(perUnitPrintHours) || 0) * q + (Number(setupMinutes) || 0) / 60;
  const totalLaborMinutes = (Number(perUnitLaborMinutes) || 0) * q;
  return { qty: q, totalPrintHours, totalLaborMinutes };
}

/**
 * Full quote computation. `input` shape:
 * {
 *   materials: [{weightGrams, costPerKg}],
 *   extras: [{type: 'hardware'|'packaging', qty, unitCost}],
 *   printHoursPerUnit, laborMinutesPerUnit, laborRate,
 *   printer: {powerWatts, purchaseCost, lifetimeHours},
 *   electricityRate,
 *   batch: {enabled, qty, setupMinutes},
 *   vatRate, customMarginPercent
 * }
 */
function computeQuote(input) {
  const qty = input.batch?.enabled ? Math.max(1, Number(input.batch.qty) || 1) : 1;
  const setupMinutes = input.batch?.enabled ? (Number(input.batch.setupMinutes) || 0) : 0;

  const matPerUnit = materialCostPerUnit(input.materials);
  const extras = extrasCostPerUnit(input.extras);

  const totalPrintHours = (Number(input.printHoursPerUnit) || 0) * qty + setupMinutes / 60;
  const totalLaborMinutes = (Number(input.laborMinutesPerUnit) || 0) * qty;

  const hourlyMachineRate = machineHourlyRate(input.printer, input.electricityRate);

  const materialTotal = matPerUnit * qty;
  const hardwareTotal = extras.hardware * qty;
  const packagingTotal = extras.packaging * qty;
  const laborTotal = laborCost(totalLaborMinutes, input.laborRate);
  const machineTotal = machineCost(totalPrintHours, hourlyMachineRate);

  const totalCost = materialTotal + hardwareTotal + packagingTotal + laborTotal + machineTotal;
  const perUnitCost = totalCost / qty;

  const vatRate = Number(input.vatRate) || 0;

  const tiers = [
    { label: 'Competitive', margin: 25 },
    { label: 'Standard', margin: 40 },
    { label: 'Premium', margin: 60 },
    { label: 'Luxury', margin: 80 },
    { label: 'Custom', margin: Number(input.customMarginPercent) || 0 },
  ].map((t) => {
    const priceExVat = perUnitCost * (1 + t.margin / 100);
    const priceIncVat = priceExVat * (1 + vatRate / 100);
    return { ...t, priceExVat, priceIncVat };
  });

  return {
    qty,
    breakdown: {
      material: materialTotal,
      hardware: hardwareTotal,
      packaging: packagingTotal,
      labor: laborTotal,
      machine: machineTotal,
    },
    totalCost,
    perUnitCost,
    hourlyMachineRate,
    totalPrintHours,
    totalLaborMinutes,
    tiers,
  };
}
