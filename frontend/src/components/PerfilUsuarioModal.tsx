import { useEffect, useState } from 'react';
import { X, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { usuarioApi, resolveFotoUrl } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Usuario } from '../api/types';
import Avatar from './Avatar';

interface Props {
  session: StoredSession;
  usuarioId: number;
  onClose: () => void;
}

/** Modal "ver perfil" de outra pessoa — mesma estrutura visual do Perfil.tsx
 * do próprio usuário (banner, avatar com moldura, bio), só que somente
 * leitura. Aberto a partir do chat (nome/avatar de uma mensagem) e da
 * barra de participantes de uma chamada de voz. */
export default function PerfilUsuarioModal({ session, usuarioId, onClose }: Props) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuarioId) { setErro('Usuário inválido.'); setLoading(false); return; }
    let ativo = true;
    usuarioApi.find(session, usuarioId)
      .then(u => ativo && setUsuario(u))
      .catch(err => ativo && setErro(err instanceof Error ? err.message : 'Erro ao carregar o perfil.'))
      .finally(() => ativo && setLoading(false));
    return () => { ativo = false; };
  }, [session, usuarioId]);

  const bannerUrl = resolveFotoUrl(usuario?.banner);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel relative w-full max-w-sm overflow-hidden rounded-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-surface/70 p-1.5 text-on-surface backdrop-blur hover:bg-surface-container-high">
          <X size={16} />
        </button>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-16 text-on-surface-variant">
            <Loader2 size={20} className="spin-icon" />
          </div>
        ) : erro || !usuario ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-error">
            <AlertCircle size={20} />
            {erro ?? 'Perfil não encontrado.'}
          </div>
        ) : (
          <>
            <div className="relative h-24 w-full">
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-[#124af0] via-[#6c04de] to-[#00797e] opacity-80" />
              )}
            </div>

            <div className="px-6 pb-6">
              <div className="-mt-10 mb-3">
                <div className="inline-block rounded-full border-4 border-surface-container">
                  <Avatar nome={usuario.nome} foto={usuario.foto} moldura={usuario.moldura} size={76} />
                </div>
              </div>

              <h2 className="text-lg font-bold text-on-surface">{usuario.nome}</h2>
              <p className="text-xs text-on-surface-variant">{usuario.email}</p>

              {usuario.descricao ? (
                <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-surface-container-high px-3 py-2.5 text-sm text-on-surface">
                  {usuario.descricao}
                </p>
              ) : (
                <p className="mt-3 text-xs italic text-on-surface-variant/70">Sem descrição.</p>
              )}

              {usuario.created_at && (
                <div className="mt-4 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                  <Calendar size={12} />
                  Na plataforma desde {new Date(usuario.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
