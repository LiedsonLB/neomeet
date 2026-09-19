// ============================================================
// client.ts — typed API calls for all backend routes (Go)
// ============================================================
import type {
  LoginResponse, ApiErrorBody, Usuario, Paginated,
  Sala, SalaTokenResponse, Comunidade, ComunidadeMembro, Canal, CanalMensagem, CanalTipo,
  ComunidadeSom, Visibilidade, MembroComPresenca, UsuarioLink, AtividadeAgora, AtividadeTipo,
} from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
export const APP_KEY = import.meta.env.VITE_APP_KEY ?? 'WEBTESTE';
export const ADM_EMAIL = 'liedson.b9@gmail.com';

// ---- error -------------------------------------------------
export class ApiError extends Error {
  code: number;
  constructor(body: ApiErrorBody) { super(body.message); this.code = body.code; }
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body ?? { message: 'Erro de comunicação com o servidor.', code: res.status });
  return body as T;
}

// ---- session -----------------------------------------------
export interface StoredSession {
  id: number; token: string; appKey: string; perfil: number;
}

function tokenUserHeader(s: StoredSession) { return `${s.id}:${s.token}:${s.appKey}`; }

// ---- sessão expirada -----------------------------------------
// authFetch dispara este evento sempre que o backend responder 401/403
// com o token inválido/expirado. O AuthContext escuta e faz o signOut
// automático (redirecionando pro login) em vez de deixar a tela travada
// com chamadas falhando silenciosamente.
export const authEvents = new EventTarget();
const SESSAO_EXPIRADA_EVENT = 'sessao-expirada';

function isSessaoExpiradaError(res: Response, body: ApiErrorBody | null) {
  if (res.status !== 401 && res.status !== 403) return false;
  const msg = body?.message?.toLowerCase() ?? '';
  return msg.includes('token') || msg.includes('acesso negado');
}

export async function authFetch<T>(session: StoredSession, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', TokenUser: tokenUserHeader(session), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (isSessaoExpiradaError(res, body)) {
      authEvents.dispatchEvent(new Event(SESSAO_EXPIRADA_EVENT));
    }
    throw new ApiError(body ?? { message: 'Erro de comunicação com o servidor.', code: res.status });
  }
  return body as T;
}

export function onSessaoExpirada(cb: () => void): () => void {
  authEvents.addEventListener(SESSAO_EXPIRADA_EVENT, cb);
  return () => authEvents.removeEventListener(SESSAO_EXPIRADA_EVENT, cb);
}

// ---- refresh automático de sessão -----------------------------
// O backend já estende a validade do token a cada chamada autenticada
// válida (sliding expiration). Este endpoint existe pra renovar a sessão
// mesmo quando o usuário fica um tempo sem disparar nenhuma outra
// requisição (aba aberta parada, chamada de vídeo sem outras chamadas à
// API, etc.) — ver useSessionRefresh no AuthContext.
export const acessoApi = {
  refreshToken: (s: StoredSession) =>
    authFetch<{ token: string; expira_em_minutos: number; renovado_em: string }>(s, '/acesso/refresh-token', { method: 'POST' }),
};

// ---- public ------------------------------------------------
// manterConectado (default true) pede ao backend um "long token" (30 dias,
// em vez de 120min) — combinado com o refresh automático, é o que evita
// o usuário ser deslogado no meio do uso.
export async function login(email: string, senha: string, manterConectado = true): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/acesso/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify({ email, senha, long_token: manterConectado ? 'sim' : 'nao' }),
  });
  return parseJsonOrThrow<LoginResponse>(res);
}

