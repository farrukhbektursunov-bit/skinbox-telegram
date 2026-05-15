/** Manzil / yetkazib berish — viloyat ro'yxati (Addresses, ClaimGift bilan bir xil tartib) */
export const UZ_DELIVERY_REGIONS = [
  'Toshkent shahri',
  'Toshkent viloyati',
  "Samarqand",
  'Buxoro',
  "Farg'ona",
  'Andijon',
  'Namangan',
  'Qashqadaryo',
  'Surxondaryo',
  'Xorazm',
  'Navoiy',
  'Jizzax',
  'Sirdaryo',
  "Qoraqalpog'iston",
]

export function isTashkentCity(region) {
  return String(region || '').trim() === 'Toshkent shahri'
}

/** Yetti: chegirmadan keyingi summa bepul chegaraga yetgan bo'lsa 0 */
export function computeDeliveryShipping({
  subtotalLessDiscount,
  region,
  freeShippingMin,
  costTashkent,
  costRegions,
}) {
  const freeMin = Number(freeShippingMin) || 0
  const net = Number(subtotalLessDiscount) || 0
  if (freeMin > 0 && net >= freeMin) return 0
  return isTashkentCity(region) ? Number(costTashkent) || 0 : Number(costRegions) || 0
}
