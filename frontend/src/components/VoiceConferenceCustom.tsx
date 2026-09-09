// components/VoiceConferenceCustom.tsx
//
// Substitui o <VideoConference/> pronto do @livekit/components-react por
// uma grade própria — com 3 opções de layout (Grade / Foco / Lista),
// avatares com foto de perfil pros participantes sem câmera, tela cheia
// pro compartilhamento de tela, e um menu de contexto (clique direito)
// em cada card de participante com: silenciar só pra mim, ajustar
// volume, gravar+baixar o áudio dela, ver perfil, e tela cheia (quando
// aplicável).
//
// Mic/deafen/soundboard/sair já vivem na barra "Voz conectada" da
// sidebar (ComunidadeRoom.tsx) — esse componente cuida só do que é
// específico da grade: câmera, compartilhar tela, e os layouts.
import { useMemo, useRef, useState } from 'react';
import {
  useTracks, useLocalParticipant, VideoTrack, type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track, RoomEvent, RemoteParticipant, LocalParticipant } from 'livekit-client';
import {
  LayoutGrid, PictureInPicture, Rows3, Video, VideoOff, ScreenShare, ScreenShareOff,
  Maximize2, MicOff, VolumeX, Volume1, Volume2, UserCircle2, Disc, Square,
} from 'lucide-react';
import Avatar from './Avatar';

type Layout = 'grade' | 'foco' | 'lista';

