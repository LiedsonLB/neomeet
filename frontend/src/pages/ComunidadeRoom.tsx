// ComunidadeRoom.tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Hash, Volume2, Plus, Settings, Mic, MicOff, Headphones, HeadphoneOff, Video, ScreenShare, PhoneOff, X,
  MessageSquare, Loader2,
  ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, LogIn, Music4, Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, canalApi, salaApi } from '../api/client';
import type { Comunidade, Canal, ParticipanteInfo } from '../api/types';
import Avatar from '../components/Avatar';
import ChatPanel from '../components/ChatPanel';
import CriarCanalModal from '../components/CriarCanalModal';
import GerenciarComunidadeModal from '../components/GerenciarComunidadeModal';
import PerfilUsuarioModal from '../components/PerfilUsuarioModal';
import SoundboardModal from '../components/SoundboardModal';
import MembrosModal from '../components/MembrosModal';
import { useVoiceCall } from '../context/VoiceCallContext';
import VoiceRoomEmbed from '../components/VoiceRoomEmbed';
import AdmBadge from '../components/AdmBadge';
import AppShell from '../layout/AppShell';
import type { ComunidadeSom } from '../api/types';

const CANAIS_POLL_MS = 8000;

type ParticipanteExibicao = ParticipanteInfo & { isLocal: boolean };

