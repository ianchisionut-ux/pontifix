export const regesEndpoints = {
  test: { api:'https://api.dev.inspectiamuncii.org', auth:'https://sso.dev.inspectiamuncii.org/realms/API/protocol/openid-connect/token' },
  production: { api:'https://api.inspectiamuncii.ro', auth:'https://sso.inspectiamuncii.ro/realms/API/protocol/openid-connect/token' },
} as const
export type RegesEnvironment = keyof typeof regesEndpoints
export const regesEntities = ['Salariat','Contract','PropunereDetasareContract','PropunereMutareContract'] as const
const entityPaths = { Salariat:'/api/Salariat', Contract:'/api/Contract', PropunereDetasareContract:'/api/Detasare/Propunere', PropunereMutareContract:'/api/Mutare/Propunere' }
export function regesUploadPath(entity: typeof regesEntities[number]) { return entityPaths[entity] }
export const regesNomenclatures = ['Cor','DomeniuActivitate','TipSporPredefinit','Nationalitate','Judet','Localitate','StareContractMunca','TipContractMunca','TipNorma','NormaTimpMunca','TemeiSuspendare','TemeiIncetare','TipLocMunca','Moneda'] as const

export type RegesMessage = {
  kind:'receipt'|'result'; messageId:string|null; responseId:string; code:string|null; codeType:string|null;
  description:string|null; ref:string|null; secondaryRef:string|null; relatedResultsExpected:boolean|null;
}
export function regesResultLabel(value:RegesMessage|null) {
  if (!value) return 'Rezultat neidentificat'
  if (value.kind==='receipt') return 'Recipisă primită · în procesare'
  if (value.code==='FAIL' || value.codeType==='ERROR') return 'Procesare respinsă'
  if (value.relatedResultsExpected!==false) return 'Mai sunt rezultate de verificat'
  if (value.codeType==='WARNING') return 'Procesat cu avertisment'
  return value.code==='SUCCES' ? 'Procesat cu succes' : 'Rezultat de verificat'
}

