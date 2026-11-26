import { supabase } from './supabase'

/** The word a person types to confirm. "SIL" (no dotted İ) also counts: not every keyboard has İ. */
export const DELETE_WORD = 'SİL'

export function deleteWordOk(typed: string): boolean {
  const word = typed.trim().toLocaleUpperCase('tr-TR')
  return word === DELETE_WORD || word === 'SIL'
}

export type DeleteResult = { ok: true } | { ok: false; error: string; premiumUntil?: string }

export const DELETE_MESSAGES: Record<string, string> = {
  not_signed_in: 'Oturumun kapanmış. Yeniden giriş yapıp tekrar dene.',
  admin_account: 'Yönetici hesabı buradan silinemez.',
  premium_active: 'Hesabında süresi bitmemiş Premium var. Silersen kalan süre geri gelmez.',
  confirm_required: 'Onay kelimesi eksik.',
  delete_failed: 'Hesap şu an silinemedi. Biraz sonra tekrar dene; sorun sürerse bize yaz.',
  network: 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.',
}

export const deleteMessage = (error: string) => DELETE_MESSAGES[error] ?? DELETE_MESSAGES.delete_failed

/** Asks the server to delete the signed-in account and everything in it, then signs out on this device. */
export async function deleteAccount(options: { premiumOk: boolean }, fetchImpl: typeof fetch = fetch): Promise<DeleteResult> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) return { ok: false, error: 'not_signed_in' }
  let response: Response
  try {
    response = await fetchImpl('/api/delete-account', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE', premium_ok: options.premiumOk }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; premium_until?: string }
  if (!response.ok || !body.ok) return { ok: false, error: body.error ?? 'delete_failed', premiumUntil: body.premium_until }
  // The account is gone on the server, so only this device's session is left to drop.
  await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined)
  return { ok: true }
}
