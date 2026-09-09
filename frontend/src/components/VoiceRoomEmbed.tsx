// components/VoiceRoomEmbed.tsx
//
// Host da <LiveKitRoom> (usa a MESMA Room já conectada pelo
// VoiceCallContext — não abre uma segunda conexão) e ponto de entrada
// da grade de vídeo customizada (ver VoiceConferenceCustom.tsx), que
// substitui o <VideoConference/> pronto do @livekit/components-react
// por causa dos requisitos específicos daqui: várias opções de layout,
// menu de contexto (botão direito) com mutar/gravar áudio/ver perfil,
// e tela cheia pro compartilhamento de tela.
import '@livekit/components-styles';
import { LiveKitRoom } from '@livekit/components-react';
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
        <LiveKitRoom
          room={room}
          serverUrl={undefined}
          token={undefined}
          connect={true}
          data-lk-theme="default"
          style={{ height: '100%' }}
        >
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
        </LiveKitRoom>
      </div>
    </div>
  );
}
