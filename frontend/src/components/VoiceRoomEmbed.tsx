// components/VoiceRoomEmbed.tsx
import { useMemo, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ChevronUp, ChevronDown, MicOff, Users, Volume1, Volume2, VolumeX, UserCircle2 } from 'lucide-react';
import type { Room } from 'livekit-client';
import { RemoteParticipant, LocalParticipant } from 'livekit-client';
import Avatar from './Avatar';

interface VoiceRoomEmbedProps {
  room: Room;
  onParticipantVolumeChange: (identity: string, volume: number) => void;
  onToggleLocalMute: (identity: string) => void;
  onViewProfile: (usuarioId: number) => void;
}

function ParticipantMenu({
  identity,
  nome,
  isLocal,
  volume,
  mutadoParaMim,
  onVolumeChange,
  onToggleMute,
  onViewProfile,
  onClose,
}: {
  identity: string;
  nome: string;
  isLocal: boolean;
  volume: number;
  mutadoParaMim: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onViewProfile: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div
        className="glass-panel absolute w-56 rounded-xl p-3 shadow-2xl"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-2 truncate px-1 text-xs font-bold text-on-surface">{nome}</p>
        {!isLocal && (
          <>
            <button
              onClick={onToggleMute}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
            >
              <VolumeX size={15} className={mutadoParaMim ? 'text-error' : ''} />
              {mutadoParaMim ? 'Reativar áudio' : 'Silenciar para mim'}
            </button>
            <div className="px-2 py-2">
              <div className="mb-1.5 flex items-center gap-2 text-xs text-on-surface-variant">
                {volume === 0 ? <VolumeX size={13} /> : volume < 1 ? <Volume1 size={13} /> : <Volume2 size={13} />}
                Volume ({Math.round(volume * 100)}%)
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={volume}
                onChange={e => onVolumeChange(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </>
        )}
        <button
          onClick={onViewProfile}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
        >
          <UserCircle2 size={15} /> Ver perfil
        </button>
      </div>
    </div>
  );
}

function ParticipantsBar({
  onParticipantVolumeChange,
  onToggleLocalMute,
  onViewProfile,
}: Omit<VoiceRoomEmbedProps, 'room'>) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuAberto, setMenuAberto] = useState<{
    identity: string;
    nome: string;
    isLocal: boolean;
    usuarioId: number;
  } | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [mutados, setMutados] = useState<Set<string>>(new Set());

  const isSpeaking = (participant: RemoteParticipant | LocalParticipant) =>
    'isSpeaking' in participant ? participant.isSpeaking : false;

  const getParticipantMeta = (participant: RemoteParticipant | LocalParticipant) => {
    try {
      if (participant.metadata) {
        return JSON.parse(participant.metadata) as {
          nome?: string;
          foto?: string;
          moldura?: string;
        };
      }
    } catch {
      return {};
    }
  };

  const allParticipants = useMemo(() => {
    const local = localParticipant.localParticipant;
    const remoteList = participants;

    const participantMap = new Map<
      string,
      { participant: RemoteParticipant | LocalParticipant; isLocal: boolean }
    >();

    if (local) {
      participantMap.set(local.identity, { participant: local, isLocal: true });
    }

    remoteList.forEach(p => {
      if (!participantMap.has(p.identity)) {
        participantMap.set(p.identity, { participant: p, isLocal: false });
      }
    });

    return Array.from(participantMap.values());
  }, [participants, localParticipant.localParticipant]);

  if (allParticipants.length === 0) return null;

  function abrirMenu(identity: string, nome: string, isLocal: boolean) {
    const usuarioId = parseInt(identity, 10);
    if (isNaN(usuarioId) || usuarioId <= 0) {
      console.warn(`[VoiceRoom] Não foi possível parsear usuarioId da identity: "${identity}"`);
    }
    setMenuAberto({
      identity,
      nome,
      isLocal,
      usuarioId: isNaN(usuarioId) ? 0 : usuarioId,
    });
  }

  return (
    <div className="border-t border-outline-variant/20 bg-surface-container-low/90 backdrop-blur-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high/50"
      >
        <div className="flex items-center gap-2">
          <Users size={14} />
          <span className="text-xs font-medium">
            {allParticipants.length} participante
            {allParticipants.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {allParticipants.map(({ participant, isLocal }) => {
            const meta = getParticipantMeta(participant);
            const nome =
              meta.nome || participant.name || participant.identity || 'Usuário';
            const speaking = isSpeaking(participant);
            const micEnabled =
              participant instanceof RemoteParticipant
                ? participant.isMicrophoneEnabled
                : true;
            const mutado = mutados.has(participant.identity);

            return (
              <button
                key={`${participant.identity}-${isLocal ? 'local' : 'remote'}`}
                onClick={() => abrirMenu(participant.identity, nome, isLocal)}
                className={`flex items-center gap-2 rounded-lg bg-surface-container-high/60 px-3 py-1.5 transition-colors hover:bg-surface-container-highest ${
                  speaking
                    ? 'ring-2 ring-tertiary ring-offset-2 ring-offset-surface-container-low'
                    : ''
                }`}
              >
                <Avatar
                  nome={nome}
                  foto={meta.foto}
                  moldura={meta.moldura}
                  size={24}
                />
                <span className="max-w-[100px] truncate text-xs text-on-surface">
                  {nome}
                  {isLocal && ' (você)'}
                </span>
                {mutado && <VolumeX size={12} className="text-error" />}
                {!micEnabled && !isLocal && (
                  <MicOff size={12} className="text-error" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {menuAberto && (
        <ParticipantMenu
          identity={menuAberto.identity}
          nome={menuAberto.nome}
          isLocal={menuAberto.isLocal}
          volume={volumes[menuAberto.identity] ?? 1}
          mutadoParaMim={mutados.has(menuAberto.identity)}
          onVolumeChange={v => {
            setVolumes(prev => ({ ...prev, [menuAberto.identity]: v }));
            onParticipantVolumeChange(menuAberto.identity, v);
          }}
          onToggleMute={() => {
            setMutados(prev => {
              const next = new Set(prev);
              if (next.has(menuAberto.identity)) {
                next.delete(menuAberto.identity);
              } else {
                next.add(menuAberto.identity);
              }
              return next;
            });
            onToggleLocalMute(menuAberto.identity);
          }}
          onViewProfile={() => {
            if (menuAberto.usuarioId > 0) {
              onViewProfile(menuAberto.usuarioId);
            }
            setMenuAberto(null);
          }}
          onClose={() => setMenuAberto(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL - CORREÇÃO FINAL
// ============================================================
export default function VoiceRoomEmbed({
  room,
  onParticipantVolumeChange,
  onToggleLocalMute,
  onViewProfile,
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
        {/*
          ⚠️ IMPORTANTE: connect={true} é o padrão e o comportamento correto!
          
          connect={false} faz o LiveKitRoom desconectar ativamente a room 
          que você passou - isso é um comportamento interno do componente.
          
          Como token e serverUrl são undefined, o componente não tenta
          reconectar, apenas usa a room já conectada pelo useVoiceChannel.
        */}
        <LiveKitRoom
          room={room}
          serverUrl={undefined}
          token={undefined}
          connect={true}  // ← CORREÇÃO: true (padrão) em vez de false
          data-lk-theme="default"
          style={{ height: '100%' }}
        >
          <VideoConference />
          <ParticipantsBar
            onParticipantVolumeChange={onParticipantVolumeChange}
            onToggleLocalMute={onToggleLocalMute}
            onViewProfile={onViewProfile}
          />
        </LiveKitRoom>
      </div>
    </div>
  );
}