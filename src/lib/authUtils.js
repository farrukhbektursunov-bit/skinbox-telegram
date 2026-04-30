/**
 * Auth xavfsizligi va validatsiya yordamchilari
 */
import DOMPurify from 'dompurify'

// Parol talablari
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

// Message keys for i18n (translate in Login/Settings when displaying)
export const PW_MSG_KEYS = {
  MIN_CHARS: 'pwMinChars',
  UPPER_LOWER: 'pwUpperLower',
  ONE_NUMBER: 'pwOneNumber',
  SPECIAL_CHAR: 'pwSpecialChar',
}

export function validatePasswordStrength(password) {
  if (!password) return { score: 0, valid: false, messages: [] }
  
  const messages = []
  let score = 0
  
  if (password.length >= PASSWORD_MIN_LENGTH) score += 2
  else messages.push(PW_MSG_KEYS.MIN_CHARS)
  
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 2
  else if (password.length > 0) messages.push(PW_MSG_KEYS.UPPER_LOWER)
  
  if (/\d/.test(password)) score += 1
  else if (password.length > 0) messages.push(PW_MSG_KEYS.ONE_NUMBER)
  
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1
  else if (password.length > 0) messages.push(PW_MSG_KEYS.SPECIAL_CHAR)
  
  return {
    score: Math.min(score, 5),
    valid: score >= 5 && password.length >= PASSWORD_MIN_LENGTH,
    messages: messages.length ? messages : [],
  }
}

export function validateEmail(email) {
  if (!email?.trim()) return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email.trim())
}

export function sanitizeInput(str, maxLen = 100) {
  if (typeof str !== 'string') return ''
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim().slice(0, maxLen)
}

export function sanitizeName(name) {
  return sanitizeInput(name, 64)
}

/** Full Name: faqat harflar, probel, apostrof, defis */
export function filterNameInput(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/[^\p{L}\s'-]/gu, '').slice(0, 64)
}

/** Telefon: faqat raqamlar (0–9), max 12 */
export function filterPhoneInput(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\D/g, '').slice(0, 12)
}

const PHONE_PREFIX = '+998 '
const PHONE_USER_DIGITS = 9

/** +998 dan keyingi 9 ta raqamni ajratib oladi (input uchun) */
export function parsePhoneForInput(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('998')) return digits.slice(3, 12)
  return digits.slice(0, 9)
}

/** Inputdagi 9 raqamdan to'liq telefon qaytaradi (DB ga saqlash uchun) */
export function formatPhoneForSave(userDigits) {
  const d = String(userDigits || '').replace(/\D/g, '').slice(0, PHONE_USER_DIGITS)
  return d ? '+998' + d : ''
}

export { PHONE_PREFIX }

// Brute-force himoyasi server tomonda bo'lishi kerak.
// Bu yordamchi faqat Supabase error xabarini UI uchun yagona formatga keltiradi.
export function getAuthRateLimitMessage(error) {
  const msg = String(error?.message || '').toLowerCase()
  if (
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('security purposes')
  ) {
    return "Ko'p urinishlar. Birozdan keyin qayta urinib ko'ring."
  }
  return null
}
