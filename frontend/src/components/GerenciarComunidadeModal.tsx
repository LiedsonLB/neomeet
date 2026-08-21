import { useRef, useState } from 'react';
import { X, ImagePlus, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { comunidadeApi, uploadApi, resolveFotoUrl } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Comunidade } from '../api/types';

interface Props {
  session: StoredSession;
  comunidade: Comunidade;
  onClose: () => void;
  onUpdated: (c: Comunidade) => void;
  onDeleted: () => void;
}

export default function GerenciarComunidadeModal({ session, comunidade, onClose, onUpdated, onDeleted }: Props) {
  const [nome, setNome] = useState(comunidade.nome);
  const [descricao, setDescricao] = useState(comunidade.descricao ?? '');
  const [iconePreview, setIconePreview] = useState<string | null>(resolveFotoUrl(comunidade.icone_url));
  const [bannerPreview, setBannerPreview] = useState<string | null>(resolveFotoUrl(comunidade.banner_url));
  const [iconeFile, setIconeFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const iconeRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  function handleIcone(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIconeFile(file);
    setIconePreview(URL.createObjectURL(file));
  }

  function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro('O nome não pode ficar vazio.'); return; }
    setLoading(true);
    setErro(null);
    try {
      let icone_url = comunidade.icone_url ?? undefined;
      if (iconeFile) {
        const up = await uploadApi.imagem(session, iconeFile, 'comunidades', comunidade.icone_url);
        icone_url = up.url;
      }
      let banner_url = comunidade.banner_url ?? undefined;
      if (bannerFile) {
        const up = await uploadApi.imagem(session, bannerFile, 'comunidades', comunidade.banner_url);
        banner_url = up.url;
      }
      const updated = await comunidadeApi.update(session, comunidade.id, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        icone_url,
        banner_url,
      });
      onUpdated(updated);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar as alterações.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir() {
    setExcluindo(true);
    setErro(null);
    try {
      await comunidadeApi.delete(session, comunidade.id);
      onDeleted();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir a comunidade.');
      setExcluindo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Editar comunidade</h2>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">Banner</label>
            <button
              type="button"
              onClick={() => bannerRef.current?.click()}
              className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-outline-variant bg-surface-container-high text-outline transition-colors hover:border-primary hover:text-primary"
            >
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <span className="flex items-center gap-2 text-xs"><ImagePlus size={18} /> Adicionar banner</span>
              )}
            </button>
            <input ref={bannerRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleBanner} />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => iconeRef.current?.click()}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-outline-variant bg-surface-container-high text-outline transition-colors hover:border-primary hover:text-primary"
            >
              {iconePreview ? (
                <img src={iconePreview} alt="Ícone" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus size={22} />
              )}
            </button>
            <input ref={iconeRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleIcone} />
            <div className="text-xs text-on-surface-variant">Ícone da comunidade</div>
          </div>

          <div>
            <label className="field-label">Nome</label>
            <input className="field-input" value={nome} onChange={e => setNome(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Descrição</label>
            <textarea
              className="field-input min-h-[72px] resize-none"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              maxLength={500}
            />
          </div>

          {erro && <p className="text-xs text-error">{erro}</p>}

          <button type="submit" className="btn-primary py-3" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin-icon" /> : 'Salvar alterações'}
          </button>
        </form>

        <div className="mt-5 border-t border-outline-variant/50 pt-5">
          {!confirmarExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmarExclusao(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-error/40 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-container/10"
            >
              <Trash2 size={15} /> Excluir comunidade
            </button>
          ) : (
            <div className="rounded-lg bg-error-container/10 p-4">
              <p className="flex items-start gap-2 text-xs text-error">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                Isso apaga a comunidade, seus canais e mensagens permanentemente. Não pode ser desfeito.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(false)}
                  className="flex-1 rounded-lg border border-outline-variant py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExcluir}
                  disabled={excluindo}
                  className="flex-1 rounded-lg bg-error py-2 text-xs font-bold text-on-error hover:bg-error-container disabled:opacity-60"
                >
                  {excluindo ? 'Excluindo…' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
