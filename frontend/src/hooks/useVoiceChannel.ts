import { useCallback, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { sounds } from '../utils/sounds';

export interface ParticipanteVoz {
  identity: string;
  nome: string;
  foto: string | null;
  moldura: string | null;
  isSpeaking: boolean;
  micEnabled: boolean;
  isLocal: boolean;
}

// A metadata do token (ver backend/internal/handlers/sala_handler.go,
// método Entrar) já carrega {nome, foto, moldura} do usuário — assim não
// precisamos de um endpoint extra de "membros" só pra desenhar o avatar
// certo em cada tile de voz.
function parseMetadata(raw: string): { foto: string | null; moldura: string | null } {
  if (!raw) return { foto: null, moldura: null };
  try {
    const m = JSON.parse(raw) as { foto?: string; moldura?: string };
    return { foto: m.foto ?? null, moldura: m.moldura ?? null };
  } catch {
    return { foto: null, moldura: null };
  }
}

function toParticipante(p: Participant, isLocal: boolean): ParticipanteVoz {
  const { foto, moldura } = parseMetadata(p.metadata ?? '');
  return {
    identity: p.identity,
    nome: p.name || p.identity,
    foto,
    moldura,
    isSpeaking: p.isSpeaking,
    micEnabled: p.isMicrophoneEnabled,
    isLocal,
  };
}

/**
 * Gerencia uma sala de voz do LiveKit diretamente (sem os componentes
 * prontos de @livekit/components-react) — assim os controles de
 * mute/deafen podem morar na barra fixa da sidebar (fora da área do
 * canal/chat ativo), exatamente como no Discord, em vez de ficarem presos
 * dentro de uma árvore <LiveKitRoom> específica de uma tela.
 */
export function useVoiceChannel() {
  const roomRef = useRef<Room | null>(null);
  const [canalId, setCanalId] = useState<number | null>(null);
  const [nomeCanal, setNomeCanal] = useState<string>('');
  const [conectando, setConectando] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [participantes, setParticipantes] = useState<ParticipanteVoz[]>([]);

  const refreshParticipantes = useCallback(() => {
    const room = roomRef.current;
    if (!room) { setParticipantes([]); return; }
    const lista: ParticipanteVoz[] = [toParticipante(room.localParticipant, true)];
    room.remoteParticipants.forEach(p => lista.push(toParticipante(p, false)));
    setParticipantes(lista);
  }, []);

  // Aplica o estado de deafen a todas as publicações de áudio remotas já
  // conhecidas — chamado tanto ao alternar o deafen quanto quando um novo
  // participante entra enquanto já estamos surdos.
  const aplicarDeafenRemoto = useCallback((sur: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    room.remoteParticipants.forEach(p => {
      p.audioTrackPublications.forEach(pub => {
        if (pub.kind === Track.Kind.Audio) pub.setEnabled(!sur);
      });
    });
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect();
      roomRef.current = null;
    }
    setCanalId(null);
    setNomeCanal('');
    setConectado(false);
    setParticipantes([]);
  }, []);

  const connect = useCallback(async (novoCanalId: number, nome: string, token: string, url: string) => {
    // Trocando de canal de voz: encerra a conexão anterior primeiro.
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    setConectando(true);
    setErro(null);
    setCanalId(novoCanalId);
    setNomeCanal(nome);

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => {
      sounds.chamadaEntrada();
      refreshParticipantes();
    });
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipantes);
    room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipantes);
    room.on(RoomEvent.TrackMuted, refreshParticipantes);
    room.on(RoomEvent.TrackUnmuted, refreshParticipantes);
    room.on(RoomEvent.TrackSubscribed, (track, pub) => {
      if (track.kind === Track.Kind.Audio) {
        track.attach(); // cria o <audio> e já toca
        pub.setEnabled(true);
      }
      refreshParticipantes();
    });
    room.on(RoomEvent.Disconnected, () => {
      setConectado(false);
      setParticipantes([]);
    });

    try {
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(!muted);
      setConectado(true);
      refreshParticipantes();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conectar ao canal de voz.');
      roomRef.current = null;
      setCanalId(null);
    } finally {
      setConectando(false);
    }
  }, [muted, refreshParticipantes]);

  const toggleMuted = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      void roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
      return next;
    });
  }, []);

  const toggleDeafened = useCallback(() => {
    setDeafened(prev => {
      const next = !prev;
      aplicarDeafenRemoto(next);
      // Ensurdecer também muta o microfone (como no Discord) — desmutar o
      // fone não desmuta o mic automaticamente, precisa dos dois cliques.
      if (next && !muted) {
        setMuted(true);
        void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      }
      return next;
    });
  }, [aplicarDeafenRemoto, muted]);

  return {
    canalId, nomeCanal, conectando, conectado, erro, muted, deafened, participantes,
    connect, disconnect, toggleMuted, toggleDeafened,
  };
}
