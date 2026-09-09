// components/FloatingVoiceWidget.tsx
//
// Bolha flutuante mostrada em QUALQUER tela (fora da própria sala da
// comunidade dona da call, que já tem sua própria barra "Voz conectada"
// na sidebar — ver ComunidadeRoom.tsx) enquanto a pessoa está numa
// chamada de voz. Clicar em "expandir" navega de volta pra sala e
// reabre a visualização normal da call.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Headphones, PhoneOff, Maximize2, Users, GripHorizontal } from 'lucide-react';
import { useVoiceCall } from '../context/VoiceCallContext';
import Avatar from './Avatar';

export default function FloatingVoiceWidget() {
  const voz = useVoiceCall();
  const navigate = useNavigate();
  const location = useLocation();
  const [minimizado, setMinimizado] = useState(false);

  if (!voz.conectado || !voz.comunidadeId) return null;

  // Na própria tela da comunidade dona da call, a sidebar já mostra a
  // barra "Voz conectada" com os mesmos controles — evita duplicar a UI.
  const naTelaDaCall = location.pathname === `/comunidades/${voz.comunidadeId}`;
  if (naTelaDaCall) return null;

  function expandir() {
    navigate(`/comunidades/${voz.comunidadeId}`);
  }

  const quemFala = voz.participantes.find(p => !p.isLocal && p.isSpeaking) ?? voz.participantes.find(p => !p.isLocal);

  return (
    <div
      className="fixed bottom-4 right-4 z-[80] w-64 overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-highest shadow-2xl"
      role="complementary"
      aria-label="Chamada de voz em andamento"
    >
      <button
        onClick={() => setMinimizado(v => !v)}
        className="flex w-full items-center justify-center gap-1 border-b border-outline-variant/40 bg-surface-container-high/60 py-1 text-outline hover:text-on-surface-variant"
        title={minimizado ? 'Expandir card' : 'Minimizar card'}
      >
        <GripHorizontal size={12} />
      </button>

      {!minimizado && (
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <Avatar
            nome={quemFala?.nome ?? voz.nomeCanal}
            foto={quemFala?.foto}
            moldura={quemFala?.moldura}
            size={34}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-tertiary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tertiary" /> Voz conectada
            </div>
            <div className="truncate text-[11px] text-on-surface-variant">
              {voz.nomeCanal} · {voz.comunidadeNome}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[10px] text-outline">
            <Users size={11} /> {voz.participantes.length}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={voz.toggleMuted}
          title={voz.muted ? 'Ativar microfone' : 'Mutar microfone'}
          className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors ${voz.muted ? 'bg-error/15 text-error' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          {voz.muted ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          onClick={voz.toggleDeafened}
          title={voz.deafened ? 'Ativar áudio' : 'Ensurdecer'}
          className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors ${voz.deafened ? 'bg-error/15 text-error' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          <Headphones size={15} />
        </button>
        <button
          onClick={expandir}
          title="Voltar para a chamada"
          className="flex flex-1 items-center justify-center rounded-lg py-1.5 text-primary transition-colors hover:bg-primary-container/20"
        >
          <Maximize2 size={15} />
        </button>
        <button
          onClick={() => void voz.disconnect()}
          title="Sair da chamada"
          className="flex flex-1 items-center justify-center rounded-lg py-1.5 text-error transition-colors hover:bg-error/15"
        >
          <PhoneOff size={15} />
        </button>
      </div>
    </div>
  );
}
