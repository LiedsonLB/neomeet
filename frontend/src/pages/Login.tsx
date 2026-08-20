import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { reenviarConfirmacao } from '../api/client';
import AuthShell, { authField } from '../components/AuthShell';

export default function Login() {
  const { signIn, session, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  const justRegistered = (location.state as { registered?: boolean } | null)?.registered;

  useEffect(() => {
    if (session) navigate('/painel', { replace: true });
  }, [session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await signIn(email, senha);
      navigate('/painel');
    } catch { }
  }

  async function handleReenviarConfirmacao() {
    if (!email) return;
    setReenviando(true);
    try {
      await reenviarConfirmacao(email);
    } catch {
      // resposta já é genérica de propósito
    } finally {
      setReenviando(false);
      setReenviado(true);
    }
  }

  return (
    <AuthShell
      footer={
        <p className="mt-stack-lg text-center text-sm italic text-on-surface-variant">
          Reuniões, jogos e conversas — sua resenha, sua sala.
        </p>
      }
    >
      <div className="mb-stack-lg text-center">
        <h2 className="mb-2 text-headline-md text-on-surface">Entrar</h2>
        <p className="text-body-md text-on-surface-variant">Acesse sua conta para continuar.</p>
      </div>

      {justRegistered && (
        <div className="mb-stack-md flex items-start gap-2 rounded-lg border border-tertiary/30 bg-tertiary-container/20 px-4 py-3 text-sm text-on-tertiary-container">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-tertiary" />
          <span>Cadastro realizado! Enviamos um e-mail de confirmação — confirme antes de entrar.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-stack-md">
        {/* E-MAIL */}
        <div className="space-y-1">
          <label htmlFor="email" className={authField.label}>E-mail</label>
          <div className={authField.wrap}>
            <div className={authField.icon}>
              <Mail size={18} className="text-outline" />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className={authField.input}
            />
          </div>
        </div>

        {/* SENHA */}
        <div className="space-y-1">
          <div className="ml-1 flex items-center justify-between">
            <label htmlFor="senha" className="block text-label-md text-on-surface">Senha</label>
            <button
              type="button"
              onClick={() => navigate('/esqueci-senha')}
              className="text-label-sm text-primary transition-colors hover:text-tertiary"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className={authField.wrap}>
            <div className={authField.icon}>
              <Lock size={18} className="text-outline" />
            </div>
            <input
              id="senha"
              type={showSenha ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className={`${authField.input} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowSenha((v) => !v)}
              aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface"
            >
              {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* ERRO */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
            <span>{error}</span>
          </div>
        )}
        {error && error.toLowerCase().includes('não verificado') && (
          <button
            type="button"
            onClick={handleReenviarConfirmacao}
            disabled={reenviando}
            className="text-left text-sm font-semibold text-primary underline transition-colors hover:text-tertiary disabled:opacity-60"
          >
            {reenviando ? 'Reenviando…' : reenviado ? 'E-mail reenviado ✓' : 'Reenviar e-mail de confirmação'}
          </button>
        )}

        {/* SUBMIT */}
        <div className="pt-stack-sm">
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </div>

        {/* DIVIDER */}
        <div className="relative py-1">
          <div aria-hidden="true" className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/50" />
          </div>
          <div className="relative flex justify-center text-label-sm">
            <span className="bg-surface-container px-2 text-on-surface-variant">ou</span>
          </div>
        </div>

        {/* CRIAR CONTA */}
        <button type="button" onClick={() => navigate('/cadastro')} className="btn-secondary w-full py-3">
          Criar conta
        </button>
      </form>

      <p className="my-3 text-center text-xs text-on-surface-variant/60">
        Resenha © 2026
      </p>
    </AuthShell>
  );
}