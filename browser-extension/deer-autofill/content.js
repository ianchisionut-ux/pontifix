(() => {
  const PAYLOAD_PREFIX = '#elmont='
  const FIXED_EMAIL = 'elmont_zalau@yahoo.com'
  const MAX_ATTEMPTS = 40

  if (!window.location.hash.startsWith(PAYLOAD_PREFIX)) return

  function normalize(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function showNotice(message, isError = false) {
    document.getElementById('elmont-deer-autofill-notice')?.remove()
    const notice = document.createElement('div')
    notice.id = 'elmont-deer-autofill-notice'
    notice.setAttribute('role', isError ? 'alert' : 'status')
    notice.textContent = message
    Object.assign(notice.style, {
      position: 'fixed',
      top: '18px',
      right: '18px',
      zIndex: '2147483647',
      maxWidth: '390px',
      padding: '14px 18px',
      borderRadius: '12px',
      color: '#ffffff',
      background: isError ? '#b91c1c' : '#08783e',
      boxShadow: '0 14px 35px rgba(15, 23, 42, .28)',
      font: '600 14px/1.45 system-ui, sans-serif',
    })
    document.body.appendChild(notice)
    if (!isError) window.setTimeout(() => notice.remove(), 9000)
  }

  function controlForLabel(labelText, selector) {
    const expected = normalize(labelText)
    const labels = Array.from(document.querySelectorAll('label'))
    for (const label of labels) {
      if (!normalize(label.textContent).includes(expected)) continue
      const byFor = label.htmlFor ? document.getElementById(label.htmlFor) : null
      if (byFor?.matches(selector)) return byFor
      const nested = label.querySelector(selector)
      if (nested) return nested
      const nearby = label.parentElement?.querySelector(selector)
      if (nearby) return nearby
    }
    return null
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    if (setter) setter.call(element, value)
    else element.value = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    element.dispatchEvent(new Event('blur', { bubbles: true }))
  }

  function setAction(select, value, label) {
    const options = Array.from(select.options)
    const byValue = options.find((option) => option.value === value)
    const byLabel = options.find((option) => normalize(option.textContent) === normalize(label))
    const option = byValue || byLabel
    if (!option) throw new Error('Acțiunea selectată nu mai există în formularul DEER.')
    setNativeValue(select, option.value)
  }

  let payload
  try {
    payload = JSON.parse(decodeURIComponent(window.location.hash.slice(PAYLOAD_PREFIX.length)))
    const dossierNumber = String(payload.dossierNumber || '').match(/(?<!\d)\d{13}(?!\d)/)?.[0]
    if (!dossierNumber) throw new Error('Numărul ATR transmis nu are exact 13 cifre.')
    payload.dossierNumber = dossierNumber
  } catch (error) {
    showNotice(`Date Pontifix invalide: ${error instanceof Error ? error.message : error}`, true)
    return
  }

  function fillForm() {
    const fields = [
      ['Număr dosar', payload.dossierNumber],
      ['Nume solicitant', payload.applicant],
      ['Localitate', payload.locality],
      ['Strada', payload.street],
      ['Adresă Email', FIXED_EMAIL],
    ]
    const controls = fields.map(([label, value]) => ({ label, value, element: controlForLabel(label, 'input, textarea') }))
    const action = controlForLabel('Acțiune', 'select')
    const missing = controls.filter(({ element }) => !element).map(({ label }) => label)
    if (!action) missing.push('Acțiune')
    if (missing.length) return false

    for (const { element, value } of controls) setNativeValue(element, String(value || ''))
    setAction(action, String(payload.action || ''), String(payload.actionLabel || ''))
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`)
    showNotice('Câmpurile au fost completate automat din Pontifix. Verifică datele și completează CAPTCHA.')
    return true
  }

  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    try {
      if (fillForm()) {
        window.clearInterval(timer)
        return
      }
      if (attempts >= MAX_ATTEMPTS) {
        window.clearInterval(timer)
        showNotice('Formularul DEER nu a putut fi identificat. Reîncarcă pagina sau actualizează extensia Elmont.', true)
      }
    } catch (error) {
      window.clearInterval(timer)
      showNotice(`Autocompletarea s-a oprit: ${error instanceof Error ? error.message : error}`, true)
    }
  }, 250)
})()
