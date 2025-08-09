import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// TODO: Replace with your project details
const supabaseUrl = 'https://swxehqxiqyyyjbsekkwa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eGVocXhpcXl5eWpic2Vra3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NzUwMzQsImV4cCI6MjA3MDM1MTAzNH0.7ivEWvbnLsOgt8MnKATO6BxWJPfxZn336GE0n_Kwq5s'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const form = document.getElementById('beta-form')
const successMsg = document.getElementById('beta-success')
const errorMsg = document.getElementById('beta-error')

function normalizeEmail(email) {
  return (email || '').trim()
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorMsg.style.display = 'none'
  successMsg.style.display = 'none'
  errorMsg.textContent = ''

  const formData = new FormData(form)
  const data = Object.fromEntries(formData)

  // Coerce types
  data.email = normalizeEmail(data.email)
  data.consent = !!document.getElementById('consent')?.checked

  if (!data.email) {
    errorMsg.textContent = 'Please enter a valid email.'
    errorMsg.style.display = 'block'
    return
  }

  try {
    const { error } = await supabase.from('beta_signups').insert([data])

    if (error) {
      // 23505 = unique violation on lower(email) index
      if (error.code === '23505') {
        errorMsg.textContent = 'This email has already signed up.'
      } else if (error.code === 'PGRST116') {
        // RLS violation or missing policy
        errorMsg.textContent = 'Signup temporarily unavailable. Please try again later.'
        console.error(error)
      } else {
        errorMsg.textContent = error.message || 'Something went wrong.'
        console.error(error)
      }
      errorMsg.style.display = 'block'
      return
    }

    form.reset()
    successMsg.style.display = 'block'
  } catch (err) {
    console.error(err)
    errorMsg.textContent = 'An unexpected error occurred. Please try again later.'
    errorMsg.style.display = 'block'
  }
})