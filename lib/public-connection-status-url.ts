const NIB_PATTERN = /^NIB-\d{4}-\d{4,}$/

export function publicConnectionStatusUrl(appUrl: string, nib: string) {
  const normalizedNib = nib.trim().toUpperCase()
  return `${appUrl.replace(/\/$/, '')}/?nib=${encodeURIComponent(normalizedNib)}#verifica-bransament`
}

export function nibFromPublicConnectionSearch(search: string) {
  const nib = new URLSearchParams(search).get('nib')?.trim().toUpperCase() || ''
  return NIB_PATTERN.test(nib) ? nib : ''
}
