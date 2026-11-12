const ONES = ['', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă']
const TEENS = ['zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece']
const TENS = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci']

function underOneThousand(value: number, feminine = false): string {
  if (value === 0) return ''
  if (value < 10) return feminine && value === 1 ? 'una' : feminine && value === 2 ? 'două' : ONES[value]
  if (value < 20) return TEENS[value - 10]
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` și ${underOneThousand(value % 10, feminine)}` : ''}`
  const hundreds = Math.floor(value / 100)
  return `${hundreds === 1 ? 'o sută' : `${hundreds === 2 ? 'două' : ONES[hundreds]} sute`}${value % 100 ? ` ${underOneThousand(value % 100, feminine)}` : ''}`
}

function integerWords(value: number): string {
  if (value === 0) return 'zero'
  const parts: string[] = []
  for (const [divisor, singular, plural] of [
    [1_000_000_000, 'miliard', 'miliarde'],
    [1_000_000, 'milion', 'milioane'],
    [1_000, 'mie', 'mii'],
  ] as const) {
    const group = Math.floor(value / divisor)
    value %= divisor
    if (!group) continue
    if (group === 1) parts.push(divisor === 1_000 ? 'o mie' : `un ${singular}`)
    else parts.push(`${underOneThousand(group, true)}${group >= 20 ? ' de' : ''} ${plural}`)
  }
  if (value) parts.push(underOneThousand(value))
  return parts.join(' ')
}

export function connectionAmountToWordsRO(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100)
  if (!Number.isSafeInteger(cents)) throw new Error('Suma contractului este prea mare pentru conversia în litere.')
  const lei = Math.floor(cents / 100)
  const bani = cents % 100
  if (lei >= 1_000_000_000_000) throw new Error('Suma contractului este prea mare pentru conversia în litere.')
  return `${amount < 0 ? 'minus ' : ''}${integerWords(lei)}, ${String(bani).padStart(2, '0')}`
}
