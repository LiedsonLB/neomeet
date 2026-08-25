import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Plus, MessagesSquare, Compass, Lock, Globe, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, resolveFotoUrl } from '../api/client';
import type { Comunidade } from '../api/types';
import AppShell from '../layout/AppShell';
import CriarComunidadeModal from '../components/CriarComunidadeModal';

type Aba = 'minhas' | 'explorar';

export default function Comunidades() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [aba, setAba] = useState<Aba>('minhas');
  const [minhas, setMinhas] = useState<Comunidade[]>([]);
  const [explorar, setExplorar] = useState<Comunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(params.get('nova') === '1');
  const [entrando, setEntrando] = useState<number | null>(null);

  async function load() {
    if (!session) return;
    setLoading(true);
    try {
      const [m, e] = await Promise.all([comunidadeApi.list(session), comunidadeApi.explorar(session)]);
      setMinhas(m);
      setExplorar(e);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar comunidades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  function fecharModal() {
    setModalAberto(false);
    if (params.get('nova')) {
      params.delete('nova');
      setParams(params, { replace: true });
    }
  }

  async function entrarPublica(c: Comunidade) {
    if (!session) return;
    setEntrando(c.id);
    try {
      await comunidadeApi.entrar(session, c.id);
      navigate(`/comunidades/${c.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar na comunidade.');
    } finally {
      setEntrando(null);
    }
  }

  const lista = aba === 'minhas' ? minhas : explorar;

  return (
    <AppShell>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface md:text-3xl">Comunidades</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Espaços com canais de texto e voz, no seu ritmo.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalAberto(true)}>
          <Plus size={16} /> Criar comunidade
        </button>
      </div>

      <div className="flex gap-2 border-b border-outline-variant/50">
        <button
          onClick={() => setAba('minhas')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${aba === 'minhas' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          <Users size={15} /> Minhas comunidades
        </button>
        <button
          onClick={() => setAba('explorar')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${aba === 'explorar' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          <Compass size={15} /> Explorar comunidades
        </button>
      </div>

      {erro && <p className="text-sm text-error">{erro}</p>}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <MessagesSquare size={28} className="text-outline" />
          <p className="text-sm text-on-surface-variant">
            {aba === 'minhas' ? 'Você ainda não faz parte de nenhuma comunidade.' : 'Nenhuma comunidade pública disponível pra explorar agora.'}
          </p>
          {aba === 'minhas' && (
            <button className="btn-secondary" onClick={() => setModalAberto(true)}>
              <Plus size={15} /> Criar a primeira
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-3">
          {lista.map(c => (
            <div key={c.id} className="glass-card flex flex-col overflow-hidden rounded-2xl transition-colors hover:bg-surface-container-high">
              <button onClick={() => aba === 'minhas' && navigate(`/comunidades/${c.id}`)} className="flex flex-1 flex-col text-left">
                {c.banner_url ? (
                  <div className="relative h-24 w-full overflow-hidden">
                    <img
                      src={resolveFotoUrl(c.banner_url) ?? undefined}
                      alt={`Banner de ${c.nome}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
                  </div>
                ) : (
                  <div className="h-16 w-full bg-gradient-to-br from-primary-container/60 to-secondary-container/60" />
                )}
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-3">
                    {c.icone_url ? (
                      <img
                        src={resolveFotoUrl(c.icone_url) ?? undefined}
                        alt={c.nome}
                        className="-mt-8 h-12 w-12 rounded-2xl border-4 border-surface-container-lowest object-cover shadow"
                      />
                    ) : (
                      <div className="-mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-surface-container-lowest bg-gradient-to-br from-primary-container to-secondary-container text-sm font-bold text-on-primary-container shadow">
                        {c.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-on-surface">{c.nome}</h3>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
                        <Users size={12} /> {c.total_membros ?? 1} membro{(c.total_membros ?? 1) !== 1 ? 's' : ''}
                        <span className="ml-1 flex items-center gap-0.5 text-[10px] text-outline">
                          {c.visibilidade === 'privada' ? <><Lock size={10} /> Privada</> : <><Globe size={10} /> Pública</>}
                        </span>
                        {c.papel === 'dono' && <span className="ml-1 rounded bg-primary-container/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">DONO</span>}
                        {c.papel === 'membro' && <span className="ml-1 rounded bg-secondary-container/30 px-1.5 py-0.5 text-[10px] font-semibold text-secondary">MEMBRO</span>}
                        {c.papel === 'pendente' && <span className="ml-1 rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">PENDENTE</span>}
                      </div>
                    </div>
                  </div>
                  {c.descricao && <p className="line-clamp-2 text-xs text-on-surface-variant">{c.descricao}</p>}
                </div>
              </button>

              {aba === 'explorar' && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => entrarPublica(c)}
                    disabled={entrando === c.id}
                    className="btn-secondary w-full justify-center py-2 text-xs"
                  >
                    {entrando === c.id ? <Loader2 size={13} className="spin-icon" /> : <><LogIn size={13} /> Entrar</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalAberto && session && (
        <CriarComunidadeModal
          session={session}
          onClose={fecharModal}
          onCreated={(c) => { fecharModal(); navigate(`/comunidades/${c.id}`); }}
        />
      )}
    </AppShell>
  );
}
