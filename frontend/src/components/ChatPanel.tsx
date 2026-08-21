import { useEffect, useRef, useState } from 'react';
import { Hash, Send, Loader2 } from 'lucide-react';
import { mensagemApi } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Canal, CanalMensagem } from '../api/types';
import Avatar from './Avatar';
import { sounds } from '../utils/sounds';

const POLL_MS = 3000;

function formatarHora(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface ChatPanelProps {
  session: StoredSession;
  canal: Canal;
  meuUsuarioId: number;
}

/**
 * Chat de um canal de texto. Não usa WebSocket/SSE de propósito — faz
 * polling incremental (`GET /canais/{id}/mensagens?after=<último id>`) a
 * cada poucos segundos, o que já dá uma experiência de "quase tempo real"
 * sem precisar abrir uma conexão persistente por canal. Se um dia o app
 * crescer bastante, dá pra trocar só o `useEffect` de polling abaixo por
 * um EventSource, sem mexer no resto do componente.
 */
export default function ChatPanel({ session, canal, meuUsuarioId }: ChatPanelProps) {
  const [mensagens, setMensagens] = useState<CanalMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ultimoIdRef = useRef(0);

  // Carrega o histórico inicial sempre que o canal muda.
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setMensagens([]);
    ultimoIdRef.current = 0;
    mensagemApi.list(session, canal.id, { limit: 50 })
      .then(lista => {
        if (!ativo) return;
        setMensagens(lista);
        ultimoIdRef.current = lista.length ? lista[lista.length - 1].id : 0;
      })
      .catch(err => ativo && setErro(err instanceof Error ? err.message : 'Erro ao carregar mensagens.'))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [session, canal.id]);

  // Polling incremental.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const novas = await mensagemApi.list(session, canal.id, { after: ultimoIdRef.current });
        if (novas.length === 0) return;
        ultimoIdRef.current = novas[novas.length - 1].id;
        setMensagens(prev => [...prev, ...novas]);
        if (novas.some(m => m.usuario_id !== meuUsuarioId)) {
          sounds.mensagem();
        }
      } catch {
        // silencioso — próximo tick tenta de novo
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [session, canal.id, meuUsuarioId]);

  // Auto-scroll pro fim quando chegam mensagens novas.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    setTexto('');
    try {
      const criada = await mensagemApi.send(session, canal.id, conteudo);
      ultimoIdRef.current = criada.id;
      setMensagens(prev => [...prev, criada]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar a mensagem.');
      setTexto(conteudo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-outline-variant/60 px-6 py-4">
        <Hash size={16} className="text-outline" />
        <span className="text-sm font-bold text-on-surface">{canal.nome}</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {carregando ? (
          <p className="text-sm text-on-surface-variant">Carregando mensagens…</p>
        ) : mensagens.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhuma mensagem ainda. Seja o primeiro a escrever!</p>
        ) : (
          mensagens.map(m => (
            <div key={m.id} className="flex gap-3">
              <Avatar nome={m.usuario_nome} foto={m.usuario_foto} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-on-surface">{m.usuario_nome}</span>
                  <span className="text-[11px] text-outline">{formatarHora(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-on-surface-variant">{m.conteudo}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {erro && <p className="px-6 pb-1 text-xs text-error">{erro}</p>}

      <form onSubmit={enviar} className="flex items-center gap-2 border-t border-outline-variant/60 p-4">
        <input
          className="field-input flex-1"
          placeholder={`Conversar em #${canal.nome}`}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          maxLength={4000}
        />
        <button type="submit" className="btn-primary px-4 py-2.5" disabled={enviando || !texto.trim()}>
          {enviando ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
