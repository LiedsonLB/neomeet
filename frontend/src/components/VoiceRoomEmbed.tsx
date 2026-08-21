// components/VoiceRoomEmbed.tsx
import { useEffect, useState } from 'react';
import { 
  LiveKitRoom, 
  VideoConference, 
  useParticipants, 
  useLocalParticipant,
  useRoomContext 
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Loader2, VolumeX, ChevronUp, ChevronDown, MicOff, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { salaApi } from '../api/client';
import Avatar from './Avatar';
import { RemoteParticipant, LocalParticipant } from 'livekit-client';

interface VoiceRoomEmbedProps {
  canalId: number;
  canalNome: string;
  onDisconnect: () => void;
}

// Componente para a barra de participantes recolhível
function ParticipantsBar() {
  const room = useRoomContext();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const [isExpanded, setIsExpanded] = useState(true);

  // Verifica se o participante está falando
  const isSpeaking = (participant: RemoteParticipant | LocalParticipant) => {
    if ('isSpeaking' in participant) {
      return participant.isSpeaking;
    }
    return false;
  };

  // Pega o nome do participante
  const getParticipantName = (participant: RemoteParticipant | LocalParticipant) => {
    // Para participantes remotos, o nome pode estar em identity ou name
    if ('name' in participant && participant.name) {
      return participant.name;
    }
    // Para o participante local, o nome vem do localParticipant
    if (participant.identity) {
      return participant.identity;
    }
    return 'Usuário';
  };

  // Pega a foto do participante do metadata
  const getParticipantPhoto = (participant: RemoteParticipant | LocalParticipant) => {
    try {
      if (participant.metadata) {
        const metadata = JSON.parse(participant.metadata);
        return metadata.foto;
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  // Lista de participantes (local + remotos)
  const allParticipants = [
    { participant: localParticipant.localParticipant, isLocal: true },
    ...participants.map(p => ({ participant: p, isLocal: false }))
  ].filter(({ participant }) => participant !== undefined);

  if (allParticipants.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-outline-variant/20 bg-surface-container-low/90 backdrop-blur-sm">
      {/* Barra de controle com setinha */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={14} />
          <span className="text-xs font-medium">
            {allParticipants.length} participante{allParticipants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={16} className="text-on-surface-variant" />
          ) : (
            <ChevronUp size={16} className="text-on-surface-variant" />
          )}
        </div>
      </button>

      {/* Lista de participantes - aparece/esconde com animação */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {allParticipants.map(({ participant, isLocal }) => {
            const name = getParticipantName(participant);
            const photo = getParticipantPhoto(participant);
            const speaking = isSpeaking(participant);
            const micEnabled = participant instanceof RemoteParticipant 
              ? participant.isMicrophoneEnabled 
              : true;

            return (
              <div
                key={participant.identity}
                className={`flex items-center gap-2 rounded-lg bg-surface-container-high/60 px-3 py-1.5 ${
                  speaking ? 'ring-2 ring-tertiary ring-offset-2 ring-offset-surface-container-low' : ''
                }`}
              >
                <Avatar 
                  nome={name} 
                  foto={photo}
                  size={24} 
                />
                <span className="max-w-[100px] truncate text-xs text-on-surface">
                  {name}
                  {isLocal && ' (você)'}
                </span>
                {!micEnabled && participant instanceof RemoteParticipant && (
                  <MicOff size={12} className="text-error" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Componente principal
export default function VoiceRoomEmbed({ canalId, canalNome, onDisconnect }: VoiceRoomEmbedProps) {
  const { session } = useAuth();
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !canalId) return;

    const entrarSala = async () => {
      try {
        const response = await salaApi.entrar(session, canalId);
        setToken(response.token);
        setUrl(response.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao entrar na sala');
      } finally {
        setLoading(false);
      }
    };

    entrarSala();
  }, [session, canalId]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
        <Loader2 size={22} className="spin-icon" />
        <p className="text-sm text-on-surface-variant">Conectando ao canal de voz…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <VolumeX size={32} className="text-error" />
        <p className="text-sm text-error">{error}</p>
        <button
          onClick={onDisconnect}
          className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Desconectar
        </button>
      </div>
    );
  }

  if (!token || !url) return null;

  return (
    <div className="flex h-full w-full flex-col bg-[#0A0C14]">
      {/* Barra superior no estilo Resenha */}
      {/* <div className="glass-panel z-10 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-headline-md font-bold text-primary">{canalNome}</span>
          <div className="flex items-center gap-2 rounded-full border border-error/20 bg-error/10 px-3 py-1 text-error">
            <div className="h-2 w-2 rounded-full bg-error animate-pulse" />
            <span className="text-label-sm font-bold uppercase tracking-wider">Ao vivo</span>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="rounded-lg bg-error/10 px-4 py-2 text-sm text-error transition-colors hover:bg-error/20"
        >
          Sair
        </button>
      </div> */}

      {/* Área do vídeo com flex-1 ocupando todo o espaço disponível */}
      <div className="min-h-0 flex-1 relative">
        <LiveKitRoom
          serverUrl={url}
          token={token}
          connect
          data-lk-theme="default"
          style={{ height: '100%' }}
          onDisconnected={onDisconnect}
        >
          <VideoConference />
          <ParticipantsBar />
        </LiveKitRoom>
      </div>
    </div>
  );
}