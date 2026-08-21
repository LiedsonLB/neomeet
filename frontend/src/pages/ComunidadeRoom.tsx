// ComunidadeRoom.tsx - Versão corrigida com tipos
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Hash, Volume2, Plus, Settings, Mic, MicOff, Headphones, PhoneOff, X,
  MessageSquare, Loader2,
  Home, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, LogIn,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, canalApi, salaApi, resolveFotoUrl } from '../api/client';
import type { Comunidade, Canal, ParticipanteInfo } from '../api/types';
import Avatar from '../components/Avatar';
import ChatPanel from '../components/ChatPanel';
import CriarCanalModal from '../components/CriarCanalModal';
import GerenciarComunidadeModal from '../components/GerenciarComunidadeModal';
import { useVoiceChannel } from '../hooks/useVoiceChannel';
import VoiceRoomEmbed from '../components/VoiceRoomEmbed';

const CANAIS_POLL_MS = 8000;

export default function ComunidadeRoom() {
  const { id } = useParams<{ id: string }>();
  const comunidadeId = Number(id);
  const { session, usuario } = useAuth();
  const navigate = useNavigate();

  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [comunidade, setComunidade] = useState<Comunidade | null>(null);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [canalTextoAtivoId, setCanalTextoAtivoId] = useState<number | null>(null);
  const [mostrarVoz, setMostrarVoz] = useState(false);
  const [entrandoNoCanal, setEntrandoNoCanal] = useState<number | null>(null);

  const [modalCriarCanal, setModalCriarCanal] = useState<null | 'texto' | 'voz'>(null);
  const [modalGerenciar, setModalGerenciar] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const [sidebarExpandida, setSidebarExpandida] = useState(true);
  const [mostrarTodosParticipantes, setMostrarTodosParticipantes] = useState<{ [canalId: number]: boolean }>({});
  const [entrandoNaComunidade, setEntrandoNaComunidade] = useState(false);

  const voz = useVoiceChannel();

  const souDono = comunidade?.papel === 'dono';
  const ehMembro = comunidade?.papel === 'dono' || comunidade?.papel === 'membro';

  const loadTudo = useCallback(async () => {
    if (!session || !comunidadeId) return;
    try {
      const [listaComunidades, atual, listaCanais] = await Promise.all([
        comunidadeApi.list(session),
        comunidadeApi.find(session, comunidadeId),
        canalApi.list(session, comunidadeId),
      ]);
      setComunidades(listaComunidades);
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
    setMostrarVoz(false);
    loadTudo();
  }, [loadTudo]);

  useEffect(() => {
    if (canalTextoAtivoId === null && canais.length > 0) {
      const primeiroTexto = canais.find(c => c.tipo === 'texto');
      if (primeiroTexto) setCanalTextoAtivoId(primeiroTexto.id);
    }
  }, [canais, canalTextoAtivoId]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (session && comunidadeId) {
        canalApi.list(session, comunidadeId)
          .then(canaisAtualizados => {
            setCanais(canaisAtualizados);
          })
          .catch(() => { });
      }
    }, CANAIS_POLL_MS);
    return () => clearInterval(iv);
  }, [session, comunidadeId]);

  useEffect(() => {
    return () => { void voz.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunidadeId]);

  async function abrirCanalVoz(canal: Canal) {
    if (!ehMembro) {
      setErro('Você precisa ser membro para entrar no canal de voz.');
      return;
    }
    if (!session || !canal.sala_id) return;
    if (voz.canalId === canal.id) {
      setMostrarVoz(true);
      return;
    }
    setEntrandoNoCanal(canal.id);
    try {
      const { token, url } = await salaApi.entrar(session, canal.sala_id);
      await voz.connect(canal.id, canal.nome, token, url);
      setMostrarVoz(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar no canal de voz.');
    } finally {
      setEntrandoNoCanal(null);
    }
  }

  function abrirCanalTexto(canal: Canal) {
    if (!ehMembro) {
      setErro('Você precisa ser membro para ver as mensagens.');
      return;
    }
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

  const toggleVerTodosParticipantes = (canalId: number) => {
    setMostrarTodosParticipantes(prev => ({
      ...prev,
      [canalId]: !prev[canalId]
    }));
  };

  // CORRIGIDO: Função para obter participantes de um canal
  const getParticipantesDoCanal = (canal: Canal): ParticipanteInfo[] => {
    // Se estiver conectado neste canal, usa os participantes do hook
    if (voz.canalId === canal.id && voz.conectado) {
      return voz.participantes.map(p => ({
        identity: p.identity || '',
        nome: p.nome || 'Usuário',
        foto: p.foto || null,
        micEnabled: p.micEnabled !== undefined ? p.micEnabled : true,
      }));
    }
    // Caso contrário, usa os participantes da API
    return canal.participantes_lista || [];
  };

  // Função para contar participantes de um canal
  const getTotalParticipantes = (canal: Canal): number => {
    if (voz.canalId === canal.id && voz.conectado) {
      return voz.participantes.length;
    }
    return canal.participantes_online || 0;
  };

  const canaisTexto = canais.filter(c => c.tipo === 'texto');
  const canaisVoz = canais.filter(c => c.tipo === 'voz');
  const canalTextoAtivo = canais.find(c => c.id === canalTextoAtivoId) ?? null;

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-on-surface-variant">
        <Loader2 size={22} className="spin-icon" />
      </div>
    );
  }

  if (erro && !comunidade) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-center text-on-surface-variant">
        <p>{erro}</p>
        <button className="btn-secondary" onClick={() => navigate('/comunidades')}>Voltar</button>
      </div>
    );
  }

  if (!comunidade) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background">
      {/* ---- Rail de servidores ---- */}
      <nav className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-outline-variant bg-surface-container-lowest py-3">
        <button
          title="Voltar ao Painel"
          onClick={() => navigate('/painel')}
          className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant transition-all hover:rounded-xl hover:bg-primary-container hover:text-on-primary-container"
        >
          <Home size={20} />
        </button>
        <div className="my-1 h-px w-8 bg-outline-variant" />
        {comunidades.map(c => {
          const ativo = c.id === comunidadeId;
          const icone = resolveFotoUrl(c.icone_url);
          return (
            <button
              key={c.id}
              title={c.nome}
              onClick={() => navigate(`/comunidades/${c.id}`)}
              className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold transition-all hover:rounded-xl ${ativo ? 'rounded-xl bg-primary-container text-on-primary-container shadow-glow' : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-container/60'}`}
            >
              {icone ? <img src={icone} alt={c.nome} className="h-full w-full object-cover" /> : c.nome.slice(0, 2).toUpperCase()}
            </button>
          );
        })}
        <button
          title="Criar comunidade"
          onClick={() => navigate('/comunidades?nova=1')}
          className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-outline-variant text-tertiary transition-all hover:rounded-xl hover:bg-surface-container-high"
        >
          <Plus size={20} />
        </button>
      </nav>

      {/* ---- Sidebar ---- */}
      <aside
        className={`flex flex-col border-r border-outline-variant bg-surface-container-low transition-all duration-300 ease-in-out ${sidebarExpandida ? 'w-64' : 'w-0 overflow-hidden border-0'}`}
      >
        <div className="relative flex items-center justify-between border-b border-outline-variant/60 px-4 py-4">
          <h1 className="truncate text-sm font-bold text-on-surface">{comunidade.nome}</h1>
          {souDono && (
            <button onClick={() => setMenuAberto(v => !v)} className="text-on-surface-variant hover:text-on-surface">
              <Settings size={16} />
            </button>
          )}
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
                <Hash size={16} className="shrink-0 opacity-70" />
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
                    <Volume2 size={16} className="shrink-0 opacity-70" />
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

                  {/* Lista de participantes */}
                  {totalParticipantes > 0 && ehMembro && (
                    <div className={`ml-6 mt-0.5 flex flex-col gap-1 border-l border-outline-variant/40 pl-3 ${!conectadoAqui ? 'opacity-70' : ''}`}>
                      {(mostrarTodos ? participantes : participantes.slice(0, 3)).map(p => (
                        <div key={p.identity} className="flex items-center gap-1.5 justify-between py-0.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Avatar nome={p.nome} foto={p.foto} size={24} />
                            <span className={`truncate text-[12px] ${conectadoAqui && p.identity === voz.identity ? 'text-tertiary font-semibold' : 'text-on-surface-variant'}`}>
                              {p.nome}
                              {conectadoAqui && p.identity === voz.identity && ' (você)'}
                            </span>
                          </div>
                          {!p.micEnabled && <MicOff size={10} className="text-error shrink-0" />}
                          {!conectadoAqui && (
                            <span className="text-[8px] text-outline ml-1">●</span>
                          )}
                        </div>
                      ))}

                      {participantes.length > 3 && (
                        <button
                          onClick={() => toggleVerTodosParticipantes(canal.id)}
                          className="flex items-center gap-1 text-[11px] text-outline hover:text-on-surface-variant transition-colors py-0.5"
                        >
                          {mostrarTodos ? (
                            <>Ver menos <ChevronUp size={12} /></>
                          ) : (
                            <>+{participantes.length - 3} outros <ChevronDown size={12} /></>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botão para entrar na comunidade */}
          {!ehMembro && (
            <div className="px-2 pt-4 border-t border-outline-variant/40">
              <button
                onClick={entrarNaComunidade}
                disabled={entrandoNaComunidade}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {entrandoNaComunidade ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Entrar na comunidade
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-outline">
                Entre para participar dos canais de texto e voz
              </p>
            </div>
          )}
        </div>

        {/* Barra de voz conectada */}
        {voz.conectado && (
          <div className="border-t border-outline-variant/60 bg-surface-container-high/60 px-3 py-2">
            <button onClick={() => setMostrarVoz(true)} className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left hover:bg-surface-container-highest">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-tertiary">
                  <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-pulse" /> Voz conectada
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
            <div className="truncate text-xs font-semibold text-on-surface">{usuario?.nome}</div>
            <div className="text-[10px] text-tertiary">Online</div>
          </div>
          <button onClick={() => navigate('/perfil')} title="Configurações" className="text-on-surface-variant hover:text-on-surface">
            <Settings size={15} />
          </button>
        </div>
      </aside>

      {/* Botão toggle sidebar */}
      <button
        onClick={() => setSidebarExpandida(!sidebarExpandida)}
        className={`absolute left-[72px] top-1/2 z-20 -translate-y-1/2 rounded-r-lg bg-surface-container-high p-1.5 shadow-lg transition-all duration-300 hover:bg-surface-container-highest ${sidebarExpandida ? 'translate-x-64' : 'translate-x-0'}`}
        title={sidebarExpandida ? 'Recolher barra lateral' : 'Expandir barra lateral'}
      >
        {sidebarExpandida ? (
          <ChevronLeft size={16} className="text-on-surface-variant" />
        ) : (
          <ChevronRight size={16} className="text-on-surface-variant" />
        )}
      </button>

      {/* Área principal */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {erro && (
          <div className="flex items-center justify-between bg-error-container/20 border-b border-error/30 px-4 py-2">
            <span className="text-sm text-error">{erro}</span>
            <button onClick={() => setErro(null)} className="text-error hover:text-error-hover">
              <X size={16} />
            </button>
          </div>
        )}

        {mostrarVoz && voz.conectado && ehMembro && voz.canalId !== null ? (
          <VoiceRoomEmbed
            canalId={voz.canalId}
            canalNome={voz.nomeCanal}
            onDisconnect={sairDaVoz}
          />
        ) : canalTextoAtivo && session && usuario && ehMembro ? (
          <ChatPanel session={session} canal={canalTextoAtivo} meuUsuarioId={usuario.id} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-on-surface-variant">
            {!ehMembro ? (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
                  <LogIn size={40} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-on-surface">{comunidade.nome}</h2>
                <p className="text-sm text-center max-w-md">
                  Você ainda não faz parte desta comunidade.
                  {comunidade.descricao && (
                    <span className="block mt-1 text-on-surface-variant/70">{comunidade.descricao}</span>
                  )}
                </p>
                <button
                  onClick={entrarNaComunidade}
                  disabled={entrandoNaComunidade}
                  className="btn-primary flex items-center gap-2 mt-2"
                >
                  {entrandoNaComunidade ? (
                    <>
                      <Loader2 size={16} className="spin-icon" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn size={16} />
                      Entrar na comunidade
                    </>
                  )}
                </button>
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
    </div>
  );
}