export async function cadastro(payload: { nome: string; email: string; senha: string }): Promise<Usuario> {
  const res = await fetch(`${API_URL}/cadastro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<Usuario>(res);
}

type QP = Record<string, string | number | boolean | string[] | undefined>;

function buildQuery(p: QP) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach(item => q.append(`${k}[]`, String(item)));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ============================================================
// USUÁRIOS
// ============================================================
// client.ts — parte do usuarioApi
export const usuarioApi = {
  list: (s: StoredSession, p?: { page?: number; per_page?: number; search?: string; aluno_id?: number; perfil?: number }) =>
    authFetch<Paginated<Usuario>>(s, `/usuarios${buildQuery(p ?? {})}`),
  find: (s: StoredSession, id: number) => authFetch<Usuario>(s, `/usuarios/${id}`),
  update: (s: StoredSession, id: number, body: Partial<Usuario> & { senha?: string }) =>
    authFetch<Usuario>(s, `/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (s: StoredSession, id: number) =>
    authFetch<void>(s, `/usuarios/${id}`, { method: 'DELETE' }),
  /** "Sinal de vida" periódico (ver PresenceHeartbeat.tsx) — alimenta o
   * indicador online/offline na aba Membros de uma comunidade. */
  heartbeat: (s: StoredSession) =>
    authFetch<{ message: string }>(s, '/usuarios/heartbeat', { method: 'POST' }),
  /** Seta a presença rica (ver PresencaBadge.tsx) — "Jogando Minecraft",
   * "Na resenha", etc. atividade: '' limpa a atividade atual. */
  setStatus: (s: StoredSession, atividade: string, atividadeTipo: AtividadeTipo) =>
    authFetch<{ message: string }>(s, '/usuarios/status', {
      method: 'POST',
      body: JSON.stringify({ atividade, atividade_tipo: atividadeTipo }),
    }),
};

// ---- perfil rico: links/jogos são guardados como JSON puro no backend ----
export function parseLinks(json: string | null | undefined): UsuarioLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(l => l && typeof l.url === 'string') : [];
  } catch { return []; }
}
export function parseJogos(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(j => typeof j === 'string') : [];
  } catch { return []; }
}
export function stringifyLinks(links: UsuarioLink[]): string { return JSON.stringify(links.filter(l => l.url.trim())); }
export function stringifyJogos(jogos: string[]): string { return JSON.stringify(jogos.filter(j => j.trim())); }

// ---- esqueci / redefinir senha ------------------------------
export async function esqueciSenha(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/acesso/esqueci-senha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify({ email }),
  });
  return parseJsonOrThrow<{ message: string }>(res);
}

export async function redefinirSenha(payload: { email: string; token: string; nova_senha: string }): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/acesso/redefinir-senha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<{ message: string }>(res);
}

// ---- confirmação de e-mail (cadastro) ------------------------
export async function confirmarEmail(payload: { email: string; token: string }): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/acesso/confirmar-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data);
  return data;
}

export async function reenviarConfirmacao(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/acesso/reenviar-confirmacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify({ email }),
  });
  return parseJsonOrThrow<{ message: string }>(res);
}

// ============================================================
// SALAS (LiveKit)
// ============================================================
export const salaApi = {
  list: (s: StoredSession, tipo?: 'reuniao' | 'producao') =>
    authFetch<Sala[]>(s, `/salas${buildQuery({ tipo })}`),
  find: (s: StoredSession, id: number) => authFetch<Sala>(s, `/salas/${id}`),
  create: (s: StoredSession, body: { nome?: string; tipo?: 'reuniao'; descricao?: string; categoria?: string }) =>
    authFetch<Sala>(s, `/salas`, { method: 'POST', body: JSON.stringify(body) }),
  entrar: (s: StoredSession, id: number) =>
    authFetch<SalaTokenResponse>(s, `/salas/${id}/entrar`, { method: 'POST' }),
  encerrar: (s: StoredSession, id: number) =>
    authFetch<void>(s, `/salas/${id}/encerrar`, { method: 'POST' }),
  // SSE — usa TokenUser como query string porque EventSource não permite
  // headers customizados no browser.
  eventosUrl: (s: StoredSession, id: number) =>
    `${API_URL}/salas/${id}/eventos?token_user=${encodeURIComponent(tokenUserHeader(s))}`,
};

// ============================================================
// UPLOAD (foto/banner de perfil, ícone/banner de comunidade)
// ============================================================

