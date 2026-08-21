import { Headphones, MicOff, VolumeX } from 'lucide-react';
import Avatar from './Avatar';
import type { ParticipanteVoz } from '../hooks/useVoiceChannel';

interface VoiceGridProps {
  nomeCanal: string;
  participantes: ParticipanteVoz[];
  conectando: boolean;
  erro: string | null;
}

export default function VoiceGrid({ nomeCanal, participantes, conectando, erro }: VoiceGridProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-outline-variant/60 px-6 py-4">
        <Headphones size={16} className="text-tertiary" />
        <span className="text-sm font-bold text-on-surface">{nomeCanal}</span>
      </div>

      {conectando && (
        <p className="p-6 text-sm text-on-surface-variant">Conectando ao canal de voz…</p>
      )}

      {erro && (
        <div className="m-4 flex items-center gap-2 rounded-lg bg-error-container/20 px-4 py-3 text-sm text-error">
          <VolumeX size={16} /> Não foi possível conectar: {erro}
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-auto p-6 sm:grid-cols-3 lg:grid-cols-4">
        {participantes.map(p => (
          <div
            key={p.identity}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border bg-surface-container-high py-8 transition-all ${p.isSpeaking ? 'border-tertiary shadow-glow-tertiary' : 'border-outline-variant/40'}`}
          >
            <Avatar nome={p.nome} foto={p.foto} moldura={p.moldura} size={64} />
            <div className="flex items-center gap-1.5">
              {!p.micEnabled && <MicOff size={13} className="text-error" />}
              <span className="max-w-[120px] truncate text-sm font-semibold text-on-surface">
                {p.nome}{p.isLocal ? ' (você)' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
