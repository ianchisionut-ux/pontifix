import type { DeclarationType } from "./declarations";

export type OfficialAnafForm = {
  type: DeclarationType;
  label: string;
  version: string;
  legalBasis: string;
  validFrom: string;
  pdfUrl: string;
  sourcePageUrl: string;
};

type CatalogEntry = Omit<OfficialAnafForm, "type" | "label" | "sourcePageUrl">;

const SOURCE_PAGES: Record<DeclarationType, string> = {
  D300: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/300.html",
  D394: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/394.html",
  D390: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/390.html",
};

const LABELS: Record<DeclarationType, string> = {
  D300: "Decont de taxă pe valoarea adăugată",
  D394: "Declarație informativă privind operațiunile naționale",
  D390: "Declarație recapitulativă privind operațiunile intracomunitare",
};

// Catalogul folosește exclusiv fișierele „soft A” publicate de ANAF. Ordinea
// descrescătoare permite alegerea versiunii valabile la începutul perioadei.
const CATALOG: Record<DeclarationType, CatalogEntry[]> = {
  D300: [
    { version: "12.0.2", legalBasis: "OPANAF 174/2026", validFrom: "2026-01", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v12.0.2_12022026.pdf" },
    { version: "11.0.7", legalBasis: "OPANAF 2131/2025", validFrom: "2025-08", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v11.0.7_16122025.pdf" },
    { version: "10.0.0", legalBasis: "OPANAF 888/2024", validFrom: "2025-01", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v10.0.0_11022025.pdf" },
    { version: "9.0.0", legalBasis: "OPANAF 888/2024", validFrom: "2024-05", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v9.0.0_07052024.pdf" },
    { version: "8.0.3", legalBasis: "OPANAF 1176/2023", validFrom: "2023-08", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v803_22092023.pdf" },
    { version: "7.0.0", legalBasis: "OPANAF 1253/2021", validFrom: "2021-07", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v700_28032022.pdf" },
    { version: "7.0.0", legalBasis: "OPANAF 632/2021", validFrom: "2021-06", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_v700_01072021.pdf" },
    { version: "2019.09.02", legalBasis: "OPANAF 2227/2019", validFrom: "2019-07", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D300_02092019.pdf" },
  ],
  D394: [
    { version: "2025.09.26", legalBasis: "versiunea ANAF pentru august 2025+", validFrom: "2025-08", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D394_26092025.pdf" },
    { version: "7.0.0", legalBasis: "OPANAF 77/2022, CAEN Rev. 3", validFrom: "2025-01", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D394_XML_v7.0.0_11022025.pdf" },
    { version: "2022.05.10", legalBasis: "OPANAF 77/2022", validFrom: "2022-04", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D394_XML_10052022.pdf" },
    { version: "2020.09.02", legalBasis: "OPANAF 3281/2020", validFrom: "2020-09", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D394_XML_020920.pdf" },
  ],
  D390: [
    { version: "2024.05.07", legalBasis: "OPANAF 705/2020", validFrom: "2020-02", pdfUrl: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/D390_XML_2020_300424.pdf" },
  ],
};

function periodKey(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("An fiscal invalid.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Lună fiscală invalidă.");
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getOfficialAnafForm(type: DeclarationType, year: number, month: number): OfficialAnafForm {
  const period = periodKey(year, month);
  const entry = CATALOG[type].find((candidate) => candidate.validFrom <= period);
  if (!entry) throw new Error(`Nu există în catalog o versiune oficială ${type} pentru perioada selectată.`);
  return { type, label: LABELS[type], sourcePageUrl: SOURCE_PAGES[type], ...entry };
}

export function getOfficialAnafForms(year: number, month: number) {
  return {
    D300: getOfficialAnafForm("D300", year, month),
    D394: getOfficialAnafForm("D394", year, month),
    D390: getOfficialAnafForm("D390", year, month),
  };
}
