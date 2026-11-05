import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Company } from "@/lib/accounting/repo";
import type { RefAccountSummary, RefSummary, RefTransaction } from "@/lib/accounting/ref";
import { pdfText } from "@/components/accounting/InvoicePdf";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 7.5, color: "#1d3552" },
  heading: { borderBottomWidth: 3, borderBottomColor: "#1677c8", paddingBottom: 10, marginBottom: 12 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, color: "#101f33" },
  subtitle: { marginTop: 4, color: "#64748b" },
  section: { marginTop: 14, marginBottom: 7, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  note: { marginBottom: 8, color: '#54627a', lineHeight: 1.5 },
  entity: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, padding: 9, backgroundColor: "#eaf5ff", borderRadius: 5 },
  strong: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#e4e8ee" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e4e8ee", minHeight: 25, alignItems: "center" },
  head: { backgroundColor: "#101f33", color: "#fff", fontFamily: "Helvetica-Bold", minHeight: 28 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: "#e4e8ee" },
  nr: { width: "5%" }, date: { width: "10%" }, doc: { width: "17%" }, explanation: { width: "28%" }, amount: { width: "13%", textAlign: "right" }, category: { width: "14%" },
  totals: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  totalBox: { width: "31%", borderWidth: 1, borderColor: "#e4e8ee", borderRadius: 5, padding: 8 },
  totalLabel: { color: "#64748b", fontSize: 6.5 },
  totalValue: { marginTop: 3, fontFamily: "Helvetica-Bold", fontSize: 10, color: "#101f33" },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, color: "#54627a", fontSize: 6, flexDirection: "row", justifyContent: "space-between" },
});

