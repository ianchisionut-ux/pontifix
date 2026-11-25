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

function normalizeDate(value = '') {
  const match = value.match(/(\d{1,2})[.,/-](\d{1,2})[.,/-](\d{2,4})/)
  if (!match) return ''
  const day = Number(match[1]); const month = Number(match[2]); const shortYear = Number(match[3])
  const year = match[3].length === 2 ? (shortYear > 35 ? 1900 : 2000) + shortYear : shortYear
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

function validCnp(value: string) {
  if (!/^[1-9]\d{12}$/.test(value)) return false
  const key = '279146358279'
  const checksum = [...key].reduce((sum, digit, index) => sum + Number(digit) * Number(value[index]), 0) % 11
  return Number(value[12]) === (checksum === 10 ? 1 : checksum)
}

const OCR_DATE = '(\\d{1,2}[.,/-]\\d{1,2}[.,/-]\\d{2,4})'

function dateAfterLabel(text: string, label: RegExp) {
  const match = label.exec(text)
  if (!match) return ''
  const nearby = text.slice(match.index + match[0].length, match.index + match[0].length + 48)
  return normalizeDate(nearby.match(new RegExp(OCR_DATE))?.[1])
}

function identitySeriesNumber(text: string) {
  const labeled = text.match(/\bSERIA?\s*[:.\-]?\s*([A-Z]{2})\s*(?:NR\.?|NO\.?)?\s*[:.\-]?\s*(\d{6})\b/i)
  if (labeled) return [labeled[1].toUpperCase(), labeled[2]] as const
  // On older Romanian identity cards the machine-readable line starts with
  // the two-letter series and six-digit number, followed by a check digit.
  const mrz = text.match(/\b([A-Z2][A-Z5])([0-9OISB]{6})\s*[<]\s*\d?\s*ROU/i)
  if (mrz) return [mrz[1].toUpperCase().replace(/^2/, 'Z').replace(/5$/, 'S'), mrz[2].toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8')] as const
  const nearLabel = text.match(/\b(?:SERIA|SERIE)\s*[:.\-]?\s*([A-Z]{2})[\s\S]{0,25}?\b(?:NR\.?|NO\.?)?\s*[:.\-]?\s*(\d{6})\b/i)
  if (nearLabel) return [nearLabel[1].toUpperCase(), nearLabel[2]] as const
  return ['', ''] as const
}

function issuer(lines: string[]) {
  const office = /\b(?:SPC[L1I]EP|SPCRPCIV|DLEP|DEPABD|S[P]?CEP|SERVICIUL\s+PUBLIC\s+COMUNITAR)\b/i
  const trim = (value: string) => clean(value.split(/\b(?:VALABILITATE|VALIDITY|VALIDITE|EXPIRY|EXPIRARE|EMISA|ISSUED|DATA\s+EMITERII)\b|\d{1,2}[.,/-]\d{1,2}[.,/-]\d{2,4}/i)[0]).replace(/\s*[~–—-]\s*$/, '')
  const candidate = lines.find((line) => office.test(line))
  if (candidate) return trim(candidate.slice(candidate.search(office)))
  const labeledValue = labeled(lines, /\bEMISA\s+DE(?:\s*\/\s*DELIVREE\s+PAR)?(?:\s*\/\s*ISSUED\s*BY)?\b/i)
  const fallback = trim(labeledValue)
  return /^[A-Z][A-Z .-]{3,}$/i.test(fallback) && !/^(?:VALABILITATE|VALIDITY|VALIDITE|EXPIRY)$/i.test(fallback) ? fallback : ''
}

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
  const cnpCandidates = [...joined.matchAll(/\b[1-9](?:[\s.-]?\d){12}\b/g)].map((match) => match[0].replace(/\D/g, ''))
  const cnp = cnpCandidates.find(validCnp) || ''
  const [series, number] = identitySeriesNumber(joined)
  const mrzName = joined.match(/IDROU([A-Z]+)<<([A-Z]+)(?:<([A-Z]+))?/i)
  const surname = mrzName?.[1] || labeled(lines, /\bNUME(?:\s*\/\s*NOM)?(?:\s*\/\s*LAST\s*NAME)?\b/i)
  const given = mrzName ? [mrzName[2], mrzName[3]].filter(Boolean).join(' ') : labeled(lines, /\bPRENUME(?:\s*\/\s*PRENOM)?(?:\s*\/\s*FIRST\s*NAME)?\b/i)
  const fallbackName = labeled(lines, /\bNUME\s+SI\s+PRENUME\b/i)
  const validity = joined.match(/\b(\d{1,2}[.,/-]\d{1,2}[.,/-]\d{2,4})\s*[-–—~]\s*(\d{1,2}[.,/-]\d{1,2}[.,/-]\d{2,4})\b/)
  const domicileBlock = joined.match(/DOMICILIU(?:\s*\/\s*ADRESSE)?(?:\s*\/\s*ADDRESS)?([\s\S]{3,260}?)(?=EMISA\s+DE|DELIVREE\s+PAR|ISSUED\s*BY)/i)?.[1] || ''
  const domicileStart = domicileBlock.search(/\b(?:JUD\.?|MUN\.?|ORAS|COM\.?|SAT|STR\.?)\b/i)
  const domicileCandidate = clean(domicileStart >= 0 ? domicileBlock.slice(domicileStart) : labeled(lines, /\bDOMICILIU(?:\s*\/\s*ADRESSE)?(?:\s*\/\s*ADDRESS)?\b/i))
  const domicile = /[\\‘’|]/.test(domicileCandidate) || (domicileCandidate.match(/[A-Z]{3,}/gi)?.length || 0) < 2 ? '' : domicileCandidate
  const issuedBy = issuer(lines)
  const issueDate = normalizeDate(validity?.[1]) || dateAfterLabel(joined, /\b(?:EMISA\s+LA|ELIBERATA\s+LA|DATA\s+EMITERII|DATE\s+OF\s+ISSUE|ISSUE\s+DATE|ISSUED\b(?!\s*BY))\b/i)
  const expiryDate = normalizeDate(validity?.[2]) || dateAfterLabel(joined, /\b(?:VALABILA\s+PANA\s+LA|DATA\s+EXPIRARII|EXPIRY(?:\s+DATE)?|DATE\s+OF\s+EXPIRY|EXPIRES|VALID\s+UNTIL)\b/i)
  return {
    fullName: clean([surname, given].filter(Boolean).join(' ') || fallbackName),
    cnp,
    series,
    number,
    domicile,
    issuedBy,
    validFrom: issueDate,
    validUntil: expiryDate,
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

function focusedCardCrop(canvas: HTMLCanvasElement) {
  if (canvas.height < canvas.width * 1.15) return null
  const width = canvas.width; const height = canvas.height
  // Score a small preview instead of allocating another full-resolution image.
  const preview = document.createElement('canvas')
  const previewScale = Math.min(480 / width, 720 / height, 1)
  preview.width = Math.max(1, Math.round(width * previewScale))
  preview.height = Math.max(1, Math.round(height * previewScale))
  preview.getContext('2d', { willReadFrequently: true })?.drawImage(canvas, 0, 0, preview.width, preview.height)
  const pixels = preview.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, preview.width, preview.height).data
  if (!pixels) return null
  const sampleWidth = preview.width; const sampleHeight = preview.height
  const sampleCropWidth = Math.round(sampleWidth * .65); const sampleCropHeight = Math.round(sampleHeight * .55)
  const candidates = [
    { x: 0, y: 0 }, { x: sampleWidth - sampleCropWidth, y: 0 },
    { x: 0, y: sampleHeight - sampleCropHeight }, { x: sampleWidth - sampleCropWidth, y: sampleHeight - sampleCropHeight },
  ]
  let best = candidates[0]; let bestScore = 0
  for (const candidate of candidates) {
    let score = 0
    for (let y = candidate.y + 4; y < candidate.y + sampleCropHeight - 4; y += 4) {
      for (let x = candidate.x + 4; x < candidate.x + sampleCropWidth - 4; x += 4) {
        const index = (y * sampleWidth + x) * 4
        const red = pixels[index]; const green = pixels[index + 1]; const blue = pixels[index + 2]
        const spread = Math.max(red, green, blue) - Math.min(red, green, blue)
        if (spread > 28 && Math.min(red, green, blue) < 245) score += 3
        else if ((red + green + blue) / 3 < 180) score++
      }
    }
    if (score > bestScore) { best = candidate; bestScore = score }
  }
  if (!bestScore) return null
  const cropWidth = Math.round(width * .65); const cropHeight = Math.round(height * .55)
  const sourceX = best.x === 0 ? 0 : width - cropWidth
  const sourceY = best.y === 0 ? 0 : height - cropHeight
  const crop = document.createElement('canvas')
  crop.width = cropWidth; crop.height = cropHeight
  crop.getContext('2d', { willReadFrequently: true })?.drawImage(canvas, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return crop
}

export async function analyzeIdentityCardInBrowser(file: File, onProgress?: (message: string) => void) {
  onProgress?.('Pregătesc imaginea local…')
  const canvas = await imageCanvas(file)
  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('ron+eng', 1, { logger: (event) => {
    if (event.status === 'recognizing text') onProgress?.(`Citesc CI: ${Math.round((event.progress || 0) * 100)}%`)
  } })
  try {
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    const result = await worker.recognize(canvas)
    const extracted = extractIdentityCardText(result.data.text)
    if (extracted.fullName && extracted.cnp && extracted.series && extracted.number && extracted.issuedBy && extracted.validFrom && extracted.validUntil) return extracted
    const crop = focusedCardCrop(canvas)
    if (!crop) return extracted
    onProgress?.('Verific detaliile din zona cărții de identitate…')
    const focused = extractIdentityCardText((await worker.recognize(crop)).data.text)
    return { ...extracted, ...Object.fromEntries(Object.entries(focused).filter(([, value]) => value)) } as IdentityCardData
  } finally { await worker.terminate() }
}
