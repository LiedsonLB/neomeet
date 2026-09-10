// components/VoiceConferenceCustom.tsx
//
// Substitui o <VideoConference/> pronto do @livekit/components-react por
// uma grade própria — avatares com foto de perfil pros participantes sem
// câmera, tela cheia pro compartilhamento de tela, sistema de PIN pra
// fixar alguém grande (clicando nela), e um menu de contexto (clique
// direito) em cada card de participante com: silenciar só pra mim,
// ajustar volume, gravar+baixar o áudio dela, ver perfil, fixar/
// desafixar e tela cheia.
//
// Um único jeito de ver: grade por padrão; quando alguém (ou uma tela
// compartilhada) é fixado, aquele card vira grande com os demais numa
// fileira embaixo — sem escolha de layout, sempre esse comportamento.
//
// Mic/deafen/soundboard/sair já vivem na barra "Voz conectada" da
// sidebar (ComunidadeRoom.tsx) — esse componente cuida só do que é
// específico da grade: câmera, compartilhar tela, e o pin.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useTracks, useLocalParticipant, VideoTrack, type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track, RoomEvent, RemoteParticipant, LocalParticipant } from 'livekit-client';
import {
  Video, VideoOff, ScreenShare, ScreenShareOff,
  Maximize2, Minimize2, Pin, PinOff, MicOff, VolumeX, Volume1, Volume2, UserCircle2, Disc, Square,
  TriangleAlert, X,
} from 'lucide-react';
import Avatar from './Avatar';

// Tamanho do card na grade: fixo dentro dessa faixa (240–340px de
// largura, 16:9 de altura via aspect-video) INDEPENDENTE do tamanho do
// monitor, de quantas pessoas estão na call, ou de esconder/mostrar a
// barra lateral. Antes o número de colunas era `sqrt(participantes)`, o
// que recalculava (e distorcia) o tamanho de TODOS os cards toda vez que
// alguém entrava/saía ou a janela mudava de tamanho — com
// `repeat(auto-fill, minmax(MIN, MAX))` o card sempre fica no mesmo
// tamanho, só muda quantas colunas cabem por linha.
const TILE_MIN_WIDTH = 240;
const TILE_MAX_WIDTH = 340;

/** Chave estável de uma faixa (participante + fonte) — usada tanto pro
 * `key` do React quanto pra identificar o que está fixado (pin). */
function chaveTrack(trackRef: TrackReferenceOrPlaceholder): string {
  return `${trackRef.participant.identity}-${trackRef.source}`;
}

interface Props {
  cameraLigada: boolean;
  compartilhandoTela: boolean;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  /** Aviso sobre o último compartilhamento de tela (ex.: "foi sem
   * áudio porque..."), vindo de useVoiceChannel.ts. `null`/ausente = sem
   * nada pra mostrar. */
  avisoTela?: string | null;
  onDismissAviso?: () => void;
  gravando: Record<string, boolean>;
  onParticipantVolumeChange: (identity: string, volume: number) => void;
  onToggleLocalMute: (identity: string) => void;
  onViewProfile: (usuarioId: number) => void;
  onIniciarGravacaoAudio: (identity: string) => void;
  onPararEBaixarGravacaoAudio: (identity: string, nomeArquivo: string) => void;
}

