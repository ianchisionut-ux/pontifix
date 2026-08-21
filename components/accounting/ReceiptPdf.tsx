import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { Company, Client, Invoice } from "@/lib/accounting/repo";
import { amountToWordsRO } from "@/lib/accounting/numberToWords";
import { formatDate } from "./InvoicePdf";
import { ACCOUNTING_LOGO_DATA_URI } from "@/lib/accounting/logo";

const NAVY="#082b4d", BLUE="#197fb5", SKY="#eaf5fb", LINE="#cfe2ed", MUTED="#6b8296";
const LOGO=ACCOUNTING_LOGO_DATA_URI;
const styles=StyleSheet.create({
 page:{padding:38,fontSize:9,fontFamily:"Helvetica",color:"#334e68"},line:{height:5,backgroundColor:BLUE,borderRadius:3,marginBottom:16},
 header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},brand:{flexDirection:"row",alignItems:"center"},logo:{width:58,height:42,objectFit:"contain",marginRight:11},
 company:{fontFamily:"Helvetica-Bold",fontSize:16,color:NAVY},tag:{fontSize:7,color:MUTED,marginTop:3},doc:{backgroundColor:NAVY,color:"#fff",borderRadius:8,padding:12,width:185},
 docLabel:{fontSize:7,letterSpacing:1,color:"#b9dcef"},docNo:{fontFamily:"Helvetica-Bold",fontSize:16,marginTop:3},docDate:{fontSize:8,marginTop:7,color:"#e4f2f8"},
 parties:{flexDirection:"row",gap:10,marginTop:20},card:{width:"50%",borderWidth:1,borderColor:LINE,borderRadius:7,padding:10},client:{width:"50%",borderWidth:1.2,borderColor:BLUE,borderRadius:7,padding:10,backgroundColor:SKY},
 kicker:{fontFamily:"Helvetica-Bold",fontSize:7,letterSpacing:1,color:BLUE,marginBottom:5},name:{fontFamily:"Helvetica-Bold",fontSize:11,color:NAVY,marginBottom:4},detail:{fontSize:7.6,lineHeight:1.5},
 body:{marginTop:22,borderWidth:1,borderColor:LINE,borderRadius:8,overflow:"hidden"},bodyTitle:{backgroundColor:BLUE,color:"#fff",fontFamily:"Helvetica-Bold",padding:9,fontSize:9},
 bodyContent:{padding:16,fontSize:10,lineHeight:1.7},amount:{marginTop:14,backgroundColor:NAVY,color:"#fff",borderRadius:7,padding:13,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 amountLabel:{fontSize:8,color:"#b9dcef"},amountValue:{fontFamily:"Helvetica-Bold",fontSize:17},words:{marginTop:10,backgroundColor:SKY,borderRadius:7,padding:11,fontSize:8,lineHeight:1.5},
 footer:{position:"absolute",left:38,right:38,bottom:35,borderTopWidth:1,borderTopColor:LINE,paddingTop:12,flexDirection:"row",justifyContent:"space-between"},footerText:{fontSize:7,color:MUTED,lineHeight:1.5},cashier:{fontFamily:"Helvetica-Bold",fontSize:8,color:NAVY},
});
function idLine(client:Client){return client.clientType==="PF" ? `CNP: ${client.cnp || "—"}` : `CIF/CUI: ${client.cif || "—"}`;}
function fmt(n:number){return n.toLocaleString("ro-RO",{minimumFractionDigits:2,maximumFractionDigits:2});}

export function ReceiptPdf({receipt,invoice,client,company}:{receipt:{series:string;number:number;issueDate:string;amount:number;cashier:string};invoice:Invoice;client:Client;company:Company}){
 const num=String(receipt.number).padStart(4,"0");
 return <Document><Page size="A4" style={styles.page}><View style={styles.line}/>
  <View style={styles.header}><View style={styles.brand}><Image src={LOGO} style={styles.logo}/><View><Text style={styles.company}>{company.name}</Text><Text style={styles.tag}>Proiectare si executie instalatii electrice</Text></View></View><View style={styles.doc}><Text style={styles.docLabel}>CHITANTA</Text><Text style={styles.docNo}>{receipt.series} {num}</Text><Text style={styles.docDate}>Data: {formatDate(receipt.issueDate)}</Text></View></View>
  <View style={styles.parties}><View style={styles.card}><Text style={styles.kicker}>EMITENT</Text><Text style={styles.name}>{company.name}</Text><Text style={styles.detail}>CIF: {company.cif}</Text><Text style={styles.detail}>Reg. com.: {company.regCom}</Text><Text style={styles.detail}>{company.address}</Text></View>
  <View style={styles.client}><Text style={styles.kicker}>PLATITOR · {client.clientType==="PF"?"PERSOANA FIZICA":"PERSOANA JURIDICA"}</Text><Text style={styles.name}>{client.name}</Text><Text style={styles.detail}>{idLine(client)}</Text>{client.regCom&&<Text style={styles.detail}>Reg. com.: {client.regCom}</Text>}<Text style={styles.detail}>{client.address}</Text><Text style={styles.detail}>{[client.city,client.judet].filter(Boolean).join(", ")}</Text></View></View>
  <View style={styles.body}><Text style={styles.bodyTitle}>INCASARE</Text><View style={styles.bodyContent}><Text>Am primit de la {client.name} suma mentionata mai jos, reprezentand contravaloarea facturii {invoice.series} {String(invoice.number).padStart(4,"0")} din {formatDate(invoice.issueDate)}.</Text><View style={styles.amount}><View><Text style={styles.amountLabel}>SUMA INCASATA</Text><Text style={styles.amountValue}>{fmt(receipt.amount)} RON</Text></View><Text style={{fontSize:8}}>Numerar</Text></View><View style={styles.words}><Text style={{fontFamily:"Helvetica-Bold",color:BLUE,marginBottom:3}}>SUMA IN LITERE</Text><Text>{amountToWordsRO(receipt.amount,"RON")}</Text></View></View></View>
  <View style={styles.footer}><View><Text style={styles.cashier}>Casier</Text><Text style={styles.footerText}>{receipt.cashier||"________________________"}</Text></View><View><Text style={styles.cashier}>Date contact</Text><Text style={styles.footerText}>{company.phone}{"\n"}{company.email}</Text></View><View><Text style={styles.cashier}>Semnatura platitor</Text><Text style={styles.footerText}>{"\n"}________________________</Text></View></View>
 </Page></Document>;
}