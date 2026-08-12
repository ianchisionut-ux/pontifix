'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

export default function BusinessPhotosUploader({
  heroImageUrl,
  gallery,
}: {
  heroImageUrl: string | null
  gallery: { id: string; url: string }[]
}) {
  const router = useRouter()
  const [dragging, setDragging] = useState<'hero' | 'gallery' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const heroInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File, kind: 'hero' | 'gallery') {
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kind)

    try {
      const res = await fetchWithTimeout('/api/business/photos', { method: 'POST', body: formData }, 60000)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Eroare la încărcare.')
        return
      }
      router.refresh()
    } catch {
      setError('Conexiune eșuată sau upload prea lent. Verifică internetul și încearcă din nou.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent, kind: 'hero' | 'gallery') {
    e.preventDefault()
    setDragging(null)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file, kind)
  }

  async function removeHero() {
    if (!confirm('Ștergi poza de copertă?')) return
    try {
      await fetchWithTimeout('/api/business/photos/hero', { method: 'DELETE' })
      router.refresh()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    }
  }

  async function removeGalleryPhoto(id: string) {
    if (!confirm('Ștergi această poză?')) return
    try {
      await fetchWithTimeout(`/api/business/photos/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="font-medium mb-1">Poze profil</h2>
      <p className="text-sm text-gray-500 mb-4">
        Poza de copertă apare pe pagina ta publică. Poți adăuga și câteva poze suplimentare (galerie).
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Hero ── */}
        <div>
          <p className="text-sm text-gray-500 mb-2">Poză copertă</p>
          {heroImageUrl ? (
            <div className="relative rounded-xl overflow-hidden aspect-video">
              <Image src={heroImageUrl} alt="Copertă" fill className="object-cover" quality={95} />
              <button
                onClick={removeHero}
                className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-xs shadow"
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging('hero')
              }}
              onDragLeave={() => setDragging(null)}
              onDrop={(e) => handleDrop(e, 'hero')}
              onClick={() => heroInputRef.current?.click()}
              className="aspect-video rounded-xl border-2 border-dashed flex items-center justify-center text-sm text-gray-400 cursor-pointer transition"
              style={{ borderColor: dragging === 'hero' ? 'var(--accent)' : 'var(--border-soft)' }}
            >
              {uploading ? 'Se încarcă...' : 'Trage o poză aici sau apasă pentru a alege'}
            </div>
          )}
          <input
            ref={heroInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'hero')}
          />
        </div>

        {/* ── Galerie ── */}
        <div>
          <p className="text-sm text-gray-500 mb-2">Galerie ({gallery.length})</p>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging('gallery')
            }}
            onDragLeave={() => setDragging(null)}
            onDrop={(e) => handleDrop(e, 'gallery')}
            onClick={() => galleryInputRef.current?.click()}
            className="aspect-video rounded-xl border-2 border-dashed flex items-center justify-center text-sm text-gray-400 cursor-pointer transition"
            style={{ borderColor: dragging === 'gallery' ? 'var(--accent)' : 'var(--border-soft)' }}
          >
            {uploading ? 'Se încarcă...' : '+ Adaugă poză'}
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'gallery')}
          />
        </div>
      </div>

      {gallery.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
          {gallery.map((photo) => (
            <div key={photo.id} className="relative rounded-lg overflow-hidden aspect-square">
              <Image src={photo.url} alt="" fill className="object-cover" quality={90} />
              <button
                onClick={() => removeGalleryPhoto(photo.id)}
                className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
