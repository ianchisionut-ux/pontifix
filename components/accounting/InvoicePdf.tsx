import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { Company, Client, Invoice, InvoiceItem } from "@/lib/accounting/repo";
import { amountToWordsRO } from "@/lib/accounting/numberToWords";
import { ACCOUNTING_LOGO_DATA_URI } from "@/lib/accounting/logo";

const NAVY = "#082b4d";
const BLUE = "#197fb5";
const SKY = "#eaf5fb";
const LINE = "#cfe2ed";
const TEXT = "#334e68";
const MUTED = "#6b8296";
const LOGO = ACCOUNTING_LOGO_DATA_URI;

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8.5, fontFamily: "Helvetica", color: TEXT, backgroundColor: "#ffffff" },
  brandLine: { height: 5, backgroundColor: BLUE, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  identity: { flexDirection: "row", alignItems: "center", width: "57%" },
  logo: { width: 64, height: 45, objectFit: "contain", marginRight: 12 },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 17, color: NAVY },
  companyTagline: { marginTop: 3, fontSize: 7.5, color: MUTED },
  invoiceBox: { width: "35%", backgroundColor: NAVY, borderRadius: 8, padding: 12, color: "#ffffff" },
  invoiceLabel: { fontSize: 8, letterSpacing: 1.2, color: "#b9dcef" },
  invoiceNumber: { fontFamily: "Helvetica-Bold", fontSize: 17, marginTop: 3 },
  invoiceMeta: { marginTop: 8, fontSize: 8, lineHeight: 1.5, color: "#e4f2f8" },
  partyRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  partyCard: { width: "50%", borderWidth: 1, borderColor: LINE, borderRadius: 7, padding: 10, backgroundColor: "#fbfdfe" },
  partyCardClient: { width: "50%", borderWidth: 1.2, borderColor: BLUE, borderRadius: 7, padding: 10, backgroundColor: SKY },
  kicker: { fontFamily: "Helvetica-Bold", fontSize: 7, letterSpacing: 1, color: BLUE, marginBottom: 5 },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, marginBottom: 4 },
  detail: { fontSize: 7.6, lineHeight: 1.5, color: TEXT },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 5, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 7.2, paddingVertical: 7, paddingHorizontal: 5 },
  tableRow: { flexDirection: "row", minHeight: 28, alignItems: "center", fontSize: 7.6, paddingVertical: 6, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: LINE },
  tableRowAlt: { backgroundColor: "#f5fafc" },
  cNr: { width: "5%" }, cDenumire: { width: "39%" }, cUM: { width: "8%", textAlign: "center" },
  cCant: { width: "9%", textAlign: "right" }, cPret: { width: "13%", textAlign: "right" },
  cVal: { width: "13%", textAlign: "right" }, cTva: { width: "13%", textAlign: "right" },
  summaryArea: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  words: { width: "55%", backgroundColor: SKY, borderRadius: 6, padding: 9, fontSize: 7.5, lineHeight: 1.5 },
  wordsTitle: { fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 3 },
  totals: { width: "38%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsMuted: { color: MUTED },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", backgroundColor: BLUE, color: "#fff", borderRadius: 6, padding: 9, marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 10 },
  notes: { marginTop: 11, padding: 8, borderLeftWidth: 3, borderLeftColor: BLUE, backgroundColor: "#f8fbfd", fontSize: 7.5, lineHeight: 1.5 },
  footer: { position: "absolute", left: 30, right: 30, bottom: 26, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 9, flexDirection: "row", justifyContent: "space-between" },
  footerCol: { width: "32%" }, footerTitle: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 7.5, marginBottom: 3 },
  footerText: { color: MUTED, fontSize: 7, lineHeight: 1.4 },
  badge: { alignSelf: "flex-start", marginTop: 5, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8, backgroundColor: "#dff2fb", color: BLUE, fontFamily: "Helvetica-Bold", fontSize: 6.5 },
});

export function pdfText(value: unknown) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function asciiObject<T extends object>(value: T): T { return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? pdfText(item) : item])) as T; }

