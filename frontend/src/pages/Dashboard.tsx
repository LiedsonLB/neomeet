// Dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ArrowRight, Compass, Sparkles, Radio, Mic } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, resolveFotoUrl, painelApi, CATEGORIAS_COMUNIDADE } from '../api/client';
import type { Comunidade, AtividadeAgora } from '../api/types';
import AppShell from '../layout/AppShell';

function primeiroNome(nome?: string) {
  return (nome ?? '').split(' ')[0] || 'visitante';
}

export default function Dashboard() {
  const { session, usuario } = useAuth();
  const navigate = useNavigate();

  const [minhasComunidades, setMinhasComunidades] = useState<Comunidade[]>([]);
  const [explorar, setExplorar] = useState<Comunidade[]>([]);
  const [atividades, setAtividades] = useState<AtividadeAgora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');

  // "O que está rolando agora" — atualiza a cada 20s pra sentir "ao vivo"
  // sem precisar abrir SSE nova só pra home.
  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const carregar = () => painelApi.atividades(session).then(list => { if (mounted) setAtividades(list); }).catch(() => {});
    carregar();
    const iv = setInterval(carregar, 20_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [session]);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    let mounted = true;

    Promise.all([comunidadeApi.list(session), comunidadeApi.explorar(session)])
      .then(([minhas, publicas]) => {
        if (!mounted) return;
        // Filtra apenas comunidades onde o usuário é dono
        setMinhasComunidades(minhas.filter(c => c.papel === 'dono'));
        // Explorar mostra todas as comunidades públicas que o usuário não é dono
        setExplorar(publicas.filter(c => c.papel !== 'dono'));
        setError(null);
      })
      .catch(err => {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro ao carregar comunidades.');
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [session]);

  const descobrir = useMemo(() => {
    let lista = explorar;
    if (categoriaFiltro) lista = lista.filter(c => c.categoria === categoriaFiltro);
    if (!busca.trim()) return lista;
    const termo = busca.trim().toLowerCase();
    return lista.filter(c => c.nome.toLowerCase().includes(termo));
  }, [explorar, busca, categoriaFiltro]);

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

      {/* ---- O que está rolando agora ---- */}
      {atividades.length > 0 && (
        <section className="flex flex-col gap-stack-md">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Radio size={20} className="text-tertiary" /> O que está rolando agora
          </h2>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {atividades.map(a => (
              <button
                key={a.canal_id}
                type="button"
                onClick={() => navigate(`/comunidades/${a.comunidade_id}?canal=${a.canal_id}`)}
                className="glass-card flex items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-surface-container-high"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tertiary/15 text-tertiary">
                  <Mic size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">{a.canal_nome}</p>
                  <p className="truncate text-xs text-on-surface-variant">{a.comunidade_nome}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-tertiary">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-tertiary" />
                    {a.total_participantes} pessoa{a.total_participantes !== 1 ? 's' : ''} conversando
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---- Suas comunidades (onde é dono) ---- */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Users size={20} className="text-primary" /> Suas comunidades
          </h2>
          <button type="button" onClick={() => navigate('/comunidades')} className="text-label-md text-tertiary transition-colors hover:text-tertiary-fixed-dim">
            Ver todas
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : minhasComunidades.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <Sparkles size={22} className="text-outline" />
            <p className="text-sm text-on-surface-variant">Você ainda não criou nenhuma comunidade.</p>
            <button type="button" onClick={() => navigate('/comunidades?nova=1')} className="btn-primary mt-2 px-5 py-2 text-sm">
              Criar minha primeira comunidade
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {minhasComunidades.map(comunidade => (
              <div
                key={comunidade.id}
                onClick={() => navigate(`/comunidades/${comunidade.id}`)}
                className="glass-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-colors hover:bg-surface-container-high"
              >
                {/* ============================================================
                    FIX: Banner da comunidade (igual ao Comunidades.tsx)
                    ============================================================ */}
                {comunidade.banner_url ? (
                  <div className="relative h-24 w-full overflow-hidden">
                    <img
                      src={resolveFotoUrl(comunidade.banner_url) ?? undefined}
                      alt={`Banner de ${comunidade.nome}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
                  </div>
                ) : (
                  <div className="h-16 w-full bg-gradient-to-br from-primary-container/60 to-secondary-container/60" />
                )}

                {/* ============================================================
                    FIX: Ícone da comunidade com moldura (igual ao Comunidades.tsx)
                    ============================================================ */}
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-3">
                    {comunidade.icone_url ? (
                      <img
                        src={resolveFotoUrl(comunidade.icone_url) ?? undefined}
                        alt={comunidade.nome}
                        className="-mt-8 h-12 w-12 rounded-2xl border-4 border-surface-container-lowest object-cover shadow"
                      />
                    ) : (
                      <div className="-mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-surface-container-lowest bg-gradient-to-br from-primary-container to-secondary-container text-sm font-bold text-on-primary-container shadow">
                        {comunidade.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-on-surface">{comunidade.nome}</h3>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
                        <Users size={12} /> {comunidade.total_membros ?? 1} membro{(comunidade.total_membros ?? 1) !== 1 ? 's' : ''}
                        <span className="ml-1 flex items-center gap-0.5 text-[10px] text-outline">
                          {comunidade.visibilidade === 'privada' ? '🔒 Privada' : '🌐 Pública'}
                        </span>
                        <span className="ml-1 rounded bg-primary-container/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">DONO</span>
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  {comunidade.descricao && (
                    <p className="line-clamp-2 text-xs text-on-surface-variant">{comunidade.descricao}</p>
                  )}
                </div>

                {/* Botão Gerenciar */}
                <div className="px-4 pb-4 mt-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/comunidades/${comunidade.id}`);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high py-2.5 text-label-md text-on-surface transition-all hover:border-transparent hover:bg-primary-container hover:text-on-primary-container"
                  >
                    Gerenciar comunidade <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Descobrir comunidades (públicas, das quais eu não faço parte) ---- */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Compass size={20} className="text-primary" /> Descobrir comunidades
          </h2>
        </div>

        <div className="-mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoriaFiltro('')}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${categoriaFiltro === '' ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Todas
          </button>
          {CATEGORIAS_COMUNIDADE.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaFiltro(categoriaFiltro === cat ? '' : cat)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${categoriaFiltro === cat ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : descobrir.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <Compass size={22} className="text-outline" />
            <p className="text-sm text-on-surface-variant">
              {busca.trim() || categoriaFiltro ? 'Nenhuma comunidade encontrada com esses filtros.' : 'Nenhuma comunidade disponível para descobrir.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3 lg:grid-cols-4">
            {descobrir.map(comunidade => (
              <div
                key={comunidade.id}
                onClick={() => navigate(`/comunidades/${comunidade.id}`)}
                className="glass-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-colors hover:bg-surface-container-high"
              >
                {/* ============================================================
                    FIX: Banner da comunidade (igual ao Comunidades.tsx)
                    ============================================================ */}
                {comunidade.banner_url ? (
                  <div className="relative h-24 w-full overflow-hidden">
                    <img
                      src={resolveFotoUrl(comunidade.banner_url) ?? undefined}
                      alt={`Banner de ${comunidade.nome}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
                  </div>
                ) : (
                  <div className="h-16 w-full bg-gradient-to-br from-primary-container/60 to-secondary-container/60" />
                )}

                {/* ============================================================
                    FIX: Ícone da comunidade (igual ao Comunidades.tsx)
                    ============================================================ */}
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-3">
                    {comunidade.icone_url ? (
                      <img
                        src={resolveFotoUrl(comunidade.icone_url) ?? undefined}
                        alt={comunidade.nome}
                        className="-mt-8 h-12 w-12 rounded-2xl border-4 border-surface-container-lowest object-cover shadow"
                      />
                    ) : (
                      <div className="-mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-surface-container-lowest bg-gradient-to-br from-primary-container to-secondary-container text-sm font-bold text-on-primary-container shadow">
                        {comunidade.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-on-surface">{comunidade.nome}</h3>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
                        <Users size={12} /> {comunidade.total_membros ?? 1} membro{(comunidade.total_membros ?? 1) !== 1 ? 's' : ''}
                        <span className="ml-1 flex items-center gap-0.5 text-[10px] text-outline">
                          {comunidade.visibilidade === 'privada' ? '🔒 Privada' : '🌐 Pública'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  {comunidade.descricao && (
                    <p className="line-clamp-2 text-xs text-on-surface-variant">{comunidade.descricao}</p>
                  )}
                </div>

                {/* Botão Entrar */}
                <div className="px-4 pb-4 mt-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/comunidades/${comunidade.id}`);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high py-2.5 text-label-md text-on-surface transition-all hover:border-transparent hover:bg-primary-container hover:text-on-primary-container"
                  >
                    Ver comunidade <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}