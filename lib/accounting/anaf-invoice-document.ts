import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";

export type AnafParty = { name:string; companyId:string; vatId:string; address:string; city:string; county:string; postalCode:string; countryCode:string; phone:string; email:string };
export type AnafInvoiceDocument = {
  kind:"invoice"|"credit-note"; id:string; issueDate:string; dueDate:string; currency:string; notes:string[];
  supplier:AnafParty; customer:AnafParty; paymentMeansCode:string; paymentAccount:string;
  subtotal:number; vatTotal:number; total:number; payable:number; sourceFileName:string; signatureIncluded:boolean;
  lines:Array<{id:string;name:string;unitCode:string;quantity:number;unitPrice:number;lineAmount:number;vatRate:number}>;
};
type X=Record<string,unknown>;
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",removeNSPrefix:true,parseTagValue:false,trimValues:true});
const obj=(v:unknown):X=>v&&typeof v==="object"&&!Array.isArray(v)?v as X:{};
const arr=<T,>(v:T|T[]|null|undefined):T[]=>v==null?[]:Array.isArray(v)?v:[v];
function val(v:unknown){if(v==null)return "";if(typeof v==="string"||typeof v==="number")return String(v).trim();return val(obj(v)["#text"])}
function num(v:unknown){const n=Number(val(v).replace(",","."));return Number.isFinite(n)?n:0}
function first(v:unknown){return obj(Array.isArray(v)?v[0]:v)}
function party(v:unknown):AnafParty{const p=obj(obj(v).Party??v),a=obj(p.PostalAddress),c=obj(a.Country),legal=first(p.PartyLegalEntity),tax=first(p.PartyTaxScheme),contact=obj(p.Contact);return{name:val(legal.RegistrationName)||val(p.Name),companyId:val(legal.CompanyID)||val(tax.CompanyID),vatId:val(tax.CompanyID),address:val(a.StreetName),city:val(a.CityName),county:val(a.CountrySubentity),postalCode:val(a.PostalZone),countryCode:val(c.IdentificationCode),phone:val(contact.Telephone),email:val(contact.ElectronicMail)}}

export function parseAnafInvoiceArchive(buffer:Buffer|Uint8Array):AnafInvoiceDocument{
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  const files=bytes[0]===0x50&&bytes[1]===0x4b?unzipSync(bytes):{"eFactura.xml":bytes};
  const xmls=Object.entries(files).filter(([n])=>n.toLowerCase().endsWith(".xml"));
  const invoice=xmls.find(([n,b])=>!n.toLowerCase().includes("semnatura")&&/<(?:\w+:)?(?:Invoice|CreditNote)\b/i.test(strFromU8(b)));
  if(!invoice)throw new Error("Arhiva ANAF nu conține un XML de factură CIUS-RO recunoscut.");
  const parsed=obj(parser.parse(strFromU8(invoice[1]))),kind=parsed.CreditNote?"credit-note":"invoice",root=obj(kind==="credit-note"?parsed.CreditNote:parsed.Invoice);
  if(!Object.keys(root).length)throw new Error("XML-ul ANAF nu conține o factură validă.");
  const monetary=obj(root.LegalMonetaryTotal),tax=first(root.TaxTotal),raw=arr(kind==="credit-note"?root.CreditNoteLine:root.InvoiceLine);
  const lines=raw.map((r,index)=>{const l=obj(r),item=obj(l.Item),cat=first(item.ClassifiedTaxCategory),q=kind==="credit-note"?l.CreditedQuantity:l.InvoicedQuantity;return{id:val(l.ID)||String(index+1),name:val(item.Name)||val(item.Description)||"Poziție fără denumire",unitCode:val(obj(q)["@unitCode"])||"-",quantity:num(q),unitPrice:num(obj(l.Price).PriceAmount),lineAmount:num(l.LineExtensionAmount),vatRate:num(cat.Percent)}});
  return{kind,id:val(root.ID),issueDate:val(root.IssueDate),dueDate:val(root.DueDate),currency:val(root.DocumentCurrencyCode)||"RON",notes:arr(root.Note).map(val).filter(Boolean),supplier:party(root.AccountingSupplierParty),customer:party(root.AccountingCustomerParty),paymentMeansCode:val(obj(root.PaymentMeans).PaymentMeansCode),paymentAccount:val(obj(obj(root.PaymentMeans).PayeeFinancialAccount).ID),subtotal:num(monetary.TaxExclusiveAmount??monetary.LineExtensionAmount),vatTotal:num(tax.TaxAmount),total:num(monetary.TaxInclusiveAmount),payable:num(monetary.PayableAmount??monetary.TaxInclusiveAmount),lines,sourceFileName:invoice[0],signatureIncluded:xmls.some(([n])=>n.toLowerCase().includes("semnatura"))};
}
