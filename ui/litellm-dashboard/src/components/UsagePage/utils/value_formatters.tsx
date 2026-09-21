export function valueFormatter(number: number) {
  if (number >= 1_000_000_000) {
    return (number / 1_000_000_000).toFixed(2) + "B";
  }
  if (number >= 1_000_000) {
    return (number / 1_000_000).toFixed(2) + "M";
  }
  if (number >= 1000) {
    return number / 1000 + "k";
  }
  return number.toString();
}

// [CN-FORK] spend carries weighted token counts (REQ-05/06), so the abbreviated
// formatter renders "<amount> tokens" instead of dollars.
export function valueFormatterSpend(number: number) {
  if (number === 0) return "0 tokens";
  if (number >= 1_000_000_000) {
    return parseFloat((number / 1_000_000_000).toFixed(2)) + "B tokens";
  }
  if (number >= 1_000_000) {
    return parseFloat((number / 1_000_000).toFixed(2)) + "M tokens";
  }
  if (number >= 1000) {
    return number / 1000 + "k tokens";
  }
  return number + " tokens";
}
