export type RomanianAddressFields = {
  county: string
  city: string
  village: string
  street: string
  number: string
  block: string
  apartment: string
}

function capture(address: string, pattern: RegExp) {
  return address.match(pattern)?.[1]?.replace(/\s+/g, ' ').trim() || ''
}

export function parseRomanianAddress(address: string): RomanianAddressFields {
  const text = address.replace(/\s+/g, ' ').trim()
  const locality = capture(text, /(?:localitatea|loc\.)\s*([^,;]+)/i)
  return {
    county: capture(text, /(?:jud(?:ețul|etul|\.)?)\s*([^,;]+)/i),
    city: capture(text, /(?:mun(?:icipiul|\.)?|oraș(?:ul)?|oras(?:ul)?)\s*([^,;]+)/i) || locality,
    village: capture(text, /(?:sat(?:ul)?)\s*([^,;]+)/i),
    street: capture(text, /(?:strada|str\.)\s*([^,;]+)/i),
    number: capture(text, /\bnr\.?\s*(?!cadastral\b)([\w/-]+)/i),
    block: capture(text, /\bbl\.?\s*([\w/-]+)/i),
    apartment: capture(text, /\bap\.?\s*([\w/-]+)/i),
  }
}