'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChecklistGrid } from '@/components/checklist-grid'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Printer } from 'lucide-react'

const MEDICAL_CONDITIONS = [
  { key: 'hipertensiune', label: 'Hipertensiune' },
  { key: 'hipotensiune', label: 'Hipotensiune' },
  { key: 'diabet', label: 'Diabet' },
  { key: 'reumatism', label: 'Reumatism' },
  { key: 'anemie', label: 'Anemie' },
  { key: 'tiroida', label: 'Probleme tiroidiene' },
  { key: 'astm', label: 'Astm' },
  { key: 'respiratorii', label: 'Probleme respiratorii' },
  { key: 'artrita', label: 'Artrită' },
  { key: 'hemofilie', label: 'Hemofilie' },
  { key: 'despicaturi', label: 'Despicături labio-maxilo-palatine' },
  { key: 'vorbit', label: 'Probleme la vorbit' },
  { key: 'auz', label: 'Probleme de auz' },
  { key: 'vaz', label: 'Probleme de văz / lentile de contact' },
  { key: 'ficat', label: 'Probleme cu ficatul' },
  { key: 'coagulare', label: 'Alte probleme de coagulare' },
  { key: 'stomac', label: 'Boli de stomac' },
  { key: 'rinichi', label: 'Boli de rinichi' },
  { key: 'hiv', label: 'HIV / SIDA' },
  { key: 'greutate', label: 'Pierderi de greutate' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'leucemie', label: 'Leucemie' },
  { key: 'epilepsie', label: 'Epilepsie (convulsii)' },
  { key: 'radioterapie', label: 'Radio / chimioterapie' },
  { key: 'crestere', label: 'Deficiențe de creștere' },
  { key: 'adhd', label: 'ADHD' },
  { key: 'osteoporoza', label: 'Osteoporoză' },
  { key: 'neurologice', label: 'Boli neurologice sau psihice' },
  { key: 'tuberculoza', label: 'Tuberculoză' },
]

const SYMPTOM_ITEMS = [
  { key: 'durere', label: 'Durere' },
  { key: 'febra', label: 'Febră' },
  { key: 'oboseala', label: 'Oboseală / astenie' },
  { key: 'ameteli', label: 'Amețeli' },
  { key: 'greata', label: 'Greață / vărsături' },
  { key: 'respiratie', label: 'Dificultăți respiratorii' },
  { key: 'palpitatii', label: 'Palpitații' },
  { key: 'eruptii', label: 'Erupții cutanate / mâncărimi' },
  { key: 'umflaturi', label: 'Umflături / edeme' },
  { key: 'tuse', label: 'Tuse' },
  { key: 'insomnie', label: 'Insomnie' },
  { key: 'scadereGreutate', label: 'Scădere în greutate neintenționată' },
  { key: 'apetit', label: 'Pierderea apetitului' },
  { key: 'tranzit', label: 'Constipație / diaree' },
]

const GENERAL_FEARS = [
  { key: 'injectii', label: 'Injecții / recoltări de sânge' },
  { key: 'durere', label: 'Durere' },
  { key: 'proceduriMedicale', label: 'Proceduri medicale în general' },
  { key: 'rezultateAnalize', label: 'Rezultate ale analizelor' },
  { key: 'spitalizare', label: 'Spitalizare' },
]

const FAMILY_HISTORY_ITEMS = [
  { key: 'diabet', label: 'Diabet' },
  { key: 'boliCardiovasculare', label: 'Boli cardiovasculare' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'boliGenetice', label: 'Boli genetice cunoscute' },
  { key: 'hipertensiune', label: 'Hipertensiune' },
  { key: 'boliPsihice', label: 'Boli psihice' },
]

function PrintLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p style={{ fontSize: '8px', margin: '1.5px 0', lineHeight: 1.3 }}>
      <span style={{ color: '#666' }}>{label}:</span>{' '}
      <span style={{ borderBottom: '1px solid #999' }}>{value || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}</span>
    </p>
  )
}

function PrintCheckbox({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <p style={{ fontSize: '8px', margin: '1px 0', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '3px' }}>
      <span>{checked ? '☑' : '☐'}</span> {label}
    </p>
  )
}

