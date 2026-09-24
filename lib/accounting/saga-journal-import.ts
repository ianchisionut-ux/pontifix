import ExcelJS from 'exceljs'

export type SagaJournalEntry={date:string;documentNumber:string;description:string;lines:Array<{accountCode:string;debit:number;credit:number;explanation:string}>}
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const text=(value:unknown)=>String(value??'').trim()
const number=(value:unknown)=>{let raw=text(value).replace(/\s/g,'');if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.');const parsed=Number(raw);return Number.isFinite(parsed)?Math.round(parsed*100)/100:0}
const date=(value:unknown)=>{if(value instanceof Date)return value.toISOString().slice(0,10);const raw=text(value);const match=raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(match)return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;return /^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):''}
function find(row:Record<string,unknown>,aliases:string[]){for(const [key,value] of Object.entries(row))if(aliases.some(alias=>normalize(alias)===normalize(key)))return value}
function parseDelimited(content:string){
  const lines=content.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());const sample=lines.slice(0,10).join('\n');const delimiter=[';','\t',','].sort((a,b)=>sample.split(b).length-sample.split(a).length)[0]
  const parse=(line:string)=>{const cells:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'&&line[i+1]==='"'&&quoted){value+='"';i++}else if(char==='"')quoted=!quoted;else if(char===delimiter&&!quoted){cells.push(value);value=''}else value+=char}cells.push(value);return cells}
  const headerIndex=lines.slice(0,20).findIndex(line=>{const values=parse(line).map(normalize);return values.some(value=>['contdebitor','contdebit','debitaccount'].includes(value))&&values.some(value=>['contcreditor','contcredit','creditaccount'].includes(value))})
  const start=headerIndex>=0?headerIndex:0;const headers=parse(lines[start]||'');return lines.slice(start+1).map(line=>{const cells=parse(line);return Object.fromEntries(headers.map((header,index)=>[header,cells[index]||'']))})
}

export async function parseSagaJournalFile(file:File){
  const extension=file.name.split('.').pop()?.toLowerCase();let rows:Record<string,unknown>[]=[]
  if(extension==='xlsx'){
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer() as unknown as Parameters<typeof workbook.xlsx.load>[0]);const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Fișierul Excel nu conține foi.')
    let headerRow=1;for(let index=1;index<=Math.min(20,sheet.rowCount);index++){const values=Array.from({length:sheet.columnCount},(_,column)=>normalize(sheet.getRow(index).getCell(column+1).text));if(values.some(value=>['contdebitor','contdebit','debitaccount'].includes(value))&&values.some(value=>['contcreditor','contcredit','creditaccount'].includes(value))){headerRow=index;break}}
    const headers=Array.from({length:sheet.columnCount},(_,column)=>sheet.getRow(headerRow).getCell(column+1).text.trim());sheet.eachRow((row,index)=>{if(index<=headerRow)return;rows.push(Object.fromEntries(headers.map((header,i)=>[header,row.getCell(i+1).value instanceof Date?row.getCell(i+1).value:row.getCell(i+1).text])))})
  }else if(extension==='csv'||extension==='txt'){
    const bytes=await file.arrayBuffer();let content=new TextDecoder('utf-8').decode(bytes);if(content.includes('\uFFFD'))content=new TextDecoder('windows-1252').decode(bytes);rows=parseDelimited(content)
  }else throw new Error('Format acceptat pentru registrul SAGA: XLSX, CSV sau TXT.')
  const entries:SagaJournalEntry[]=rows.map((row,index)=>({
    date:date(find(row,['data','data document','data articol'])),documentNumber:text(find(row,['document','nr document','numar document','nrdoc'])),description:text(find(row,['explicatie','descriere','denumire','detalii']))||`Import SAGA rând ${index+2}`,
    lines:[
      {accountCode:text(find(row,['cont debitor','cont debit','debit account'])),debit:number(find(row,['suma','valoare','debit'])),credit:0,explanation:text(find(row,['explicatie','descriere','detalii']))},
      {accountCode:text(find(row,['cont creditor','cont credit','credit account'])),debit:0,credit:number(find(row,['suma','valoare','credit'])),explanation:text(find(row,['explicatie','descriere','detalii']))},
    ],
  })).filter(entry=>entry.date||entry.documentNumber||entry.lines.some(line=>line.accountCode))
  const errors:string[]=[];entries.forEach((entry,index)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date))errors.push(`Rând ${index+2}: data lipsește sau este invalidă.`);if(entry.lines.some(line=>!/^\d{3,}(?:[.][A-Za-z0-9_-]+)?$/.test(line.accountCode)))errors.push(`Rând ${index+2}: cont debitor/creditor invalid.`);const amount=entry.lines[0].debit;if(amount<=0||Math.abs(amount-entry.lines[1].credit)>0.009)errors.push(`Rând ${index+2}: suma trebuie să fie pozitivă și echilibrată.`)})
  if(!entries.length)throw new Error('Nu au fost identificate articole contabile în fișier.')
  return {entries,errors}
}
