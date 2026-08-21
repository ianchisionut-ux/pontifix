type Row = Record<string, string | number | null | undefined>;

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Uses ";" as separator (Excel in Romania defaults to semicolon-delimited CSV
// because "," is the decimal separator).
export function toCsv(headers: string[], rows: Row[]): string {
  const headerLine = headers.join(";");
  const lines = rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(";"));
  // BOM so Excel opens UTF-8 diacritics (ă, â, î, ș, ț) correctly.
  return "\uFEFF" + [headerLine, ...lines].join("\r\n");
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
