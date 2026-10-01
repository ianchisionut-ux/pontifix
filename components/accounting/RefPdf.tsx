import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Company } from "@/lib/accounting/repo";
import type { RefAccountSummary, RefSummary } from "@/lib/accounting/ref";
import { pdfText } from "@/components/accounting/InvoicePdf";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 7.5, color: "#1d3552" },
  heading: { borderBottomWidth: 3, borderBottomColor: "#3b66f6", paddingBottom: 10, marginBottom: 12 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, color: "#001a3d" },
  subtitle: { marginTop: 4, color: "#64748b" },
  entity: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, padding: 9, backgroundColor: "#edf5ff", borderRadius: 5 },
  strong: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#cbdcf1" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dce7f4", minHeight: 25, alignItems: "center" },
  head: { backgroundColor: "#001a3d", color: "#fff", fontFamily: "Helvetica-Bold", minHeight: 28 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: "#dce7f4" },
  nr: { width: "5%" }, date: { width: "10%" }, doc: { width: "17%" }, explanation: { width: "28%" }, amount: { width: "13%", textAlign: "right" }, category: { width: "14%" },
  totals: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  totalBox: { width: "31%", borderWidth: 1, borderColor: "#cbdcf1", borderRadius: 5, padding: 8 },
  totalLabel: { color: "#64748b", fontSize: 6.5 },
  totalValue: { marginTop: 3, fontFamily: "Helvetica-Bold", fontSize: 10, color: "#001a3d" },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, color: "#7a8ca2", fontSize: 6, flexDirection: "row", justifyContent: "space-between" },
});

function money(value: number) { return value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function categoryLabel(value: string) {
  return ({ TAXABLE_INCOME: "Venit impozabil", NON_TAXABLE_INCOME: "Venit neimpozabil", DEDUCTIBLE_EXPENSE: "Cheltuiala deductibila", PARTIAL_EXPENSE: "Partial deductibila", NON_DEDUCTIBLE_EXPENSE: "Nedeductibila" } as Record<string, string>)[value] || value;
}

export function RefPdf({ company, year, accountSummary, summary, vatPayer }: { company: Company; year: number; accountSummary: RefAccountSummary[]; summary: RefSummary; vatPayer: boolean }) {
  return <Document title={`Registrul de evidenta fiscala ${year}`}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.heading} fixed><Text style={styles.title}>REGISTRUL DE EVIDENTA FISCALA</Text><Text style={styles.subtitle}>An fiscal {year} · document generat electronic</Text></View>
      <View style={styles.entity}><View><Text style={styles.strong}>{pdfText(company.name)}</Text><Text>CIF/CUI: {company.cif || "-"} · Reg. com.: {company.regCom || "-"}</Text><Text>{pdfText(company.address || "-")}</Text></View><View><Text style={styles.strong}>Regim TVA</Text><Text>{vatPayer ? "Platitor de TVA – baza fiscala fara TVA" : "Neplatitor de TVA – baza fiscala la valoarea bruta"}</Text></View></View>
            <View style={styles.table}>
        <View style={[styles.row, styles.head]} fixed><Text style={[styles.cell,{width:"12%"}]}>Cont</Text><Text style={[styles.cell,{width:"38%"}]}>Denumire cont</Text><Text style={[styles.cell,{width:"12%"}]}>Tip</Text><Text style={[styles.cell,styles.amount]}>Rulaj debit</Text><Text style={[styles.cell,styles.amount]}>Rulaj credit</Text><Text style={[styles.cell,styles.amount]}>Total fiscal</Text></View>
        {accountSummary.map((row) => <View key={row.accountCode} style={styles.row} wrap={false}><Text style={[styles.cell,{width:"12%"}]}>{row.accountCode}</Text><Text style={[styles.cell,{width:"38%"}]}>{pdfText(row.accountName)}</Text><Text style={[styles.cell,{width:"12%"}]}>{row.type==="INCOME"?"VENIT":"CHELTUIALA"}</Text><Text style={[styles.cell,styles.amount]}>{money(row.debit)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.credit)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.fiscalAmount)}</Text></View>)}
        {!accountSummary.length && <View style={styles.row}><Text style={{ padding: 10 }}>Nu exista rulaje pe conturi pentru anul selectat.</Text></View>}
      </View>
      <View style={styles.totals} wrap={false}>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>TOTAL VENITURI INCASATE</Text><Text style={styles.totalValue}>{money(summary.totalIncome)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>VENITURI IMPOZABILE</Text><Text style={styles.totalValue}>{money(summary.taxableIncome)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>TOTAL CHELTUIELI EFECTUATE</Text><Text style={styles.totalValue}>{money(summary.totalExpenses)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>CHELTUIELI DEDUCTIBILE</Text><Text style={styles.totalValue}>{money(summary.deductibleExpenses)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>REZULTAT FISCAL</Text><Text style={styles.totalValue}>{money(summary.fiscalResult)} RON</Text></View>
      </View>
      <View style={styles.footer} fixed><Text>Document de lucru pentru evidenta fiscala. Clasificarea fiscala trebuie validata de contribuabil/contabil.</Text><Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} / ${totalPages}`} /></View>
    </Page>
  </Document>;
}