function fmt(n: number) { return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function identification(client: Client) {
  return client.clientType === "PF"
    ? [client.cnp && `CNP: ${client.cnp}`, (client.ciSeries || client.ciNumber) && `CI: ${client.ciSeries} ${client.ciNumber}`]
    : [client.cif && `CIF/CUI: ${client.cif}`, client.regCom && `Reg. com.: ${client.regCom}`];
}

export function InvoicePdf({ invoice, items, client, company }: { invoice: Invoice; items: InvoiceItem[]; client: Client; company: Company }) {
  const companyPdf = asciiObject(company);
  const clientPdf = asciiObject(client);
  const invoicePdf = asciiObject(invoice);
  const itemsPdf = items.map(asciiObject);
  const numStr = String(invoicePdf.number).padStart(4, "0");
  return <Document><Page size="A4" style={styles.page}>
    <View style={styles.brandLine}/>
    <View style={styles.header}>
      <View style={styles.identity}><Image src={LOGO} style={styles.logo}/><View><Text style={styles.companyName}>{companyPdf.name}</Text><Text style={styles.companyTagline}>Proiectare si executie instalatii electrice</Text><Text style={styles.badge}>DOCUMENT FISCAL</Text></View></View>
      <View style={styles.invoiceBox}><Text style={styles.invoiceLabel}>{invoicePdf.invoiceType === "STORNO" ? "FACTURA STORNO" : "FACTURA"}</Text><Text style={styles.invoiceNumber}>{invoicePdf.series} {numStr}</Text><Text style={styles.invoiceMeta}>Emisa: {formatDate(invoicePdf.issueDate)}{"\n"}Scadenta: {invoicePdf.dueDate ? formatDate(invoicePdf.dueDate) : "-"}{"\n"}Moneda: {invoicePdf.currency}</Text></View>
    </View>

    <View style={styles.partyRow}>
      <View style={styles.partyCard}><Text style={styles.kicker}>FURNIZOR</Text><Text style={styles.partyName}>{companyPdf.name}</Text>
        <Text style={styles.detail}>CIF: {companyPdf.cif}</Text><Text style={styles.detail}>Reg. com.: {companyPdf.regCom}</Text><Text style={styles.detail}>{companyPdf.address}</Text>
        {[companyPdf.iban, companyPdf.iban2, companyPdf.iban3].filter(Boolean).map((iban, index) => <Text key={String(iban)} style={styles.detail}>IBAN {index + 1}: {iban}</Text>)}{companyPdf.bank && <Text style={styles.detail}>Banca: {companyPdf.bank}</Text>}
        <Text style={styles.detail}>{[companyPdf.phone, companyPdf.email].filter(Boolean).join(" | ")}</Text>
      </View>
      <View style={styles.partyCardClient}><Text style={styles.kicker}>BENEFICIAR - {clientPdf.clientType === "PF" ? "PERSOANA FIZICA" : "PERSOANA JURIDICA"}</Text><Text style={styles.partyName}>{clientPdf.name}</Text>
        {identification(clientPdf).filter(Boolean).map((line, index)=><Text key={index} style={styles.detail}>{line}</Text>)}
        <Text style={styles.detail}>{clientPdf.address || "Adresa necompletata"}</Text>
        <Text style={styles.detail}>{[clientPdf.city, clientPdf.judet].filter(Boolean).join(", ")}</Text>
        <Text style={styles.detail}>{[clientPdf.phone, clientPdf.email].filter(Boolean).join(" | ")}</Text>
        {clientPdf.sourceNib && <Text style={styles.badge}>DOSAR {clientPdf.sourceNib}</Text>}
      </View>
    </View>

    <View style={styles.table}>
      <View style={styles.tableHeader}><Text style={styles.cNr}>Nr.</Text><Text style={styles.cDenumire}>Produs / serviciu</Text><Text style={styles.cUM}>U.M.</Text><Text style={styles.cCant}>Cant.</Text><Text style={styles.cPret}>Pret unitar</Text><Text style={styles.cVal}>Valoare</Text><Text style={styles.cTva}>TVA</Text></View>
      {itemsPdf.map((it,idx)=><View key={it.id} style={[styles.tableRow, idx%2 ? styles.tableRowAlt : {}]}><Text style={styles.cNr}>{idx+1}</Text><Text style={styles.cDenumire}>{it.description}</Text><Text style={styles.cUM}>{it.um}</Text><Text style={styles.cCant}>{fmt(it.qty)}</Text><Text style={styles.cPret}>{fmt(it.unitPrice)}</Text><Text style={styles.cVal}>{fmt(it.valoare)}</Text><Text style={styles.cTva}>{fmt(it.vatValue)} ({it.vatRate}%)</Text></View>)}
    </View>

    <View style={styles.summaryArea}><View style={styles.words}><Text style={styles.wordsTitle}>TOTAL IN LITERE</Text><Text>{amountToWordsRO(invoicePdf.total, invoicePdf.currency)}</Text>{companyPdf.vatIncasare ? <Text style={{marginTop:4,color:MUTED}}>TVA la incasare</Text> : null}</View>
      <View style={styles.totals}><View style={styles.totalsRow}><Text style={styles.totalsMuted}>Subtotal</Text><Text>{fmt(invoicePdf.subtotal)} {invoicePdf.currency}</Text></View><View style={styles.totalsRow}><Text style={styles.totalsMuted}>TVA</Text><Text>{fmt(invoicePdf.vatTotal)} {invoicePdf.currency}</Text></View>{invoicePdf.discountPercent>0&&<View style={styles.totalsRow}><Text style={styles.totalsMuted}>Discount</Text><Text>{invoicePdf.discountPercent}%</Text></View>}<View style={styles.totalFinal}><Text>TOTAL</Text><Text>{fmt(invoicePdf.total)} {invoicePdf.currency}</Text></View></View>
    </View>
    {invoicePdf.notes && <View style={styles.notes}><Text style={{fontFamily:"Helvetica-Bold",marginBottom:2}}>Observatii</Text><Text>{invoicePdf.notes}</Text></View>}

    <View style={styles.footer}><View style={styles.footerCol}><Text style={styles.footerTitle}>Intocmit de</Text><Text style={styles.footerText}>{invoicePdf.delegateName || companyPdf.name}</Text><Text style={styles.footerText}>{invoicePdf.delegateCI ? `CI ${invoicePdf.delegateCI}` : ""}</Text></View><View style={styles.footerCol}><Text style={styles.footerTitle}>Expeditie</Text><Text style={styles.footerText}>{invoicePdf.vehiclePlate ? `Auto ${invoicePdf.vehiclePlate}` : "-"}</Text><Text style={styles.footerText}>{invoicePdf.deliveryDate ? formatDate(invoicePdf.deliveryDate) : ""} {invoicePdf.deliveryTime}</Text></View><View style={styles.footerCol}><Text style={styles.footerTitle}>Semnatura beneficiar</Text><Text style={styles.footerText}>{"\n"}________________________</Text></View></View>
  </Page></Document>;
}

export function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}