function money(value: number) { return value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function categoryLabel(value: string) {
  return ({ TAXABLE_INCOME: "Venit impozabil", NON_TAXABLE_INCOME: "Venit neimpozabil", DEDUCTIBLE_EXPENSE: "Cheltuiala deductibila", PARTIAL_EXPENSE: "Partial deductibila", NON_DEDUCTIBLE_EXPENSE: "Nedeductibila" } as Record<string, string>)[value] || value;
}

function ReportFooter() {
  return <View style={styles.footer} fixed><Text>Document de lucru pentru evidenta fiscala. Clasificarea fiscala trebuie validata de contribuabil/contabil.</Text><Text render={({pageNumber,totalPages}) => `Pagina ${pageNumber} / ${totalPages}`}/></View>
}

export function RefPdf({ company, year, transactions, accountSummary, summary, vatPayer }: { company: Company; year: number; transactions: RefTransaction[]; accountSummary: RefAccountSummary[]; summary: RefSummary; vatPayer: boolean }) {
  return <Document title={`Registrul de evidenta fiscala ${year}`}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.heading} fixed><Text style={styles.title}>REGISTRUL DE EVIDENTA FISCALA</Text><Text style={styles.subtitle}>An fiscal {year} · document generat electronic</Text></View>
      <View style={styles.entity}><View><Text style={styles.strong}>{pdfText(company.name)}</Text><Text>CIF/CUI: {company.cif || "-"} · Reg. com.: {company.regCom || "-"}</Text><Text>{pdfText(company.address || "-")}</Text></View><View><Text style={styles.strong}>Regim TVA</Text><Text>{vatPayer ? "Platitor de TVA – baza fiscala fara TVA" : "Neplatitor de TVA – baza fiscala la valoarea bruta"}</Text></View></View>
      <Text style={styles.note}>Totalurile REF provin din incasarile si platile inregistrate. Emiterea facturilor si calcularea salariilor nu reprezinta automat incasari ori plati.</Text>
      <View style={styles.totals} wrap={false}>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>TOTAL VENITURI INCASATE</Text><Text style={styles.totalValue}>{money(summary.totalIncome)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>VENITURI IMPOZABILE</Text><Text style={styles.totalValue}>{money(summary.taxableIncome)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>TOTAL CHELTUIELI EFECTUATE</Text><Text style={styles.totalValue}>{money(summary.totalExpenses)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>CHELTUIELI DEDUCTIBILE</Text><Text style={styles.totalValue}>{money(summary.deductibleExpenses)} RON</Text></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>REZULTAT FISCAL</Text><Text style={styles.totalValue}>{money(summary.fiscalResult)} RON</Text></View>
      </View>
      <Text style={styles.section}>INCASARI SI PLATI INCLUSE IN REF</Text>
      <View style={styles.table}>
        <View style={[styles.row,styles.head]} fixed><Text style={[styles.cell,styles.nr]}>Nr.</Text><Text style={[styles.cell,styles.date]}>Data</Text><Text style={[styles.cell,styles.doc]}>Document</Text><Text style={[styles.cell,styles.explanation]}>Explicatie / sursa</Text><Text style={[styles.cell,styles.amount]}>Suma (RON)</Text><Text style={[styles.cell,styles.amount]}>Valoare fiscala</Text><Text style={[styles.cell,styles.category]}>Clasificare fiscala</Text></View>
        {transactions.map((row,index) => <View key={row.id} style={styles.row} wrap={false}><Text style={[styles.cell,styles.nr]}>{index+1}</Text><Text style={[styles.cell,styles.date]}>{row.date.split('-').reverse().join('.')}</Text><Text style={[styles.cell,styles.doc]}>{pdfText(`${row.documentType} ${row.documentNumber}`)}</Text><Text style={[styles.cell,styles.explanation]}>{pdfText(row.explanation)}{'\n'}{row.source==='AUTO_PAYROLL'?'Plata salariala':row.source==='AUTO_PAYMENT'?'Incasare factura':'Pozitie manuala'}</Text><Text style={[styles.cell,styles.amount]}>{money(row.grossAmount)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.fiscalAmount)}</Text><Text style={[styles.cell,styles.category]}>{pdfText(categoryLabel(row.fiscalCategory))}</Text></View>)}
        {!transactions.length && <View style={styles.row}><Text style={{padding:10}}>Nu exista incasari sau plati in REF pentru anul selectat.</Text></View>}
      </View>
      <ReportFooter/>
    </Page>
    {accountSummary.length>0 && <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.heading} fixed><Text style={styles.title}>RULAJE CONTABILE - INFORMATIV</Text><Text style={styles.subtitle}>{pdfText(company.name)} - {year} - anexa separata de totalurile REF</Text></View>
      <Text style={styles.note}>Includ facturi neincasate si salarii neachitate. Rulajele nu sunt totaluri REF si nu stabilesc deductibilitatea fiscala.</Text>
      <View style={styles.table}>
        <View style={[styles.row,styles.head]} fixed><Text style={[styles.cell,{width:'10%'}]}>Cont</Text><Text style={[styles.cell,{width:'39%'}]}>Denumire cont</Text><Text style={[styles.cell,{width:'12%'}]}>Tip</Text><Text style={[styles.cell,styles.amount]}>Rulaj debit</Text><Text style={[styles.cell,styles.amount]}>Rulaj credit</Text><Text style={[styles.cell,styles.amount]}>Rulaj net contabil</Text></View>
        {accountSummary.map(row => <View key={row.accountCode} style={styles.row} wrap={false}><Text style={[styles.cell,{width:'10%'}]}>{row.accountCode}</Text><Text style={[styles.cell,{width:'39%'}]}>{pdfText(row.accountName)}</Text><Text style={[styles.cell,{width:'12%'}]}>{row.type==='INCOME'?'VENIT':'CHELTUIALA'}</Text><Text style={[styles.cell,styles.amount]}>{money(row.debit)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.credit)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.accountingAmount)}</Text></View>)}
        {!accountSummary.length && <View style={styles.row}><Text style={{padding:10}}>Nu exista rulaje contabile pentru anul selectat.</Text></View>}
      </View>
      <ReportFooter/>
    </Page>}
  </Document>;
}
