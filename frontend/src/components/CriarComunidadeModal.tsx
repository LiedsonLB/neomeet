import { useRef, useState } from 'react';
import { X, ImagePlus, Loader2, Globe, Lock } from 'lucide-react';
import { comunidadeApi, uploadApi, CATEGORIAS_COMUNIDADE } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Comunidade, Visibilidade } from '../api/types';

interface Props {
  session: StoredSession;
  onClose: () => void;
  onCreated: (c: Comunidade) => void;
}

export default function CriarComunidadeModal({ session, onClose, onCreated }: Props) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [visibilidade, setVisibilidade] = useState<Visibilidade>('publica');
  const [iconeFile, setIconeFile] = useState<File | null>(null);
  const [iconePreview, setIconePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleIcone(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIconeFile(file);
    setIconePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro('Dê um nome para a comunidade.'); return; }
    setLoading(true);
    setErro(null);
    try {
      let icone_url: string | undefined;
      if (iconeFile) {
        const up = await uploadApi.imagem(session, iconeFile, 'comunidades');
        icone_url = up.url;
      }
      const created = await comunidadeApi.create(session, {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        categoria: categoria || undefined,
        visibilidade,
        icone_url,
      });
      onCreated(created);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar a comunidade.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Criar comunidade</h2>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-outline-variant bg-surface-container-high text-outline transition-colors hover:border-primary hover:text-primary"
            >
              {iconePreview ? (
                <img src={iconePreview} alt="Ícone" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus size={22} />
              )}
            </button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleIcone} />
            <div className="text-xs text-on-surface-variant">
              Ícone da comunidade (opcional). <br /> PNG, JPG ou WEBP até 5MB.
            </div>
          </div>

          <div>
            <label className="field-label">Nome da comunidade</label>
            <input className="field-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Turma de Redação 2026" autoFocus />
          </div>

          <div>
            <label className="field-label">Descrição (opcional)</label>
            <textarea
              className="field-input min-h-[72px] resize-none"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Sobre o que é essa comunidade?"
              maxLength={500}
            />
          </div>

          <div>
            <label className="field-label">Categoria (opcional)</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS_COMUNIDADE.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoria(categoria === cat ? '' : cat)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${categoria === cat ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label">Visibilidade</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibilidade('publica')}
                className={`flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${visibilidade === 'publica' ? 'border-primary-container bg-primary-container/15' : 'border-outline-variant hover:bg-surface-container-high'}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface"><Globe size={14} /> Pública</span>
                <span className="text-[11px] text-on-surface-variant">Qualquer um encontra e entra direto</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibilidade('privada')}
                className={`flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${visibilidade === 'privada' ? 'border-primary-container bg-primary-container/15' : 'border-outline-variant hover:bg-surface-container-high'}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface"><Lock size={14} /> Privada</span>
                <span className="text-[11px] text-on-surface-variant">Só entra quem você aprovar</span>
              </button>
            </div>
          </div>

          {erro && <p className="text-xs text-error">{erro}</p>}

          <button type="submit" className="btn-primary py-3" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin-icon" /> : 'Criar comunidade'}
          </button>
        </form>
      </div>
    </div>
  );
}
