import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { Company, Client, Invoice, InvoiceItem } from "@/lib/accounting/repo";
import { amountToWordsRO } from "@/lib/accounting/numberToWords";

const CYAN = "#29ABD4";
const PURPLE = "#6B2FB3";

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
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  col: { width: "48%" },
  label: { color: "#555", fontSize: 8, marginTop: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4 },
  table: { marginTop: 16, borderWidth: 1, borderColor: "#ddd" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: CYAN,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    padding: 5,
  },
  tableRow: {
    flexDirection: "row",
    fontSize: 8,
    padding: 5,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  cNr: { width: "6%" },
  cDenumire: { width: "38%" },
  cUM: { width: "10%", textAlign: "center" },
  cCant: { width: "10%", textAlign: "center" },
  cPret: { width: "12%", textAlign: "right" },
  cVal: { width: "12%", textAlign: "right" },
  cTva: { width: "12%", textAlign: "right" },
  totalsBox: { marginTop: 6, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 220, justifyContent: "space-between", marginTop: 2 },
  totalPlataRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  totalPlataLabel: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  totalPlataValue: { fontFamily: "Helvetica-Bold", fontSize: 11, color: PURPLE },
  footerBox: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: CYAN,
    borderRadius: 4,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerCol: { width: "32%" },
  footerLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 3 },
  footerText: { fontSize: 8, lineHeight: 1.4 },
  amountWords: { fontSize: 8, marginTop: 10, fontStyle: "italic" },
});

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoicePdf({
  invoice,
  items,
  client,
  company,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Client;
  company: Company;
}) {
  const numStr = String(invoice.number).padStart(4, "0");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Factura</Text>
          <Text style={styles.headerNumber}>
            {invoice.series} {numStr}
          </Text>
        </View>
        <Text style={styles.headerSub}>
          Data emiterii: {formatDate(invoice.issueDate)}
          {company.vatIncasare ? "                              TVA la Incasare (21%)" : ""}
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Furnizor:</Text>
            <Text style={styles.bold}>{company.name}</Text>
            <Text style={styles.label}>Reg. com: {company.regCom}</Text>
            <Text style={styles.label}>CIF: {company.cif}</Text>
            <Text style={styles.label}>Adresa: {company.address}</Text>
            <Text style={styles.label}>IBAN (RON): {company.iban}</Text>
            <Text style={styles.label}>Banca: {company.bank}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Client:</Text>
            <Text style={styles.bold}>{client.name}</Text>
            <Text style={styles.label}>Reg. com: {client.regCom}</Text>
            <Text style={styles.label}>CIF: {client.cif}</Text>
            <Text style={styles.label}>Adresa: {client.address}</Text>
            <Text style={styles.label}>Judet: {client.judet}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cNr}>Nr.</Text>
            <Text style={styles.cDenumire}>Denumire produs/serviciu</Text>
            <Text style={styles.cUM}>U.M.</Text>
            <Text style={styles.cCant}>Cant.</Text>
            <Text style={styles.cPret}>Pret unitar (RON fara TVA)</Text>
            <Text style={styles.cVal}>Valoare (RON)</Text>
            <Text style={styles.cTva}>TVA (RON)</Text>
          </View>
          {items.map((it, idx) => (
            <View style={styles.tableRow} key={it.id}>
              <Text style={styles.cNr}>{idx + 1}</Text>
              <Text style={styles.cDenumire}>{it.description}</Text>
              <Text style={styles.cUM}>{it.um}</Text>
              <Text style={styles.cCant}>{it.qty}</Text>
              <Text style={styles.cPret}>{fmt(it.unitPrice)}</Text>
              <Text style={styles.cVal}>{fmt(it.valoare)}</Text>
              <Text style={styles.cTva}>{fmt(it.vatValue)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{fmt(invoice.subtotal)}</Text>
            <Text>{fmt(invoice.vatTotal)}</Text>
          </View>
          {invoice.discountPercent > 0 && (
            <View style={styles.totalsRow}>
              <Text>Discount ({invoice.discountPercent}%)</Text>
              <Text></Text>
              <Text></Text>
            </View>
          )}
          <View style={styles.totalPlataRow}>
            <Text style={styles.totalPlataLabel}>Total plata</Text>
            <Text style={styles.totalPlataValue}>
              {fmt(invoice.total)} {invoice.currency}
            </Text>
          </View>
          {invoice.currency !== "RON" && (
            <Text style={{ fontSize: 8, color: "#666", marginTop: 3 }}>
              Echivalent: {fmt(invoice.total * invoice.exchangeRate)} RON (curs {invoice.exchangeRate} RON/{invoice.currency})
            </Text>
          )}
        </View>

        <Text style={styles.amountWords}>
          Adica {amountToWordsRO(invoice.total, invoice.currency)}.
        </Text>

        <View style={styles.footerBox}>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>Intocmit de:</Text>
            <Text style={styles.footerText}>{invoice.delegateName || company.name}</Text>
            <Text style={styles.footerText}>CI: {invoice.delegateCI}</Text>
            <Text style={styles.footerText}>CNP: {invoice.delegateCNP}</Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>Date privind expeditia:</Text>
            <Text style={styles.footerText}>
              {invoice.vehiclePlate ? `Autoturism cu nr. ${invoice.vehiclePlate}.` : ""}
            </Text>
            <Text style={styles.footerText}>
              {invoice.deliveryDate ? `Expediat la ${formatDate(invoice.deliveryDate)}` : ""}
              {invoice.deliveryTime ? `, ora ${invoice.deliveryTime}` : ""}
            </Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>Semnatura de primire:</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}
