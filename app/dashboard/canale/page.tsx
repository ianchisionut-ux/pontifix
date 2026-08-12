import { redirect } from 'next/navigation'

// pagina "Canale" a fost mutată în Setări — păstrăm ruta veche ca redirect,
// pentru orice link/favorite salvat anterior
export default function CanaleRedirect() {
  redirect('/dashboard/setari')
}
