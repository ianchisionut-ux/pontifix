function freshMessages(payload, seen) {
  if (!payload || !Array.isArray(payload.items) || typeof payload.serverTime !== 'string') return null
  if (!Number.isFinite(Date.parse(payload.serverTime))) return null
  const fresh = []
  for (const item of payload.items) {
    if (typeof item?.id !== 'string' || typeof item?.text !== 'string' || seen.has(item.id)) continue
    seen.add(item.id)
    fresh.push({ id: item.id, sender: typeof item.senderName === 'string' ? item.senderName : 'Un coleg', text: item.text })
  }
  if (seen.size > 500) {
    for (const id of [...seen].slice(0, seen.size - 300)) seen.delete(id)
  }
  return { fresh, serverTime: payload.serverTime }
}

module.exports = { freshMessages }
