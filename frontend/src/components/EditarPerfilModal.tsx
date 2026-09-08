// components/EditarPerfilModal.tsx
import { useState, useRef } from 'react';
import { X, Camera, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { usuarioApi, uploadApi, resolveFotoUrl } from '../api/client';
import type { LoginResponse, Usuario } from '../api/types';
import { MOLDURAS } from './Avatar';

interface EditarPerfilModalProps {
  usuario: LoginResponse;
  onClose: () => void;
  onUpdated: (usuario: Usuario) => void;
}

export default function EditarPerfilModal({ usuario, onClose, onUpdated }: EditarPerfilModalProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: usuario.nome || '',
    email: usuario.email || '',
    moldura: usuario.moldura || '',
    descricao: usuario.descricao || '',
  });

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(resolveFotoUrl(usuario.foto) || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(resolveFotoUrl(usuario.banner) || null);

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'foto' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'foto') {
        setFotoFile(file);
        setFotoPreview(reader.result as string);
      } else {
        setBannerFile(file);
        setBannerPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      let fotoUrl = usuario.foto;
      let bannerUrl = usuario.banner;

      if (fotoFile) {
        const result = await uploadApi.foto(session, fotoFile, fotoUrl);
        fotoUrl = result.url;
      }
      if (bannerFile) {
        const result = await uploadApi.banner(session, bannerFile, bannerUrl);
        bannerUrl = result.url;
      }

      const updated = await usuarioApi.update(session, usuario.id, {
        nome: formData.nome,
        email: formData.email,
        foto: fotoUrl,
        banner: bannerUrl,
        moldura: formData.moldura,
        descricao: formData.descricao,
      });

      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FIX: Removida variável não utilizada 'molduraSelecionada'
  // ============================================================

  // ============================================================
  // FIX: Função para obter o estilo da moldura com tipo correto
  // ============================================================
  const getMolduraStyle = (molduraId: string) => {
    const found = MOLDURAS.find(m => m.id === molduraId);
    // Retorna undefined em vez de null para evitar erro de tipo
    return found?.gradient || undefined;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-high shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-high/95 px-6 py-4 backdrop-blur">
          <h2 className="text-xl font-bold text-on-surface">Editar Perfil</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {/* Banner */}
          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">Banner</label>
            <div
              className="group relative h-32 w-full cursor-pointer overflow-hidden rounded-xl bg-surface-container-highest"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-container/20 to-secondary-container/20">
                  <Camera size={32} className="text-outline" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Upload size={24} className="text-white" />
              </div>
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'banner')} />
            </div>
          </div>

          {/* ============================================================
              FIX: Avatar com moldura CORRETA
              ============================================================ */}
          <div className="flex items-start gap-6">
            <div className="shrink-0">
              <label className="mb-2 block text-sm font-medium text-on-surface-variant">Avatar</label>
              
              {/* Container do avatar com moldura */}
              <div
                className="group relative cursor-pointer"
                onClick={() => fotoInputRef.current?.click()}
              >
                {/* 
                  FIX: A moldura é aplicada como padding no container
                  A imagem fica dentro com a moldura visível ao redor
                */}
                <div 
                  className="relative rounded-full"
                  style={{
                    width: '96px',
                    height: '96px',
                    // FIX: Usar undefined em vez de null e espalhar condicionalmente
                    ...(getMolduraStyle(formData.moldura) ? {
                      padding: '4px',
                      background: getMolduraStyle(formData.moldura),
                    } : {
                      // Sem moldura - apenas background normal
                    })
                  }}
                >
                  {/* Conteúdo do avatar (imagem ou iniciais) */}
                  <div className="relative h-full w-full overflow-hidden rounded-full bg-surface-container-highest">
                    {fotoPreview ? (
                      <img 
                        src={fotoPreview} 
                        alt="Foto" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-on-surface">
                        {usuario.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Overlay de hover para upload */}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera size={20} className="text-white" />
                </div>
                <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'foto')} />
              </div>
            </div>

            {/* Seleção de moldura */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-on-surface-variant">Moldura</label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {MOLDURAS.map((moldura) => (
                  <button
                    key={moldura.id || 'nenhuma'}
                    type="button"
                    onClick={() => setFormData({ ...formData, moldura: moldura.id })}
                    className={`rounded-lg border-2 p-2 transition-all ${
                      formData.moldura === moldura.id 
                        ? 'border-primary bg-primary-container/20' 
                        : 'border-outline-variant hover:border-outline'
                    }`}
                  >
                    <div
                      className="mx-auto h-8 w-8 rounded-full border-2 border-outline-variant"
                      style={
                        moldura.gradient 
                          ? { 
                              background: moldura.gradient, 
                              borderStyle: 'solid', 
                              borderColor: 'transparent' 
                            } 
                          : undefined
                      }
                    />
                    <span className="mt-1 block truncate text-[10px] text-on-surface-variant">{moldura.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label htmlFor="nome" className="mb-2 block text-sm font-medium text-on-surface-variant">Nome</label>
            <input
              id="nome"
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-on-surface placeholder-outline-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-on-surface-variant">Email</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-on-surface placeholder-outline-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="descricao" className="mb-2 block text-sm font-medium text-on-surface-variant">
              Descrição (aparece no seu perfil pra outras pessoas)
            </label>
            <textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              maxLength={300}
              rows={3}
              placeholder="Conte um pouco sobre você…"
              className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface placeholder-outline-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-right text-[10px] text-outline">{formData.descricao.length}/300</p>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            >
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}