export async function geocodeAddress(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${address}, ${city}, România`)
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_MAPS_SERVER_API_KEY}`
  )
  const data = await res.json()
  const location = data.results?.[0]?.geometry?.location
  if (!location) return null
  return { lat: location.lat, lng: location.lng }
}
