import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

/**
 * Shown where AI would help but the free shared AI needs an account. Turning the blocker into an
 * invitation matters: without it guests only see the much weaker rule-based mode.
 */
export function AiSignupPrompt({ reason = 'Notlarından özet, kart ve sınav sorularını yapay zekâ hazırlasın.' }: { reason?: string }) {
  const store = useStore()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)
  if (ai.ok || settings.provider !== 'shared' || store.session || !supabase) return null

  return (
    <div className="signup-prompt" role="note">
      <span className="signup-prompt-icon">
        <Sparkles size={20} />
      </span>
      <div className="grow">
        <strong>Yapay zekâ ücretsiz, sadece hesap aç</strong>
        <p>{reason} Hesap açmak 30 saniye sürer; notların telefonunda ve bilgisayarında da durur.</p>
      </div>
      <div className="btn-row">
        <Link to="/giris?mod=kayit" className="btn btn-primary btn-sm">
          Ücretsiz hesap aç
        </Link>
        <Link to="/giris" className="btn btn-sm">
          Giriş yap
        </Link>
      </div>
    </div>
  )
}
