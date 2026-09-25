export const VAT_REGIME_OPTIONS = [
  ["S", "S · standard"],
  ["Z", "Z · cotă zero"],
  ["E", "E · scutit"],
  ["AE", "AE · taxare inversă"],
  ["O", "O · în afara TVA"],
] as const;

export type VatRegimeCode = (typeof VAT_REGIME_OPTIONS)[number][0];

export const VAT_REGIME_LABELS = Object.fromEntries(VAT_REGIME_OPTIONS) as Record<VatRegimeCode, string>;

export function isVatRegimeCode(value: unknown): value is VatRegimeCode {
  return VAT_REGIME_OPTIONS.some(([code]) => code === value);
}

export function suggestVatRegime(input: {
  type?: "INCOME" | "EXPENSE";
  companyVatPayer?: boolean;
  vatAmount?: number;
  vatRate?: number;
  reverseCharge?: boolean;
}): VatRegimeCode {
  if (input.reverseCharge) return "AE";
  if (input.type === "INCOME" && input.companyVatPayer === false) return "O";
  return Number(input.vatAmount || 0) > 0 || Number(input.vatRate || 0) > 0 ? "S" : "Z";
}

export function vatRegimeNeedsReason(code: VatRegimeCode) {
  return code === "E" || code === "AE" || code === "O";
}

export function defaultVatRegimeReason(code: VatRegimeCode) {
  if (code === "AE") return "Taxare inversă conform Codului fiscal.";
  if (code === "O") return "Operațiune în afara sferei TVA.";
  return "";
}

export function calculateIncludedVat(grossAmount: number, vatRate: number) {
  if (!Number.isFinite(grossAmount) || !Number.isFinite(vatRate) || grossAmount <= 0 || vatRate <= 0) return 0;
  return Math.round((grossAmount * vatRate / (100 + vatRate) + Number.EPSILON) * 100) / 100;
}
