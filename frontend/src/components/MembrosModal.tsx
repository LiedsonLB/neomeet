// components/MembrosModal.tsx
//
// Aba "Membros" de uma comunidade: todo mundo que já faz parte (dono +
// membros — pendentes não aparecem aqui, ver GerenciarComunidadeModal
// pra aprovar/recusar solicitações), com indicador online/offline
// alimentado pelo heartbeat (ver PresenceHeartbeat.tsx e
// GET /comunidades/{id}/membros no backend).
import { useEffect, useState } from 'react';
import { Loader2, Users, X, Crown } from 'lucide-react';
import { comunidadeApi } from '../api/client';
import type { StoredSession } from '../api/client';
import type { MembroComPresenca } from '../api/types';
import Avatar from './Avatar';

interface Props {
  session: StoredSession;
  comunidadeId: number;
  comunidadeNome: string;
  onClose: () => void;
  onVerPerfil: (usuarioId: number) => void;
}

export default function MembrosModal({ session, comunidadeId, comunidadeNome, onClose, onVerPerfil }: Props) {
  const [membros, setMembros] = useState<MembroComPresenca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    comunidadeApi.membros(session, comunidadeId)
      .then(lista => { if (ativo) setMembros(lista); })
      .catch(err => { if (ativo) setErro(err instanceof Error ? err.message : 'Erro ao carregar os membros.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [session, comunidadeId]);

  const online = membros.filter(m => m.online);
  const offline = membros.filter(m => !m.online);

  function linha(m: MembroComPresenca) {
    return (
      <button
        key={m.usuario_id}
        onClick={() => onVerPerfil(m.usuario_id)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-container-high"
      >
        <Avatar nome={m.nome} foto={m.foto} moldura={m.moldura} size={34} online={m.online} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-sm font-medium text-on-surface">
            {m.nome}
            {m.papel === 'dono' && <Crown size={12} className="shrink-0 text-amber" />}
          </div>
          <div className="text-[11px] text-on-surface-variant">{m.online ? 'Online' : 'Offline'}</div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-primary" />
            <h2 className="text-base font-bold text-on-surface">Membros · {comunidadeNome}</h2>
          </div>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="spin-icon text-outline" /></div>
          ) : erro ? (
            <p className="px-2 py-4 text-sm text-error">{erro}</p>
          ) : (
            <>
              {online.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-outline">
                    Online — {online.length}
                  </p>
                  {online.map(linha)}
                </div>
              )}
              {offline.length > 0 && (
                <div>
                  <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-outline">
                    Offline — {offline.length}
                  </p>
                  {offline.map(linha)}
                </div>
              )}
              {membros.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-on-surface-variant">Nenhum membro ainda.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
