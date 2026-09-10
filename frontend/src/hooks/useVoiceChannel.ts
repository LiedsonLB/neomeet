import { useCallback, useRef, useState } from 'react';
import { Room, RoomEvent, Track, RemoteAudioTrack, type Participant } from 'livekit-client';
import { sounds } from '../utils/sounds';

export interface ParticipanteVoz {
  identity: string;
  nome: string;
  foto: string | null;
  moldura: string | null;
  isSpeaking: boolean;
  micEnabled: boolean;
  /** Ensurdecido (não está ouvindo ninguém) — visível pra quem está fora
   * da call também, ver publicarDeafenedLocal/parseMetadata abaixo. */
  deafened: boolean;
  /** Câmera ligada. */
  cameraOn: boolean;
  /** Compartilhando tela. */
  screenShare: boolean;
  isLocal: boolean;
  /** Volume local (só afeta o que EU escuto, não é enviado a ninguém). */
  volume: number;
  /** Silenciado só pra mim (independe do deafen geral). */
  mutadoParaMim: boolean;
}

// A metadata do token (ver backend/internal/handlers/sala_handler.go,
// método Entrar) já carrega {nome, foto, moldura} do usuário — assim não
// precisamos de um endpoint extra de "membros" só pra desenhar o avatar
// certo em cada tile de voz. O campo "deafened" não vem do token: é
// publicado depois, via localParticipant.setMetadata() (ver
// publicarDeafenedLocal), pois é um estado que só o próprio cliente sabe
// (o LiveKit não tem noção de "ensurdecido").
function parseMetadata(raw: string): { foto: string | null; moldura: string | null; deafened: boolean } {
  if (!raw) return { foto: null, moldura: null, deafened: false };
  try {
    const m = JSON.parse(raw) as { foto?: string; moldura?: string; deafened?: boolean };
    return { foto: m.foto ?? null, moldura: m.moldura ?? null, deafened: m.deafened ?? false };
  } catch {
    return { foto: null, moldura: null, deafened: false };
  }
}

/**
 * Gerencia uma sala de voz do LiveKit diretamente (sem os componentes
 * prontos de @livekit/components-react) — assim os controles de
 * mute/deafen podem morar na barra fixa da sidebar (fora da área do
 * canal/chat ativo), exatamente como no Discord, em vez de ficarem presos
 * dentro de uma árvore <LiveKitRoom> específica de uma tela.
 *
 * A `Room` conectada aqui também é exposta (`room`) pra qualquer outro
 * componente que precise renderizar vídeo/tela compartilhada em cima da
 * MESMA conexão (ver VoiceRoomEmbed.tsx) — evita abrir uma segunda conexão
 * paralela, que era a causa do mic/deafen "só funcionar na aside".
 */
