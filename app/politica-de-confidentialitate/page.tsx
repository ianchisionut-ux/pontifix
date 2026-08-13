import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Politica de confidențialitate | Elmont',
  description: 'Informații privind prelucrarea datelor personale în platforma Elmont.',
}

export default function PrivacyPage() {
  return <LegalPage
    title="Politica de confidențialitate"
    description="Această politică explică ce date sunt prelucrate prin Elmont, de ce sunt necesare și ce drepturi au persoanele vizate."
    updatedAt="13 august 2026"
    sections={[
      { title: 'Cine prelucrează datele', content: <>
        <p>Elmont S.A. administrează utilizarea Elmont și stabilește scopurile prelucrării datelor introduse în platformă. Pentru întrebări privind confidențialitatea ne puteți contacta la <a className="font-semibold text-blue-600 hover:underline" href="mailto:elmont_zalau@yahoo.com">elmont_zalau@yahoo.com</a>.</p>
      </> },
      { title: 'Datele prelucrate', content: <>
        <p>În funcție de funcțiile utilizate, putem prelucra: nume și prenume, adresă de email, număr de telefon, funcție, departament, categorie profesională, program de lucru, pontaje, absențe și concedii.</p>
        <p>Pentru gestiunea proiectelor pot fi prelucrate denumirea și datele proiectului, datele beneficiarului, numărul de telefon, stadiile avizelor și documentele încărcate. Sunt prelucrate și date tehnice necesare autentificării, securității și diagnosticării erorilor.</p>
      </> },
      { title: 'Scopurile prelucrării', content: <>
        <p>Datele sunt utilizate pentru administrarea conturilor și a drepturilor de acces, evidența timpului de lucru, întocmirea foilor de prezență, gestionarea concediilor, realizarea rapoartelor și administrarea proiectelor și documentelor.</p>
        <p>Dacă integrarea WhatsApp este activată, datele de contact sunt utilizate numai la inițiativa unui utilizator autorizat pentru transmiterea unei actualizări despre proiectul beneficiarului.</p>
      </> },
      { title: 'Temeiurile prelucrării', content: <>
        <p>Prelucrarea poate avea la bază executarea contractului sau a raportului de muncă, îndeplinirea obligațiilor legale ale angajatorului, interesul legitim privind organizarea și securitatea activității și, când este necesar, consimțământul persoanei vizate.</p>
      </> },
      { title: 'Destinatari și furnizori', content: <>
        <p>Datele sunt accesibile numai utilizatorilor autorizați, conform rolurilor atribuite. Pentru funcționarea platformei putem utiliza furnizori de infrastructură și servicii precum Vercel pentru găzduire și stocare, Neon pentru baza de date, furnizori de email și Meta Platforms pentru WhatsApp Business Platform.</p>
        <p>Acești furnizori prelucrează date numai în măsura necesară serviciilor oferite și potrivit propriilor obligații contractuale și legale.</p>
      </> },
      { title: 'Transferuri internaționale', content: <>
        <p>Unii furnizori pot prelucra date în afara Spațiului Economic European. În asemenea situații sunt utilizate mecanisme legale adecvate, precum decizii de adecvare sau clauze contractuale standard, după caz.</p>
      </> },
      { title: 'Păstrarea datelor', content: <>
        <p>Datele sunt păstrate atât timp cât sunt necesare activității organizației, îndeplinirii obligațiilor legale și soluționării eventualelor cereri sau litigii. Conturile și datele care nu mai sunt necesare pot fi șterse sau anonimizate conform procedurilor interne și termenelor legale aplicabile.</p>
      </> },
      { title: 'Securitate', content: <>
        <p>Folosim măsuri tehnice și organizatorice pentru limitarea accesului, protejarea autentificării, criptarea secretelor de integrare și prevenirea accesului neautorizat. Niciun sistem nu poate elimina complet toate riscurile, iar incidentele sunt analizate și gestionate conform obligațiilor aplicabile.</p>
      </> },
      { title: 'Drepturile persoanelor vizate', content: <>
        <p>În condițiile prevăzute de GDPR, puteți solicita accesul la date, rectificarea, ștergerea, restricționarea prelucrării, portabilitatea sau opoziția. Dacă prelucrarea se bazează pe consimțământ, acesta poate fi retras fără a afecta prelucrarea anterioară.</p>
        <p>Aveți și dreptul de a depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal.</p>
      </> },
      { title: 'Cookie-uri și autentificare', content: <>
        <p>Elmont utilizează cookie-uri strict necesare pentru autentificare, menținerea sesiunii și securitate. Platforma nu utilizează cookie-uri publicitare în paginile sale operaționale.</p>
      </> },
      { title: 'Actualizarea politicii', content: <>
        <p>Politica poate fi actualizată atunci când se schimbă funcționalitățile sau cerințele legale. Noua versiune este publicată pe această pagină împreună cu data ultimei actualizări.</p>
      </> },
    ]}
  />
}
