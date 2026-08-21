// components/EditarPerfilModal.tsx
import { useState, useRef } from 'react';
import { X, Camera, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { usuarioApi, uploadApi, resolveFotoUrl } from '../api/client';
import type { Usuario } from '../api/types';

interface EditarPerfilModalProps {
  usuario: Usuario;
  onClose: () => void;
  onUpdated: (usuario: Usuario) => void;
}

// Presets de molduras
const MOLDURAS = [
  { id: 'default', nome: 'Padrão', cor: 'border-secondary' },
  { id: 'gold', nome: 'Ouro', cor: 'border-yellow-500' },
  { id: 'silver', nome: 'Prata', cor: 'border-gray-400' },
  { id: 'diamond', nome: 'Diamante', cor: 'border-cyan-400' },
  { id: 'ruby', nome: 'Rubi', cor: 'border-red-500' },
  { id: 'emerald', nome: 'Esmeralda', cor: 'border-emerald-500' },
  { id: 'sapphire', nome: 'Safira', cor: 'border-blue-500' },
  { id: 'rainbow', nome: 'Arco-Íris', cor: 'border-4 border-transparent bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500' },
];

export default function EditarPerfilModal({ usuario, onClose, onUpdated }: EditarPerfilModalProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: usuario.nome || '',
    email: usuario.email || '',
    moldura: usuario.moldura || 'default',
  });

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(resolveFotoUrl(usuario.foto) || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(resolveFotoUrl(usuario.banner) || null);

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'foto' | 'banner'
  ) => {
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

      // Upload da foto se houver alteração
      if (fotoFile) {
        const result = await uploadApi.foto(session, fotoFile, fotoUrl);
        fotoUrl = result.url;
      }

      // Upload do banner se houver alteração
      if (bannerFile) {
        const result = await uploadApi.banner(session, bannerFile, bannerUrl);
        bannerUrl = result.url;
      }

      // Atualiza o usuário via API
      const updated = await usuarioApi.update(session, usuario.id, {
        nome: formData.nome,
        email: formData.email,
        foto: fotoUrl,
        banner: bannerUrl,
        moldura: formData.moldura,
      });

      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-container-high shadow-2xl border border-outline-variant/20">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-high/95 backdrop-blur px-6 py-4">
          <h2 className="text-xl font-bold text-on-surface">Editar Perfil</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {/* Banner */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Banner</label>
            <div 
              className="relative h-32 w-full rounded-xl overflow-hidden bg-surface-container-highest cursor-pointer group"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-container/20 to-secondary-container/20">
                  <Camera size={32} className="text-outline" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload size={24} className="text-white" />
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'banner')}
              />
            </div>
          </div>

          {/* Foto e Moldura */}
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Avatar</label>
              <div 
                className="relative h-24 w-24 rounded-full overflow-hidden cursor-pointer group"
                onClick={() => fotoInputRef.current?.click()}
              >
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Foto" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-container-highest text-2xl font-bold text-on-surface">
                    {usuario.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className={`absolute inset-0 rounded-full border-4 ${
                  MOLDURAS.find(m => m.id === formData.moldura)?.cor || 'border-secondary'
                }`} />
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'foto')}
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Moldura</label>
              <div className="grid grid-cols-4 gap-2">
                {MOLDURAS.map((moldura) => (
                  <button
                    key={moldura.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, moldura: moldura.id })}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      formData.moldura === moldura.id
                        ? 'border-primary bg-primary-container/20'
                        : 'border-outline-variant hover:border-outline'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full border-4 mx-auto ${
                      moldura.cor.startsWith('border-gradient') ? 'border-2 border-transparent bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500' : moldura.cor
                    }`} />
                    <span className="text-[10px] text-on-surface-variant mt-1 block truncate">{moldura.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-on-surface-variant mb-2">
              Nome
            </label>
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
            <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-on-surface placeholder-outline-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-highest transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}