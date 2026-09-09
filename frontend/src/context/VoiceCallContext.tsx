// context/VoiceCallContext.tsx
//
// Antes, cada tela de comunidade (ComunidadeRoom.tsx) chamava
// useVoiceChannel() localmente — então ao navegar pra outra tela
// (chat, perfil, outra comunidade) o componente desmontava, o hook ia
// junto, e a ligação de voz caía. Esse Context resolve isso: o
// useVoiceChannel() passa a viver AQUI, uma única vez, na raiz do App
// (acima das <Routes>), então a Room do LiveKit sobrevive a qualquer
// navegação — só cai quando a pessoa clicar em "Sair da chamada" de
// verdade (ou fechar a aba).
//
// Ver FloatingVoiceWidget.tsx: quando conectado e a pessoa não está na
// tela da comunidade dona da call, mostra uma bolha flutuante que pode
// ser expandida de volta pra tela normal.
import { createContext, useContext, type ReactNode } from 'react';
import { useVoiceChannel } from '../hooks/useVoiceChannel';

type VoiceCallValue = ReturnType<typeof useVoiceChannel>;

const VoiceCallContext = createContext<VoiceCallValue | null>(null);

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const voz = useVoiceChannel();
  return <VoiceCallContext.Provider value={voz}>{children}</VoiceCallContext.Provider>;
}

/** Hook de acesso à chamada de voz global — substitui o antigo
 * `useVoiceChannel()` direto dentro das páginas. */
export function useVoiceCall(): VoiceCallValue {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) {
    throw new Error('useVoiceCall precisa ser usado dentro de <VoiceCallProvider>.');
  }
  return ctx;
}
