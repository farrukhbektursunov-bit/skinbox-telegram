import { supabase } from '@/api/supabase'

export function cartItemsQueryKey(userId) {
  return ['cartItems', userId]
}

/** Bir xil queryFn - cache to'qnashuvini oldini olish (AppLayout va Cart bir xil ma'lumotdan foydalansin) */
export async function fetchCartItems(userId) {
  const { data, error } = await supabase
    .from('cart_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((i) => ({ ...i, price: Number(i.price), quantity: Number(i.quantity) }))
}
