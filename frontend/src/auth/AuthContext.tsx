// auth/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { login as apiLogin, acessoApi, onSessaoExpirada, APP_KEY, type StoredSession } from '../api/client';
import type { LoginResponse, Usuario } from '../api/types';

const STORAGE_KEY = 'webleia.session';

// A cada 20min renovamos a sessão em background — bem dentro da janela de
// 120min do token curto e insignificante frente aos 30 dias do long token,
// mas garante que uma aba parada (sem outras chamadas à API) nunca deixe
// o token "esfriar" até expirar.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

interface AuthState {
  session: StoredSession | null;
  usuario: LoginResponse | null;
  isAdmin: boolean;
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, senha: string) => Promise<void>;
  signOut: () => void;
  updateUsuario: (patch: Partial<LoginResponse>) => void;
  refreshUser: (usuarioAtualizado: Usuario) => void; // Adicionado
}

const AuthContext = createContext<AuthState | null>(null);

function loadStored(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<LoginResponse | null>(() => loadStored());
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (usuario) localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
    else localStorage.removeItem(STORAGE_KEY);
  }, [usuario]);

  async function signIn(email: string, senha: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(email, senha);
      setUsuario(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nao foi possivel entrar.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setUsuario(null);
  }

  function updateUsuario(patch: Partial<LoginResponse>) {
    setUsuario(prev => (prev ? { ...prev, ...patch } : prev));
  }

  // CORRIGIDO: refreshUser agora usa o estado atual
  const refreshUser = useCallback((usuarioAtualizado: Usuario) => {
    setUsuario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        ...usuarioAtualizado,
      };
    });
  }, []);

  const session: StoredSession | null = usuario
    ? { id: usuario.id, token: usuario.token, appKey: APP_KEY, perfil: usuario.perfil }
    : null;

  // Sessão expirada de verdade (token revogado, muito tempo sem abrir o
  // app etc.) → desloga automaticamente em vez de deixar a tela travada
  // com erros 401/403 silenciosos.
  useEffect(() => {
    return onSessaoExpirada(() => {
      setUsuario(null);
      setError('Sua sessão expirou. Faça login novamente.');
    });
  }, []);

  // Refresh automático em background: mantém a sessão viva mesmo quando o
  // usuário fica um tempo sem disparar outras chamadas à API.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!session) return;

    const refresh = () => {
      const current = sessionRef.current;
      if (current) acessoApi.refreshToken(current).catch(() => {});
    };

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    // Também renova ao voltar o foco na aba (ex.: notebook que hibernou).
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session?.id, session?.token]);

  const isAdmin = usuario?.perfil === 1 || session?.perfil === 1;

  return (
    <AuthContext.Provider value={{
      session,
      usuario,
      isAdmin,
      refreshUser,
      loading,
      isLoading,
      error,
      signIn,
      signOut,
      updateUsuario
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}