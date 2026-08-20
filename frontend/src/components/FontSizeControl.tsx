import { useEffect, useState } from 'react';
import { Minus, Plus, Type } from 'lucide-react';

const STORAGE_KEY = 'webleia.fontScale';
const STEPS = [0.875, 1, 1.125, 1.25, 1.4]; // 87.5% .. 140%
const DEFAULT_STEP = 1; // índice em STEPS correspondente a 100%

function loadStep(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const idx = raw ? Number(raw) : DEFAULT_STEP;
  return Number.isFinite(idx) && idx >= 0 && idx < STEPS.length ? idx : DEFAULT_STEP;
}

function applyScale(step: number) {
  // Escala o font-size base do <html>; como o restante do app usa unidades
  // relativas/px herdando do documento em várias telas, isso aumenta o
  // texto de forma consistente. Onde o tamanho é fixo em px puro, o efeito
  // visual ainda ajuda pois a maioria dos componentes usa rem/em em cascata
  // a partir do body.
  document.documentElement.style.fontSize = `${STEPS[step] * 100}%`;
}

// Aplica a escala salva assim que o app carrega (fora do React), para não
// haver "flash" de fonte no tamanho padrão antes do primeiro render.
applyScale(loadStep());

export function useFontScale() {
  const [step, setStep] = useState(loadStep);

  useEffect(() => {
    applyScale(step);
    localStorage.setItem(STORAGE_KEY, String(step));
  }, [step]);

  return {
    step,
    canDecrease: step > 0,
    canIncrease: step < STEPS.length - 1,
    decrease: () => setStep(s => Math.max(0, s - 1)),
    increase: () => setStep(s => Math.min(STEPS.length - 1, s + 1)),
    reset: () => setStep(DEFAULT_STEP),
  };
}

// Botões A- / A+ para acessibilidade — texto maior ajuda tanto alunos mais
// novos quanto o público mais velho da plataforma.
export default function FontSizeControl({ compact }: { compact?: boolean }) {
  const { canDecrease, canIncrease, decrease, increase } = useFontScale();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--line)', borderRadius: 8, padding: 2 }} title="Tamanho do texto">
      {!compact && <Type size={13} color="var(--ink-soft)" style={{ margin: '0 4px' }} />}
      <button
        type="button"
        onClick={decrease}
        disabled={!canDecrease}
        aria-label="Diminuir tamanho do texto"
        style={btnStyle(canDecrease)}
      >
        <Minus size={13} />
      </button>
      <button
        type="button"
        onClick={increase}
        disabled={!canIncrease}
        aria-label="Aumentar tamanho do texto"
        style={btnStyle(canIncrease)}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6, border: 'none',
    background: 'transparent', cursor: enabled ? 'pointer' : 'not-allowed',
    color: enabled ? 'var(--ink)' : 'var(--line)',
  };
}
