function readNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getFreeChancesPerGame() {
  return readNonNegativeNumber(process.env.FREE_CHANCES, 0);
}

export function getPaidChancesPack() {
  return readNonNegativeNumber(process.env.PAID_CHANCES, 0);
}

export function getPaidChancesPrice() {
  return readNonNegativeNumber(process.env.PAID_CHANCES_PRICE, 0);
}
