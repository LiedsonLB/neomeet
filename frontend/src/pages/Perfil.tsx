// Perfil.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, ArrowRight, BadgeCheck, LogOut, Pencil } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, resolveFotoUrl, ApiError } from '../api/client';
import type { Comunidade, Usuario } from '../api/types';
import AppShell from '../layout/AppShell';
import EditarPerfilModal from '../components/EditarPerfilModal';
import Avatar from '../components/Avatar';

export default function Perfil() {
  const { session, usuario, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [minhasComunidades, setMinhasComunidades] = useState<Comunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    comunidadeApi.list(session)
      .then(list => {
        if (mounted) {
          // Filtra comunidades onde o usuário é dono
          setMinhasComunidades(list.filter(c => c.papel === 'dono'));
        }
      })
      .catch(err => mounted && setError(err instanceof ApiError ? err.message : 'Erro ao carregar suas comunidades.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [session?.id]);

  if (!usuario) return null;

  const banner = resolveFotoUrl(usuario.banner);

  const handlePerfilAtualizado = (usuarioAtualizado: Usuario) => {
    refreshUser(usuarioAtualizado);
  };

  return (
    <AppShell>
      <div className="glass-panel relative overflow-hidden rounded-3xl">
        {/* Banner */}
        <div className="relative h-40 w-full md:h-56">
          {banner ? (
            <img src={banner} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-[#124af0] via-[#6c04de] to-[#00797e] opacity-80" />
          )}
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 50%)' }}
          />
        </div>

        <div className="relative -mt-16 px-6 pb-8 md:-mt-20 md:px-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            {/* Avatar (usa o mesmo componente/presets de moldura do resto do app) */}
            <div className="relative inline-block">
              <div className="relative z-10 rounded-full border-4 border-surface-container bg-surface-container-highest">
                <Avatar nome={usuario.nome} foto={usuario.foto} moldura={usuario.moldura} size={128} />
              </div>
              <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 rounded-full border border-surface-bright bg-surface-container px-2 py-1 shadow-lg backdrop-blur-sm md:bottom-4 md:right-4">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-tertiary shadow-[0_0_8px_#00dce5]" />
                <span className="text-label-sm text-on-surface">Online</span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-3 pb-2">
              <button
                type="button"
                onClick={() => setModalEditarAberto(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-label-md text-on-primary transition-all hover:bg-primary-hover shadow-[0_0_20px_rgba(46,91,255,0.3)]"
              >
                <Pencil size={18} /> Editar perfil
              </button>
              <button
                type="button"
                onClick={() => { signOut(); navigate('/login'); }}
                className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 text-label-md text-on-surface transition-all hover:bg-surface-container-highest"
              >
                <LogOut size={18} /> Sair
              </button>
            </div>
          </div>

          {/* Detalhes */}
          <div className="mt-6 md:mt-8">
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-headline-lg text-on-surface">{usuario.nome}</h1>
              {usuario.perfil === 1 && (
                <BadgeCheck size={22} className="text-tertiary" aria-label="Administrador" />
              )}
            </div>
            <p className="mb-4 text-label-md text-primary">{usuario.email}</p>
            {usuario.descricao && (
              <p className="mb-4 max-w-xl whitespace-pre-wrap break-words text-label-md text-on-surface-variant">{usuario.descricao}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-surface-container-highest px-3 py-1.5">
                <Video size={16} className="text-secondary" />
                <span className="text-label-sm text-on-surface">{minhasComunidades.length} comunidade(s) criada(s)</span>
              </div>
              {usuario.perfil === 1 && (
                <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-surface-container-highest px-3 py-1.5">
                  <BadgeCheck size={16} className="text-tertiary" />
                  <span className="text-label-sm text-on-surface">Administrador</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Minhas comunidades */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Users size={20} className="text-primary" /> Minhas comunidades
          </h2>
          <span className="text-label-md text-on-surface-variant">{minhasComunidades.length} criada(s)</span>
        </div>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : minhasComunidades.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <p className="text-sm text-on-surface-variant">Você ainda não criou nenhuma comunidade.</p>
            <button type="button" onClick={() => navigate('/comunidades?nova=1')} className="btn-primary mt-2 px-5 py-2 text-sm">
              Criar comunidade
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {minhasComunidades.map(comunidade => (
              <div
                key={comunidade.id}
                onClick={() => navigate(`/comunidades/${comunidade.id}`)}
                className="glass-panel group flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-surface-container-high"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest text-lg font-bold text-primary overflow-hidden">
                  {comunidade.icone_url ? (
                    <img src={resolveFotoUrl(comunidade.icone_url) ?? undefined} alt={comunidade.nome} className="h-full w-full object-cover" />
                  ) : (
                    comunidade.nome.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="text-label-md text-on-surface transition-colors group-hover:text-primary">{comunidade.nome}</h3>
                  <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                    <span className="inline-block h-2 w-2 rounded-full bg-tertiary" />
                    {comunidade.total_membros ?? 1} membros
                  </p>
                </div>
                <ArrowRight size={18} className="text-outline transition-colors group-hover:text-on-surface" />
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="pb-2 text-center text-[11px] text-on-surface-variant/60">
        Resenha · Desenvolvido por{' '}
        <a href="https://liedsonbarros.vercel.app" target="_blank" rel="noreferrer noopener" className="font-medium text-primary hover:underline">
          Liedson Barros
        </a>
        {' · '}
        <a href="https://github.com/LiedsonLB" target="_blank" rel="noreferrer noopener" className="font-medium text-primary hover:underline">
          GitHub
        </a>
      </p>

      {/* Modal de edição */}
      {modalEditarAberto && (
        <EditarPerfilModal
          usuario={usuario}
          onClose={() => setModalEditarAberto(false)}
          onUpdated={handlePerfilAtualizado}
        />
      )}
    </AppShell>
  );
}