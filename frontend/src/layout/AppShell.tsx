import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Compass, LogOut, MessagesSquare, Plus, Loader2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { comunidadeApi, resolveFotoUrl } from '../api/client';
import type { Comunidade } from '../api/types';
import Avatar from '../components/Avatar';

const NAV_ITEMS = [
  { to: '/painel', label: 'Home', icon: Home },
  { to: '/comunidades', label: 'Comunidades', icon: Compass },
];

interface AppShellProps {
  children: ReactNode;
  /** Quando true, o conteúdo ocupa 100% da altura/largura disponível, sem
   * o max-width/padding padrão — usado pela tela de uma comunidade
   * (ComunidadeRoom.tsx), que já tem seu próprio layout interno (sidebar
   * de canais + chat/voz) e precisa de espaço de borda a borda. Isso
   * também resolve o "troca de aside" — a comunidade passa a viver DENTRO
   * do rail principal do AppShell, em vez de ser uma tela isolada com um
   * rail próprio por cima. */
  fullBleed?: boolean;
}

export default function AppShell({ children, fullBleed }: AppShellProps) {
  const { session, usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [loadingComunidades, setLoadingComunidades] = useState(true);

  function isActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  useEffect(() => {
    if (!session) {
      setLoadingComunidades(false);
      return;
    }

    let mounted = true;
    setLoadingComunidades(true);

    comunidadeApi
      .list(session)
      .then(list => {
        if (mounted) {
          // Filtra apenas comunidades onde o usuário é membro
          const comunidadesDoUsuario = Array.isArray(list)
            ? list.filter(c => c.papel !== null && c.papel !== undefined)
            : [];
          setComunidades(comunidadesDoUsuario);
        }
      })
      .catch(() => {
        if (mounted) setComunidades([]);
      })
      .finally(() => {
        if (mounted) setLoadingComunidades(false);
      });

    return () => { mounted = false; };
  }, [session]);

  const comunidadeIdAtual = location.pathname.startsWith('/comunidades/')
    ? Number(location.pathname.split('/')[2])
    : null;

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* ---- Rail lateral (desktop) com comunidades ---- */}
      <nav className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col justify-between border-r border-outline-variant bg-surface-container-lowest py-4 md:flex">
        <div className="flex flex-col items-center gap-2">
          {/* Logo */}
          <button
            type="button"
            onClick={() => navigate('/painel')}
            className="shadow-lg transition-transform hover:scale-105"
            title="Resenha"
          >
            <img src="/resenha_icon.png" alt="Resenha" className="h-12" />
          </button>

          <div className="my-1 h-px w-8 bg-outline-variant" />

          {/* Navegação principal */}
          <div className="flex flex-col items-center gap-3 px-2">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  type="button"
                  title={item.label}
                  onClick={() => navigate(item.to)}
                  className={
                    active
                      ? 'flex h-12 w-12 scale-110 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[0px_4px_20px_rgba(46,91,255,0.3)] transition-all'
                      : 'flex h-12 w-12 items-center justify-center rounded-xl text-outline transition-all duration-200 hover:bg-surface-container-high hover:text-on-surface-variant'
                  }
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                </button>
              );
            })}

            <div className="my-1 h-px w-8 bg-outline-variant" />

            {/* Lista de Comunidades */}
            {loadingComunidades ? (
              <Loader2 size={20} className="spin-icon text-outline" />
            ) : (
              comunidades.map(c => {
                const ativo = c.id === comunidadeIdAtual;
                const icone = resolveFotoUrl(c.icone_url);
                const pendente = c.papel === 'pendente';
                return (
                  <button
                    key={c.id}
                    title={pendente ? `${c.nome} (aguardando aprovação)` : c.nome}
                    onClick={() => navigate(`/comunidades/${c.id}`)}
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold transition-all hover:rounded-xl ${ativo
                      ? 'bg-surface-container-high text-on-primary-container shadow-glow'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-container/60'
                      } ${pendente ? 'opacity-50' : ''}`}
                  >
                    {icone ? (
                      <img src={icone} alt={c.nome} className="h-full w-full object-cover" />
                    ) : (
                      c.nome.slice(0, 2).toUpperCase()
                    )}
                    {pendente && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest bg-amber" />
                    )}
                  </button>
                );
              })
            )}

            {/* Botão Criar Comunidade */}
            <button
              type="button"
              title="Criar comunidade"
              onClick={() => navigate('/comunidades?nova=1')}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-outline-variant bg-surface-container text-tertiary transition-all hover:bg-surface-container-high"
            >
              <Plus size={22} />
            </button>
          </div>
        </div>

        {/* Footer - Perfil e Sair */}
        <div className="flex flex-col items-center gap-3 px-2">
          <button
            type="button"
            title="Meu perfil"
            onClick={() => navigate('/perfil')}
            className={
              isActive('/perfil')
                ? 'flex h-11 w-11 items-center justify-center rounded-full ring-2 ring-primary'
                : 'flex h-11 w-11 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100'
            }
          >
            <Avatar nome={usuario?.nome ?? '?'} foto={usuario?.foto} moldura={usuario?.moldura} size={38} />
          </button>
          <button
            type="button"
            title="Sair"
            onClick={() => { signOut(); navigate('/login'); }}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-outline transition-all hover:bg-error-container/20 hover:text-error"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* ---- Topbar (mobile) ---- */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-margin-mobile md:hidden">
        <button type="button" onClick={() => navigate('/painel')} className="flex items-center gap-2">
          <MessagesSquare size={22} className="text-primary" />
          <span className="text-headline-md text-primary">Resenha</span>
        </button>
        <button type="button" onClick={() => navigate('/perfil')}>
          <Avatar nome={usuario?.nome ?? '?'} foto={usuario?.foto} moldura={usuario?.moldura} size={32} />
        </button>
      </header>

      {/* ---- Conteúdo principal ---- */}
      <main className={fullBleed ? 'h-screen pb-16 pt-16 md:ml-20 md:h-screen md:pb-0 md:pt-0' : 'min-h-screen pb-24 pt-16 md:ml-20 md:pb-8 md:pt-0'}>
        {fullBleed ? (
          <div className="h-full">{children}</div>
        ) : (
          <div className="mx-auto flex w-full max-w-container-max flex-col gap-margin-desktop p-gutter">
            {children}
          </div>
        )}
      </main>

      {/* ---- Bottom nav (mobile) ---- */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant bg-surface-container-lowest px-2 md:hidden">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={
                active
                  ? 'my-1 flex h-12 w-14 scale-110 flex-col items-center justify-center rounded-full bg-primary-container text-on-primary-container'
                  : 'flex h-12 w-14 flex-col items-center justify-center text-outline'
              }
            >
              <Icon size={22} />
            </button>
          );
        })}
        <button type="button" onClick={() => navigate('/comunidades?nova=1')} className="flex h-12 w-14 flex-col items-center justify-center text-outline">
          <Plus size={22} />
        </button>
        <button type="button" onClick={() => navigate('/perfil')} className="flex h-12 w-14 flex-col items-center justify-center text-outline">
          <Avatar nome={usuario?.nome ?? '?'} foto={usuario?.foto} moldura={usuario?.moldura} size={22} />
        </button>
      </nav>
    </div>
  );
}