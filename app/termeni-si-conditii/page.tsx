import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Termeni și condiții | Elmont',
  description: 'Termenii și condițiile de utilizare a platformei Elmont.',
}

export default function TermsPage() {
  return <LegalPage
    title="Termeni și condiții"
    description="Acești termeni reglementează accesul și utilizarea platformei Elmont, aplicație pentru pontaj, administrarea angajaților și gestiunea proiectelor."
    updatedAt="13 august 2026"
    sections={[
      { title: 'Operatorul și acceptarea termenilor', content: <>
        <p>Elmont este platforma utilizată de Elmont S.A. pentru organizarea activităților interne. Prin accesarea sau utilizarea platformei confirmați că ați citit și acceptați acești termeni.</p>
        <p>Dacă utilizați Elmont în numele unei organizații, confirmați că aveți dreptul de a folosi contul și funcțiile puse la dispoziție de aceasta.</p>
      </> },
      { title: 'Scopul platformei', content: <>
        <p>Elmont oferă instrumente pentru evidența timpului de lucru și a prezenței, administrarea angajaților și concediilor, rapoarte, documente și proiecte. Platforma poate include integrarea WhatsApp pentru transmiterea manuală a actualizărilor despre proiecte către beneficiari.</p>
        <p>Funcționalitățile pot fi modificate sau îmbunătățite pentru securitate, conformitate și buna funcționare a serviciului.</p>
      </> },
      { title: 'Conturi și acces', content: <>
        <p>Accesul este permis numai utilizatorilor autorizați. Datele de autentificare sunt personale și nu trebuie comunicate altor persoane. Utilizatorul trebuie să anunțe imediat administratorul dacă suspectează accesarea neautorizată a contului.</p>
        <p>Drepturile diferă în funcție de rol. Administratorii răspund pentru configurarea utilizatorilor și pentru corectitudinea informațiilor introduse în platformă.</p>
      </> },
      { title: 'Utilizare permisă', content: <>
        <p>Platforma trebuie utilizată numai în scopuri profesionale, legale și conforme cu atribuțiile utilizatorului. Sunt interzise accesul neautorizat, încercarea de afectare a securității, încărcarea de conținut ilegal sau malițios și folosirea datelor în alte scopuri decât cele aprobate.</p>
        <p>Documentele încărcate trebuie să fie relevante pentru activitatea organizației, iar utilizatorul trebuie să aibă dreptul de a le prelucra.</p>
      </> },
      { title: 'Pontaje, rapoarte și proiecte', content: <>
        <p>Pontajele, concediile, stadiile proiectelor și rapoartele sunt generate pe baza informațiilor introduse sau confirmate de utilizatori. Administratorii trebuie să verifice datele înainte de folosirea lor în documente oficiale sau în comunicări către beneficiari.</p>
        <p>Elmont este un instrument de evidență și organizare; nu înlocuiește verificarea umană, consultanța juridică, contabilă sau de resurse umane.</p>
      </> },
      { title: 'Documente și servicii terțe', content: <>
        <p>Platforma poate utiliza servicii terțe pentru găzduire, baze de date, stocarea documentelor, autentificare, email și WhatsApp Business Platform. Utilizarea acestor funcții poate fi supusă și regulilor furnizorilor respectivi.</p>
        <p>Disponibilitatea unei integrări poate depinde de aprobări, limite sau întreruperi aflate în afara controlului Elmont.</p>
      </> },
      { title: 'Disponibilitate și securitate', content: <>
        <p>Sunt aplicate măsuri rezonabile pentru protejarea și disponibilitatea platformei. Totuși, funcționarea neîntreruptă nu poate fi garantată în cazul mentenanței, incidentelor tehnice sau indisponibilității furnizorilor externi.</p>
        <p>Accesul poate fi suspendat dacă există un risc de securitate, o utilizare necorespunzătoare sau încetarea relației care justifica accesul.</p>
      </> },
      { title: 'Răspundere', content: <>
        <p>Utilizatorii răspund pentru exactitatea datelor introduse și pentru acțiunile efectuate din conturile lor. În limitele permise de lege, operatorul nu răspunde pentru prejudicii rezultate din date greșite introduse de utilizatori, utilizarea neautorizată a conturilor ori indisponibilitatea serviciilor terțe.</p>
      </> },
      { title: 'Modificarea termenilor', content: <>
        <p>Termenii pot fi actualizați pentru a reflecta schimbări ale platformei sau ale cerințelor legale. Versiunea aplicabilă și data actualizării sunt publicate pe această pagină.</p>
      </> },
      { title: 'Contact', content: <>
        <p>Pentru întrebări privind acești termeni sau utilizarea Elmont ne puteți contacta la <a className="font-semibold text-blue-600 hover:underline" href="mailto:elmont_zalau@yahoo.com">elmont_zalau@yahoo.com</a>.</p>
      </> },
    ]}
  />
}
