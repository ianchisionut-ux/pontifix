import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Company } from "@/lib/accounting/repo";
import type { DeclarationReport, DeclarationType } from "@/lib/accounting/declarations";

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingHorizontal: 28, paddingBottom: 38, fontFamily: "Helvetica", fontSize: 7.5, color: "#1d3552" },
  heading: { borderBottomWidth: 3, borderBottomColor: "#3b66f6", paddingBottom: 9, marginBottom: 11 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, color: "#001a3d" },
  subtitle: { marginTop: 4, color: "#64748b" },
  entity: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9, padding: 8, backgroundColor: "#edf5ff", borderRadius: 5 },
  strong: { fontFamily: "Helvetica-Bold" },
  notice: { marginBottom: 8, padding: 7, borderWidth: 1, borderColor: "#f0d394", borderRadius: 5, backgroundColor: "#fff9eb", color: "#805510", lineHeight: 1.4 },
  summary: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryBox: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: "#cbdcf1", borderRadius: 5, padding: 8 },
  label: { color: "#64748b", fontSize: 6.5 },
  value: { marginTop: 3, fontFamily: "Helvetica-Bold", fontSize: 10, color: "#001a3d" },
  section: { marginTop: 3, marginBottom: 6, fontFamily: "Helvetica-Bold", fontSize: 9, color: "#001a3d" },
  table: { borderWidth: 1, borderColor: "#cbdcf1", marginBottom: 11 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dce7f4", minHeight: 24, alignItems: "center" },
  head: { backgroundColor: "#001a3d", color: "#fff", fontFamily: "Helvetica-Bold", minHeight: 27 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: "#dce7f4" },
  partner: { width: "27%" }, code: { width: "17%" }, country: { width: "8%" }, count: { width: "9%", textAlign: "right" }, amount: { width: "13%", textAlign: "right" },
  rate: { width: "18%" }, wideAmount: { width: "27%", textAlign: "right" }, wideCount: { width: "28%", textAlign: "right" },
  empty: { padding: 10, color: "#64748b" },
  warnings: { marginTop: 4 },
  warning: { marginBottom: 3, color: "#805510" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, color: "#7a8ca2", fontSize: 6, flexDirection: "row", justifyContent: "space-between" },
});

