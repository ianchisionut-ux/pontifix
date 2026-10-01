import { ready } from "./db";
export type SuggestedAccount={code:string;name:string;confidence:number;source:"history"|"product"|"rule"|"default"};
const norm=(v:string)=>v.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
const expense:Array<[RegExp,string]>=[
 [/\b(benzina|motorina|combustibil|carburant)\b/,"6022"],[/\b(electricitate|energie|gaz|apa|utilitat)\w*\b/,"605"],
 [/\b(chirie|inchiriere|leasing)\b/,"612"],[/\b(transport|curier|livrare|posta)\b/,"624"],
 [/\b(telefon|internet|telecom)\w*\b/,"626"],[/\b(contabil|consultant|juridic|audit|onorariu)\w*\b/,"628"],
 [/\b(publicitate|reclama|marketing|protocol)\w*\b/,"623"],[/\b(asigurare|polita)\w*\b/,"613"],
 [/\b(reparat|mentenant|service auto|intretinere)\w*\b/,"611"],
 [/\b(marfa|marfuri|material|cablu|conductor|siguranta|tablou|aparat|papetarie|birotica|consumabil)\w*\b/,"6028"],
];
const income:Array<[RegExp,string]>=[
 [/\b(proiect|proiectare|documentatie|consultant)\w*\b/,"704"],[/\b(execut|montaj|instalat|bransament|lucrare|reparat|mentenant|servici)\w*\b/,"704"],
 [/\b(marfa|produs|material|tablou|echipament)\w*\b/,"707"],[/\b(chirie|inchiriere)\w*\b/,"706"],
];
export async function suggestAccounts(description:string,direction:"INCOME"|"EXPENSE"){
 const normalized=norm(description);if(normalized.length<2)return [] as SuggestedAccount[];const pool=await ready();
 const sql=direction==="EXPENSE"
  ?`SELECT i."expenseAccount" code,a.name,COUNT(*)::int uses FROM purchase_invoice_items i JOIN accounting_accounts a ON a.code=i."expenseAccount" WHERE lower(i.description) LIKE lower($1) GROUP BY i."expenseAccount",a.name ORDER BY uses DESC LIMIT 4`
  :`SELECT i."revenueAccount" code,a.name,COUNT(*)::int uses FROM invoice_items i JOIN accounting_accounts a ON a.code=i."revenueAccount" WHERE lower(i.description) LIKE lower($1) GROUP BY i."revenueAccount",a.name ORDER BY uses DESC LIMIT 4`;
 const rows=(await pool.query(sql,[`%${description.trim()}%`])).rows;const result=new Map<string,SuggestedAccount>();
 rows.forEach((r,i)=>result.set(r.code,{code:r.code,name:r.name,confidence:Math.max(72,96-i*7),source:"history"}));
 if(direction==="INCOME"){const products=(await pool.query(`SELECT p."revenueAccount" code,a.name FROM products p JOIN accounting_accounts a ON a.code=p."revenueAccount" WHERE lower(p.name) LIKE lower($1) ORDER BY CASE WHEN lower(p.name)=lower($2) THEN 0 ELSE 1 END LIMIT 4`,[`%${description.trim()}%`,description.trim()])).rows;
  products.forEach((r,i)=>{if(!result.has(r.code))result.set(r.code,{code:r.code,name:r.name,confidence:94-i*6,source:"product"})});}
 const rule=(direction==="EXPENSE"?expense:income).find(([p])=>p.test(normalized)),code=rule?.[1]||(direction==="EXPENSE"?"628":"704");
 if(!result.has(code)){const a=(await pool.query(`SELECT code,name FROM accounting_accounts WHERE code=$1 AND active=1 AND "allowPosting"=1`,[code])).rows[0];if(a)result.set(code,{...a,confidence:rule?82:45,source:rule?"rule":"default"});}
 return [...result.values()].sort((a,b)=>b.confidence-a.confidence).slice(0,5);
}