/** Pastas aceitas pelo backend — ver internal/handlers/upload_handler.go. */
export type PastaUpload = 'fotos' | 'banners' | 'comunidades';

export const uploadApi = {
  /**
   * Envia uma imagem para `POST /upload/foto` (o nome da rota ficou do
   * fluxo original de foto de perfil, mas ela aceita qualquer imagem —
   * o campo `pasta` decide onde é salva). Devolve a URL pública pronta
   * pra gravar em `usuario.foto`/`banner` ou `comunidade.icone_url`/
   * `banner_url` via PUT.
   */
  imagem: async (s: StoredSession, file: File, pasta: PastaUpload = 'fotos', urlAntiga?: string | null): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('arquivo', file);
    form.append('pasta', pasta);
    if (urlAntiga) form.append('foto_antiga', urlAntiga);
    const res = await fetch(`${API_URL}/upload/foto`, {
      method: 'POST',
      headers: { TokenUser: tokenUserHeader(s) },
      body: form,
    });
    return parseJsonOrThrow<{ url: string }>(res);
  },
  // Atalhos por conveniência — todos chamam `imagem` por baixo.
  foto: (s: StoredSession, file: File, oldFotoUrl?: string | null) => uploadApi.imagem(s, file, 'fotos', oldFotoUrl),
  banner: (s: StoredSession, file: File, oldBannerUrl?: string | null) => uploadApi.imagem(s, file, 'banners', oldBannerUrl),
  /** Envia um clipe de áudio (mp3/wav/ogg/m4a) pro soundboard de uma comunidade. */
  som: async (s: StoredSession, file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('arquivo', file);
    const res = await fetch(`${API_URL}/upload/som`, {
      method: 'POST',
      headers: { TokenUser: tokenUserHeader(s) },
      body: form,
    });
    return parseJsonOrThrow<{ url: string }>(res);
  },
};

// Resolve o campo `foto` (que pode vir como caminho relativo do backend,
// ex.: "/uploads/fotos/xxx.jpg") para uma URL absoluta que o <img> consiga
// carregar.
export function resolveFotoUrl(foto: string | null | undefined): string | null {
  if (!foto) return null;
  if (foto.startsWith('http://') || foto.startsWith('https://')) return foto;
  return `${API_URL}${foto.startsWith('/') ? '' : '/'}${foto}`;
}

// ============================================================
// COMUNIDADES
// ============================================================
// Espelha models.CategoriasComunidade no backend — só os chips de filtro/
// sugestão de "Descobrir comunidades" e do modal de criar comunidade.
export const CATEGORIAS_COMUNIDADE = ['Jogos', 'Tecnologia', 'Música', 'Filmes', 'Esportes', 'Estudos', 'Humor'];