export function useVoiceChannel() {
  const roomRef = useRef<Room | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [canalId, setCanalId] = useState<number | null>(null);
  const [nomeCanal, setNomeCanal] = useState<string>('');
  // Comunidade dona do canal conectado — usado pelo widget flutuante
  // (FloatingVoiceWidget.tsx) pra saber pra onde navegar ao "expandir" a
  // call, e pelo ComunidadeRoom pra decidir se reabre a visualização de
  // voz ao entrar de novo na tela dessa mesma comunidade.
  const [comunidadeId, setComunidadeId] = useState<number | null>(null);
  const [comunidadeNome, setComunidadeNome] = useState<string>('');
  const [conectando, setConectando] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [participantes, setParticipantes] = useState<ParticipanteVoz[]>([]);
  const [compartilhandoTela, setCompartilhandoTela] = useState(false);
  const [cameraLigada, setCameraLigada] = useState(false);
  // Identities com gravação de áudio em andamento (ver
  // iniciarGravacaoAudio/pararEBaixarGravacaoAudio) — só usado pra pintar
  // o ícone de "gravando" no menu de contexto do participante.
  const [gravando, setGravando] = useState<Record<string, boolean>>({});

  const volumesRef = useRef<Record<string, number>>({});
  const mutadosRef = useRef<Set<string>>(new Set());
  // Espelha `deafened` de forma síncrona (o state React é assíncrono) —
  // usado dentro de toParticipante/listeners do LiveKit, no mesmo padrão
  // de mutadosRef/volumesRef acima.
  const deafenedRef = useRef(false);
  const gravadoresRef = useRef<Record<string, { recorder: MediaRecorder; chunks: Blob[] }>>({});
  // Guard síncrono contra chamadas duplicadas de connect() — um guard só
  // em state (ex.: `conectando`) não é suficiente porque setState é
  // assíncrono/batched: um segundo clique (ou o StrictMode do React
  // invocando o handler 2x em dev) pode disparar connect() de novo ANTES
  // do primeiro `setConectando(true)` re-renderizar. Isso é exatamente o
  // que causava conectar, publicar o mic e cair pra reconectar em outra
  // sala/token um instante depois: eram duas conexões concorrentes pra
  // canais diferentes (ou a mesma, mas com token novo) brigando entre si.
  const conectandoRef = useRef(false);

  const toParticipante = useCallback((p: Participant, isLocal: boolean): ParticipanteVoz => {
    const { foto, moldura, deafened: deafenedRemoto } = parseMetadata(p.metadata ?? '');
    return {
      identity: p.identity,
      nome: p.name || p.identity,
      foto,
      moldura,
      isSpeaking: p.isSpeaking,
      micEnabled: p.isMicrophoneEnabled,
      // Pra mim mesmo, o estado "ao vivo" (deafenedRef) é mais confiável
      // que a metadata (que só chega depois de ida e volta com o
      // servidor) — pros outros, só dá pra saber pela metadata mesmo.
      deafened: isLocal ? deafenedRef.current : deafenedRemoto,
      cameraOn: p.isCameraEnabled,
      screenShare: p.isScreenShareEnabled,
      isLocal,
      volume: volumesRef.current[p.identity] ?? 1,
      mutadoParaMim: mutadosRef.current.has(p.identity),
    };
  }, []);

  const refreshParticipantes = useCallback(() => {
    const r = roomRef.current;
    if (!r) { setParticipantes([]); return; }
    const lista: ParticipanteVoz[] = [toParticipante(r.localParticipant, true)];
    r.remoteParticipants.forEach(p => lista.push(toParticipante(p, false)));
    setParticipantes(lista);
  }, [toParticipante]);

  // Aplica o estado de deafen a todas as publicações de áudio remotas já
  // conhecidas — chamado tanto ao alternar o deafen quanto quando um novo
  // participante entra enquanto já estamos surdos.
  const aplicarDeafenRemoto = useCallback((sur: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    r.remoteParticipants.forEach(p => {
      p.audioTrackPublications.forEach(pub => {
        if (pub.kind === Track.Kind.Audio) pub.setEnabled(!sur && !mutadosRef.current.has(p.identity));
      });
    });
  }, []);

  // Publica o "ensurdecido" na metadata do meu participante (precisa do
  // grant canUpdateOwnMetadata — ver backend/internal/handlers/
  // sala_handler.go) — assim quem ainda não entrou no canal também vê
  // esse selo (via ListParticipants), e quem já está na call vê em tempo
  // real pelo evento ParticipantMetadataChanged. Faz merge com a
  // metadata atual (nome/foto/moldura) em vez de substituir, senão a
  // troca perderia o avatar de quem já está conectado.
  const publicarDeafenedLocal = useCallback((sur: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    let meta: Record<string, unknown> = {};
    try {
      meta = r.localParticipant.metadata ? JSON.parse(r.localParticipant.metadata) : {};
    } catch {
      meta = {};
    }
    meta.deafened = sur;
    void r.localParticipant.setMetadata(JSON.stringify(meta)).catch(() => {
      // Token antigo em cache sem o grant canUpdateOwnMetadata, ou
      // servidor indisponível — falha silenciosa, só não propaga o selo
      // pra quem ainda não entrou na call.
    });
  }, []);

  const disconnect = useCallback(async () => {
    const r = roomRef.current;
    if (r) {
      try {
        await r.disconnect();
      } catch (e) {
        // Ignora erros ao desconectar (já pode estar desconectado)
        console.debug('[VoiceChannel] Erro ao desconectar (ignorado):', e);
      }
      roomRef.current = null;
    }
    // Encerra qualquer gravação de áudio pendente sem baixar nada (a
    // pessoa desconectou antes de clicar em "baixar").
    Object.values(gravadoresRef.current).forEach(({ recorder }) => {
      try { recorder.stop(); } catch { /* já parado */ }
    });
    gravadoresRef.current = {};
    volumesRef.current = {};
    mutadosRef.current = new Set();
    setRoom(null);
    setCanalId(null);
    setNomeCanal('');
    setComunidadeId(null);
    setComunidadeNome('');
    setConectado(false);
    setParticipantes([]);
    setCompartilhandoTela(false);
    setCameraLigada(false);
    setGravando({});
  }, []);

  const connect = useCallback(async (
    novoCanalId: number,
    nome: string,
    token: string,
    url: string,
    novaComunidadeId?: number,
    novaComunidadeNome?: string,
  ) => {
    // Já tem uma conexão em andamento (ou pra ESSE mesmo canal, ou pra
    // outro) — ignora a chamada extra em vez de deixar duas rodarem juntas.
    if (conectandoRef.current) return;
    conectandoRef.current = true;

    // Trocando de canal de voz: encerra a conexão anterior primeiro.
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {
        // Ignora erros ao desconectar
      }
      roomRef.current = null;
    }

    setConectando(true);
    setErro(null);
    setCanalId(novoCanalId);
    setNomeCanal(nome);
    setComunidadeId(novaComunidadeId ?? null);
    setComunidadeNome(novaComunidadeNome ?? '');
    setCompartilhandoTela(false);
    setCameraLigada(false);
    volumesRef.current = {};
    mutadosRef.current = new Set();
    deafenedRef.current = deafened;

    const r = new Room();
    roomRef.current = r;

    // ============================================================
    // LISTENERS DO LIVEKIT
    // ============================================================

    r.on(RoomEvent.ParticipantConnected, () => {
      sounds.chamadaEntrada();
      refreshParticipantes();
    });

    r.on(RoomEvent.ParticipantDisconnected, refreshParticipantes);
    r.on(RoomEvent.ActiveSpeakersChanged, refreshParticipantes);
    r.on(RoomEvent.TrackMuted, refreshParticipantes);
    r.on(RoomEvent.TrackUnmuted, refreshParticipantes);
    // Câmera/tela ligando ou desligando (local ou remoto) muda
    // isCameraEnabled/isScreenShareEnabled de quem publicou — precisa
    // recalcular a lista pro selo de "transmitindo" aparecer/sumir.
    r.on(RoomEvent.TrackPublished, refreshParticipantes);
    r.on(RoomEvent.TrackUnpublished, refreshParticipantes);
    r.on(RoomEvent.LocalTrackPublished, refreshParticipantes);
    // Alguém (inclusive eu) mudou o "ensurdecido" via
    // publicarDeafenedLocal — atualiza o selo na hora, sem esperar o
    // próximo evento de mic/track.
    r.on(RoomEvent.ParticipantMetadataChanged, refreshParticipantes);

    r.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.attach(); // cria o <audio> e já toca
        const audioTrack = track as RemoteAudioTrack;
        audioTrack.setVolume(volumesRef.current[participant.identity] ?? 1);
        pub.setEnabled(!deafened && !mutadosRef.current.has(participant.identity));
      }
      refreshParticipantes();
    });

    r.on(RoomEvent.Disconnected, () => {
      setConectado(false);
      setParticipantes([]);
    });

    // Soundboard: alguém (inclusive eu, se outra aba) tocou um som pra
    // sala inteira ouvir — recebido via LiveKit data channel, tocado
    // localmente a partir da mesma URL do arquivo (sem streaming de
    // áudio de verdade, só um "sinal" com a URL). Nota: NÃO existe
    // RoomEvent.DataChannel na API do livekit-client — o evento certo
    // pra receber mensagens de data channel é DataReceived, abaixo.
    r.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const texto = new TextDecoder().decode(payload);
        const msg = JSON.parse(texto) as { type?: string; url?: string };
        if (msg.type === 'soundboard' && msg.url) {
          const audio = new Audio(msg.url);
          audio.volume = 0.8;
          void audio.play().catch(() => { });
        }
        // Alguém começou a compartilhar a tela — toca o efeito sonoro
        // pra sala inteira ouvir (quem iniciou já tocou localmente em
        // toggleScreenShare, então isso é só pros outros participantes).
        if (msg.type === 'tela-compartilhada') {
          sounds.compartilharTela();
        }
      } catch {
        // payload não era do soundboard/tela — ignora
      }
    });

    // Se a pessoa parar o compartilhamento pelo painel nativo do
    // navegador (em vez do nosso botão), o LocalTrackUnpublished dispara
    // e precisamos refletir isso no estado (senão o botão fica "ligado"
    // pra sempre).
    r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (pub.source === Track.Source.ScreenShare) setCompartilhandoTela(false);
      if (pub.source === Track.Source.Camera) setCameraLigada(false);
      refreshParticipantes();
    });

    // ============================================================
    // Reconexão — só log em dev, sem efeito colateral nenhum.
    // ============================================================
    r.on(RoomEvent.Reconnecting, () => {
      if (import.meta.env.DEV) {
        console.debug('[LiveKit] Reconnecting...');
      }
    });

    r.on(RoomEvent.Reconnected, () => {
      if (import.meta.env.DEV) {
        console.debug('[LiveKit] Reconnected successfully');
      }
      refreshParticipantes();
    });

    try {
      await r.connect(url, token);
      await r.localParticipant.setMicrophoneEnabled(!muted);
      if (deafened) publicarDeafenedLocal(true);
      setRoom(r);
      setConectado(true);
      refreshParticipantes();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conectar ao canal de voz.');
      roomRef.current = null;
      setCanalId(null);
    } finally {
      setConectando(false);
      conectandoRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, deafened, refreshParticipantes, publicarDeafenedLocal]);

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
      deafenedRef.current = next;
      aplicarDeafenRemoto(next);
      publicarDeafenedLocal(next);
      // Ensurdecer também muta o microfone (como no Discord) — desmutar o
      // fone não desmuta o mic automaticamente, precisa dos dois cliques.
      if (next && !muted) {
        setMuted(true);
        void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      }
      refreshParticipantes();
      return next;
    });
  }, [aplicarDeafenRemoto, publicarDeafenedLocal, muted, refreshParticipantes]);

  // ---- controles por participante (menu de contexto no avatar) --------

  /** Ajusta o volume de UM participante só pra mim (0 a 2 = até 200%). */
  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    const v = Math.max(0, Math.min(2, volume));
    volumesRef.current[identity] = v;
    const participant = roomRef.current?.remoteParticipants.get(identity);
    participant?.audioTrackPublications.forEach(pub => {
      if (pub.track && pub.kind === Track.Kind.Audio) {
        (pub.track as RemoteAudioTrack).setVolume(v);
      }
    });
    refreshParticipantes();
  }, [refreshParticipantes]);

  /** Silencia/dessilencia UM participante só pra mim, sem afetar deafen geral. */
  const toggleLocalMute = useCallback((identity: string) => {
    const jaMutado = mutadosRef.current.has(identity);
    if (jaMutado) mutadosRef.current.delete(identity);
    else mutadosRef.current.add(identity);

    const participant = roomRef.current?.remoteParticipants.get(identity);
    participant?.audioTrackPublications.forEach(pub => {
      if (pub.kind === Track.Kind.Audio) pub.setEnabled(!deafened && !mutadosRef.current.has(identity));
    });
    refreshParticipantes();
  }, [deafened, refreshParticipantes]);

  /** Toca um som do soundboard pra mim e transmite pra todo mundo na
   * chamada ouvir também (cada cliente toca a URL localmente — não é
   * streaming de áudio de verdade, só um "sinal" via data channel). */
  const tocarSomParaTodos = useCallback((url: string) => {
    const r = roomRef.current;
    const audio = new Audio(url);
    audio.volume = 0.8;
    void audio.play().catch(() => { });
    if (r) {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'soundboard', url }));
      void r.localParticipant.publishData(payload, { reliable: true });
    }
  }, []);

  /** Liga/desliga a câmera local. */
  const toggleCamera = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      const next = !cameraLigada;
      await r.localParticipant.setCameraEnabled(next);
      setCameraLigada(next);
    } catch (e) {
      console.debug('[VoiceChannel] Erro ao alternar câmera:', e);
    }
  }, [cameraLigada]);

  /** Compartilha a tela inteira COM áudio do sistema (quando o navegador
   * suportar) — toca um efeito sonoro localmente e avisa o resto da sala
   * (via data channel) pra que todo mundo ouça o mesmo efeito. Parar o
   * compartilhamento (inclusive pelo painel nativo do navegador) é
   * refletido pelo listener de LocalTrackUnpublished, acima. */
  const toggleScreenShare = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      if (!compartilhandoTela) {
        await r.localParticipant.setScreenShareEnabled(true, { audio: true });
        setCompartilhandoTela(true);
        sounds.compartilharTela();
        const payload = new TextEncoder().encode(JSON.stringify({ type: 'tela-compartilhada' }));
        void r.localParticipant.publishData(payload, { reliable: true });
      } else {
        await r.localParticipant.setScreenShareEnabled(false);
        setCompartilhandoTela(false);
      }
    } catch (e) {
      // Pessoa cancelou o picker de tela do navegador, ou não deu
      // permissão — não é um erro de conexão, só ignora.
      console.debug('[VoiceChannel] Erro ao compartilhar tela (ignorado):', e);
    }
  }, [compartilhandoTela]);

  /** Começa a gravar o áudio recebido de UM participante remoto (usado no
   * menu de contexto do card dele, ver VoiceConferenceCustom.tsx). Grava
   * localmente via MediaRecorder — não depende de nenhum serviço externo
   * de gravação. Chame pararEBaixarGravacaoAudio pra encerrar e baixar. */
  const iniciarGravacaoAudio = useCallback((identity: string) => {
    const r = roomRef.current;
    if (!r) return;
    if (gravadoresRef.current[identity]) return; // já gravando
    const participant = r.remoteParticipants.get(identity);
    let trilha: RemoteAudioTrack | undefined;
    participant?.audioTrackPublications.forEach(pub => {
      if (pub.track && pub.kind === Track.Kind.Audio) trilha = pub.track as RemoteAudioTrack;
    });
    const mediaTrack = trilha?.mediaStreamTrack;
    if (!mediaTrack) return;
    try {
      const stream = new MediaStream([mediaTrack]);
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      gravadoresRef.current[identity] = { recorder, chunks };
      recorder.start();
      setGravando(prev => ({ ...prev, [identity]: true }));
    } catch (e) {
      console.debug('[VoiceChannel] Erro ao iniciar gravação de áudio:', e);
    }
  }, []);

  /** Encerra a gravação iniciada em iniciarGravacaoAudio e dispara o
   * download do arquivo (.webm) no navegador da pessoa. */
  const pararEBaixarGravacaoAudio = useCallback((identity: string, nomeArquivo: string) => {
    const entry = gravadoresRef.current[identity];
    if (!entry) return;
    entry.recorder.onstop = () => {
      const blob = new Blob(entry.chunks, { type: entry.recorder.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nomeSeguro = nomeFileNameSeguro(nomeArquivo);
      a.download = `${nomeSeguro}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      delete gravadoresRef.current[identity];
    };
    try {
      entry.recorder.stop();
    } catch {
      // já parado
    }
    setGravando(prev => {
      const next = { ...prev };
      delete next[identity];
      return next;
    });
  }, []);

  return {
    room,
    canalId,
    nomeCanal,
    comunidadeId,
    comunidadeNome,
    conectando,
    conectado,
    erro,
    muted,
    deafened,
    participantes,
    compartilhandoTela,
    cameraLigada,
    gravando,
    connect,
    disconnect,
    toggleMuted,
    toggleDeafened,
    toggleCamera,
    toggleScreenShare,
    setParticipantVolume,
    toggleLocalMute,
    tocarSomParaTodos,
    iniciarGravacaoAudio,
    pararEBaixarGravacaoAudio,
  };
}

/** Sanitiza uma string pra virar nome de arquivo (usado ao baixar o áudio
 * gravado de um participante) — troca tudo que não for letra/número/
 * hífen/underscore por "_". */
function nomeFileNameSeguro(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60) || 'audio';
}