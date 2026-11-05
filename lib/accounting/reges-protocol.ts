import { XMLParser, XMLValidator } from 'fast-xml-parser'

import type { RegesMessage } from './reges-shared'
export * from './reges-shared'

const guid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
const zeroGuid = '00000000-0000-0000-0000-000000000000'
type RecordValue = Record<string,unknown>
function record(value:unknown):RecordValue { return value && typeof value==='object' && !Array.isArray(value) ? value as RecordValue : {} }
function field(value:unknown,key:string) { return Object.entries(record(value)).find(([name]) => name.toLowerCase()===key.toLowerCase())?.[1] }
function text(value:unknown) { return typeof value==='string' ? value : null }
function id(value:unknown) { const valueText=text(value); return valueText && guid.test(valueText) && valueText!==zeroGuid ? valueText.toLowerCase() : null }

// Extract only the documented MessageResponse / MessageResult envelope. This is
// deliberately not an XSD validator, and HTTP success is not business success.
export function parseRegesMessage(source:string):RegesMessage|null {
  if (!source.trim() || /<!DOCTYPE|<!ENTITY/i.test(source)) return null
  let envelope:unknown
  try {
    if (source.trimStart().startsWith('<')) {
      if (XMLValidator.validate(source)!==true) return null
      const parsed = new XMLParser({removeNSPrefix:true,ignoreAttributes:false,parseTagValue:false}).parse(source)
      envelope = field(parsed,'MessageResult') || field(parsed,'MessageResponse') || field(parsed,'Message')
    } else envelope=JSON.parse(source)
  } catch { return null }
  const responseId=id(field(envelope,'ResponseId'))
  if (!responseId) return null
  const result=field(envelope,'Result')
  const related=field(result,'RelatedResultsExpected')
  if (result && (!['SUCCES','FAIL'].includes(String(field(result,'Code'))) || !['SUCCES','WARNING','ERROR'].includes(String(field(result,'CodeType'))) || ![true,false,'true','false','1','0'].includes(related as boolean|string))) return null
  return { kind:result ? 'result':'receipt', responseId, messageId:id(field(field(envelope,'Header'),'MessageId')),
    code:text(field(result,'Code')),codeType:text(field(result,'CodeType')),description:text(field(result,'Description')),
    ref:id(field(result,'Ref')),secondaryRef:id(field(result,'SecRef')),
    relatedResultsExpected:related===true||related==='true'||related==='1' ? true : related===false||related==='false'||related==='0' ? false : null }
}

export function parseNomenclature(source:unknown) {
  if (!Array.isArray(source) || !source.every(value => value && typeof value==='object' && !Array.isArray(value) && Object.hasOwn(value,'id'))) throw new Error('Format de nomenclator REGES neașteptat. Lista salvată nu a fost înlocuită.')
  return source as Array<Record<string,unknown>>
}