export default function ComunidadeRoom() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const canalAutoEntrarId = searchParams.get('canal');
  const comunidadeId = Number(id);
  const { session, usuario } = useAuth();
  const navigate = useNavigate();

  const [comunidade, setComunidade] = useState<Comunidade | null>(null);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [canalTextoAtivoId, setCanalTextoAtivoId] = useState<number | null>(null);
  const [mostrarVoz, setMostrarVoz] = useState(false);
  const [entrandoNoCanal, setEntrandoNoCanal] = useState<number | null>(null);

  const [modalCriarCanal, setModalCriarCanal] = useState<null | 'texto' | 'voz'>(null);
  const [modalGerenciar, setModalGerenciar] = useState(false);
  const [modalSoundboard, setModalSoundboard] = useState(false);
  const [modalMembros, setModalMembros] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState<number | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  const [sidebarExpandida, setSidebarExpandida] = useState(true);
  const [mostrarTodosParticipantes, setMostrarTodosParticipantes] = useState<{ [canalId: number]: boolean }>({});
  const [entrandoNaComunidade, setEntrandoNaComunidade] = useState(false);

  const voz = useVoiceCall();

  const souDono = comunidade?.papel === 'dono';
  const ehMembro = comunidade?.papel === 'dono' || comunidade?.papel === 'membro';
  const pendente = comunidade?.papel === 'pendente';

  const loadTudo = useCallback(async () => {
    if (!session || !comunidadeId) return;
    try {
      const [atual, listaCanais] = await Promise.all([
        comunidadeApi.find(session, comunidadeId),
        canalApi.list(session, comunidadeId).catch(() => [] as Canal[]),
      ]);
      setComunidade(atual);
      setCanais(listaCanais);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar a comunidade.');
    } finally {
      setCarregando(false);
    }
  }, [session, comunidadeId]);

  async function entrarNaComunidade() {
    if (!session) return;
    setEntrandoNaComunidade(true);
    try {
      await comunidadeApi.entrar(session, comunidadeId);
      await loadTudo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar na comunidade.');
    } finally {
      setEntrandoNaComunidade(false);
    }
  }

  useEffect(() => {
    setCarregando(true);
    setCanalTextoAtivoId(null);
    // Se já estou conectado num canal de voz DESSA MESMA comunidade
    // (ex.: vim do widget flutuante, ou só troquei de aba e voltei),
    // reabre a visualização da call em vez de cair pro chat — a call em
    // si nunca foi desconectada (ela vive no VoiceCallContext, acima das
    // rotas), só a tela mudava antes.
    setMostrarVoz(voz.conectado && voz.comunidadeId === comunidadeId);
    loadTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTudo]);

  useEffect(() => {
    if (canalTextoAtivoId === null && canais.length > 0) {
      const primeiroTexto = canais.find(c => c.tipo === 'texto');
      if (primeiroTexto) setCanalTextoAtivoId(primeiroTexto.id);
    }
  }, [canais, canalTextoAtivoId]);

  // Vindo da seção "O que está rolando agora" do Dashboard (?canal=ID) —
  // entra direto no canal de voz assim que a lista de canais carregar.
  useEffect(() => {
    if (!canalAutoEntrarId || !ehMembro || canais.length === 0) return;
    const canal = canais.find(c => c.id === Number(canalAutoEntrarId) && c.tipo === 'voz');
    if (canal) abrirCanalVoz(canal);
    setSearchParams(params => { params.delete('canal'); return params; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalAutoEntrarId, ehMembro, canais]);

  // Poll leve pra manter a contagem/lista de quem está em cada canal de
  // voz atualizada mesmo sem eu estar conectado (ver quem está na call
  // sem precisar entrar).
  useEffect(() => {
    const iv = setInterval(() => {
      if (session && comunidadeId && ehMembro) {
        canalApi.list(session, comunidadeId).then(setCanais).catch(() => { });
      }
    }, CANAIS_POLL_MS);
    return () => clearInterval(iv);
  }, [session, comunidadeId, ehMembro]);

  // Nota: antes havia aqui um useEffect que chamava voz.disconnect() ao
  // desmontar esse componente (trocar de tela) — era exatamente isso que
  // derrubava a chamada ao navegar pra outro canal/perfil/comunidade. A
  // conexão agora vive no VoiceCallContext (acima das rotas) e só cai
  // quando a pessoa clica em "Sair da chamada" de verdade, no
  // FloatingVoiceWidget ou na barra "Voz conectada" abaixo.

  // Guard síncrono contra duplo clique/StrictMode chamando abrirCanalVoz
  // duas vezes antes do `entrandoNoCanal` (state, assíncrono) conseguir
  // desabilitar o botão — era isso que abria duas conexões concorrentes
  // (às vezes pra canais diferentes) e derrubava uma na outra.
  // const entrandoNoCanalRef = useRef<number | null>(null);

  async function abrirCanalVoz(canal: Canal) {
    if (!ehMembro) {
      setErro('Você precisa ser membro para entrar no canal de voz.');
      return;
    }
    if (!session || !canal.sala_id) return;

    // Já está conectado neste canal
    if (voz.canalId === canal.id && voz.conectado) {
      setMostrarVoz(true);
      return;
    }

    // Já está conectado em outro canal - desconecta primeiro
    if (voz.conectado) {
      await voz.disconnect();
    }

    setEntrandoNoCanal(canal.id);
    try {
      const { token, url } = await salaApi.entrar(session, canal.sala_id);
      await voz.connect(canal.id, canal.nome, token, url, comunidade?.id, comunidade?.nome);
      setMostrarVoz(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar no canal de voz.');
      setMostrarVoz(false);
    } finally {
      setEntrandoNoCanal(null);
    }
  }

  useEffect(() => {
    // Se a voz foi desconectada, fecha a visualização
    if (!voz.conectado && mostrarVoz) {
      setMostrarVoz(false);
    }
  }, [voz.conectado, mostrarVoz]);

  function abrirCanalTexto(canal: Canal) {
    if (!ehMembro) { setErro('Você precisa ser membro para ver as mensagens.'); return; }
    setCanalTextoAtivoId(canal.id);
    setMostrarVoz(false);
  }

  async function sairDaVoz() {
    await voz.disconnect();
    setMostrarVoz(false);
  }

  async function excluirCanal(canal: Canal, e: React.MouseEvent) {
    e.stopPropagation();
    if (!session) return;
    if (!confirm(`Excluir o canal "${canal.nome}"?`)) return;
    try {
      if (voz.canalId === canal.id) await voz.disconnect();
      await canalApi.delete(session, canal.id);
      setCanais(prev => prev.filter(c => c.id !== canal.id));
      if (canalTextoAtivoId === canal.id) setCanalTextoAtivoId(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir o canal.');
    }
  }

  function tocarSom(som: ComunidadeSom) {
    voz.tocarSomParaTodos(som.arquivo_url);
  }

  const toggleVerTodosParticipantes = (canalId: number) => {
    setMostrarTodosParticipantes(prev => ({ ...prev, [canalId]: !prev[canalId] }));
  };

  const getParticipantesDoCanal = (canal: Canal): ParticipanteExibicao[] => {
    if (voz.canalId === canal.id && voz.conectado) {
      return voz.participantes.map(p => ({
        identity: p.identity || '',
        nome: p.nome || 'Usuário',
        foto: p.foto || null,
        moldura: p.moldura || null,
        micEnabled: p.micEnabled ?? true,
        deafened: p.deafened ?? false,
        cameraOn: p.cameraOn ?? false,
        screenShare: p.screenShare ?? false,
        isLocal: p.isLocal ?? false,
      }));
    }
    return (canal.participantes_lista || []).map(p => ({ ...p, isLocal: false }));
  };

  const getTotalParticipantes = (canal: Canal): number => {
    if (voz.canalId === canal.id && voz.conectado) return voz.participantes.length;
    return canal.participantes_online || 0;
  };

  const canaisTexto = canais.filter(c => c.tipo === 'texto');
  const canaisVoz = canais.filter(c => c.tipo === 'voz');
  const canalTextoAtivo = canais.find(c => c.id === canalTextoAtivoId) ?? null;

  if (carregando) {
    return (
      <AppShell fullBleed>
        <div className="flex h-full items-center justify-center bg-background text-on-surface-variant">
          <Loader2 size={22} className="spin-icon" />
        </div>
      </AppShell>
    );
  }

  if (erro && !comunidade) {
    return (
      <AppShell fullBleed>
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-background text-center text-on-surface-variant">
          <p>{erro}</p>
          <button className="btn-secondary" onClick={() => navigate('/comunidades')}>Voltar</button>
        </div>
      </AppShell>
    );
  }

  if (!comunidade) return null;

  return (
    <AppShell fullBleed>
      <div className="relative flex h-full w-full overflow-hidden bg-background text-on-background">
        {/* ---- Sidebar de canais (a rail de servidores já vive no AppShell) ---- */}
        <aside
          className={`flex flex-col border-r border-outline-variant bg-surface-container-low transition-all duration-300 ease-in-out ${sidebarExpandida ? 'w-64' : 'w-0 overflow-hidden border-0'}`}
        >
          <div className="relative flex items-center justify-between gap-1.5 border-b border-outline-variant/60 px-4 py-4">
            <h1 className="truncate text-sm font-bold text-on-surface">{comunidade.nome}</h1>
            <div className="flex shrink-0 items-center gap-3">
              {ehMembro && (
                <button onClick={() => setModalMembros(true)} title="Ver membros" className="text-on-surface-variant hover:text-on-surface">
                  <Users size={16} />
                </button>
              )}
              {souDono && (
                <button onClick={() => setMenuAberto(v => !v)} className="text-on-surface-variant hover:text-on-surface">
                  <Settings size={16} />
                </button>
              )}
            </div>
            {menuAberto && (
              <div className="absolute right-3 top-12 z-30 w-48 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-highest shadow-xl">
                <button
                  onClick={() => { setMenuAberto(false); setModalCriarCanal('texto'); }}
                  className="block w-full px-4 py-2.5 text-left text-xs font-medium text-on-surface hover:bg-surface-container-high"
                >
                  Criar canal
                </button>
                <button
                  onClick={() => { setMenuAberto(false); setModalGerenciar(true); }}
                  className="block w-full px-4 py-2.5 text-left text-xs font-medium text-on-surface hover:bg-surface-container-high"
                >
                  Editar comunidade
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
            {/* Canais de texto */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-outline">Canais de texto</span>
                {souDono && (
                  <button onClick={() => setModalCriarCanal('texto')} className="text-outline hover:text-on-surface">
                    <Plus size={13} />
                  </button>
                )}
              </div>
              {canaisTexto.length === 0 && <p className="px-2 py-1 text-[11px] text-outline">Nenhum canal ainda.</p>}
              {canaisTexto.map(canal => (
                <button
                  key={canal.id}
                  onClick={() => abrirCanalTexto(canal)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${canalTextoAtivoId === canal.id && !mostrarVoz && ehMembro ? 'bg-secondary-container/40 font-semibold text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                >
                  <span className="w-4 shrink-0 text-center text-sm leading-none opacity-80">
                    {canal.icone ? canal.icone : <Hash size={14} />}
                  </span>
                  <span className="flex-1 truncate">{canal.nome}</span>
                  {!ehMembro && <span className="text-[10px] text-outline">🔒</span>}
                  {souDono && (
                    <span onClick={(e) => excluirCanal(canal, e)} className="hidden shrink-0 text-outline hover:text-error group-hover:block">
                      <X size={13} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Canais de voz */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-outline">Canais de voz</span>
                {souDono && (
                  <button onClick={() => setModalCriarCanal('voz')} className="text-outline hover:text-on-surface">
                    <Plus size={13} />
                  </button>
                )}
              </div>
              {canaisVoz.length === 0 && <p className="px-2 py-1 text-[11px] text-outline">Nenhum canal ainda.</p>}
              {canaisVoz.map(canal => {
                const conectadoAqui = voz.canalId === canal.id && voz.conectado;
                const participantes = getParticipantesDoCanal(canal);
                const totalParticipantes = getTotalParticipantes(canal);
                const mostrarTodos = mostrarTodosParticipantes[canal.id] || false;

                return (
                  <div key={canal.id}>
                    <button
                      onClick={() => abrirCanalVoz(canal)}
                      className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${conectadoAqui ? 'bg-tertiary/10 font-semibold text-tertiary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                    >
                      <span className="w-4 shrink-0 text-center text-sm leading-none opacity-80">
                        {canal.icone ? canal.icone : <Volume2 size={14} />}
                      </span>
                      <span className="flex-1 truncate">{canal.nome}</span>
                      {!ehMembro && <span className="text-[10px] text-outline">🔒</span>}
                      {entrandoNoCanal === canal.id ? (
                        <Loader2 size={13} className="spin-icon shrink-0" />
                      ) : totalParticipantes > 0 ? (
                        <span className="shrink-0 text-[10px] text-outline">{totalParticipantes}</span>
                      ) : null}
                      {souDono && (
                        <span onClick={(e) => excluirCanal(canal, e)} className="hidden shrink-0 text-outline hover:text-error group-hover:block">
                          <X size={13} />
                        </span>
                      )}
                    </button>

                    {/* Quem está na call — visível mesmo sem eu ter entrado */}
                    {totalParticipantes > 0 && (
                      <div className={`mt-0.5 flex flex-col gap-1 border-l border-outline-variant/40 pl-3 ${!conectadoAqui ? 'opacity-70' : ''}`}>
                        {(mostrarTodos ? participantes : participantes.slice(0, 3)).map(p => (
                          <button
                            key={p.identity}
                            onClick={() => setPerfilAberto(Number(p.identity) || 0)}
                            className="flex items-center justify-between gap-1.5 py-0.5 text-left hover:opacity-80"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Avatar nome={p.nome} foto={p.foto} moldura={p.moldura} size={24} />
                              <span className={`truncate text-[12px] ${conectadoAqui && p.isLocal ? 'font-semibold text-tertiary' : 'text-on-surface-variant'}`}>
                                {p.nome}{conectadoAqui && p.isLocal && ' (você)'}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {p.screenShare && <ScreenShare size={10} className="text-tertiary" />}
                              {p.cameraOn && <Video size={10} className="text-tertiary" />}
                              {p.deafened ? (
                                <HeadphoneOff size={10} className="text-error" />
                              ) : !p.micEnabled && (
                                <MicOff size={10} className="text-error" />
                              )}
                            </div>
                          </button>
                        ))}

                        {participantes.length > 3 && (
                          <button
                            onClick={() => toggleVerTodosParticipantes(canal.id)}
                            className="flex items-center gap-1 py-0.5 text-[11px] text-outline transition-colors hover:text-on-surface-variant"
                          >
                            {mostrarTodos ? <>Ver menos <ChevronUp size={12} /></> : <>+{participantes.length - 3} outros <ChevronDown size={12} /></>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!ehMembro && (
              <div className="border-t border-outline-variant/40 px-2 pt-4">
                {pendente ? (
                  <p className="rounded-lg bg-amber/10 px-3 py-2.5 text-center text-xs text-amber">
                    Solicitação enviada — aguardando aprovação do dono.
                  </p>
                ) : (
                  <>
                    <button
                      onClick={entrarNaComunidade}
                      disabled={entrandoNaComunidade}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {entrandoNaComunidade ? <><Loader2 size={16} className="spin-icon" /> Entrando...</> : <><LogIn size={16} /> Entrar na comunidade</>}
                    </button>
                    <p className="mt-2 text-center text-[11px] text-outline">
                      {comunidade.visibilidade === 'privada' ? 'Comunidade privada — sua entrada depende de aprovação do dono.' : 'Entre para participar dos canais de texto e voz'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Barra fixa de voz conectada — os MESMOS botões controlam a
              mesma Room usada dentro da chamada (ver VoiceRoomEmbed). */}
          {voz.conectado && (
            <div className="border-t border-outline-variant/60 bg-surface-container-high/60 px-3 py-2">
              <button onClick={() => setMostrarVoz(true)} className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left hover:bg-surface-container-highest">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-tertiary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tertiary" /> Voz conectada
                  </div>
                  <div className="truncate text-[11px] text-on-surface-variant">{voz.nomeCanal} / {comunidade.nome}</div>
                </div>
              </button>
              <div className="mt-1.5 flex items-center gap-1">
                <button
                  onClick={voz.toggleMuted}
                  title={voz.muted ? 'Ativar microfone' : 'Mutar microfone'}
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors ${voz.muted ? 'bg-error/15 text-error' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  {voz.muted ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  onClick={voz.toggleDeafened}
                  title={voz.deafened ? 'Ativar áudio' : 'Ensurdecer'}
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors ${voz.deafened ? 'bg-error/15 text-error' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  <Headphones size={15} />
                </button>
                <button
                  onClick={() => setModalSoundboard(true)}
                  title="Efeitos sonoros"
                  className="flex flex-1 items-center justify-center rounded-lg py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                >
                  <Music4 size={15} />
                </button>
                <button
                  onClick={sairDaVoz}
                  title="Desconectar"
                  className="flex flex-1 items-center justify-center rounded-lg py-1.5 text-error transition-colors hover:bg-error/15"
                >
                  <PhoneOff size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Barra do usuário */}
          <div className="flex items-center gap-2 border-t border-outline-variant/60 bg-surface-container px-3 py-2.5">
            <Avatar nome={usuario?.nome ?? '?'} foto={usuario?.foto} moldura={usuario?.moldura} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate text-xs font-semibold text-on-surface">{usuario?.nome}</span>
                <AdmBadge email={usuario?.email} />
              </div>
              <div className="text-[10px] text-tertiary">Online</div>
            </div>
            <button
              onClick={voz.conectado ? voz.toggleMuted : undefined}
              title={voz.conectado ? (voz.muted ? 'Ativar microfone' : 'Mutar microfone') : 'Entre num canal de voz para usar o microfone'}
              className={`text-on-surface-variant hover:text-on-surface ${!voz.conectado ? 'opacity-40' : ''} ${voz.muted ? 'text-error' : ''}`}
              disabled={!voz.conectado}
            >
              {voz.muted ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
            <button onClick={() => navigate('/perfil')} title="Configurações" className="text-on-surface-variant hover:text-on-surface">
              <Settings size={15} />
            </button>
          </div>
        </aside>

        {/* Botão toggle sidebar */}
        <button
          onClick={() => setSidebarExpandida(!sidebarExpandida)}
          className={`absolute top-1/2 z-20 -translate-y-1/2 rounded-r-lg bg-surface-container-high p-1.5 shadow-lg transition-all duration-300 hover:bg-surface-container-highest ${sidebarExpandida ? 'translate-x-64' : 'translate-x-0'}`}
          title={sidebarExpandida ? 'Recolher barra lateral' : 'Expandir barra lateral'}
        >
          {sidebarExpandida ? <ChevronLeft size={16} className="text-on-surface-variant" /> : <ChevronRight size={16} className="text-on-surface-variant" />}
        </button>

        {/* Área principal */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {erro && (
            <div className="flex items-center justify-between border-b border-error/30 bg-error-container/20 px-4 py-2">
              <span className="text-sm text-error">{erro}</span>
              <button onClick={() => setErro(null)} className="text-error hover:opacity-80"><X size={16} /></button>
            </div>
          )}

          {mostrarVoz && voz.conectado && voz.room && ehMembro ? (
            <VoiceRoomEmbed
              room={voz.room}
              cameraLigada={voz.cameraLigada}
              compartilhandoTela={voz.compartilhandoTela}
              onToggleCamera={voz.toggleCamera}
              onToggleScreenShare={voz.toggleScreenShare}
              gravando={voz.gravando}
              onParticipantVolumeChange={voz.setParticipantVolume}
              onToggleLocalMute={voz.toggleLocalMute}
              onViewProfile={setPerfilAberto}
              onIniciarGravacaoAudio={voz.iniciarGravacaoAudio}
              onPararEBaixarGravacaoAudio={voz.pararEBaixarGravacaoAudio}
            />
          ) : canalTextoAtivo && session && usuario && ehMembro ? (
            <ChatPanel
              session={session}
              canal={canalTextoAtivo}
              meuUsuarioId={usuario.id}
              meuEmail={usuario.email}
              souDonoComunidade={souDono}
              onVerPerfil={setPerfilAberto}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-on-surface-variant">
              {!ehMembro ? (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
                    <LogIn size={40} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-on-surface">{comunidade.nome}</h2>
                  <p className="max-w-md text-center text-sm">
                    {pendente ? 'Sua solicitação está esperando aprovação do dono desta comunidade.' : 'Você ainda não faz parte desta comunidade.'}
                    {comunidade.descricao && <span className="mt-1 block text-on-surface-variant/70">{comunidade.descricao}</span>}
                  </p>
                  {!pendente && (
                    <button onClick={entrarNaComunidade} disabled={entrandoNaComunidade} className="btn-primary mt-2 flex items-center gap-2">
                      {entrandoNaComunidade ? <><Loader2 size={16} className="spin-icon" /> Entrando...</> : <><LogIn size={16} /> Entrar na comunidade</>}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <MessageSquare size={28} className="text-outline" />
                  <p className="text-sm">Selecione um canal para começar.</p>
                </>
              )}
            </div>
          )}
        </main>

        {modalCriarCanal && session && (
          <CriarCanalModal
            session={session}
            comunidadeId={comunidade.id}
            tipoInicial={modalCriarCanal}
            onClose={() => setModalCriarCanal(null)}
            onCreated={(canal) => { setCanais(prev => [...prev, canal]); setModalCriarCanal(null); }}
          />
        )}

        {modalGerenciar && session && (
          <GerenciarComunidadeModal
            session={session}
            comunidade={comunidade}
            onClose={() => setModalGerenciar(false)}
            onUpdated={(c) => { setComunidade(c); setModalGerenciar(false); }}
            onDeleted={() => navigate('/comunidades')}
          />
        )}

        {modalSoundboard && session && usuario && (
          <SoundboardModal
            session={session}
            comunidadeId={comunidade.id}
            meuUsuarioId={usuario.id}
            souDono={souDono}
            onClose={() => setModalSoundboard(false)}
            onTocar={tocarSom}
          />
        )}

        {modalMembros && session && (
          <MembrosModal
            session={session}
            comunidadeId={comunidade.id}
            comunidadeNome={comunidade.nome}
            onClose={() => setModalMembros(false)}
            onVerPerfil={(usuarioId) => { setModalMembros(false); setPerfilAberto(usuarioId); }}
          />
        )}

        {perfilAberto !== null && perfilAberto > 0 && session && (
          <PerfilUsuarioModal session={session} usuarioId={perfilAberto} onClose={() => setPerfilAberto(null)} />
        )}
      </div>
    </AppShell>
  );
}