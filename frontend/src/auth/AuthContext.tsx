// auth/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as apiLogin, APP_KEY, type StoredSession } from '../api/client';
import type { LoginResponse, Usuario } from '../api/types';

const STORAGE_KEY = 'webleia.session';

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