import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, Loader2, Trash2, AlertTriangle, Globe, Lock, Check, UserPlus } from 'lucide-react';
import { comunidadeApi, uploadApi, resolveFotoUrl } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Comunidade, ComunidadeMembro, Visibilidade } from '../api/types';
import Avatar from './Avatar';

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
  const [visibilidade, setVisibilidade] = useState<Visibilidade>(comunidade.visibilidade ?? 'publica');
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

  // ---- solicitações pendentes (só comunidades privadas) ----------------
  const [pendentes, setPendentes] = useState<ComunidadeMembro[]>([]);
  const [carregandoPendentes, setCarregandoPendentes] = useState(false);
  const [processando, setProcessando] = useState<number | null>(null);

  useEffect(() => {
    if (comunidade.visibilidade !== 'privada') return;
    setCarregandoPendentes(true);
    comunidadeApi.pendentes(session, comunidade.id)
      .then(setPendentes)
      .catch(() => setPendentes([]))
      .finally(() => setCarregandoPendentes(false));
  }, [session, comunidade.id, comunidade.visibilidade]);

  async function aprovar(usuarioId: number) {
    setProcessando(usuarioId);
    try {
      await comunidadeApi.aprovar(session, comunidade.id, usuarioId);
      setPendentes(prev => prev.filter(p => p.usuario_id !== usuarioId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aprovar.');
    } finally {
      setProcessando(null);
    }
  }

  async function rejeitar(usuarioId: number) {
    setProcessando(usuarioId);
    try {
      await comunidadeApi.rejeitar(session, comunidade.id, usuarioId);
      setPendentes(prev => prev.filter(p => p.usuario_id !== usuarioId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao recusar.');
    } finally {
      setProcessando(null);
    }
  }

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
        visibilidade,
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
      <div className="glass-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-6" onClick={e => e.stopPropagation()}>
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

          <div>
            <label className="field-label">Visibilidade</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibilidade('publica')}
                className={`flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${visibilidade === 'publica' ? 'border-primary-container bg-primary-container/15' : 'border-outline-variant hover:bg-surface-container-high'}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface"><Globe size={14} /> Pública</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibilidade('privada')}
                className={`flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${visibilidade === 'privada' ? 'border-primary-container bg-primary-container/15' : 'border-outline-variant hover:bg-surface-container-high'}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface"><Lock size={14} /> Privada</span>
              </button>
            </div>
          </div>

          {erro && <p className="text-xs text-error">{erro}</p>}

          <button type="submit" className="btn-primary py-3" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin-icon" /> : 'Salvar alterações'}
          </button>
        </form>

        {/* Solicitações pendentes — só comunidades privadas */}
        {comunidade.visibilidade === 'privada' && (
          <div className="mt-5 border-t border-outline-variant/50 pt-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              <UserPlus size={13} /> Solicitações de entrada
            </h3>
            {carregandoPendentes ? (
              <div className="flex justify-center py-3"><Loader2 size={16} className="spin-icon text-outline" /></div>
            ) : pendentes.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Nenhuma solicitação no momento.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pendentes.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-surface-container-high px-2.5 py-2">
                    <Avatar nome={p.usuario_nome ?? '?'} foto={p.usuario_foto} size={28} />
                    <span className="flex-1 truncate text-xs font-medium text-on-surface">{p.usuario_nome}</span>
                    <button
                      onClick={() => aprovar(p.usuario_id)}
                      disabled={processando === p.usuario_id}
                      title="Aprovar"
                      className="rounded-md bg-tertiary/15 p-1.5 text-tertiary hover:bg-tertiary/25"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => rejeitar(p.usuario_id)}
                      disabled={processando === p.usuario_id}
                      title="Recusar"
                      className="rounded-md bg-error/15 p-1.5 text-error hover:bg-error/25"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
