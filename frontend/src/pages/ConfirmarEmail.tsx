import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { confirmarEmail, reenviarConfirmacao } from '../api/client';
import AuthShell from '../components/AuthShell';

export default function ConfirmarEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';

  const [status, setStatus] = useState<'carregando' | 'sucesso' | 'erro'>('carregando');
  const [mensagem, setMensagem] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  useEffect(() => {
    if (!email || !token) {
      setStatus('erro');
      setMensagem('Link inválido. Verifique se copiou o link completo do e-mail.');
      return;
    }

    confirmarEmail({ email, token })
      .then(res => {
        setStatus('sucesso');
        setMensagem(res.message);
      })
      .catch(err => {
        setStatus('erro');
        setMensagem(err instanceof Error ? err.message : 'Não foi possível confirmar o e-mail.');
      });
  }, [email, token]);

  async function handleReenviar() {
    if (!email) return;
    setReenviando(true);
    try {
      await reenviarConfirmacao(email);
      setReenviado(true);
    } catch {
      // resposta já é genérica, sem detalhes pra vazar
      setReenviado(true);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-stack-md text-center">
        <h2 className="mb-2 text-headline-md text-on-surface">Confirmação de e-mail</h2>
      </div>

      {status === 'carregando' && (
        <div className="flex flex-col items-center gap-3.5 py-5 text-center">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-body-md text-on-surface-variant">Confirmando seu e-mail…</p>
        </div>
      )}

      {status === 'sucesso' && (
        <div className="flex flex-col items-center gap-3.5 py-5 text-center">
          <CheckCircle2 size={40} className="text-tertiary" />
          <p className="text-body-md text-on-surface-variant">{mensagem}</p>
          <button type="button" onClick={() => navigate('/login')} className="btn-primary w-full py-3">
            Ir para o login
          </button>
        </div>
      )}

      {status === 'erro' && (
        <div className="flex flex-col items-center gap-3.5 py-5 text-center">
          <XCircle size={40} className="text-error" />
          <p className="text-body-md text-on-surface-variant">{mensagem}</p>
          {email && !reenviado && (
            <button
              type="button"
              onClick={handleReenviar}
              disabled={reenviando}
              className="btn-secondary w-full py-3"
            >
              {reenviando ? 'Reenviando…' : 'Reenviar e-mail de confirmação'}
            </button>
          )}
          {reenviado && (
            <p className="text-sm text-on-surface-variant">
              Se o e-mail estiver cadastrado e pendente, um novo link foi enviado.
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-on-surface-variant underline transition-colors hover:text-on-surface"
          >
            Voltar para o login
          </button>
        </div>
      )}

    </AuthShell>
  );
}