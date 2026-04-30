/** Barcha sahifalarda bir xil rasm ko'rsatish uchun yagona mantiq */

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function normalizeImageUrl(url) {
  if (url == null) return null
  const s = String(url).trim()
  return s.length > 0 ? s : null
}

// Mahsulotda admin / foydalanuvchi bergan rasm bormi (demo Unsplash emas)
export function hasUserProvidedImage(product) {
  return getProductImages(product).length > 0
}

/**
 * img onError: agar rasm bazadan/katalogdan bo'lsa — Unsplash bilan almashtirma
 */
export function onProductImageError(e, product, demoFallbackUrl) {
  const el = e.target
  el.onerror = null
  if (hasUserProvidedImage(product)) {
    el.src = TRANSPARENT_PIXEL
    el.classList.add('object-none', 'bg-muted/40')
    return
  }
  if (demoFallbackUrl) {
    el.src = demoFallbackUrl
    return
  }
  el.src = TRANSPARENT_PIXEL
}

// Har bir turkum uchun mos rasmlar (Unsplash — skincare/cosmetic)
const CATEGORY_IMAGES = {
  cleansers: [
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80',
    'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?w=400&q=80',
  ],
  serums: [
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80',
  ],
  moisturizers: [
    'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&q=80',
    'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?w=400&q=80',
  ],
  toners: [
    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80',
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80',
  ],
  masks: [
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80',
    'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&q=80',
  ],
  sunscreen: [
    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80',
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80',
  ],
}

export function getProductImages(product) {
  if (!product) return []
  const main = normalizeImageUrl(product.image_url)
  const extra = (Array.isArray(product.images) ? product.images : [])
    .map(normalizeImageUrl)
    .filter(Boolean)
  const combined = main ? [main, ...extra.filter((u) => u !== main)] : [...extra]
  return combined.filter(Boolean)
}

export function getFirstImage(product) {
  const images = getProductImages(product)
  return images[0] || null
}

/** Rasm bo'lmasa — har bir turkum uchun o'ziga mos demo rasmlar */
export function getDemoImages(product) {
  const cat = product?.category || 'cleansers'
  return CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.cleansers
}

/** Ko'rsatish uchun rasm(lar) - asl yoki turkumga mos demo (swipe uchun 2-3 ta) */
export function getDisplayImages(product) {
  const images = getProductImages(product)
  if (images.length > 0) return images
  return getDemoImages(product)
}