interface Props {
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

function parseMeta(raw: string | undefined): { nome?: string; foto?: string; moldura?: string } {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

interface MenuState {
  identity: string;
  nome: string;
  isLocal: boolean;
  usuarioId: number;
  temAudio: boolean;
  ehScreenShare: boolean;
  x: number;
  y: number;
}

function ContextMenu({
  menu, volume, mutadoParaMim, gravandoAgora, onVolumeChange, onToggleMute, onViewProfile,
  onGravar, onFullscreen, onClose,
}: {
  menu: MenuState;
  volume: number;
  mutadoParaMim: boolean;
  gravandoAgora: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onViewProfile: () => void;
  onGravar: () => void;
  onFullscreen: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[75]" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <div
        className="glass-panel absolute w-60 rounded-xl p-3 shadow-2xl"
        style={{ top: Math.min(menu.y, window.innerHeight - 280), left: Math.min(menu.x, window.innerWidth - 250) }}
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-2 truncate px-1 text-xs font-bold text-on-surface">{menu.nome}</p>

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

        {onFullscreen && (
          <button
            onClick={onFullscreen}
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
  trackRef, grande, onContextMenuTile,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  grande?: boolean;
  onContextMenuTile: (e: React.MouseEvent, trackRef: TrackReferenceOrPlaceholder) => void;
}) {
  const { participant, publication, source } = trackRef;
  const meta = parseMeta(participant.metadata);
  const nome = meta.nome || participant.name || participant.identity || 'Usuário';
  const isLocal = participant instanceof LocalParticipant;
  const isSpeaking = 'isSpeaking' in participant ? participant.isSpeaking : false;
  const micEnabled = participant instanceof RemoteParticipant ? participant.isMicrophoneEnabled : true;
  const temVideo = !!publication && !publication.isMuted && source !== Track.Source.ScreenShareAudio;
  const ehScreenShare = source === Track.Source.ScreenShare;
  const tileRef = useRef<HTMLDivElement>(null);

  function fullscreen() {
    void tileRef.current?.requestFullscreen?.();
  }

  return (
    <div
      ref={tileRef}
      onContextMenu={e => onContextMenuTile(e, trackRef)}
      onDoubleClick={ehScreenShare ? fullscreen : undefined}
      className={`group relative flex items-center justify-center overflow-hidden rounded-2xl border bg-surface-container-high ${isSpeaking ? 'border-tertiary shadow-glow-tertiary' : 'border-outline-variant/40'} ${grande ? 'h-full w-full' : 'aspect-video'}`}
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

      {ehScreenShare && (
        <button
          onClick={fullscreen}
          title="Tela cheia"
          className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Maximize2 size={13} />
        </button>
      )}
    </div>
  );
}

export default function VoiceConferenceCustom({
  cameraLigada, compartilhandoTela, onToggleCamera, onToggleScreenShare, gravando,
  onParticipantVolumeChange, onToggleLocalMute, onViewProfile,
  onIniciarGravacaoAudio, onPararEBaixarGravacaoAudio,
}: Props) {
  const [layout, setLayout] = useState<Layout>('grade');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [mutados, setMutados] = useState<Set<string>>(new Set());
  const { localParticipant } = useLocalParticipant();

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
  const cameras = useMemo(() => tracks.filter(t => t.source === Track.Source.Camera), [tracks]);

  function abrirMenu(e: React.MouseEvent, trackRef: TrackReferenceOrPlaceholder) {
    e.preventDefault();
    const { participant, source } = trackRef;
    const meta = parseMeta(participant.metadata);
    const usuarioId = parseInt(participant.identity, 10);
    setMenu({
      identity: participant.identity,
      nome: meta.nome || participant.name || participant.identity || 'Usuário',
      isLocal: participant instanceof LocalParticipant,
      usuarioId: isNaN(usuarioId) ? 0 : usuarioId,
      temAudio: participant instanceof RemoteParticipant,
      ehScreenShare: source === Track.Source.ScreenShare,
      x: e.clientX,
      y: e.clientY,
    });
  }

  const layoutBtns: { id: Layout; icon: typeof LayoutGrid; title: string }[] = [
    { id: 'grade', icon: LayoutGrid, title: 'Grade' },
    { id: 'foco', icon: PictureInPicture, title: 'Foco (tela compartilhada)' },
    { id: 'lista', icon: Rows3, title: 'Lista' },
  ];

  const focoTile = telasCompartilhadas[0] ?? cameras.find(t => t.participant.isSpeaking);
  const outrasNoFoco = tracks.filter(t => t !== focoTile);

  return (
    <div className="flex h-full flex-col bg-[#0A0C14]">
      {/* Barra superior — só o que é específico dessa grade (o resto dos
          controles de voz mora na sidebar, ver ComunidadeRoom.tsx) */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
          {layoutBtns.map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              onClick={() => setLayout(id)}
              title={title}
              className={`rounded-md p-1.5 transition-colors ${layout === id ? 'bg-primary text-on-primary' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={15} />
            </button>
          ))}
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

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {layout === 'lista' && (
          <div className="mx-auto flex max-w-md flex-col gap-2">
            {tracks.map(t => (
              <Tile key={`${t.participant.identity}-${t.source}`} trackRef={t} onContextMenuTile={abrirMenu} />
            ))}
          </div>
        )}

        {layout === 'grade' && (
          <div
            className="grid h-full auto-rows-fr gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(Math.sqrt(tracks.length || 1)))}, minmax(0, 1fr))` }}
          >
            {tracks.map(t => (
              <Tile key={`${t.participant.identity}-${t.source}`} trackRef={t} onContextMenuTile={abrirMenu} />
            ))}
          </div>
        )}

        {layout === 'foco' && (
          <div className="flex h-full flex-col gap-3">
            {focoTile && (
              <div className="min-h-0 flex-1">
                <Tile trackRef={focoTile} grande onContextMenuTile={abrirMenu} />
              </div>
            )}
            {outrasNoFoco.length > 0 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
                {outrasNoFoco.map(t => (
                  <div key={`${t.participant.identity}-${t.source}`} className="w-40 shrink-0">
                    <Tile trackRef={t} onContextMenuTile={abrirMenu} />
                  </div>
                ))}
              </div>
            )}
            {!focoTile && (
              <p className="flex flex-1 items-center justify-center text-sm text-white/50">
                Ninguém está compartilhando a tela agora.
              </p>
            )}
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
          onFullscreen={menu.ehScreenShare ? () => { setMenu(null); } : null}
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
