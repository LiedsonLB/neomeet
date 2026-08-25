import { useEffect, useRef, useState, useCallback } from 'react';
import { Hash, Send, Loader2, Smile, AtSign, Pin, Bell, BellOff, Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import { mensagemApi } from '../api/client';
import type { StoredSession } from '../api/client';
import type { Canal, CanalMensagem } from '../api/types';
import Avatar from './Avatar';
import AdmBadge, { isAdm } from './AdmBadge';
import { sounds } from '../utils/sounds';

const POLL_MS = 3000;
const REACOES_RAPIDAS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💯'];

function formatarHora(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarData(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Textarea que cresce sozinha conforme o texto, até uma altura máxima —
// resolve "campo de texto de uma linha só" sem precisar de nenhuma lib.
function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { innerRef?: React.Ref<HTMLTextAreaElement> }) {
  const { innerRef, ...rest } = props;
  const localRef = useRef<HTMLTextAreaElement>(null);

  function setRefs(el: HTMLTextAreaElement | null) {
    (localRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    if (typeof innerRef === 'function') innerRef(el);
    else if (innerRef && 'current' in innerRef) (innerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  }

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [props.value]);

  return <textarea ref={setRefs} rows={1} {...rest} />;
}

type ReacaoLocal = { [msgId: number]: { [emoji: string]: number } };

interface ChatPanelProps {
  session: StoredSession;
  canal: Canal;
  meuUsuarioId: number;
  meuEmail?: string | null;
  souDonoComunidade?: boolean;
  onVerPerfil?: (usuarioId: number) => void;
}

export default function ChatPanel({ session, canal, meuUsuarioId, meuEmail, souDonoComunidade, onVerPerfil }: ChatPanelProps) {
  const [mensagens, setMensagens] = useState<CanalMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [reacoes, setReacoes] = useState<ReacaoLocal>({});
  const [minhasReacoes, setMinhasReacoes] = useState<{ [msgId: number]: Set<string> }>({});
  const [notificacoes, setNotificacoes] = useState(true);
  const [pickerMsgId, setPickerMsgId] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ultimoIdRef = useRef(0);

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

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const novas = await mensagemApi.list(session, canal.id, { after: ultimoIdRef.current });
        if (novas.length === 0) return;
        ultimoIdRef.current = novas[novas.length - 1].id;
        setMensagens(prev => [...prev, ...novas]);
        if (notificacoes && novas.some(m => m.usuario_id !== meuUsuarioId)) {
          sounds.mensagem();
        }
      } catch { /* silencioso */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [session, canal.id, meuUsuarioId, notificacoes]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens.length]);

  useEffect(() => {
    if (!pickerMsgId) return;
    const handler = () => setPickerMsgId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [pickerMsgId]);

  const reagir = useCallback((msgId: number, emoji: string) => {
    setReacoes(prev => {
      const msgReacoes = { ...(prev[msgId] ?? {}) };
      const jaReagi = minhasReacoes[msgId]?.has(emoji);
      msgReacoes[emoji] = Math.max(0, (msgReacoes[emoji] ?? 0) + (jaReagi ? -1 : 1));
      if (msgReacoes[emoji] === 0) delete msgReacoes[emoji];
      return { ...prev, [msgId]: msgReacoes };
    });
    setMinhasReacoes(prev => {
      const s = new Set(prev[msgId] ?? []);
      if (s.has(emoji)) s.delete(emoji); else s.add(emoji);
      return { ...prev, [msgId]: s };
    });
    setPickerMsgId(null);
  }, [minhasReacoes]);

  const mencionarUsuario = useCallback((nome: string) => {
    setTexto(prev => `${prev}@${nome.split(' ')[0]} `);
    inputRef.current?.focus();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const nova = await mensagemApi.send(session, canal.id, t);
      setMensagens(prev => [...prev, nova]);
      ultimoIdRef.current = nova.id;
      setTexto('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar.');
    } finally {
      setEnviando(false);
    }
  }

  function iniciarEdicao(m: CanalMensagem) {
    setEditandoId(m.id);
    setTextoEdicao(m.conteudo);
    setPickerMsgId(null);
  }

  async function salvarEdicao(msgId: number) {
    const t = textoEdicao.trim();
    if (!t) return;
    setSalvandoEdicao(true);
    try {
      const atualizada = await mensagemApi.edit(session, msgId, t);
      setMensagens(prev => prev.map(m => (m.id === msgId ? atualizada : m)));
      setEditandoId(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao editar a mensagem.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function apagarMensagem(msgId: number) {
    if (!confirm('Apagar esta mensagem?')) return;
    try {
      await mensagemApi.delete(session, msgId);
      setMensagens(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao apagar a mensagem.');
    }
  }

  const grupos: { data: string; msgs: CanalMensagem[] }[] = [];
  mensagens.forEach(m => {
    const d = formatarData(m.created_at);
    if (!grupos.length || grupos[grupos.length - 1].data !== d) {
      grupos.push({ data: d, msgs: [m] });
    } else {
      grupos[grupos.length - 1].msgs.push(m);
    }
  });

  const canalNome = canal.icone ? `${canal.icone} ${canal.nome}` : `#${canal.nome}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/60 bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-2">
          <Hash size={18} className="text-outline" />
          <span className="font-semibold text-on-surface">{canal.nome}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotificacoes(v => !v)}
            title={notificacoes ? 'Silenciar canal' : 'Ativar notificações'}
            className={`rounded-lg p-1.5 transition-colors ${notificacoes ? 'text-on-surface-variant hover:bg-surface-container-high' : 'text-error hover:bg-error/10'}`}
          >
            {notificacoes ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
          <button
            onClick={() => { setTexto(prev => prev + '@'); inputRef.current?.focus(); }}
            title="Mencionar alguém"
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <AtSign size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {carregando && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="spin-icon text-outline" />
          </div>
        )}
        {!carregando && mensagens.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-on-surface-variant">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high text-2xl">
              {canal.icone ?? '💬'}
            </div>
            <p className="font-semibold text-on-surface">Bem-vindo a #{canal.nome}!</p>
            <p className="text-sm">Este é o começo deste canal. Manda a primeira mensagem!</p>
          </div>
        )}

        {grupos.map(grupo => (
          <div key={grupo.data}>
            <div className="relative my-4 flex items-center gap-3">
              <div className="flex-1 border-t border-outline-variant/40" />
              <span className="rounded-full border border-outline-variant/40 bg-surface-container px-3 py-0.5 text-[11px] font-medium text-outline">
                {grupo.data}
              </span>
              <div className="flex-1 border-t border-outline-variant/40" />
            </div>

            {grupo.msgs.map((m, i) => {
              const prevMsg = i > 0 ? grupo.msgs[i - 1] : null;
              const mesmoAutor = prevMsg?.usuario_id === m.usuario_id;
              const msgReacoes = reacoes[m.id] ?? {};
              const temReacoes = Object.keys(msgReacoes).length > 0;
              const isHovered = hoveredMsg === m.id;
              const sou = m.usuario_id === meuUsuarioId;
              const possoGerenciar = sou || souDonoComunidade;
              const editandoEsta = editandoId === m.id;

              return (
                <div
                  key={m.id}
                  className={`group relative flex gap-3 rounded-lg px-2 py-0.5 transition-colors hover:bg-surface-container-high/40 ${mesmoAutor ? 'mt-0.5' : 'mt-3'}`}
                  onMouseEnter={() => setHoveredMsg(m.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  <div className="w-8 shrink-0">
                    {!mesmoAutor && (
                      <button
                        className="mt-0.5"
                        title={`Ver perfil de ${m.usuario_nome}`}
                        onClick={() => onVerPerfil?.(m.usuario_id)}
                      >
                        <Avatar nome={m.usuario_nome} foto={m.usuario_foto} size={32} />
                      </button>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {!mesmoAutor && (
                      <div className="mb-0.5 flex items-center gap-2">
                        <button
                          className="text-sm font-semibold text-on-surface hover:underline"
                          onClick={() => onVerPerfil?.(m.usuario_id)}
                        >
                          {m.usuario_nome}
                        </button>
                        <AdmBadge email={sou && isAdm(meuEmail) ? meuEmail : null} />
                        <span className="text-[11px] text-outline">{formatarHora(m.created_at)}</span>
                        {m.editado_em && <span className="text-[10px] italic text-outline">(editado)</span>}
                      </div>
                    )}

                    {editandoEsta ? (
                      <div className="flex flex-col gap-1.5">
                        <AutoGrowTextarea
                          className="w-full rounded-lg border border-primary/40 bg-surface-container px-2.5 py-1.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/30"
                          value={textoEdicao}
                          onChange={e => setTextoEdicao(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvarEdicao(m.id); }
                            if (e.key === 'Escape') setEditandoId(null);
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2 text-[11px]">
                          <button onClick={() => salvarEdicao(m.id)} disabled={salvandoEdicao} className="flex items-center gap-1 font-semibold text-primary hover:underline">
                            <Check size={12} /> salvar
                          </button>
                          <button onClick={() => setEditandoId(null)} className="flex items-center gap-1 text-outline hover:underline">
                            <XIcon size={12} /> cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-on-surface">
                        {m.conteudo.split(/(@\w+)/g).map((parte, idx) =>
                          parte.startsWith('@') ? (
                            <span key={idx} className="rounded bg-primary-container/30 px-0.5 font-medium text-primary">
                              {parte}
                            </span>
                          ) : parte
                        )}
                        {mesmoAutor && m.editado_em && <span className="ml-1 text-[10px] italic text-outline">(editado)</span>}
                      </p>
                    )}

                    {temReacoes && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(msgReacoes).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => reagir(m.id, emoji)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${minhasReacoes[m.id]?.has(emoji)
                              ? 'border-primary/40 bg-primary-container/30 text-primary'
                              : 'border-outline-variant/40 bg-surface-container hover:border-primary/30 hover:bg-primary-container/10'
                              }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-medium">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {mesmoAutor && isHovered && !editandoEsta && (
                    <span className="absolute left-2 top-1/2 w-8 -translate-y-1/2 text-center text-[10px] text-outline">
                      {formatarHora(m.created_at)}
                    </span>
                  )}

                  {isHovered && !editandoEsta && (
                    <div
                      className="absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-outline-variant/60 bg-surface-container-highest shadow-lg"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="relative">
                        <button
                          className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                          title="Reagir"
                          onClick={e => { e.stopPropagation(); setPickerMsgId(prev => prev === m.id ? null : m.id); }}
                        >
                          <Smile size={15} />
                        </button>
                        {pickerMsgId === m.id && (
                          <div
                            className="absolute right-0 top-8 z-20 flex gap-1 rounded-xl border border-outline-variant/60 bg-surface-container-highest p-2 shadow-xl"
                            onClick={e => e.stopPropagation()}
                          >
                            {REACOES_RAPIDAS.map(emoji => (
                              <button
                                key={emoji}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl transition-colors hover:bg-surface-container-high"
                                onClick={() => reagir(m.id, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                        title="Mencionar"
                        onClick={() => mencionarUsuario(m.usuario_nome)}
                      >
                        <AtSign size={15} />
                      </button>
                      <button
                        className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                        title="Fixar mensagem"
                        onClick={() => { /* TODO: fixar */ }}
                      >
                        <Pin size={15} />
                      </button>
                      {sou && (
                        <button
                          className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                          title="Editar mensagem"
                          onClick={() => iniciarEdicao(m)}
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {possoGerenciar && (
                        <button
                          className="rounded-md p-1.5 text-on-surface-variant hover:bg-error/10 hover:text-error"
                          title="Apagar mensagem"
                          onClick={() => apagarMensagem(m.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {erro && <p className="py-2 text-center text-xs text-error">{erro}</p>}
      </div>

      {/* Input de mensagem — área de texto que cresce, permite quebrar
          linha com Shift+Enter (Enter sozinho envia). */}
      <form onSubmit={enviar} className="shrink-0 border-t border-outline-variant/60 bg-surface-container-low px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
          <button
            type="button"
            title="Emoji"
            className="shrink-0 pb-1 text-outline transition-colors hover:text-on-surface"
            onClick={() => {
              const r = REACOES_RAPIDAS[Math.floor(Math.random() * REACOES_RAPIDAS.length)];
              setTexto(prev => prev + r);
              inputRef.current?.focus();
            }}
          >
            <Smile size={18} />
          </button>
          <AutoGrowTextarea
            innerRef={inputRef}
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-outline"
            placeholder={`Mensagem em ${canalNome}`}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); } }}
            disabled={enviando}
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            className="shrink-0 pb-1 text-outline transition-colors disabled:opacity-40 enabled:hover:text-primary"
          >
            {enviando ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
          </button>
        </div>
        <p className="mt-1 px-1 text-[10px] text-outline">Enter para enviar · Shift+Enter para nova linha</p>
      </form>
    </div>
  );
}
