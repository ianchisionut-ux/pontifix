import { ready } from "./db";
const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v),round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export async function getFinancialRegister(input:{type:"CASH"|"BANK";from:string;to:string;accountCode?:string}){
 if(!valid(input.from)||!valid(input.to)||input.from>input.to)throw new Error("Intervalul registrului nu este valid.");
 const prefix=input.type==="CASH"?"531":"512",pool=await ready();
 const accounts=(await pool.query(`SELECT code,name FROM accounting_accounts WHERE active=1 AND "allowPosting"=1 AND code LIKE $1 ORDER BY code`,[`${prefix}%`])).rows as Array<{code:string;name:string}>;
 const accountCode=input.accountCode&&accounts.some(a=>a.code===input.accountCode)?input.accountCode:accounts.find(a=>a.code===`${prefix}1`)?.code||accounts[0]?.code;
 if(!accountCode)throw new Error(input.type==="CASH"?"Nu există un cont activ de casă.":"Nu există un cont bancar activ.");
 const opening=Number((await pool.query(`SELECT COALESCE(SUM(l.debit-l.credit),0) balance FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId" WHERE l."accountCode"=$1 AND e.status='POSTED' AND e.date<$2::date`,[accountCode,input.from])).rows[0].balance||0);
 const rows=(await pool.query(`SELECT e.id,e.date::text date,e."entryNumber",e.description,e."documentNumber",e."sourceType",l.debit,l.credit,l.explanation FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId" WHERE l."accountCode"=$1 AND e.status='POSTED' AND e.date BETWEEN $2::date AND $3::date ORDER BY e.date,e."entryNumber",l."lineNumber"`,[accountCode,input.from,input.to])).rows;
 let balance=round(opening);const entries=rows.map(row=>{const debit=Number(row.debit),credit=Number(row.credit);balance=round(balance+debit-credit);return{...row,debit,credit,balance}});
 return{type:input.type,accountCode,accountName:accounts.find(a=>a.code===accountCode)?.name||"",accounts,from:input.from,to:input.to,openingBalance:round(opening),entries,totalDebit:round(entries.reduce((s,r)=>s+r.debit,0)),totalCredit:round(entries.reduce((s,r)=>s+r.credit,0)),closingBalance:balance};
}
