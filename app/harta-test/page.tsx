'use client'

import { useEffect, useRef, useState } from 'react'

export default function HartaTestPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('pornire...')

  useEffect(() => {
    setStatus('se încarcă scriptul Google...')
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    script.async = true
    script.onload = () => {
      setStatus('script încărcat, creez harta...')
      try {
        // @ts-ignore
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 46.1667, lng: 21.3167 },
          zoom: 7,
        })
        setStatus('✓ harta creată cu succes, fără nicio eroare')
      } catch (err: any) {
        setStatus('✗ EROARE la creare: ' + err.message)
      }
    }
    script.onerror = () => setStatus('✗ scriptul Google nu s-a putut încărca deloc')
    document.head.appendChild(script)
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: '10px' }}>Test izolat hartă</h1>
      <p style={{ marginBottom: '20px', fontWeight: 'bold' }}>Status: {status}</p>
      <div
        ref={mapRef}
        style={{ width: '600px', height: '400px', border: '3px solid red', background: 'yellow' }}
      >
        (dacă vezi galben aici, harta nu s-a desenat peste acest fundal)
      </div>
    </div>
  )
}
