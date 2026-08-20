export type IdentityCardData = {
  fullName: string
  cnp: string
  series: string
  number: string
  domicile: string
  issuedBy: string
  validFrom: string
  validUntil: string
}

function clean(value = '') { return value.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim() }
function fold(value = '') { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '') }

function labeled(lines: string[], label: RegExp) {
  for (let index = 0; index < lines.length; index++) {
    if (!label.test(lines[index])) continue
    const inline = clean(lines[index].replace(label, '').replace(/^\s*[:/.-]+\s*/, ''))
    if (inline.length > 1) return inline
    return clean(lines[index + 1] || '')
  }
  return ''
}

export function extractIdentityCardText(rawText: string): IdentityCardData {
  const text = fold(rawText).replace(/[|]/g, 'I')
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean)
  const joined = lines.join('\n')
  const cnp = (joined.match(/(?:CNP|COD\s+NUMERIC\s+PERSONAL)?\s*[:.-]?\s*([1-8](?:[\s.-]?\d){12})/i)?.[1] || '').replace(/\D/g, '')
  const seriesNumber = joined.match(/(?:SERIA|SERIE|SERIES?)\s*[:.-]?\s*([A-Z]{2})\s*(?:NR\.?|NO\.?)?\s*[:.-]?\s*(\d{6})/i)
    || joined.match(/\b([A-Z]{2})\s*(\d{6})\b/)
  const mrzName = joined.match(/IDROU([A-Z]+)<<([A-Z<]+)/i)
  const surname = mrzName?.[1] || labeled(lines, /\bNUME(?:\s*\/\s*NOM)?(?:\s*\/\s*LAST\s*NAME)?\b/i)
  const given = mrzName?.[2]?.replace(/<+/g, ' ') || labeled(lines, /\bPRENUME(?:\s*\/\s*PRENOM)?(?:\s*\/\s*FIRST\s*NAME)?\b/i)
  const fallbackName = labeled(lines, /\bNUME\s+SI\s+PRENUME\b/i)
  const validity = joined.match(/(?:VALABILITATE|VALIDITY|VALIDITE)[^\d]{0,60}(\d{2}[.\/-]\d{2}[.\/-]\d{2,4})\s*[-–]\s*(\d{2}[.\/-]\d{2}[.\/-]\d{2,4})/i)
  const dates = [...joined.matchAll(/\b\d{2}[.\/-]\d{2}[.\/-]\d{2,4}\b/g)].map((match) => match[0])
  const domicileBlock = joined.match(/DOMICILIU(?:\s*\/\s*ADRESSE)?(?:\s*\/\s*ADDRESS)?([\s\S]{3,260}?)(?=EMISA\s+DE|DELIVREE\s+PAR|ISSUED\s*BY)/i)?.[1] || ''
  const domicileStart = domicileBlock.search(/\b(?:JUD\.?|MUN\.?|ORAS|COM\.?|SAT|STR\.?)\b/i)
  const domicile = clean(domicileStart >= 0 ? domicileBlock.slice(domicileStart) : labeled(lines, /\bDOMICILIU(?:\s*\/\s*ADRESSE)?(?:\s*\/\s*ADDRESS)?\b/i))
  const issuedBy = clean(joined.match(/\b((?:SPCLEP|SPCRPCIV|DLEP|DEPABD)\s+[A-Z][A-Z .-]{1,60})/i)?.[1] || labeled(lines, /\bEMISA\s+DE(?:\s*\/\s*DELIVREE\s+PAR)?(?:\s*\/\s*ISSUED\s*BY)?\b/i))
  return {
    fullName: clean([surname, given].filter(Boolean).join(' ') || fallbackName),
    cnp,
    series: seriesNumber?.[1] || '',
    number: seriesNumber?.[2] || '',
    domicile,
    issuedBy,
    validFrom: validity?.[1] || dates.at(-2) || '',
    validUntil: validity?.[2] || dates.at(-1) || '',
  }
}

async function imageCanvas(file: File) {
  if (file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 3 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true })!, viewport, canvas }).promise
    return canvas
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image(); image.src = url; await image.decode()
    const scale = Math.min(3, Math.max(1, 2200 / Math.max(image.width, image.height)))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index] * .3 + pixels.data[index + 1] * .59 + pixels.data[index + 2] * .11
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128))
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = contrasted
    }
    context.putImageData(pixels, 0, 0)
    return canvas
  } finally { URL.revokeObjectURL(url) }
}

export async function analyzeIdentityCardInBrowser(file: File, onProgress?: (message: string) => void) {
  onProgress?.('Pregătesc imaginea local…')
  const canvas = await imageCanvas(file)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('ron+eng', 1, { logger: (event) => {
    if (event.status === 'recognizing text') onProgress?.(`Citesc CI: ${Math.round((event.progress || 0) * 100)}%`)
  } })
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const result = await worker.recognize(canvas)
    return extractIdentityCardText(result.data.text)
  } finally { await worker.terminate() }
}