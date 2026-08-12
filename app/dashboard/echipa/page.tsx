import { redirect } from 'next/navigation'

// pagina "Echipă" a fost mutată în Setări — păstrăm ruta veche ca redirect
export default function EchipaRedirect() {
  redirect('/dashboard/setari')
}
