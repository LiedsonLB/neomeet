import { useState } from 'react';
import { X, Hash, Volume2, Loader2 } from 'lucide-react';
import { canalApi } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Canal, CanalTipo } from '../api/types';

interface Props {
  session: StoredSession;
  comunidadeId: number;
  tipoInicial?: CanalTipo;
  onClose: () => void;
  onCreated: (c: Canal) => void;
}

export default function CriarCanalModal({ session, comunidadeId, tipoInicial = 'texto', onClose, onCreated }: Props) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CanalTipo>(tipoInicial);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro('Dê um nome para o canal.'); return; }
    setLoading(true);
    setErro(null);
    try {
      const created = await canalApi.create(session, comunidadeId, { nome: nome.trim().toLowerCase().replace(/\s+/g, '-'), tipo });
      onCreated(created);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar o canal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-sm rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Criar canal</h2>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">Tipo de canal</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipo('texto')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${tipo === 'texto' ? 'border-primary-container bg-primary-container/15 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <Hash size={16} /> Texto
              </button>
              <button
                type="button"
                onClick={() => setTipo('voz')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${tipo === 'voz' ? 'border-primary-container bg-primary-container/15 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <Volume2 size={16} /> Voz
              </button>
            </div>
          </div>

          <div>
            <label className="field-label">Nome do canal</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                {tipo === 'texto' ? <Hash size={15} /> : <Volume2 size={15} />}
              </span>
              <input
                className="field-input pl-9"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder={tipo === 'texto' ? 'novo-canal' : 'Sala de estudo'}
                autoFocus
              />
            </div>
          </div>

          {erro && <p className="text-xs text-error">{erro}</p>}

          <button type="submit" className="btn-primary py-3" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin-icon" /> : 'Criar canal'}
          </button>
        </form>
      </div>
    </div>
  );
}
