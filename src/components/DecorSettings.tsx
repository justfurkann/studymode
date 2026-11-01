import { Check } from 'lucide-react'
import { PAPERS, PENS, updateDecor, useDecor } from '../lib/decor'
import { playSound } from '../lib/sound'

/** "Kırtasiye seti" in Settings: paper, highlighter colour and stationery sounds. */
export function DecorSettings() {
  const decor = useDecor()
  return (
    <div className="decor-settings">
      <div>
        <p className="decor-label">Defter kağıdı</p>
        <div className="paper-picker" role="group" aria-label="Defter kağıdı">
          {PAPERS.map(({ id, label }) => (
            <button key={id} className={`paper-swatch paper-${id}`} aria-pressed={decor.paper === id} onClick={() => updateDecor({ paper: id })}>
              <span className="paper-sample" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="decor-label">
          Fosforlu kalem <span className="hl">rengi</span>
        </p>
        <div className="pen-picker" role="group" aria-label="Fosforlu kalem rengi">
          {PENS.map(({ id, label, swatch }) => (
            <button key={id} className="pen-swatch" aria-pressed={decor.pen === id} aria-label={label} title={label} style={{ background: swatch }} onClick={() => updateDecor({ pen: id })}>
              {decor.pen === id && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={decor.asmr}
          onChange={(e) => {
            updateDecor({ asmr: e.target.checked })
            if (e.target.checked) playSound('right')
          }}
        />
        <span>
          Kırtasiye sesleri
          <span className="subtle"> · Kart çevirirken kağıt hışırtısı, doğru cevapta fosforlu kalem sesi, bitişte sayfa çevirme.</span>
        </span>
      </label>
    </div>
  )
}
