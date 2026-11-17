import assert from 'node:assert/strict'
import { parseSagaJournalFile, sagaJournalEntrySourceKeys } from '../lib/accounting/saga-journal-import.ts'

const valid=new File(['Data;Document;Explicatie;Cont debitor;Cont creditor;Suma\n24.09.2026;NC-10;Consum materiale;6028;3028;1.234,50'], 'registru.csv',{type:'text/csv'})
const parsed=await parseSagaJournalFile(valid)
assert.equal(parsed.entries.length,1)
assert.equal(parsed.errors.length,0)
assert.equal(parsed.entries[0].date,'2026-09-24')
assert.equal(parsed.entries[0].lines[0].accountCode,'6028')
assert.equal(parsed.entries[0].lines[0].debit,1234.5)
assert.equal(parsed.entries[0].lines[1].credit,1234.5)

const integerThousands=new File(['Data;Document;Explicatie;Cont debitor;Cont creditor;Suma\n24.09.2026;NC-12;Consum materiale;6028;3028;1.234'], 'registru-mii.csv',{type:'text/csv'})
const integerParsed=await parseSagaJournalFile(integerThousands)
assert.equal(integerParsed.errors.length,0)
assert.equal(integerParsed.entries[0].lines[0].debit,1234)
assert.equal(integerParsed.entries[0].lines[1].credit,1234)

const invalid=new File(['Data;Document;Explicatie;Cont debitor;Cont creditor;Suma\ninvalid;NC-11;Test;X;401;-2'], 'invalid.csv',{type:'text/csv'})
const rejected=await parseSagaJournalFile(invalid)
assert.ok(rejected.errors.some(error=>error.includes('data')))
assert.ok(rejected.errors.some(error=>error.includes('cont')))
assert.ok(rejected.errors.some(error=>error.includes('suma')))

const rowA=parsed.entries[0]
const rowB={...rowA,documentNumber:'NC-20',description:'Alt articol'}
const rowC={...rowA,documentNumber:'NC-30',description:'Articol nou'}
const originalKeys=sagaJournalEntrySourceKeys([rowA,rowB])
const reorderedOverlapKeys=sagaJournalEntrySourceKeys([rowB,rowC,rowA])
assert.equal(reorderedOverlapKeys[0],originalKeys[1], 'Reordering an exported row must preserve its source key')
assert.equal(reorderedOverlapKeys[2],originalKeys[0], 'Overlapping rows from another export must remain idempotent')
assert.ok(!originalKeys.includes(reorderedOverlapKeys[1]), 'A genuinely new row must receive a new source key')

const duplicateKeys=sagaJournalEntrySourceKeys([rowA,rowA])
const duplicateReexportKeys=sagaJournalEntrySourceKeys([rowA,rowA])
assert.equal(duplicateKeys[0],originalKeys[0], 'The first occurrence keeps the stable content key')
assert.notEqual(duplicateKeys[0],duplicateKeys[1], 'Legitimate identical rows must have distinct occurrence keys')
assert.deepEqual(duplicateReexportKeys,duplicateKeys, 'Re-exporting identical duplicates must be idempotent by occurrence ordinal')

const normalizedRow={...rowA,documentNumber:' nc-10 ',description:'Consum   materiale',lines:rowA.lines.map(line=>({...line,accountCode:` ${line.accountCode} `}))}
assert.equal(sagaJournalEntrySourceKeys([normalizedRow])[0],originalKeys[0], 'Harmless spacing and account casing must not change a row key')
console.log('SAGA journal import parser tests passed.')
