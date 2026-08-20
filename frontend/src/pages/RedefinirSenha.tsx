import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { redefinirSenha } from '../api/client';
import AuthShell, { authField } from '../components/AuthShell';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkInvalido = !email || !token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha !== confirmSenha) { setError('As senhas não coincidem.'); return; }
    if (novaSenha.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }
    setLoading(true); setError(null);
    try {
      await redefinirSenha({ email, token, nova_senha: novaSenha });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally { setLoading(false); }
  }

  return (
    <AuthShell>
      <div className="mb-stack-lg text-center">
        <h2 className="mb-2 text-headline-md text-on-surface">Redefinir senha</h2>
      </div>

      {linkInvalido ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
            <span>Link inválido. Solicite a redefinição novamente.</span>
          </div>
          <button type="button" onClick={() => navigate('/esqueci-senha')} className="btn-secondary w-full py-3">
            Solicitar novo link
          </button>
        </div>
      ) : done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <p className="text-body-md text-on-surface-variant">
            Senha redefinida com sucesso! Você já pode entrar com a nova senha.
          </p>
          <button type="button" onClick={() => navigate('/login')} className="btn-primary w-full py-3">
            Ir para o login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-stack-md">
          <p className="text-center text-body-md text-on-surface-variant">
            Escolha uma nova senha para <strong className="text-on-surface">{email}</strong>.
          </p>

          <div className="space-y-1">
            <label htmlFor="novaSenha" className={authField.label}>Nova senha</label>
            <div className={authField.wrap}>
              <div className={authField.icon}><Lock size={18} className="text-outline" /></div>
              <input
                id="novaSenha"
                type={showSenha ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                required
                autoFocus
                className={`${authField.input} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowSenha(v => !v)}
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface"
              >
                {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmSenha" className={authField.label}>Confirmar nova senha</label>
            <div className={authField.wrap}>
              <div className={authField.icon}><Lock size={18} className="text-outline" /></div>
              <input
                id="confirmSenha"
                type={showSenha ? 'text' : 'password'}
                placeholder="Confirme a nova senha"
                value={confirmSenha}
                onChange={e => setConfirmSenha(e.target.value)}
                required
                className={authField.input}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
