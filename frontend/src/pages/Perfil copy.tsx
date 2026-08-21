import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, ArrowRight, BadgeCheck, LogOut, Pencil, Camera, ImagePlus, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { salaApi, resolveFotoUrl, uploadApi, usuarioApi, ApiError } from '../api/client';
import type { Sala } from '../api/types';
import AppShell from '../layout/AppShell';
import Avatar, { MOLDURAS } from '../components/Avatar';

export default function Perfil() {
  const { session, usuario, signOut, updateUsuario } = useAuth();
  const navigate = useNavigate();

  const [minhasSalas, setMinhasSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- edição de perfil ---------------------------------------------
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [moldura, setMoldura] = useState<string | null>(usuario?.moldura ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    salaApi.list(session)
      .then(list => mounted && setMinhasSalas(list.filter(s => s.criado_por === session.id)))
      .catch(err => mounted && setError(err instanceof ApiError ? err.message : 'Erro ao carregar suas salas.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [session?.id]);

  function iniciarEdicao() {
    setNome(usuario?.nome ?? '');
    setMoldura(usuario?.moldura ?? null);
    setFotoFile(null);
    setFotoPreview(null);
    setBannerFile(null);
    setBannerPreview(null);
    setErroEdicao(null);
    setEditando(true);
  }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function salvar() {
    if (!session || !usuario) return;
    if (!nome.trim()) { setErroEdicao('O nome não pode ficar vazio.'); return; }
    setSalvando(true);
    setErroEdicao(null);
    try {
      let foto: string | undefined;
      if (fotoFile) {
        const up = await uploadApi.foto(session, fotoFile, usuario.foto);
        foto = up.url;
      }
      let banner: string | undefined;
      if (bannerFile) {
        const up = await uploadApi.banner(session, bannerFile, usuario.banner);
        banner = up.url;
      }
      const updated = await usuarioApi.update(session, usuario.id, {
        nome: nome.trim(),
        foto,
        banner,
        moldura: moldura ?? '', // string vazia == "remover moldura" (ver backend nilIfEmpty)
      });
      updateUsuario({ nome: updated.nome, foto: updated.foto, banner: updated.banner, moldura: updated.moldura });
      setEditando(false);
    } catch (err) {
      setErroEdicao(err instanceof Error ? err.message : 'Erro ao salvar o perfil.');
    } finally {
      setSalvando(false);
    }
  }

  if (!usuario) return null;

  const bannerUrlAtual = resolveFotoUrl(usuario.banner);
  const initials = usuario.nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  return (
    <AppShell>
      <div className="glass-panel relative overflow-hidden rounded-3xl">
        {/* Banner */}
        <div className="relative h-40 w-full md:h-56">
          {bannerPreview || bannerUrlAtual ? (
            <img src={bannerPreview ?? bannerUrlAtual ?? undefined} alt="" className="h-full w-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-[#124af0] via-[#6c04de] to-[#00797e] opacity-80" />
              <div
                className="absolute inset-0 opacity-30 mix-blend-overlay"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 50%)' }}
              />
            </>
          )}
          {editando && (
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-surface/80 px-3 py-1.5 text-xs font-semibold text-on-surface backdrop-blur hover:bg-surface-container-high"
            >
              <ImagePlus size={14} /> Trocar banner
            </button>
          )}
          <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleBanner} />
        </div>

        <div className="relative -mt-16 px-6 pb-8 md:-mt-20 md:px-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            {/* Avatar */}
            <div className="relative inline-block">
              <div className="relative z-10 rounded-full border-4 border-surface-container">
                {fotoPreview ? (
                  <img src={fotoPreview} alt={usuario.nome} className="h-32 w-32 rounded-full object-cover md:h-40 md:w-40" />
                ) : (
                  <Avatar nome={usuario.nome} foto={usuario.foto} moldura={editando ? moldura : usuario.moldura} size={136} />
                )}
              </div>
              {editando && (
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="absolute bottom-1 right-1 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-container bg-primary text-on-primary shadow hover:opacity-90"
                >
                  <Camera size={15} />
                </button>
              )}
              <input ref={fotoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFoto} />
              {!editando && (
                <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 rounded-full border border-surface-bright bg-surface-container px-2 py-1 shadow-lg backdrop-blur-sm md:bottom-4 md:right-4">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-tertiary shadow-[0_0_8px_#00dce5]" />
                  <span className="text-label-sm text-on-surface">Online</span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-3 pb-2">
              {editando ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditando(false)}
                    className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 text-label-md text-on-surface transition-all hover:bg-surface-container-highest"
                    disabled={salvando}
                  >
                    <X size={16} /> Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvar}
                    className="btn-primary px-4 py-2"
                    disabled={salvando}
                  >
                    {salvando ? <Loader2 size={16} className="spin-icon" /> : <><Check size={16} /> Salvar</>}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={iniciarEdicao}
                    className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 text-label-md text-on-surface transition-all hover:bg-surface-container-highest"
                  >
                    <Pencil size={16} /> Editar perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => { signOut(); navigate('/login'); }}
                    className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 text-label-md text-on-surface transition-all hover:bg-surface-container-highest"
                  >
                    <LogOut size={18} /> Sair
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Detalhes / formulário de edição */}
          <div className="mt-6 md:mt-8">
            {editando ? (
              <div className="max-w-md">
                <label className="field-label">Nome</label>
                <input className="field-input" value={nome} onChange={e => setNome(e.target.value)} maxLength={120} />

                <label className="field-label mt-4">Moldura do avatar</label>
                <div className="flex flex-wrap gap-3">
                  {MOLDURAS.map(m => (
                    <button
                      key={m.id || 'nenhuma'}
                      type="button"
                      onClick={() => setMoldura(m.id || null)}
                      title={m.nome}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all ${(moldura ?? '') === m.id ? 'border-primary scale-110' : 'border-transparent opacity-80 hover:opacity-100'}`}
                      style={{ background: m.gradient ?? 'transparent' }}
                    >
                      {!m.gradient && (
                        <span className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-outline-variant text-[10px] text-outline">
                          {initials || '—'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {erroEdicao && <p className="mt-3 text-xs text-error">{erroEdicao}</p>}
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-3">
                  <h1 className="text-headline-lg text-on-surface">{usuario.nome}</h1>
                  {usuario.perfil === 1 && (
                    <BadgeCheck size={22} className="text-tertiary" aria-label="Administrador" />
                  )}
                </div>
                <p className="mb-4 text-label-md text-primary">{usuario.email}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-surface-container-highest px-3 py-1.5">
                    <Video size={16} className="text-secondary" />
                    <span className="text-label-sm text-on-surface">{minhasSalas.length} sala(s) criada(s)</span>
                  </div>
                  {usuario.perfil === 1 && (
                    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-surface-container-highest px-3 py-1.5">
                      <BadgeCheck size={16} className="text-tertiary" />
                      <span className="text-label-sm text-on-surface">Administrador</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Minhas salas */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <Users size={20} className="text-primary" /> Minhas salas
          </h2>
          <span className="text-label-md text-on-surface-variant">{minhasSalas.length} criada(s)</span>
        </div>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : minhasSalas.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center">
            <p className="text-sm text-on-surface-variant">Você ainda não criou nenhuma sala.</p>
            <button type="button" onClick={() => navigate('/salas?nova=1')} className="btn-primary mt-2 px-5 py-2 text-sm">
              Criar sala
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {minhasSalas.map(sala => (
              <div
                key={sala.id}
                onClick={() => navigate(`/salas/${sala.id}`)}
                className="glass-panel group flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-surface-container-high"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest text-lg font-bold text-primary">
                  {sala.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-grow">
                  <h3 className="text-label-md text-on-surface transition-colors group-hover:text-primary">{sala.nome}</h3>
                  <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                    <span className="inline-block h-2 w-2 rounded-full bg-tertiary" />
                    {sala.participantes_online ?? 0} online
                  </p>
                </div>
                <ArrowRight size={18} className="text-outline transition-colors group-hover:text-on-surface" />
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
