import './globals.css'

export const metadata = {
  metadataBase: new URL('https://elmontz.vercel.app'),
  title: 'Elmont S.A. — Proiectare și execuție instalații electrice',
  description: 'Proiectare și execuție rețele electrice, branșamente și posturi de transformare 0,4–20 kV. Elmont S.A., Zalău, din 1997.',
  openGraph: { title: 'Elmont S.A. — Putere pentru proiecte reale', description: 'Proiectare, execuție și mentenanță pentru infrastructură electrică 0,4–20 kV.', url: 'https://elmontz.vercel.app', siteName: 'Elmont S.A.', locale: 'ro_RO', type: 'website', images: [{ url: '/og.png', width: 1732, height: 908, alt: 'Elmont S.A. — Putere pentru proiecte reale' }] },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ro"><body>{children}</body></html>
}