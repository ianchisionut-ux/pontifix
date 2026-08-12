// fetch cu timeout la nivel de client — plasă de siguranță suplimentară, ca niciun
// formular să nu rămână blocat la nesfârșit dacă serverul nu răspunde deloc dintr-un
// motiv neprevăzut (rețea, funcție serverless înghețată etc.)
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
