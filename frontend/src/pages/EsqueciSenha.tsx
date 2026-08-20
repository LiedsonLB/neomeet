import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MailCheck, AlertTriangle } from 'lucide-react';
import { esqueciSenha } from '../api/client';
import AuthShell, { authField } from '../components/AuthShell';

export default function EsqueciSenha() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await esqueciSenha(email);
      // Resposta é sempre genérica (não revela se o e-mail existe).
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar redefinição.');
    } finally { setLoading(false); }
  }

  return (
    <AuthShell>
      <div className="mb-stack-lg text-center">
        <h2 className="mb-2 text-headline-md text-on-surface">Esqueci minha senha</h2>
        {!sent && (
          <p className="text-body-md text-on-surface-variant">
            Informe o e-mail usado no cadastro para receber o link de redefinição.
          </p>
        )}
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <MailCheck size={40} className="text-tertiary" />
          <p className="text-body-md text-on-surface-variant">
            Se <strong className="text-on-surface">{email}</strong> estiver cadastrado, você vai receber
            um e-mail com o link para escolher uma nova senha. O link é válido por 1 hora.
          </p>
          <button type="button" onClick={() => navigate('/login')} className="btn-secondary w-full py-3">
            Voltar para o login
          </button>
        </div>
      ) : (
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
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
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

          <div className="pt-stack-sm">
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Enviando…' : 'Enviar link de redefinição'}
            </button>
          </div>
          <button type="button" onClick={() => navigate('/login')} className="btn-secondary w-full py-3">
            Voltar para o login
          </button>
        </form>
      )}

    </AuthShell>
  );
}