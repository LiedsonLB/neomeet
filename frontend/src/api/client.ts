// ============================================================
// client.ts — typed API calls for all backend routes (Go)
// ============================================================
import type {
  LoginResponse, ApiErrorBody, Usuario, Paginated,
  Sala, SalaTokenResponse
} from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
export const APP_KEY = import.meta.env.VITE_APP_KEY ?? 'WEBTESTE';

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

export async function authFetch<T>(session: StoredSession, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', TokenUser: tokenUserHeader(session), ...(init.headers ?? {}) },
  });
  return parseJsonOrThrow<T>(res);
}

// ---- public ------------------------------------------------
export async function login(email: string, senha: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/acesso/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify({ email, senha }),
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
export const usuarioApi = {
  list: (s: StoredSession, p?: { page?: number; per_page?: number; search?: string; aluno_id?: number; perfil?: number }) =>
    authFetch<Paginated<Usuario>>(s, `/usuarios${buildQuery(p ?? {})}`),
  find: (s: StoredSession, id: number) => authFetch<Usuario>(s, `/usuarios/${id}`),
  update: (s: StoredSession, id: number, body: Partial<Usuario> & { senha?: string }) =>
    authFetch<Usuario>(s, `/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (s: StoredSession, id: number) =>
    authFetch<void>(s, `/usuarios/${id}`, { method: 'DELETE' }),
};

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
  console.log('📤 Enviando confirmarEmail:', payload);
  console.log('📤 Token length:', payload.token.length);

  const res = await fetch(`${API_URL}/acesso/confirmar-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', AppKey: APP_KEY },
    body: JSON.stringify(payload),
  });

  console.log('📥 Resposta status:', res.status);
  const data = await res.json();
  console.log('📥 Resposta body:', data);

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
// UPLOAD (foto de perfil, etc.)
// ============================================================
export const uploadApi = {
  foto: async (s: StoredSession, file: File, oldFotoUrl?: string | null): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('arquivo', file);
    if (oldFotoUrl) {
      form.append('foto_antiga', oldFotoUrl);
    }
    const res = await fetch(`${API_URL}/upload/foto`, {
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