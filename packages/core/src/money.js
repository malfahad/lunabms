const DEFAULT_CURRENCY_CODE = "UGX";

// Keep this in sync with the Settings screen dropdown options.
const SUPPORTED_CURRENCY_CODES = ["UGX", "USD", "KES", "EUR", "CNY", "AED"];

function normalizeCurrencyCode(code) {
  if (code == null) return DEFAULT_CURRENCY_CODE;
  const s = String(code).trim().toUpperCase();
  return SUPPORTED_CURRENCY_CODES.includes(s) ? s : DEFAULT_CURRENCY_CODE;
}

function formatMoney(amount, currencyCode = DEFAULT_CURRENCY_CODE) {
  const x = Number(amount);
  if (amount == null || amount === "" || Number.isNaN(x)) return "—";
  const c = normalizeCurrencyCode(currencyCode);
  // Use currency code prefix (e.g. "UGX 1,000") to match current app style.
  return `${c} ${x.toLocaleString()}`;
}

module.exports = {
  DEFAULT_CURRENCY_CODE,
  SUPPORTED_CURRENCY_CODES,
  normalizeCurrencyCode,
  formatMoney,
};

