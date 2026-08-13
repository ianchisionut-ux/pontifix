export type BrowserAtrResult = {
  customerName: string
  customerPhone: string
  workAddress: string
  atrNumber: string
  atrDate: string
  confidence: number
  source: 'PDF_TEXT' | 'LOCAL_OCR'
}

function clean(value = '') {
  return value.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()
}

function extract(text: string, source: BrowserAtrResult['source']): BrowserAtrResult {
  const normalized = clean(text)
  const namePatterns = [
    /adresat[ăa]\s+de\s+(.{3,100}?),\s+pentru\b/i,
    /aparține\s+utilizatorului\s+(.{3,100}?)(?:\s+cu\s+domiciliul|,)/i,
    /utilizator(?:ul)?\s*[:\-]\s*(.{3,100}?)(?:,|\n)/i,
  ]
  const nameMatch = namePatterns.map((pattern) => normalized.match(pattern)).find(Boolean)
  const phoneMatch = normalized.match(/\btelefon\s*[:\-]?\s*((?:\+?40|0)[\d .()\/-]{8,18})/i)
  const atrMatch = normalized.match(/AVIZ\s+TEHNIC\s+DE\s+RACORDARE[\s\S]{0,180}?Nr\.?\s*([\w./-]+)\s+din\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i)
  const addressMatch = normalized.match(/amplasat\(ă\)\s+în\s+(.{10,260}?)(?:,?\s+nr\.?\s+cadastral|,?\s+în\s+condițiile|\.\s*1\.)/i)
    || normalized.match(/cu\s+domiciliul\s+în\s+(.{10,260}?)(?:,?\s+telefon\b)/i)
  const customerName = clean(nameMatch?.[1] || '').replace(/\s+(?:CU DOMICILIUL|PENTRU).*$/i, '')
  const customerPhone = clean(phoneMatch?.[1] || '').replace(/[^+\d]/g, '')
  const workAddress = clean(addressMatch?.[1] || '')
  const found = [customerName, customerPhone, workAddress, atrMatch?.[1]].filter(Boolean).length
  return {
    customerName,
    customerPhone,
    workAddress,
    atrNumber: clean(atrMatch?.[1] || ''),
    atrDate: clean(atrMatch?.[2] || ''),
    confidence: Math.min(.98, .35 + found * .15 + (customerName && customerPhone ? .2 : 0)),
    source,
  }
}

export async function analyzeAtrInBrowser(file: File, onProgress?: (message: string) => void): Promise<BrowserAtrResult> {
  onProgress?.('Citesc prima pagină a ATR-ului…')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const textContent = await page.getTextContent()
  const embeddedText = textContent.items.map((item) => 'str' in item ? item.str : '').join(' ')
  let result = extract(embeddedText, 'PDF_TEXT')
  if (result.customerName && result.customerPhone) return result

  onProgress?.('Document scanat: recunosc local textul, fără încărcare externă…')
  const viewport = page.getViewport({ scale: 2.25 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Browserul nu permite procesarea imaginii ATR.')
  await page.render({ canvasContext: context, viewport, canvas }).promise
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('ron+eng', 1, {
    logger: (event) => {
      if (event.status === 'recognizing text') onProgress?.(`OCR local: ${Math.round((event.progress || 0) * 100)}%`)
    },
  })
  try {
    const recognized = await worker.recognize(canvas)
    result = extract(recognized.data.text, 'LOCAL_OCR')
  } finally {
    await worker.terminate()
  }
  return result
}

