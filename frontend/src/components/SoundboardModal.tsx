import { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Loader2, Music4, Play } from 'lucide-react';
import { comunidadeSomApi, uploadApi } from '../api/client';
import type { StoredSession } from '../api/client';
import type { ComunidadeSom } from '../api/types';

interface Props {
  session: StoredSession;
  comunidadeId: number;
  meuUsuarioId: number;
  souDono: boolean;
  onClose: () => void;
  /** Chamado quando EU toco um som — quem estiver ouvindo (ComunidadeRoom)
   * decide como transmitir pros outros participantes da chamada (via
   * LiveKit data channel) e tocar localmente. */
  onTocar: (som: ComunidadeSom) => void;
}

/** Soundboard estilo Discord: uma grade de sons curtos que qualquer membro
 * pode tocar durante uma chamada de voz (todo mundo na sala ouve), com um
 * formulário simples pra adicionar novos clipes (upload de mp3/wav/ogg). */
export default function SoundboardModal({ session, comunidadeId, meuUsuarioId, souDono, onClose, onTocar }: Props) {
  const [sons, setSons] = useState<ComunidadeSom[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState('');
  const [emoji, setEmoji] = useState('🔊');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    comunidadeSomApi.list(session, comunidadeId)
      .then(setSons)
      .catch(err => setErro(err instanceof Error ? err.message : 'Erro ao carregar os sons.'))
      .finally(() => setLoading(false));
  }, [session, comunidadeId]);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !arquivo) { setErro('Dê um nome e escolha um arquivo de áudio.'); return; }
    setEnviando(true);
    setErro(null);
    try {
      const up = await uploadApi.som(session, arquivo);
      const criado = await comunidadeSomApi.create(session, comunidadeId, {
        nome: nome.trim(), emoji: emoji.trim() || null, arquivo_url: up.url,
      });
      setSons(prev => [...prev, criado]);
      setMostrarForm(false);
      setNome(''); setEmoji('🔊'); setArquivo(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar o som.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(som: ComunidadeSom, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remover o som "${som.nome}"?`)) return;
    try {
      await comunidadeSomApi.delete(session, som.id);
      setSons(prev => prev.filter(s => s.id !== som.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover o som.');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
            <Music4 size={17} className="text-tertiary" /> Efeitos sonoros
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface"><X size={18} /></button>
        </div>

        {erro && <p className="mb-3 text-xs text-error">{erro}</p>}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="spin-icon text-outline" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {sons.map(som => (
              <div key={som.id} className="group relative">
                <button
                  onClick={() => onTocar(som)}
                  className="flex w-full flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-3 text-center transition-colors hover:bg-primary-container/30"
                >
                  <span className="text-xl">{som.emoji || '🔊'}</span>
                  <span className="line-clamp-2 text-[11px] leading-tight text-on-surface">{som.nome}</span>
                  <Play size={11} className="text-outline" />
                </button>
                {(souDono || som.criado_por === meuUsuarioId) && (
                  <button
                    onClick={(e) => handleRemover(som, e)}
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-on-error group-hover:flex"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => setMostrarForm(v => !v)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant px-2 py-3 text-outline transition-colors hover:border-primary hover:text-primary"
            >
              <Plus size={18} />
              <span className="text-[11px]">Adicionar</span>
            </button>
          </div>
        )}

        {mostrarForm && (
          <form onSubmit={handleAdicionar} className="mt-4 flex flex-col gap-3 border-t border-outline-variant/50 pt-4">
            <div className="flex gap-2">
              <input
                className="field-input w-16 text-center text-lg"
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                maxLength={4}
              />
              <input
                className="field-input flex-1"
                placeholder="Nome do som"
                value={nome}
                onChange={e => setNome(e.target.value)}
                maxLength={60}
              />
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary justify-center py-2 text-xs"
            >
              {arquivo ? arquivo.name : 'Escolher arquivo de áudio (mp3, wav, ogg — até 2MB)'}
            </button>
            <input ref={inputRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a" className="hidden" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            <button type="submit" className="btn-primary py-2.5" disabled={enviando}>
              {enviando ? <Loader2 size={15} className="spin-icon" /> : 'Adicionar ao soundboard'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
