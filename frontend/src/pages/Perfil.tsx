import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, ArrowRight, BadgeCheck, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { salaApi, resolveFotoUrl, ApiError } from '../api/client';
import type { Sala } from '../api/types';
import AppShell from '../layout/AppShell';

export default function Perfil() {
  const { session, usuario, signOut } = useAuth();
  const navigate = useNavigate();

  const [minhasSalas, setMinhasSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    salaApi.list(session)
      .then(list => mounted && setMinhasSalas(list.filter(s => s.criado_por === session.id)))
      .catch(err => mounted && setError(err instanceof ApiError ? err.message : 'Erro ao carregar suas salas.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [session?.id]);

  if (!usuario) return null;

  const foto = resolveFotoUrl(usuario.foto);
  const initials = usuario.nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  return (
    <AppShell>
      <div className="glass-panel relative overflow-hidden rounded-3xl">
        {/* Banner */}
        <div className="relative h-40 w-full md:h-56">
          <div className="absolute inset-0 bg-gradient-to-r from-[#124af0] via-[#6c04de] to-[#00797e] opacity-80" />
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 50%)' }}
          />
        </div>

        <div className="relative -mt-16 px-6 pb-8 md:-mt-20 md:px-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            {/* Avatar */}
            <div className="relative inline-block">
              <div className="relative z-10 h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container bg-surface-container-highest md:h-40 md:w-40">
                {foto ? (
                  <img src={foto} alt={usuario.nome} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-on-surface">{initials}</div>
                )}
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
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-surface-container-highest px-3 py-1.5">
                <Video size={16} className="text-secondary" />
                <span className="text-label-sm text-on-surface">{minhasSalas.length} sala(s) criada(s)</span>
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

      {/* Minhas salas */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Users size={20} className="text-primary" /> Minhas salas
          </h2>
          <span className="text-label-md text-on-surface-variant">{minhasSalas.length} criada(s)</span>
        </div>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : minhasSalas.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <p className="text-sm text-on-surface-variant">Você ainda não criou nenhuma sala.</p>
            <button type="button" onClick={() => navigate('/salas?nova=1')} className="btn-primary mt-2 px-5 py-2 text-sm">
              Criar sala
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {minhasSalas.map(sala => (
              <div
                key={sala.id}
                onClick={() => navigate(`/salas/${sala.id}`)}
                className="glass-panel group flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-surface-container-high"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest text-lg font-bold text-primary">
                  {sala.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-grow">
                  <h3 className="text-label-md text-on-surface transition-colors group-hover:text-primary">{sala.nome}</h3>
                  <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                    <span className="inline-block h-2 w-2 rounded-full bg-tertiary" />
                    {sala.participantes_online ?? 0} online
                  </p>
                </div>
                <ArrowRight size={18} className="text-outline transition-colors group-hover:text-on-surface" />
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
