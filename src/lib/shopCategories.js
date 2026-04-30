import { supabase } from '@/api/supabase'

/** Supabase bo‘sh bo‘lsa — eski 6 turkum (bitta bo‘lim) */
export const FALLBACK_SECTION_ID = '__fallback_skincare__'

export const FALLBACK_SHOP_TREE = {
  sections: [
    {
      id: FALLBACK_SECTION_ID,
      slug: 'skincare',
      name_uz: 'Yuz parvarishi',
      name_ru: 'Уход за лицом',
      name_en: 'Skincare',
      sort_order: 0,
    },
  ],
  categories: [
    {
      id: '__fb_cleansers__',
      section_id: FALLBACK_SECTION_ID,
      slug: 'cleansers',
      name_uz: 'Tozalash vositalari',
      name_ru: 'Очищающие средства',
      name_en: 'Cleansers',
      sort_order: 0,
    },
    {
      id: '__fb_toners__',
      section_id: FALLBACK_SECTION_ID,
      slug: 'toners',
      name_uz: 'Tonerlar',
      name_ru: 'Тоники',
      name_en: 'Toners',
      sort_order: 1,
    },
    {
      id: '__fb_serums__',
      section_id: FALLBACK_SECTION_ID,
      slug: 'serums',
      name_uz: 'Serumlar',
      name_ru: 'Сыворотки',
      name_en: 'Serums',
      sort_order: 2,
    },
    {
      id: '__fb_moisturizers__',
      section_id: FALLBACK_SECTION_ID,
      slug: 'moisturizers',
      name_uz: 'Namlovchilar',
      name_ru: 'Увлажнители',
      name_en: 'Moisturizers',
      sort_order: 3,
    },
    {
      id: '__fb_masks__',
      section_id: FALLBACK_SECTION_ID,
      slug: 'masks',
      name_uz: 'Yuz niqoblari',
      name_ru: 'Маски для лица',
      name_en: 'Face masks',
      sort_order: 4,
    },
    {
      id: '__fb_sunscreen__',
      section_id: FALLBACK_SECTION_ID,
      slug: 'sunscreen',
      name_uz: 'Quyoshdan himoya',
      name_ru: 'Солнцезащита',
      name_en: 'Sunscreen',
      sort_order: 5,
    },
  ],
}

function sortTree(sections, categories) {
  const secSorted = [...sections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const secOrder = new Map(secSorted.map((s, i) => [s.id, i]))
  const catSorted = [...categories].sort((a, b) => {
    const da = secOrder.get(a.section_id) ?? 999
    const db = secOrder.get(b.section_id) ?? 999
    if (da !== db) return da - db
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  return { sections: secSorted, categories: catSorted }
}

/**
 * Bo‘limlar va turkumlar (ombordan).
 * Jadval bo‘sh yoki xatolik bo‘lsa — FALLBACK_SHOP_TREE.
 */
export async function fetchShopCategoryTree() {
  const [secRes, catRes] = await Promise.all([
    supabase.from('category_sections').select('*').order('sort_order', { ascending: true }),
    supabase.from('product_categories').select('*').order('sort_order', { ascending: true }),
  ])
  if (secRes.error || catRes.error) {
    return sortTree(FALLBACK_SHOP_TREE.sections, FALLBACK_SHOP_TREE.categories)
  }
  const sections = secRes.data ?? []
  const categories = catRes.data ?? []
  if (sections.length === 0 && categories.length === 0) {
    return sortTree(FALLBACK_SHOP_TREE.sections, FALLBACK_SHOP_TREE.categories)
  }
  return sortTree(sections, categories)
}

export function sectionLabel(section, lang) {
  if (!section) return ''
  if (lang === 'ru') return section.name_ru || section.name_uz || section.slug
  if (lang === 'en') return section.name_en || section.name_uz || section.slug
  return section.name_uz || section.slug
}

export function categoryLabel(category, lang) {
  if (!category) return ''
  if (lang === 'ru') return category.name_ru || category.name_uz || category.slug
  if (lang === 'en') return category.name_en || category.name_uz || category.slug
  return category.name_uz || category.slug
}

/** @param {{ categories: { slug: string }[] }} tree */
export function categorySlugSet(tree) {
  return new Set((tree?.categories ?? []).map((c) => c.slug))
}