function parseMeta(raw: string | undefined): { nome?: string; foto?: string; moldura?: string } {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

interface MenuState {
  chave: string;
  identity: string;
  nome: string;
  isLocal: boolean;
  usuarioId: number;
  temAudio: boolean;
  ehScreenShare: boolean;
  fixado: boolean;
  x: number;
  y: number;
}

function ContextMenu({
  menu, volume, mutadoParaMim, gravandoAgora, onVolumeChange, onToggleMute, onViewProfile,
  onGravar, onTogglePin, onToggleFullscreen, onClose,
}: {
  menu: MenuState;
  volume: number;
  mutadoParaMim: boolean;
  gravandoAgora: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onViewProfile: () => void;
  onGravar: () => void;
  onTogglePin: () => void;
  onToggleFullscreen: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[75]" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <div
        className="glass-panel absolute w-60 rounded-xl p-3 shadow-2xl"
        style={{ top: Math.min(menu.y, window.innerHeight - 320), left: Math.min(menu.x, window.innerWidth - 250) }}
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-2 truncate px-1 text-xs font-bold text-on-surface">{menu.nome}</p>

        <button
          onClick={onTogglePin}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
        >
          {menu.fixado ? <PinOff size={15} className="text-primary" /> : <Pin size={15} />}
          {menu.fixado ? 'Desafixar' : 'Fixar grande (foco)'}
        </button>

        {!menu.isLocal && menu.temAudio && (
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
                type="range" min={0} max={2} step={0.05} value={volume}
                onChange={e => onVolumeChange(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <button
              onClick={onGravar}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
            >
              {gravandoAgora ? <Square size={15} className="text-error" /> : <Disc size={15} />}
              {gravandoAgora ? 'Parar e baixar áudio' : 'Gravar áudio dela'}
            </button>
          </>
        )}

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
          >
            <Maximize2 size={15} /> Tela cheia
          </button>
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

function Tile({
  trackRef, grande, fixado, onContextMenuTile, onTogglePin, registerNode,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  grande?: boolean;
  fixado: boolean;
  onContextMenuTile: (e: React.MouseEvent, trackRef: TrackReferenceOrPlaceholder) => void;
  onTogglePin: (trackRef: TrackReferenceOrPlaceholder) => void;
  registerNode: (chave: string, el: HTMLDivElement | null) => void;
}) {
  // Clique simples no PRÓPRIO card (compartilhamento ou câmera) fixa/
  // desafixa — sem precisar acertar um botão pequeno no canto. Um clique
  // duplo continua abrindo tela cheia (só faz sentido pra compartilha-
  // mento de tela), então o clique simples espera um instante pra ver se
  // virou duplo antes de fixar — se virou, cancela o pin e só entra em
  // tela cheia.
  const cliqueTimeoutRef = useRef<number | null>(null);
  const { participant, publication, source } = trackRef;
  const meta = parseMeta(participant.metadata);
  const nome = meta.nome || participant.name || participant.identity || 'Usuário';
  const isLocal = participant instanceof LocalParticipant;
  const isSpeaking = 'isSpeaking' in participant ? participant.isSpeaking : false;
  const micEnabled = participant instanceof RemoteParticipant ? participant.isMicrophoneEnabled : true;
  const temVideo = !!publication && !publication.isMuted && source !== Track.Source.ScreenShareAudio;
  const ehScreenShare = source === Track.Source.ScreenShare;
  const tileRef = useRef<HTMLDivElement>(null);
  const chave = chaveTrack(trackRef);

  // Tela cheia com botão pra SAIR também — antes só dava pra sair com
  // ESC. Escuta `fullscreenchange` em vez de guardar um booleano "cru",
  // porque a saída pode acontecer de várias formas (ESC, botão do
  // navegador, ou o botão daqui) e todas precisam manter esse estado
  // sincronizado.
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  useEffect(() => {
    function onFullscreenChange() {
      setEmTelaCheia(document.fullscreenElement === tileRef.current);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function alternarTelaCheia() {
    if (document.fullscreenElement === tileRef.current) {
      void document.exitFullscreen?.();
    } else {
      void tileRef.current?.requestFullscreen?.();
    }
  }

  function handleClick() {
    if (cliqueTimeoutRef.current) return;
    cliqueTimeoutRef.current = window.setTimeout(() => {
      onTogglePin(trackRef);
      cliqueTimeoutRef.current = null;
    }, 220);
  }

  function handleDoubleClick() {
    if (cliqueTimeoutRef.current) {
      window.clearTimeout(cliqueTimeoutRef.current);
      cliqueTimeoutRef.current = null;
    }
    if (ehScreenShare) alternarTelaCheia();
  }

  useEffect(() => () => {
    if (cliqueTimeoutRef.current) window.clearTimeout(cliqueTimeoutRef.current);
  }, []);

  return (
    <div
      ref={el => { (tileRef as React.MutableRefObject<HTMLDivElement | null>).current = el; registerNode(chave, el); }}
      onContextMenu={e => onContextMenuTile(e, trackRef)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      title={fixado ? 'Clique pra desafixar' : 'Clique pra fixar grande'}
      className={`group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border bg-surface-container-high ${isSpeaking ? 'border-tertiary shadow-glow-tertiary' : fixado ? 'border-primary' : 'border-outline-variant/40'} ${grande ? 'h-full w-full' : 'aspect-video'}`}
    >
      {temVideo ? (
        <VideoTrack trackRef={trackRef} className="h-full w-full object-contain bg-black" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <Avatar nome={nome} foto={meta.foto} moldura={meta.moldura} size={grande ? 96 : 56} />
        </div>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5">
        {!micEnabled && !ehScreenShare && <MicOff size={11} className="text-error" />}
        <span className="max-w-[140px] truncate text-[11px] font-medium text-white">
          {ehScreenShare ? `${nome} · tela` : nome}{isLocal && !ehScreenShare && ' (você)'}
        </span>
      </div>

      {fixado && (
        <div className="absolute left-1.5 top-1.5 rounded-md bg-primary/90 p-1 text-on-primary">
          <Pin size={11} />
        </div>
      )}

      {ehScreenShare && (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); alternarTelaCheia(); }}
            title={emTelaCheia ? 'Sair da tela cheia' : 'Tela cheia (duplo clique)'}
            className="rounded-md bg-black/50 p-1 text-white hover:bg-black/70"
          >
            {emTelaCheia ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}

export default function VoiceConferenceCustom({
  cameraLigada, compartilhandoTela, onToggleCamera, onToggleScreenShare, gravando,
  avisoTela, onDismissAviso,
  onParticipantVolumeChange, onToggleLocalMute, onViewProfile,
  onIniciarGravacaoAudio, onPararEBaixarGravacaoAudio,
}: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [mutados, setMutados] = useState<Set<string>>(new Set());
  const [fixado, setFixado] = useState<string | null>(null);
  const { localParticipant } = useLocalParticipant();

  // Mapa dos nós DOM de cada card — usado pra acionar tela cheia a
  // partir do menu de contexto (que é renderizado fora do <Tile/>, então
  // precisa de uma forma de "alcançar" o elemento certo).
  const nodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  function registerNode(chave: string, el: HTMLDivElement | null) {
    if (el) nodesRef.current.set(chave, el);
    else nodesRef.current.delete(chave);
  }
  function alternarTelaCheiaPorChave(chave: string) {
    const el = nodesRef.current.get(chave);
    if (!el) return;
    if (document.fullscreenElement === el) void document.exitFullscreen?.();
    else void el.requestFullscreen?.();
  }

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      onlySubscribed: false,
      updateOnlyOn: [
        RoomEvent.ActiveSpeakersChanged, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
        RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
        RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
        RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      ],
    },
  );

  const telasCompartilhadas = useMemo(() => tracks.filter(t => t.source === Track.Source.ScreenShare), [tracks]);

  // Se o card fixado sumiu (a pessoa saiu, desligou a câmera ou parou de
  // compartilhar a tela), desafixa sozinho em vez de ficar "preso" numa
  // referência que não existe mais.
  useEffect(() => {
    if (fixado && !tracks.some(t => chaveTrack(t) === fixado)) {
      setFixado(null);
    }
  }, [tracks, fixado]);

  // Fixa automaticamente a PRIMEIRA vez que alguém começa a compartilhar
  // a tela (detecta a transição de "ninguém compartilhando" pra "alguém
  // compartilhando", não todo re-render), pra garantir que ninguém perca
  // o início de uma apresentação.
  const tinhaTelaAntes = useRef(false);
  useEffect(() => {
    const temTelaAgora = telasCompartilhadas.length > 0;
    if (temTelaAgora && !tinhaTelaAntes.current) {
      setFixado(chaveTrack(telasCompartilhadas[0]));
    }
    tinhaTelaAntes.current = temTelaAgora;
  }, [telasCompartilhadas]);

  function alternarPin(trackRef: TrackReferenceOrPlaceholder) {
    const chave = chaveTrack(trackRef);
    setFixado(prev => (prev === chave ? null : chave));
  }

  function abrirMenu(e: React.MouseEvent, trackRef: TrackReferenceOrPlaceholder) {
    e.preventDefault();
    const { participant, source } = trackRef;
    const meta = parseMeta(participant.metadata);
    const usuarioId = parseInt(participant.identity, 10);
    const chave = chaveTrack(trackRef);
    setMenu({
      chave,
      identity: participant.identity,
      nome: meta.nome || participant.name || participant.identity || 'Usuário',
      isLocal: participant instanceof LocalParticipant,
      usuarioId: isNaN(usuarioId) ? 0 : usuarioId,
      temAudio: participant instanceof RemoteParticipant,
      ehScreenShare: source === Track.Source.ScreenShare,
      fixado: fixado === chave,
      x: e.clientX,
      y: e.clientY,
    });
  }

  // Sem escolha de layout: prioriza quem está FIXADO (manualmente ou
  // pelo auto-pin de tela compartilhada, ver efeito acima). Sem nada
  // fixado, é só a grade — não tem mais um "modo foco automático" por
  // quem está falando.
  const focoTile = fixado ? tracks.find(t => chaveTrack(t) === fixado) : null;
  const outrasNoFoco = focoTile ? tracks.filter(t => t !== focoTile) : [];

  return (
    <div className="flex h-full flex-col bg-[#0A0C14]">
      {/* Barra superior — só o que é específico dessa grade (o resto dos
          controles de voz mora na sidebar, ver ComunidadeRoom.tsx) */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
        <div>
          {fixado && (
            <button
              onClick={() => setFixado(null)}
              title="Desafixar"
              className="flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/30"
            >
              <PinOff size={12} /> Desafixar
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleCamera}
            title={cameraLigada ? 'Desligar câmera' : 'Ligar câmera'}
            className={`rounded-lg p-2 transition-colors ${cameraLigada ? 'bg-primary text-on-primary' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
          >
            {cameraLigada ? <Video size={15} /> : <VideoOff size={15} />}
          </button>
          <button
            onClick={onToggleScreenShare}
            title={compartilhandoTela ? 'Parar compartilhamento' : 'Compartilhar tela (com áudio)'}
            className={`rounded-lg p-2 transition-colors ${compartilhandoTela ? 'bg-tertiary text-on-tertiary' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
          >
            {compartilhandoTela ? <ScreenShareOff size={15} /> : <ScreenShare size={15} />}
          </button>
        </div>
      </div>

      {avisoTela && (
        <div className="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <p className="flex-1">{avisoTela}</p>
          {onDismissAviso && (
            <button onClick={onDismissAviso} className="shrink-0 text-amber-300/70 hover:text-amber-300">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {focoTile ? (
          <div className="flex h-full flex-col gap-3">
            <div className="min-h-0 flex-1">
              <Tile
                trackRef={focoTile}
                grande
                fixado
                onContextMenuTile={abrirMenu}
                onTogglePin={alternarPin}
                registerNode={registerNode}
              />
            </div>
            {outrasNoFoco.length > 0 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
                {outrasNoFoco.map(t => (
                  <div key={chaveTrack(t)} className="w-40 shrink-0">
                    <Tile
                      trackRef={t}
                      fixado={false}
                      onContextMenuTile={abrirMenu}
                      onTogglePin={alternarPin}
                      registerNode={registerNode}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // `auto-fill` + `minmax(MIN, MAX)` mantém o tamanho de cada
          // card praticamente constante — só a quantidade de colunas por
          // linha muda. Isso evita o "bug" de antes, onde o tamanho de
          // TODOS os cards era recalculado (e distorcido) toda vez que
          // alguém entrava/saía da call, a janela mudava de tamanho, ou a
          // barra lateral era escondida.
          <div
            className="grid content-start gap-3"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_MIN_WIDTH}px, ${TILE_MAX_WIDTH}px))`, justifyContent: 'center' }}
          >
            {tracks.map(t => (
              <Tile
                key={chaveTrack(t)}
                trackRef={t}
                fixado={fixado === chaveTrack(t)}
                onContextMenuTile={abrirMenu}
                onTogglePin={alternarPin}
                registerNode={registerNode}
              />
            ))}
          </div>
        )}

        {tracks.length === 0 && (
          <p className="flex h-full items-center justify-center text-sm text-white/50">Conectando...</p>
        )}
      </div>

      {menu && (
        <ContextMenu
          menu={menu}
          volume={volumes[menu.identity] ?? 1}
          mutadoParaMim={mutados.has(menu.identity)}
          gravandoAgora={!!gravando[menu.identity]}
          onVolumeChange={v => {
            setVolumes(prev => ({ ...prev, [menu.identity]: v }));
            onParticipantVolumeChange(menu.identity, v);
          }}
          onToggleMute={() => {
            setMutados(prev => {
              const next = new Set(prev);
              if (next.has(menu.identity)) next.delete(menu.identity); else next.add(menu.identity);
              return next;
            });
            onToggleLocalMute(menu.identity);
            setMenu(null);
          }}
          onGravar={() => {
            if (gravando[menu.identity]) {
              onPararEBaixarGravacaoAudio(menu.identity, menu.nome);
            } else {
              onIniciarGravacaoAudio(menu.identity);
            }
            setMenu(null);
          }}
          onTogglePin={() => {
            setFixado(prev => (prev === menu.chave ? null : menu.chave));
            setMenu(null);
          }}
          onToggleFullscreen={menu.ehScreenShare ? () => { alternarTelaCheiaPorChave(menu.chave); setMenu(null); } : null}
          onViewProfile={() => {
            if (menu.usuarioId > 0) onViewProfile(menu.usuarioId);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {/* mantém o hook de participante local "vivo" no bundle, evitando
          tree-shaking indevido de useLocalParticipant caso a build futura
          precise dele diretamente aqui */}
      <span className="hidden">{localParticipant?.identity}</span>
    </div>
  );
}
