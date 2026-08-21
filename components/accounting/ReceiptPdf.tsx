import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Company, Client, Invoice } from "@/lib/accounting/repo";
import { amountToWordsRO } from "@/lib/accounting/numberToWords";
import { formatDate } from "./InvoicePdf";

const CYAN = "#29ABD4";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#222" },
  headerBar: {
    backgroundColor: CYAN,
    color: "#fff",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  headerNumber: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  headerSub: { fontSize: 8, color: "#fff", marginTop: 10 },
  label: { color: "#555", fontSize: 8, marginTop: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 14, marginBottom: 4 },
  bodyText: { fontSize: 9, marginTop: 14, lineHeight: 1.6 },
  cashierBox: { marginTop: 30, textAlign: "right" as const },
});

export function ReceiptPdf({
  receipt,
  invoice,
  client,
  company,
}: {
  receipt: { series: string; number: number; issueDate: string; amount: number; cashier: string };
  invoice: Invoice;
  client: Client;
  company: Company;
}) {
  const numStr = String(receipt.number).padStart(4, "0");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Chitanta</Text>
          <Text style={styles.headerNumber}>
            {receipt.series} {numStr}
          </Text>
        </View>
        <Text style={styles.headerSub}>Data emiterii: {formatDate(receipt.issueDate)}</Text>

        <Text style={styles.sectionTitle}>Furnizor:</Text>
        <Text style={styles.bold}>{company.name}</Text>
        <Text style={styles.label}>Reg. com: {company.regCom}</Text>
        <Text style={styles.label}>CIF: {company.cif}</Text>
        <Text style={styles.label}>Adresa: {company.address}</Text>

        <Text style={styles.bodyText}>
          Am primit de la {client.name}, CIF {client.cif}, Reg. com {client.regCom}, adresa{" "}
          {client.address}, suma de {receipt.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}{" "}
          Lei, adica {amountToWordsRO(receipt.amount)}, reprezentand contravaloarea facturii{" "}
          {invoice.series} {String(invoice.number).padStart(4, "0")} din data{" "}
          {formatDate(invoice.issueDate)}.
        </Text>

        <View style={styles.cashierBox}>
          <Text>Casier,</Text>
          <Text style={{ marginTop: 20 }}>{receipt.cashier || "________________"}</Text>
        </View>
      </Page>
    </Document>
  );
}