export const comunidadeApi = {
  /** "Minhas comunidades": dono, membro ou solicitação pendente. */
  list: (s: StoredSession) => authFetch<Comunidade[]>(s, '/comunidades'),
  /** "Explorar comunidades": públicas das quais eu ainda não faço parte. */
  explorar: (s: StoredSession, categoria?: string) =>
    authFetch<Comunidade[]>(s, `/comunidades/explorar${buildQuery({ categoria })}`),
  find: (s: StoredSession, id: number) => authFetch<Comunidade>(s, `/comunidades/${id}`),
  create: (s: StoredSession, body: { nome: string; descricao?: string | null; categoria?: string | null; visibilidade?: Visibilidade; icone_url?: string | null; banner_url?: string | null }) =>
    authFetch<Comunidade>(s, '/comunidades', { method: 'POST', body: JSON.stringify(body) }),
  update: (s: StoredSession, id: number, body: { nome?: string; descricao?: string | null; visibilidade?: Visibilidade; icone_url?: string | null; banner_url?: string | null }) =>
    authFetch<Comunidade>(s, `/comunidades/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (s: StoredSession, id: number) =>
    authFetch<{ message: string }>(s, `/comunidades/${id}`, { method: 'DELETE' }),
  /** Pública: entra na hora. Privada: cria uma solicitação pendente
   * (devolve `papel: 'pendente'`) até o dono aprovar. */
  entrar: (s: StoredSession, id: number) =>
    authFetch<{ message: string; papel: 'membro' | 'pendente' }>(s, `/comunidades/${id}/entrar`, { method: 'POST' }),
  /** Só o dono vê — quem está esperando aprovação numa comunidade privada. */
  pendentes: (s: StoredSession, id: number) =>
    authFetch<ComunidadeMembro[]>(s, `/comunidades/${id}/pendentes`),
  aprovar: (s: StoredSession, comunidadeId: number, usuarioId: number) =>
    authFetch<{ message: string }>(s, `/comunidades/${comunidadeId}/membros/${usuarioId}/aprovar`, { method: 'POST' }),
  rejeitar: (s: StoredSession, comunidadeId: number, usuarioId: number) =>
    authFetch<{ message: string }>(s, `/comunidades/${comunidadeId}/membros/${usuarioId}`, { method: 'DELETE' }),
  /** Qualquer membro vê — lista completa (dono + membros) com indicador
   * online/offline, pra aba "Membros". */
  membros: (s: StoredSession, id: number) =>
    authFetch<MembroComPresenca[]>(s, `/comunidades/${id}/membros`),
};

// ============================================================
// CANAIS (texto/voz de uma comunidade)
// ============================================================
export const canalApi = {
  list: (s: StoredSession, comunidadeId: number) =>
    authFetch<Canal[]>(s, `/comunidades/${comunidadeId}/canais`),
  create: (s: StoredSession, comunidadeId: number, body: { nome: string; tipo: CanalTipo; icone?: string }) =>
    authFetch<Canal>(s, `/comunidades/${comunidadeId}/canais`, { method: 'POST', body: JSON.stringify(body) }),
  update: (s: StoredSession, id: number, body: { nome?: string; icone?: string | null }) =>
    authFetch<Canal>(s, `/canais/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (s: StoredSession, id: number) =>
    authFetch<{ message: string }>(s, `/canais/${id}`, { method: 'DELETE' }),
};

// ============================================================
// MENSAGENS (chat de um canal de texto)
// ============================================================
export const mensagemApi = {
  list: (s: StoredSession, canalId: number, opts?: { after?: number; limit?: number }) =>
    authFetch<CanalMensagem[]>(s, `/canais/${canalId}/mensagens${buildQuery({ after: opts?.after, limit: opts?.limit })}`),
  send: (s: StoredSession, canalId: number, conteudo: string) =>
    authFetch<CanalMensagem>(s, `/canais/${canalId}/mensagens`, { method: 'POST', body: JSON.stringify({ conteudo }) }),
  edit: (s: StoredSession, mensagemId: number, conteudo: string) =>
    authFetch<CanalMensagem>(s, `/mensagens/${mensagemId}`, { method: 'PUT', body: JSON.stringify({ conteudo }) }),
  delete: (s: StoredSession, mensagemId: number) =>
    authFetch<{ message: string }>(s, `/mensagens/${mensagemId}`, { method: 'DELETE' }),
};

// ============================================================
// SOUNDBOARD (efeitos sonoros de uma comunidade)
// ============================================================
export const comunidadeSomApi = {
  list: (s: StoredSession, comunidadeId: number) =>
    authFetch<ComunidadeSom[]>(s, `/comunidades/${comunidadeId}/sons`),
  create: (s: StoredSession, comunidadeId: number, body: { nome: string; emoji?: string | null; arquivo_url: string }) =>
    authFetch<ComunidadeSom>(s, `/comunidades/${comunidadeId}/sons`, { method: 'POST', body: JSON.stringify(body) }),
  delete: (s: StoredSession, somId: number) =>
    authFetch<{ message: string }>(s, `/sons/${somId}`, { method: 'DELETE' }),
};

// ============================================================
// PAINEL (home): "o que está rolando agora"
// ============================================================
export const painelApi = {
  atividades: (s: StoredSession) => authFetch<AtividadeAgora[]>(s, '/painel/atividades'),
};
