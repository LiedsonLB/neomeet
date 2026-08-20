import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ArrowRight, Compass, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { salaApi, ApiError } from '../api/client';
import type { Sala } from '../api/types';
import AppShell from '../layout/AppShell';

const CATEGORIES = ['Todos', 'Jogos', 'Tech', 'Educação'];

function primeiroNome(nome?: string) {
  return (nome ?? '').split(' ')[0] || 'visitante';
}

export default function Dashboard() {
  const { session, usuario } = useAuth();
  const navigate = useNavigate();

  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todos');

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    salaApi
      .list(session)
      .then(list => mounted && setSalas(list))
      .catch(err => mounted && setError(err instanceof ApiError ? err.message : 'Erro ao carregar comunidades.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [session?.id]);

  const minhasSalas = useMemo(
    () => salas.filter(s => s.criado_por === session?.id),
    [salas, session?.id],
  );

  const descobrir = useMemo(() => {
    return salas
      .filter(s => s.criado_por !== session?.id)
      .filter(s => categoria === 'Todos' || s.categoria === categoria)
      .filter(s => !busca.trim() || s.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  }, [salas, session?.id, categoria, busca]);

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
            placeholder="Buscar resenhas, salas ou pessoas..."
            className="w-full rounded-full border border-outline-variant bg-surface-container py-3 pl-12 pr-4 text-body-md text-on-surface placeholder-outline-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">{error}</p>
      )}

      {/* ---- Suas comunidades ---- */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Users size={20} className="text-primary" /> Suas comunidades
          </h2>
          <button type="button" onClick={() => navigate('/salas')} className="text-label-md text-tertiary transition-colors hover:text-tertiary-fixed-dim">
            Ver todas
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : minhasSalas.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <Sparkles size={22} className="text-outline" />
            <p className="text-sm text-on-surface-variant">Você ainda não criou nenhuma comunidade.</p>
            <button type="button" onClick={() => navigate('/salas?nova=1')} className="btn-primary mt-2 px-5 py-2 text-sm">
              Criar minha primeira sala
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {minhasSalas.map(sala => (
              <div key={sala.id} className="glass-card group relative flex flex-col gap-stack-md overflow-hidden rounded-xl p-4 transition-all duration-300 hover:shadow-[0px_4px_20px_rgba(46,91,255,0.15)]">
                <div className="absolute -left-1 top-1/2 h-12 w-2 -translate-y-1/2 rounded-r-full bg-tertiary opacity-80 shadow-[0_0_10px_#00dce5]" />
                <div className="flex items-center gap-4 pl-2">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-surface-variant bg-surface-container-highest text-lg font-bold text-primary">
                    {sala.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-body-lg font-bold leading-tight text-on-surface">{sala.nome}</h3>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" />
                      <span className="text-label-sm text-tertiary">{sala.participantes_online ?? 0} online</span>
                    </div>
                  </div>
                </div>
                <p className="line-clamp-2 text-label-md text-on-surface-variant">{sala.descricao ?? 'Sem descrição.'}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/salas/${sala.id}`)}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high py-2.5 text-label-md text-on-surface transition-all hover:border-transparent hover:bg-primary-container hover:text-on-primary-container"
                >
                  Entrar na sala <ArrowRight size={16} />
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
          <p className="text-sm text-on-surface-variant">Nenhuma comunidade encontrada.</p>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3 lg:grid-cols-4">
            {descobrir.map(sala => (
              <div
                key={sala.id}
                onClick={() => navigate(`/salas/${sala.id}`)}
                className="glass-card group flex cursor-pointer flex-col gap-4 rounded-2xl border border-outline-variant p-5 transition-colors hover:border-outline"
              >
                <div className="relative h-32 w-full overflow-hidden rounded-lg bg-surface-container-high">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-container/40 via-secondary-container/30 to-tertiary-container/40 text-2xl font-bold text-on-surface opacity-80 transition-transform duration-500 group-hover:scale-105">
                    {sala.nome.slice(0, 2).toUpperCase()}
                  </div>
                  {sala.categoria && (
                    <div className="absolute right-2 top-2 rounded bg-surface/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface backdrop-blur">
                      {sala.categoria}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-body-lg font-bold text-on-surface">{sala.nome}</h3>
                  <p className="mt-1 line-clamp-2 text-label-md text-on-surface-variant">{sala.descricao ?? 'Sem descrição.'}</p>
                </div>
                <div className="mt-auto flex items-center justify-between text-on-surface-variant">
                  <span className="flex items-center gap-1 text-label-sm">
                    <Users size={14} /> {sala.participantes_online ?? 0} online
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
