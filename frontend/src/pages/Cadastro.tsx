import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { cadastro } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import AuthShell, { authField } from '../components/AuthShell';

export default function Cadastro() {
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => { if (session) navigate('/painel', { replace: true }); }, [session]);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmSenha, setShowConfirmSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (senha !== confirmSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (senha.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await cadastro({ nome, email, senha });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      maxWidth={480}
      footer={
        <p className="mt-stack-lg text-center text-sm italic text-on-surface-variant">
          Reuniões, jogos e conversas — sua resenha, sua sala.
        </p>
      }
    >
      <div className="mb-stack-lg text-center">
        <h2 className="mb-2 text-headline-md text-on-surface">Cadastro</h2>
        <p className="text-body-md text-on-surface-variant">Crie sua conta para começar.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-stack-md">
        {/* NOME */}
        <div className="space-y-1">
          <label htmlFor="nome" className={authField.label}>
            Como você quer ser chamado? <span className="text-error">*</span>
          </label>

          <div className={authField.wrap}>
            <div className={authField.icon}>
              <User size={18} className="text-outline" />
            </div>

            <input
              id="nome"
              type="text"
              autoComplete="nickname"
              placeholder="Digite seu Nickname (vulgo)"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              autoFocus
              className={authField.input}
            />
          </div>
        </div>

        {/* EMAIL */}
        <div className="space-y-1">
          <label htmlFor="email" className={authField.label}>
            E-mail <span className="text-error">*</span>
          </label>
          <div className={authField.wrap}>
            <div className={authField.icon}><Mail size={18} className="text-outline" /></div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={authField.input}
            />
          </div>
        </div>

        {/* SENHA */}
        <div className="space-y-1">
          <label htmlFor="senha" className={authField.label}>
            Senha <span className="text-error">*</span>
          </label>
          <div className={authField.wrap}>
            <div className={authField.icon}><Lock size={18} className="text-outline" /></div>
            <input
              id="senha"
              type={showSenha ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
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

        {/* CONFIRMAR SENHA */}
        <div className="space-y-1">
          <label htmlFor="confirmSenha" className={authField.label}>
            Confirmar senha <span className="text-error">*</span>
          </label>
          <div className={authField.wrap}>
            <div className={authField.icon}><Lock size={18} className="text-outline" /></div>
            <input
              id="confirmSenha"
              type={showConfirmSenha ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirme sua senha"
              value={confirmSenha}
              onChange={e => setConfirmSenha(e.target.value)}
              required
              className={`${authField.input} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmSenha(v => !v)}
              aria-label={showConfirmSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface"
            >
              {showConfirmSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
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
            {loading ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </div>

        <div className="relative py-1">
          <div aria-hidden="true" className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/50" />
          </div>
          <div className="relative flex justify-center text-label-sm">
            <span className="bg-surface-container px-2 text-on-surface-variant">ou</span>
          </div>
        </div>

        <button type="button" onClick={() => navigate('/login')} className="btn-secondary w-full py-3">
          Já tenho conta
        </button>
      </form>

      <p className="my-3 text-center text-xs text-on-surface-variant/60">Resenha © 2026</p>
    </AuthShell>
  );
}