export default function PatientRecordForm({
  customerId,
  simpleInitial,
  medicalInitial,
}: {
  customerId: string
  simpleInitial: { name: string; phone: string; email: string; notes: string; dateOfBirth: string; allergies: string; medicalNotes: string }
  medicalInitial: any
}) {
  const router = useRouter()
  const [simple, setSimple] = useState(simpleInitial)
  const [form, setForm] = useState({
    cnp: medicalInitial?.cnp ?? '',
    address: medicalInitial?.address ?? '',
    city: medicalInitial?.city ?? '',
    occupation: medicalInitial?.occupation ?? '',
    emergencyContactName: medicalInitial?.emergencyContactName ?? '',
    emergencyContactPhone: medicalInitial?.emergencyContactPhone ?? '',
    familyDoctor: medicalInitial?.familyDoctor ?? '',
    familyDoctorLastVisit: medicalInitial?.familyDoctorLastVisit ?? '',
    previousSpecialist: medicalInitial?.previousDentist ?? '',
    previousSpecialistLastVisit: medicalInitial?.previousDentistLastVisit ?? '',
    hospitalized: medicalInitial?.hospitalized ?? false,
    hospitalizedDetails: medicalInitial?.hospitalizedDetails ?? '',
    surgeries: medicalInitial?.surgeries ?? false,
    surgeriesDetails: medicalInitial?.surgeriesDetails ?? '',
    onMedication: medicalInitial?.onMedication ?? false,
    medicationDetails: medicalInitial?.medicationDetails ?? '',
    smoker: medicalInitial?.smoker ?? false,
    allergyAnesthesia: medicalInitial?.allergyAnesthesia ?? false,
    allergyAntibiotics: medicalInitial?.allergyAntibiotics ?? false,
    allergyAspirin: medicalInitial?.allergyAspirin ?? false,
    allergyIodine: medicalInitial?.allergyIodine ?? false,
    allergyLatex: medicalInitial?.allergyLatex ?? false,
    allergyNickel: medicalInitial?.allergyNickel ?? false,
    allergyOther: medicalInitial?.allergyOther ?? '',
    pregnant: medicalInitial?.pregnant ?? false,
    pregnantMonth: medicalInitial?.pregnantMonth ?? '',
    breastfeeding: medicalInitial?.breastfeeding ?? false,
    contraceptives: medicalInitial?.contraceptives ?? false,
    menopause: medicalInitial?.menopause ?? false,
    generalNotes: medicalInitial?.generalNotes ?? '',
  })
  const [conditions, setConditions] = useState<Record<string, boolean>>(medicalInitial?.medicalConditions ?? {})
  const [fears, setFears] = useState<Record<string, boolean>>(medicalInitial?.clinicalHistory?.fears ?? {})
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>(medicalInitial?.clinicalHistory?.symptoms ?? {})
  const [familyHistory, setFamilyHistory] = useState<Record<string, boolean>>(medicalInitial?.clinicalHistory?.familyHistory ?? {})
  const [visit, setVisit] = useState({
    visitReason: medicalInitial?.clinicalHistory?.visitReason ?? '',
    symptomsSince: medicalInitial?.clinicalHistory?.symptomsSince ?? '',
    painScale: medicalInitial?.clinicalHistory?.painScale ?? '',
    previousTreatments: medicalInitial?.clinicalHistory?.previousTreatments ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const { previousSpecialist, previousSpecialistLastVisit, ...restForm } = form
      const [res1, res2] = await Promise.all([
        fetchWithTimeout(`/api/customers/${customerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(simple),
        }),
        fetchWithTimeout(`/api/business/patients/${customerId}/medical-record`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...restForm,
            previousDentist: previousSpecialist,
            previousDentistLastVisit: previousSpecialistLastVisit,
            medicalConditions: conditions,
            clinicalHistory: { ...visit, fears, symptoms, familyHistory },
          }),
        }),
      ])
      if (!res1.ok || !res2.ok) {
        setError('A apărut o eroare la salvare.')
        return
      }
      setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' }))
      router.refresh()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="screen-only flex flex-col gap-4">
        <Card>
          <h3 className="font-medium mb-3">Date de contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Nume" value={simple.name} onChange={(e) => setSimple({ ...simple, name: e.target.value })} />
            <Input placeholder="Telefon" value={simple.phone} onChange={(e) => setSimple({ ...simple, phone: e.target.value })} />
            <Input placeholder="Email" type="email" value={simple.email} onChange={(e) => setSimple({ ...simple, email: e.target.value })} />
            <Input placeholder="Data nașterii" type="date" value={simple.dateOfBirth} onChange={(e) => setSimple({ ...simple, dateOfBirth: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Date personale</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="CNP" value={form.cnp} onChange={(e) => setForm({ ...form, cnp: e.target.value })} />
            <Input placeholder="Ocupație" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            <Input placeholder="Adresă" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="Localitate / Județ" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Contact în caz de urgență</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Nume" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            <Input placeholder="Telefon" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Medici anteriori</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Input placeholder="Medic de familie" value={form.familyDoctor} onChange={(e) => setForm({ ...form, familyDoctor: e.target.value })} />
            <Input placeholder="Data ultimei consultații" value={form.familyDoctorLastVisit} onChange={(e) => setForm({ ...form, familyDoctorLastVisit: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Medic specialist anterior" value={form.previousSpecialist} onChange={(e) => setForm({ ...form, previousSpecialist: e.target.value })} />
            <Input placeholder="Data ultimei consultații" value={form.previousSpecialistLastVisit} onChange={(e) => setForm({ ...form, previousSpecialistLastVisit: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Istoric medical general</h3>
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={form.hospitalized} onChange={(e) => setForm({ ...form, hospitalized: e.target.checked })} />
                Ați fost spitalizat(ă)?
              </label>
              {form.hospitalized && (
                <Input placeholder="Anul și motivul" value={form.hospitalizedDetails} onChange={(e) => setForm({ ...form, hospitalizedDetails: e.target.value })} />
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={form.surgeries} onChange={(e) => setForm({ ...form, surgeries: e.target.checked })} />
                Ați suferit intervenții chirurgicale?
              </label>
              {form.surgeries && (
                <Input placeholder="Anul și ce anume" value={form.surgeriesDetails} onChange={(e) => setForm({ ...form, surgeriesDetails: e.target.value })} />
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={form.onMedication} onChange={(e) => setForm({ ...form, onMedication: e.target.checked })} />
                Luați medicamente în prezent?
              </label>
              {form.onMedication && (
                <Input placeholder="Ce anume și pentru ce" value={form.medicationDetails} onChange={(e) => setForm({ ...form, medicationDetails: e.target.value })} />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.smoker} onChange={(e) => setForm({ ...form, smoker: e.target.checked })} />
              Fumător
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Alergii</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
            {[
              ['allergyAnesthesia', 'Anestezie'],
              ['allergyAntibiotics', 'Antibiotice'],
              ['allergyAspirin', 'Aspirină'],
              ['allergyIodine', 'Iod'],
              ['allergyLatex', 'Latex'],
              ['allergyNickel', 'Nichel'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <Input placeholder="Alte alergii" value={form.allergyOther} onChange={(e) => setForm({ ...form, allergyOther: e.target.value })} />
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Doar pentru femei</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.pregnant} onChange={(e) => setForm({ ...form, pregnant: e.target.checked })} />
                Însărcinată
              </label>
              {form.pregnant && (
                <Input placeholder="Luna" value={form.pregnantMonth} onChange={(e) => setForm({ ...form, pregnantMonth: e.target.value })} className="max-w-[120px]" />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.breastfeeding} onChange={(e) => setForm({ ...form, breastfeeding: e.target.checked })} />
              Alăptează
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.contraceptives} onChange={(e) => setForm({ ...form, contraceptives: e.target.checked })} />
              Folosește anticoncepționale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.menopause} onChange={(e) => setForm({ ...form, menopause: e.target.checked })} />
              S-a instalat menopauza
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Probleme medicale cunoscute</h3>
          <ChecklistGrid items={MEDICAL_CONDITIONS} value={conditions} onChange={(k, v) => setConditions({ ...conditions, [k]: v })} />
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Motivul vizitei</h3>
          <Textarea
            placeholder="De ce v-ați programat? Ce vă supără?"
            value={visit.visitReason}
            onChange={(e) => setVisit({ ...visit, visitReason: e.target.value })}
            className="mb-2"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="De când aveți aceste simptome?"
              value={visit.symptomsSince}
              onChange={(e) => setVisit({ ...visit, symptomsSince: e.target.value })}
            />
            <Input
              placeholder="Intensitatea durerii (0-10, dacă e cazul)"
              value={visit.painScale}
              onChange={(e) => setVisit({ ...visit, painScale: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Simptome curente</h3>
          <ChecklistGrid items={SYMPTOM_ITEMS} value={symptoms} onChange={(k, v) => setSymptoms({ ...symptoms, [k]: v })} />
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Tratamente încercate anterior</h3>
          <Textarea
            placeholder="Medicamente luate, tratamente încercate pentru problema actuală..."
            value={visit.previousTreatments}
            onChange={(e) => setVisit({ ...visit, previousTreatments: e.target.value })}
            className="min-h-[70px]"
          />
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Istoric medical familial</h3>
          <p className="text-sm text-gray-500 mb-2">Afecțiuni cunoscute în familie (părinți, frați, bunici):</p>
          <ChecklistGrid items={FAMILY_HISTORY_ITEMS} value={familyHistory} onChange={(k, v) => setFamilyHistory({ ...familyHistory, [k]: v })} />
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Temeri legate de vizita medicală</h3>
          <ChecklistGrid items={GENERAL_FEARS} value={fears} onChange={(k, v) => setFears({ ...fears, [k]: v })} />
        </Card>

        <Card>
          <h3 className="font-medium mb-3">Alte mențiuni</h3>
          <Textarea value={form.generalNotes} onChange={(e) => setForm({ ...form, generalNotes: e.target.value })} placeholder="Orice altă problemă relevantă..." className="min-h-[80px]" />
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Se salvează...' : 'Salvează fișa'}
          </Button>
          <button onClick={() => window.print()} className="btn-secondary text-sm">
            <Printer size={14} className="inline mr-1" style={{ verticalAlign: '-2px' }} /> Printează
          </button>
          {savedAt && <span className="text-xs text-gray-500">Salvat la {savedAt}</span>}
        </div>
      </div>

      <div className="print-only" style={{ color: '#000', fontSize: '8.5px', lineHeight: 1.3 }}>
        <h1 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 2px' }}>Fișa pacientului</h1>
        <p style={{ fontSize: '9px', color: '#666', margin: '0 0 6px' }}>{simple.name || 'Nume: ...........................'}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
          <div>
            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Date de contact</h2>
            <PrintLine label="Nume" value={simple.name} />
            <PrintLine label="Telefon" value={simple.phone} />
            <PrintLine label="Email" value={simple.email} />
            <PrintLine label="Data nașterii" value={simple.dateOfBirth} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Date personale</h2>
            <PrintLine label="CNP" value={form.cnp} />
            <PrintLine label="Ocupație" value={form.occupation} />
            <PrintLine label="Adresă" value={form.address} />
            <PrintLine label="Localitate / Județ" value={form.city} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Contact urgență</h2>
            <PrintLine label="Nume" value={form.emergencyContactName} />
            <PrintLine label="Telefon" value={form.emergencyContactPhone} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Medici anteriori</h2>
            <PrintLine label="Medic de familie" value={form.familyDoctor} />
            <PrintLine label="Ultima consultație" value={form.familyDoctorLastVisit} />
            <PrintLine label="Medic specialist anterior" value={form.previousSpecialist} />
            <PrintLine label="Ultima consultație" value={form.previousSpecialistLastVisit} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Istoric medical general</h2>
            <PrintCheckbox label="Spitalizat(ă)" checked={form.hospitalized} />
            <PrintCheckbox label="Intervenții chirurgicale" checked={form.surgeries} />
            <PrintCheckbox label="Medicație curentă" checked={form.onMedication} />
            <PrintCheckbox label="Fumător" checked={form.smoker} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Alergii</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <PrintCheckbox label="Anestezie" checked={form.allergyAnesthesia} />
              <PrintCheckbox label="Antibiotice" checked={form.allergyAntibiotics} />
              <PrintCheckbox label="Aspirină" checked={form.allergyAspirin} />
              <PrintCheckbox label="Iod" checked={form.allergyIodine} />
              <PrintCheckbox label="Latex" checked={form.allergyLatex} />
              <PrintCheckbox label="Nichel" checked={form.allergyNickel} />
            </div>
            <PrintLine label="Altele" value={form.allergyOther} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Doar pentru femei</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <PrintCheckbox label="Însărcinată" checked={form.pregnant} />
              <PrintCheckbox label="Alăptează" checked={form.breastfeeding} />
              <PrintCheckbox label="Anticoncepționale" checked={form.contraceptives} />
              <PrintCheckbox label="Menopauză" checked={form.menopause} />
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Probleme medicale cunoscute</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {MEDICAL_CONDITIONS.map((c) => (
                <PrintCheckbox key={c.key} label={c.label} checked={conditions[c.key]} />
              ))}
            </div>

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Motivul vizitei</h2>
            <PrintLine label="Motiv" value={visit.visitReason} />
            <PrintLine label="De când" value={visit.symptomsSince} />
            <PrintLine label="Intensitate durere (0-10)" value={visit.painScale} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Simptome curente</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {SYMPTOM_ITEMS.map((s) => (
                <PrintCheckbox key={s.key} label={s.label} checked={symptoms[s.key]} />
              ))}
            </div>
            <PrintLine label="Tratamente încercate" value={visit.previousTreatments} />

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Istoric familial</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {FAMILY_HISTORY_ITEMS.map((f) => (
                <PrintCheckbox key={f.key} label={f.label} checked={familyHistory[f.key]} />
              ))}
            </div>

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Temeri legate de vizita medicală</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {GENERAL_FEARS.map((f) => (
                <PrintCheckbox key={f.key} label={f.label} checked={fears[f.key]} />
              ))}
            </div>

            <h2 style={{ fontSize: '9.5px', fontWeight: 700, margin: '4px 0 2px', borderBottom: '1px solid #ccc' }}>Alte mențiuni</h2>
            <p style={{ fontSize: '8px', borderBottom: '1px solid #999', minHeight: '20px' }}>{form.generalNotes || '\u00A0'}</p>
          </div>
        </div>

        <p style={{ fontSize: '6.5px', color: '#888', marginTop: '10px' }}>
          Nu voi face vinovat medicul sau oricare dintre membrii echipei sale de eventualele omisiuni.
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '8px' }}>
          <span>Data: ......................</span>
          <span>Semnătura pacientului (tutorelui): ......................................</span>
        </div>
      </div>
    </div>
  )
}