const names: Record<DeclarationType, string> = { D300: "DECONT DE TVA", D394: "OPERATIUNI INTERNE", D390: "OPERATIUNI INTRACOMUNITARE" };
function money(value: number) { return value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pdfText(value: unknown) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

function Header({ company, report, type }: { company: Company; report: DeclarationReport; type: DeclarationType }) {
  return <>
    <View style={styles.heading} fixed><Text style={styles.title}>FISA DE LUCRU {type} - {names[type]}</Text><Text style={styles.subtitle}>Perioada {String(report.period.month).padStart(2, "0")}/{report.period.year} - generata electronic pentru verificare contabila</Text></View>
    <View style={styles.entity}><View><Text style={styles.strong}>{pdfText(company.name)}</Text><Text>CIF/CUI: {company.cif || "-"} - Reg. com.: {company.regCom || "-"}</Text><Text>{pdfText(company.address || "-")}</Text></View><View><Text style={styles.strong}>Regim TVA</Text><Text>{report.basis.vatPayer ? "Platitor de TVA" : "Neplatitor de TVA"}</Text><Text>{report.basis.vatOnCashAccounting ? "TVA la incasare" : "TVA la facturare"}</Text></View></View>
    <View style={styles.notice}><Text><Text style={styles.strong}>Document de lucru, nu formular ANAF semnat.</Text> Valorile se verifica de contabil, se transfera in formularul/XML-ul oficial, se valideaza, se semneaza digital si se depun prin canalul ANAF aplicabil.</Text></View>
  </>;
}

function Footer() { return <View style={styles.footer} fixed><Text>Generat de Facturare - control contabil obligatoriu inainte de depunere.</Text><Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} / ${totalPages}`} /></View>; }

function PartnerTable({ rows, empty }: { rows: Array<{ partnerName:string; partnerCif:string; countryCode:string; documentCount:number; taxableBase:number; vat?:number; gross?:number }>; empty:string }) {
  return <View style={styles.table}>
    <View style={[styles.row,styles.head]} fixed><Text style={[styles.cell,styles.partner]}>Partener</Text><Text style={[styles.cell,styles.code]}>CUI / cod TVA</Text><Text style={[styles.cell,styles.country]}>Tara</Text><Text style={[styles.cell,styles.count]}>Documente</Text><Text style={[styles.cell,styles.amount]}>Baza RON</Text><Text style={[styles.cell,styles.amount]}>TVA RON</Text><Text style={[styles.cell,styles.amount]}>Total RON</Text></View>
    {rows.map((row,index)=><View key={`${row.partnerCif}-${index}`} style={styles.row} wrap={false}><Text style={[styles.cell,styles.partner]}>{pdfText(row.partnerName || "Necompletat")}</Text><Text style={[styles.cell,styles.code]}>{row.partnerCif || "Necompletat"}</Text><Text style={[styles.cell,styles.country]}>{row.countryCode}</Text><Text style={[styles.cell,styles.count]}>{row.documentCount}</Text><Text style={[styles.cell,styles.amount]}>{money(row.taxableBase)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.vat || 0)}</Text><Text style={[styles.cell,styles.amount]}>{money(row.gross || row.taxableBase)}</Text></View>)}
    {!rows.length&&<Text style={styles.empty}>{empty}</Text>}
  </View>;
}

export function DeclarationPdf({ company, report, type }: { company: Company; report: DeclarationReport; type: DeclarationType }) {
  return <Document title={`Fisa de lucru ${type} ${report.period.year}-${String(report.period.month).padStart(2,"0")}`}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Header company={company} report={report} type={type}/>
      {report.warnings.length>0&&<View style={styles.warnings} wrap={false}><Text style={styles.section}>Verificari necesare</Text>{report.warnings.map(w=><Text key={w} style={styles.warning}>- {pdfText(w)}</Text>)}</View>}
      {type==="D300"&&<>
        <View style={styles.summary}><View style={styles.summaryBox}><Text style={styles.label}>TVA COLECTATA</Text><Text style={styles.value}>{money(report.d300.outputVat)} RON</Text></View><View style={styles.summaryBox}><Text style={styles.label}>TVA DEDUCTIBILA</Text><Text style={styles.value}>{money(report.d300.inputVat)} RON</Text></View><View style={styles.summaryBox}><Text style={styles.label}>TVA DE PLATA</Text><Text style={styles.value}>{money(report.d300.vatPayable)} RON</Text></View><View style={styles.summaryBox}><Text style={styles.label}>TVA DE RECUPERAT</Text><Text style={styles.value}>{money(report.d300.vatRefundable)} RON</Text></View></View>
        <Text style={styles.section}>Facturi emise grupate pe cote TVA</Text><View style={styles.table}><View style={[styles.row,styles.head]} fixed><Text style={[styles.cell,styles.rate]}>Cota TVA</Text><Text style={[styles.cell,styles.wideAmount]}>Baza impozabila RON</Text><Text style={[styles.cell,styles.wideAmount]}>TVA facturata RON</Text><Text style={[styles.cell,styles.wideCount]}>Documente</Text></View>{report.d300.vatRows.map(row=><View key={row.vatRate} style={styles.row}><Text style={[styles.cell,styles.rate]}>{row.vatRate}%</Text><Text style={[styles.cell,styles.wideAmount]}>{money(row.taxableBase)}</Text><Text style={[styles.cell,styles.wideAmount]}>{money(row.vat)}</Text><Text style={[styles.cell,styles.wideCount]}>{row.documentCount}</Text></View>)}</View>
      </>}
      {type==="D394"&&<><Text style={styles.section}>Livrari interne</Text><PartnerTable rows={report.d394.sales} empty="Nu exista livrari interne in perioada selectata."/><Text style={styles.section}>Achizitii interne inregistrate in Registrul fiscal</Text><PartnerTable rows={report.d394.purchases.map(row=>({partnerName:row.partnerName,partnerCif:row.partnerCif,countryCode:row.countryCode,documentCount:1,taxableBase:row.net,vat:row.vat,gross:row.gross}))} empty="Nu exista achizitii interne inregistrate."/></>}
      {type==="D390"&&<><Text style={styles.section}>Parteneri si operatiuni intracomunitare identificate</Text><PartnerTable rows={report.d390.sales} empty="Nu exista operatiuni intracomunitare identificate."/></>}
      <Footer/>
    </Page>
  </Document>;
}
