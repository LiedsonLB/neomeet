// components/PresencaBadge.tsx
//
// Mostra a "presença rica" de um usuário — em vez do simples online/offline
// (ver Avatar.tsx), aqui dá pra ver o que a pessoa está fazendo agora
// ("🎮 Jogando Minecraft", "🎙️ Na resenha") como no pedido original:
//
//   🟢 Na resenha         🎮 Jogando Minecraft
//   🟡 Disponível
//
import { Gamepad2, Mic, Circle } from 'lucide-react';
import type { AtividadeTipo } from '../api/types';

interface PresencaBadgeProps {
  online: boolean;
  atividade?: string | null;
  atividadeTipo?: AtividadeTipo | string | null;
  /** 'sm' pra dentro de cards de lista, 'md' pra cabeçalho de perfil. */
  size?: 'sm' | 'md';
}

const CORES: Record<string, string> = {
  jogo: 'text-secondary',
  voz: 'text-tertiary',
  '': 'text-outline',
};

export default function PresencaBadge({ online, atividade, atividadeTipo, size = 'sm' }: PresencaBadgeProps) {
  if (!online) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-highest px-2.5 py-1 text-on-surface-variant ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}>
        <Circle size={8} className="fill-outline text-outline" /> Offline
      </span>
    );
  }

  const tipo = atividadeTipo ?? '';
  const cor = CORES[tipo] ?? CORES[''];
  const Icone = tipo === 'jogo' ? Gamepad2 : tipo === 'voz' ? Mic : null;

  return (
    <div className={`flex flex-col gap-0.5 ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-tertiary/30 bg-tertiary/10 px-2.5 py-1 text-tertiary">
        <Circle size={8} className="animate-pulse fill-tertiary text-tertiary" /> Na resenha
      </span>
      {atividade && (
        <span className={`inline-flex items-center gap-1.5 pl-1 font-medium ${cor}`}>
          {Icone && <Icone size={12} />} {atividade}
        </span>
      )}
    </div>
  );
}
