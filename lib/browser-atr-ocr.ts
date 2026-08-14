export type BrowserAtrResult = {
  customerName: string
  customerPhone: string
  workAddress: string
  atrNumber: string
  atrDate: string
  pta: string
  solution: string
  confidence: number
  source: 'PDF_TEXT' | 'LOCAL_OCR'
}

function clean(value = '') {
  return value.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()
}

function fold(value = '') {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function extractAtrText(text: string, source: BrowserAtrResult['source']): BrowserAtrResult {
  const normalized = fold(text)
  const namePatterns = [
    /adresata\s+de\s+(.{3,100}?),\s+pentru\b/i,
    /apartine\s+utilizatorului\s+(.{3,100}?)(?:\s+cu\s+domiciliul|,)/i,
    /utilizator(?:ul)?\s*[:\-]\s*(.{3,100}?)(?:,|\n)/i,
  ]
  const nameMatch = namePatterns.map((pattern) => normalized.match(pattern)).find(Boolean)
  const phoneMatch = normalized.match(/\btelefon\s*[:\-]?\s*((?:\+?40|0)[\d .()\/-]{8,18})/i)
  const atrMatch = normalized.match(/AVIZ\s+TEHNIC\s+DE\s+RACORDARE[\s\S]{0,220}?Nr\.?\s*([\w./-]+)\s+din\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i)
  const addressMatch = normalized.match(/amplasat\(a\)\s+in\s+(.{10,260}?)(?:,?\s+nr\.?\s+cadastral|,?\s+in\s+conditiile|\.\s*1\.)/i)
    || normalized.match(/cu\s+domiciliul\s+in\s+(.{10,260}?)(?:,?\s+telefon\b)/i)

  const ptaMatch = normalized.match(/\b((?:PTA|PTZ)\s*[:\-]?\s*[A-Z0-9][A-Z0-9 _./-]{2,100}?)(?=\s*,?\s*\d{1,2}(?:[.,/]\d+)+\s*kV|\s+[b-dc][')]?\s+|$)/i)
    || normalized.match(/(?:sursa|punctul)\s+de\s+alimentare\s*[:\-]?\s*((?:PTA|PTZ)[A-Z0-9 _./-]{2,100})/i)

  const solutionPatterns = [
    /(?:c\)|c\.)\s*Lucrari\s+pentru\s+realizarea\s+instalatiei\s+de\s+racordare\s*:\s*(.{20,1800}?)(?=\s+c\s*[’']?\)\s*Lucrari|\s+d\)\s*Lucrari|\s+e\)\s*Punctul|\s+3\.\s*\(1\)|$)/i,
    /Descrierea\s+succinta\s+a\s+solutiei\s+de\s+racordare[\s\S]{0,260}?(?:a\)\s*)?(Punctul\s+de\s+racordare.{20,1800}?)(?=\s+3\.\s*\(1\)|$)/i,
    /solutia\s+(?:tehnica\s+)?(?:de\s+racordare)?\s*(?:este|propusa)?\s*[:\-]\s*(.{20,1800}?)(?=\s+punctul\s+de\s+delimitare|\s+masurarea\s+energiei|\s+3\.\s*\(1\)|$)/i,
  ]
  const solutionMatch = solutionPatterns.map((pattern) => normalized.match(pattern)).find(Boolean)

  const customerName = clean(nameMatch?.[1] || '').replace(/\s+(?:CU DOMICILIUL|PENTRU).*$/i, '')
  const customerPhone = clean(phoneMatch?.[1] || '').replace(/[^+\d]/g, '')
  const workAddress = clean(addressMatch?.[1] || '')
  const pta = clean(ptaMatch?.[1] || '')
  const solution = clean(solutionMatch?.[1] || '')
  const found = [customerName, customerPhone, workAddress, atrMatch?.[1], pta, solution].filter(Boolean).length
  return {
    customerName,
    customerPhone,
    workAddress,
    atrNumber: clean(atrMatch?.[1] || ''),
    atrDate: clean(atrMatch?.[2] || ''),
    pta,
    solution,
    confidence: Math.min(.99, .3 + found * .11 + (customerName && customerPhone ? .18 : 0) + (pta && solution ? .12 : 0)),
    source,
  }
}

async function pageText(pdf: Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>>['promise'] extends Promise<infer T> ? T : never, pageNumber: number) {
  const page = await pdf.getPage(pageNumber)
  const content = await page.getTextContent()
  return content.items.map((item) => 'str' in item ? item.str : '').join('\n')
}

export async function analyzeAtrInBrowser(file: File, onProgress?: (message: string) => void): Promise<BrowserAtrResult> {
  onProgress?.('Citesc primele două pagini ale ATR-ului…')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pageCount = Math.min(pdf.numPages, 2)
  const embeddedPages: string[] = []
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) embeddedPages.push(await pageText(pdf, pageNumber))
  let result = extractAtrText(embeddedPages.join('\n'), 'PDF_TEXT')
  if (result.customerName && result.customerPhone && result.pta && result.solution) return result

  const pagesToOcr = new Set<number>()
  if (!result.customerName || !result.customerPhone) pagesToOcr.add(1)
  if ((!result.pta || !result.solution) && pageCount >= 2) pagesToOcr.add(2)
  if (!pagesToOcr.size) return result

  onProgress?.('Verific local zonele tehnice din ATR...')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('ron+eng', 1, {
    logger: (event) => {
      if (event.status === 'recognizing text') onProgress?.(`OCR local: ${Math.round((event.progress || 0) * 100)}%`)
    },
  })
  const ocrPages: string[] = []
  try {
    for (const pageNumber of pagesToOcr) {
      onProgress?.(`OCR local: pagina ${pageNumber} din ${pageCount}...`)
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: pageNumber === 2 ? 2.65 : 2.35 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Browserul nu permite procesarea imaginii ATR.')
      await page.render({ canvasContext: context, viewport, canvas }).promise
      const recognized = await worker.recognize(canvas)
      ocrPages.push(recognized.data.text)
    }
  } finally {
    await worker.terminate()
  }
  result = extractAtrText([...embeddedPages, ...ocrPages].join('\n'), 'LOCAL_OCR')
  return result
}
