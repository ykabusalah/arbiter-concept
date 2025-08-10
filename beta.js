
// Modal first — always works even if Supabase config is missing
console.log('[beta] script loaded (modal-first)')

const modal = document.getElementById('beta-modal')
const backdrop = document.querySelector('.modal-backdrop')
const closeBtn = modal?.querySelector('.modal-close')

function openModal() {
  if (!modal) return
  modal.classList.add('open')
  modal.setAttribute('aria-hidden', 'false')
  if (backdrop) { backdrop.classList.add('open') }
  setTimeout(() => document.getElementById('email')?.focus(), 50)
}
function closeModal() {
  if (!modal) return
  modal.classList.remove('open')
  modal.setAttribute('aria-hidden', 'true')
  if (backdrop) { backdrop.classList.remove('open') }
}

closeBtn?.addEventListener('click', closeModal)
backdrop?.addEventListener('click', closeModal)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })

// Auto-bind any CTA that likely means "Request Invite"
function looksLikeInvite(el) {
  if (!el) return false
  const txt = (el.textContent || '').trim().toLowerCase()
  const aria = (el.getAttribute?.('aria-label') || '').toLowerCase()
  const href = (el.getAttribute?.('href') || '').toLowerCase()
  return txt.includes('request invite') || aria.includes('request invite') ||
         href === '#beta' || href.includes('#request') || el.classList.contains('js-request-invite') ||
         el.getAttribute?.('data-request-invite') === 'true'
}
document.addEventListener('click', (e) => {
  const t = e.target
  if (!(t instanceof Element)) return
  const el = t.closest('a,button,[role="button"]') || t
  if (looksLikeInvite(el)) {
    e.preventDefault()
    openModal()
  }
})

// Also proactively tag matching buttons/links for clarity
window.addEventListener('load', () => {
  const candidates = Array.from(document.querySelectorAll('a,button,[role="button"]'))
  candidates.forEach(el => {
    if (looksLikeInvite(el)) el.classList.add('js-request-invite')
  })
})


// Success renderer: compact "it worked" view
function showSuccess() {
  const success = document.getElementById('beta-success')
  const form = document.getElementById('beta-form')
  if (!success || !form) return
  // Inline SVG check icon
  const checkSvg = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="11" stroke="currentColor" opacity=".3"/><path d="M7 12.5l3 3 7-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  success.innerHTML = '<div style="display:flex;align-items:center;gap:12px;color:#218838">'+checkSvg+'<span>Success! You\'re on the list.</span></div>'
  success.style.display = 'block'
}


// Explicit bindings after DOM is ready
function bindInviteTriggers() {
  const triggers = Array.from(document.querySelectorAll('.js-request-invite,[data-request-invite="true"],a[href="#beta"]'))
  if (triggers.length === 0) {
    console.warn('[beta] No explicit invite triggers found; relying on delegation.')
  }
  triggers.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      openModal()
    }, { passive: false })
  })
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindInviteTriggers)
} else {
  bindInviteTriggers()
}

// ===== Supabase (guarded) =====
let supabaseUrl = 'https://YOUR-PROJECT.supabase.co'    // Settings → API → Project URL
let supabaseAnonKey = 'YOUR-ANON-KEY'                   // Settings → API → anon public key

const mask = (s) => (typeof s === 'string' && s.length > 8 ? s.slice(0,4) + '...' + s.slice(-4) : s)
console.log('[beta] supabaseUrl =', supabaseUrl)
console.log('[beta] supabaseAnonKey =', mask(supabaseAnonKey))

let supabase = null
let configOk = supabaseUrl && !supabaseUrl.includes('YOUR-PROJECT') && supabaseAnonKey && !supabaseAnonKey.includes('YOUR-ANON-KEY')

async function loadSupabaseClient() {
  if (!configOk) {
    console.warn('[beta] Missing Supabase config — modal still works; form will show an error on submit.')
    const diag = document.getElementById('beta-diag')
    if (diag) {
      diag.style.display = 'block'
      diag.textContent = 'Missing Supabase config. Set supabaseUrl and supabaseAnonKey in beta.js (Settings → API).'
    }
    return null
  }
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm')
    const client = createClient(supabaseUrl, supabaseAnonKey)
    window.supabase = client
    console.log('[beta] Supabase client ready')
    return client
  } catch (e) {
    console.error('[beta] Failed to load supabase-js', e)
    return null
  }
}

// Form submission (works via modal form)
const form = document.getElementById('beta-form')
const successMsg = document.getElementById('beta-success')
const errorMsg = document.getElementById('beta-error')

function normalizeEmail(email) { return (email || '').trim() }

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!form) return

  errorMsg.style.display = 'none'
  successMsg.style.display = 'none'
  errorMsg.textContent = ''

  const formData = new FormData(form)
  const data = Object.fromEntries(formData)

  data.email = normalizeEmail(data.email)
  data.consent = !!document.getElementById('consent')?.checked

  if (!data.email) {
    errorMsg.textContent = 'Please enter a valid email.'
    errorMsg.style.display = 'block'
    return
  }

  // Lazy-load/create client
  supabase = supabase || await loadSupabaseClient()
  if (!supabase) {
    errorMsg.textContent = 'Signup not configured yet. Please try again later.'
    errorMsg.style.display = 'block'
    return
  }

  try {
    const { data: insertData, error } = await supabase.from('beta_signups')
      .insert([data])
      .select('id,email,inserted_at')
      .single()

    if (error) {
      console.error('[beta] insert error', error)
      if (error.code === '23505') {
        errorMsg.textContent = 'This email has already signed up.'
      } else if (error.code === 'PGRST116') {
        errorMsg.textContent = 'Signup blocked by security policy. Run the SQL policies in Supabase.'
      } else {
        errorMsg.textContent = error.message || 'Something went wrong.'
      }
      errorMsg.style.display = 'block'
      return
    }

    console.log('[beta] insert ok', insertData)
    form.reset()
    successMsg.style.display = 'block'
  } catch (err) {
    console.error('[beta] unexpected fail', err)
    errorMsg.textContent = 'Network or unexpected error. Check DevTools → Network.'
    errorMsg.style.display = 'block'
  }
})
