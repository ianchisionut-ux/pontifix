import assert from 'node:assert/strict'
import { parseSagaJournalFile } from '../lib/accounting/saga-journal-import.ts'

const valid=new File(['Data;Document;Explicatie;Cont debitor;Cont creditor;Suma\n24.09.2026;NC-10;Consum materiale;6028;3028;1.234,50'], 'registru.csv',{type:'text/csv'})
const parsed=await parseSagaJournalFile(valid)
assert.equal(parsed.entries.length,1)
assert.equal(parsed.errors.length,0)
assert.equal(parsed.entries[0].date,'2026-09-24')
assert.equal(parsed.entries[0].lines[0].accountCode,'6028')
assert.equal(parsed.entries[0].lines[0].debit,1234.5)
assert.equal(parsed.entries[0].lines[1].credit,1234.5)

const invalid=new File(['Data;Document;Explicatie;Cont debitor;Cont creditor;Suma\ninvalid;NC-11;Test;X;401;-2'], 'invalid.csv',{type:'text/csv'})
const rejected=await parseSagaJournalFile(invalid)
assert.ok(rejected.errors.some(error=>error.includes('data')))
assert.ok(rejected.errors.some(error=>error.includes('cont')))
assert.ok(rejected.errors.some(error=>error.includes('suma')))
console.log('SAGA journal import parser tests passed.')
