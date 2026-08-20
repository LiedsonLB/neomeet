import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Users, Plus, LogIn, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { salaApi, ApiError } from '../api/client';
import type { Sala } from '../api/types';
import AppShell from '../layout/AppShell';
import { authField } from '../components/AuthShell';

const CATEGORIAS = ['Jogos', 'Tech', 'Educação', 'Outro'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function NovaSalaModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (body: { nome: string; descricao?: string; categoria?: string }) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<string>('Tech');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setError('Dê um nome para a sua sala.'); return; }
    setLoading(true); setError(null);
    try {
      await onCreate({ nome: nome.trim(), descricao: descricao.trim() || undefined, categoria });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sala.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-md rounded-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-stack-md flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface">Nova comunidade</h2>
          <button type="button" onClick={onClose} className="text-outline transition-colors hover:text-on-surface">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-stack-md">
          <div className="space-y-1">
            <label className={authField.label}>Nome da sala</label>
            <input
              className={authField.input.replace('pl-10', 'pl-3.5')}
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Devs Brasil"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className={authField.label}>Descrição (opcional)</label>
            <textarea
              className={`${authField.input.replace('pl-10', 'pl-3.5')} resize-none`}
              rows={3}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Sobre o que é essa comunidade?"
            />
          </div>

          <div className="space-y-1">
            <label className={authField.label}>Categoria</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={
                    categoria === c
                      ? 'rounded-full bg-primary px-4 py-1.5 text-label-sm text-on-primary'
                      : 'rounded-full border border-outline-variant px-4 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high'
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Criando…' : 'Criar sala'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Salas() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalOpen = params.get('nova') === '1';
  const busca = params.get('busca') ?? '';

  async function load() {
    if (!session) return;
    setLoading(true);
    try {
      const list = await salaApi.list(session);
      setSalas(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar salas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const salasFiltradas = useMemo(() => {
    if (!busca.trim()) return salas;
    const q = busca.trim().toLowerCase();
    return salas.filter(s => s.nome.toLowerCase().includes(q) || s.descricao?.toLowerCase().includes(q));
  }, [salas, busca]);

  function openModal() { setParams({ nova: '1' }); }
  function closeModal() { setParams({}); }

  async function handleCreate(body: { nome: string; descricao?: string; categoria?: string }) {
    if (!session) return;
    const created = await salaApi.create(session, { ...body, tipo: 'reuniao' });
    closeModal();
    navigate(`/salas/${created.id}`);
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">Comunidades</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Salas de vídeo por assunto — entre, converse, resenha.</p>
        </div>
        <button type="button" onClick={openModal} className="btn-primary px-5 py-2.5">
          <Plus size={16} /> Nova sala
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : salasFiltradas.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-16 text-center">
          <Video size={28} className="text-outline" />
          <p className="mt-2 text-on-surface-variant">Nenhuma sala encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {salasFiltradas.map(sala => (
            <div key={sala.id} className="glass-card flex flex-col gap-3 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-primary" />
                {sala.categoria && (
                  <span className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">{sala.categoria}</span>
                )}
              </div>
              <h3 className="text-body-lg font-bold text-on-surface">{sala.nome}</h3>
              {sala.descricao && (
                <p className="line-clamp-2 text-label-md text-on-surface-variant">{sala.descricao}</p>
              )}
              <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                <Users size={13} /> {sala.participantes_online ?? 0} online · criada em {fmtDate(sala.created_at)}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/salas/${sala.id}`)}
                className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-surface-container-high py-2.5 text-label-md text-on-surface transition-colors hover:bg-primary-container hover:text-on-primary-container"
              >
                <LogIn size={14} /> Entrar
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <NovaSalaModal onClose={closeModal} onCreate={handleCreate} />}
    </AppShell>
  );
}
