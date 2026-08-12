import './globals.css'

export const metadata = {
  title: 'Pontifix — Pontaj și prezență',
  description: 'Pontaj, prezență și statistici pentru echipe.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ro"><body>{children}</body></html>
}