/** Formats integer minor units (e.g. KES cents) for display. Amounts are always computed on the server. */
export function formatMoney(minor: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100);
}
