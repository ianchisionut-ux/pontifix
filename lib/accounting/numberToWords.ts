const UNITS = [
  "", "unu", "doi", "trei", "patru", "cinci", "sase", "sapte", "opt", "noua",
];
const TEENS = [
  "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece",
  "saisprezece", "saptesprezece", "optsprezece", "nouasprezece",
];
const TENS = [
  "", "", "douazeci", "treizeci", "patruzeci", "cincizeci", "saizeci", "saptezeci", "optzeci", "nouazeci",
];

function belowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return TENS[t] + (u ? " si " + UNITS[u] : "");
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hWord = h === 1 ? "o suta" : UNITS[h] + " sute";
  return hWord + (rest ? " " + belowThousand(rest) : "");
}

export function integerToWordsRO(n: number): string {
  if (n === 0) return "zero";
  let result = "";
  const billions = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;

  const parts: string[] = [];
  if (billions) parts.push(belowThousand(billions) + (billions === 1 ? " miliard" : " miliarde"));
  if (millions) parts.push(belowThousand(millions) + (millions === 1 ? " milion" : " milioane"));
  if (thousands) {
    parts.push((thousands === 1 ? "o mie" : belowThousand(thousands) + " mii"));
  }
  if (rest) parts.push(belowThousand(rest));
  result = parts.join(" ");
  return result.trim();
}

// Formats an amount like 177.60 -> "o suta saptezeci si sapte virgula sase zero RON"
export function amountToWordsRO(amount: number, currency = "RON"): string {
  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(rounded);
  const decPart = Math.round((rounded - intPart) * 100);
  const intWords = integerToWordsRO(intPart);
  if (decPart === 0) return `${intWords} ${currency}`;
  const decStr = decPart.toString().padStart(2, "0");
  const decDigitsWords = decStr
    .split("")
    .map((d) => (d === "0" ? "zero" : UNITS[Number(d)]))
    .join(" ");
  return `${intWords} virgula ${decDigitsWords} ${currency}`;
}
