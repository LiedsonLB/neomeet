// components/VoiceRoomEmbed.tsx
//
// Host da árvore do @livekit/components-react (fornece o Room via
// RoomContext pros hooks usados em VoiceConferenceCustom.tsx — não abre
// uma segunda conexão, usa a MESMA Room já conectada pelo
// VoiceCallContext) e ponto de entrada da grade de vídeo customizada,
// que substitui o <VideoConference/> pronto por causa dos requisitos
// específicos daqui: várias opções de layout, menu de contexto (botão
// direito) com mutar/gravar áudio/ver perfil, e tela cheia pro
// compartilhamento de tela.
//
// IMPORTANTE: aqui é de propósito que NÃO se usa o componente
// <LiveKitRoom> do @livekit/components-react. Ele parece só um wrapper
// inofensivo, mas por baixo roda um useEffect cujo cleanup chama
// SEMPRE room.disconnect() ao desmontar — inclusive quando `room` foi
// passado de fora já conectado e `connect`/`token`/`serverUrl` nem são
// usados. Como este componente só é renderizado enquanto a tela da call
// está visível (ComunidadeRoom.tsx alterna isso ao abrir o perfil, um
// canal de texto, ou trocar de comunidade), qualquer desmontagem sua
// derrubava a chamada de voz de verdade — mesmo a Room em si vivendo no
// VoiceCallContext, acima das rotas. `RoomContext.Provider` sozinho não
// tem esse efeito colateral: só expõe a mesma Room pros hooks
// (useTracks, useLocalParticipant etc.), sem gerenciar o ciclo de vida
// da conexão.
import '@livekit/components-styles';
import { RoomContext } from '@livekit/components-react';
import type { Room } from 'livekit-client';
import VoiceConferenceCustom from './VoiceConferenceCustom';

interface VoiceRoomEmbedProps {
  room: Room;
  cameraLigada: boolean;
  compartilhandoTela: boolean;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  gravando: Record<string, boolean>;
  onParticipantVolumeChange: (identity: string, volume: number) => void;
  onToggleLocalMute: (identity: string) => void;
  onViewProfile: (usuarioId: number) => void;
  onIniciarGravacaoAudio: (identity: string) => void;
  onPararEBaixarGravacaoAudio: (identity: string, nomeArquivo: string) => void;
}

export default function VoiceRoomEmbed({
  room,
  cameraLigada,
  compartilhandoTela,
  onToggleCamera,
  onToggleScreenShare,
  gravando,
  onParticipantVolumeChange,
  onToggleLocalMute,
  onViewProfile,
  onIniciarGravacaoAudio,
  onPararEBaixarGravacaoAudio,
}: VoiceRoomEmbedProps) {
  if (!room) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0A0C14]">
        <p className="text-on-surface-variant">Conectando ao canal de voz...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0A0C14]">
      <div className="relative min-h-0 flex-1">
        <div className="lk-room-container" data-lk-theme="default" style={{ height: '100%' }}>
          <RoomContext.Provider value={room}>
            <VoiceConferenceCustom
              cameraLigada={cameraLigada}
              compartilhandoTela={compartilhandoTela}
              onToggleCamera={onToggleCamera}
              onToggleScreenShare={onToggleScreenShare}
              gravando={gravando}
              onParticipantVolumeChange={onParticipantVolumeChange}
              onToggleLocalMute={onToggleLocalMute}
              onViewProfile={onViewProfile}
              onIniciarGravacaoAudio={onIniciarGravacaoAudio}
              onPararEBaixarGravacaoAudio={onPararEBaixarGravacaoAudio}
            />
          </RoomContext.Provider>
        </div>
      </div>
    </div>
  );
}