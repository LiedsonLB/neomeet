// Dashboard.tsx - Versão corrigida com Comunidades
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ArrowRight, Compass, Sparkles, Hash, Volume2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, resolveFotoUrl } from '../api/client';
import type { Comunidade } from '../api/types';
import AppShell from '../layout/AppShell';

const CATEGORIES = ['Todos', 'Jogos', 'Tech', 'Educação'];

function primeiroNome(nome?: string) {
  return (nome ?? '').split(' ')[0] || 'visitante';
}

export default function Dashboard() {
  const { session, usuario } = useAuth();
  const navigate = useNavigate();

  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todos');

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    comunidadeApi
      .list(session)
      .then(list => {
        if (mounted) {
          setComunidades(Array.isArray(list) ? list : []);
          setError(null);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar comunidades.');
          setComunidades([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
      
    return () => { mounted = false; };
  }, [session]);

  // Comunidades onde o usuário é dono
  const minhasComunidades = useMemo(() => {
    const list = Array.isArray(comunidades) ? comunidades : [];
    return list.filter(c => c.papel === 'dono');
  }, [comunidades]);

  // Comunidades para descobrir (onde não é dono)
  const descobrir = useMemo(() => {
    const list = Array.isArray(comunidades) ? comunidades : [];
    return list
      .filter(c => c.papel !== 'dono')
      .filter(c => categoria === 'Todos' || c.categoria === categoria)
      .filter(c => !busca.trim() || c.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  }, [comunidades, categoria, busca]);

  // Se não houver sessão, mostrar mensagem apropriada
  if (!session) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-on-surface-variant">Faça login para ver suas comunidades.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* ---- Header ---- */}
      <header className="flex flex-col items-start justify-between gap-stack-md md:flex-row md:items-center">
        <div>
          <h1 className="text-headline-lg-mobile text-on-surface tracking-tight md:text-headline-xl">
            Olá, <span className="gradient-text">{primeiroNome(usuario?.nome)}</span>
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant md:text-body-lg">
            Pronto para a resenha de hoje?
          </p>
        </div>
        <div className="group relative w-full md:w-96">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar comunidades..."
            className="w-full rounded-full border border-outline-variant bg-surface-container py-3 pl-12 pr-4 text-body-md text-on-surface placeholder-outline-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {/* ---- Suas comunidades (onde é dono) ---- */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Users size={20} className="text-primary" /> Suas comunidades
          </h2>
          <button 
            type="button" 
            onClick={() => navigate('/comunidades')} 
            className="text-label-md text-tertiary transition-colors hover:text-tertiary-fixed-dim"
          >
            Ver todas
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : minhasComunidades.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <Sparkles size={22} className="text-outline" />
            <p className="text-sm text-on-surface-variant">Você ainda não criou nenhuma comunidade.</p>
            <button 
              type="button" 
              onClick={() => navigate('/comunidades?nova=1')} 
              className="btn-primary mt-2 px-5 py-2 text-sm"
            >
              Criar minha primeira comunidade
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {minhasComunidades.map(comunidade => (
              <div 
                key={comunidade.id} 
                className="glass-card group relative flex flex-col gap-stack-md overflow-hidden rounded-xl p-4 transition-all duration-300 hover:shadow-[0px_4px_20px_rgba(46,91,255,0.15)]"
              >
                <div className="absolute -left-1 top-1/2 h-12 w-2 -translate-y-1/2 rounded-r-full bg-tertiary opacity-80 shadow-[0_0_10px_#00dce5]" />
                <div className="flex items-center gap-4 pl-2">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-surface-variant bg-surface-container-highest text-lg font-bold text-primary overflow-hidden">
                    {comunidade.icone_url ? (
                      <img 
                        src={resolveFotoUrl(comunidade.icone_url)} 
                        alt={comunidade.nome} 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      comunidade.nome.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-body-lg font-bold leading-tight text-on-surface">{comunidade.nome}</h3>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-tertiary" />
                      <span className="text-label-sm text-tertiary">{comunidade.total_membros ?? 1} membros</span>
                    </div>
                  </div>
                </div>
                {comunidade.descricao && (
                  <p className="line-clamp-2 text-label-md text-on-surface-variant">{comunidade.descricao}</p>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/comunidades/${comunidade.id}`)}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high py-2.5 text-label-md text-on-surface transition-all hover:border-transparent hover:bg-primary-container hover:text-on-primary-container"
                >
                  Gerenciar comunidade <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Descobrir comunidades ---- */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Compass size={20} className="text-primary" /> Descobrir comunidades
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={
                  categoria === c
                    ? 'rounded-full bg-primary px-4 py-2 text-label-md text-on-primary shadow-[0_0_10px_rgba(184,195,255,0.2)] transition-colors'
                    : 'rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface'
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : descobrir.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <Compass size={22} className="text-outline" />
            <p className="text-sm text-on-surface-variant">
              {busca.trim() ? 'Nenhuma comunidade encontrada com esses filtros.' : 'Nenhuma comunidade disponível para descobrir.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3 lg:grid-cols-4">
            {descobrir.map(comunidade => (
              <div
                key={comunidade.id}
                onClick={() => navigate(`/comunidades/${comunidade.id}`)}
                className="glass-card group flex cursor-pointer flex-col gap-4 rounded-2xl border border-outline-variant p-5 transition-colors hover:border-outline"
              >
                <div className="relative h-32 w-full overflow-hidden rounded-lg bg-surface-container-high">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-container/40 via-secondary-container/30 to-tertiary-container/40 text-2xl font-bold text-on-surface opacity-80 transition-transform duration-500 group-hover:scale-105">
                    {comunidade.icone_url ? (
                      <img 
                        src={resolveFotoUrl(comunidade.icone_url)} 
                        alt={comunidade.nome} 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      comunidade.nome.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  {comunidade.categoria && (
                    <div className="absolute right-2 top-2 rounded bg-surface/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface backdrop-blur">
                      {comunidade.categoria}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-body-lg font-bold text-on-surface">{comunidade.nome}</h3>
                  <p className="mt-1 line-clamp-2 text-label-md text-on-surface-variant">
                    {comunidade.descricao ?? 'Sem descrição.'}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between text-on-surface-variant">
                  <span className="flex items-center gap-1 text-label-sm">
                    <Users size={14} /> {comunidade.total_membros ?? 1} membros
                  </span>
                  <ArrowRight size={18} className="transition-all group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}