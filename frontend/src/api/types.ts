// ============================================================
// types.ts
// ============================================================

export interface Usuario {
  id: number; 
  nome: string; 
  email: string; 
  foto: string | null;
  perfil: number; 
  email_verified_at: string | null;
  created_at: string | null; 
  updated_at: string | null; 
}

export interface LoginResponse {
  id: number; 
  nome: string; 
  email: string; 
  foto: string | null; 
  perfil: number;
  email_verified_at: string | null; 
  token: string;
}

// ---- Pagination --------------------------------------------
export interface Paginated<T> {
  data: T[]; 
  current_page: number; 
  per_page: number; 
  total: number; 
  last_page: number;
}

export interface ApiErrorBody { 
  message: string; 
  code: number; 
}

export interface Sala {
  id: number;
  nome: string;
  codigo: string;
  tipo: 'reuniao' | 'producao' | string;
  descricao: string | null;
  categoria: string | null;
  genero_textual_id: number | null;
  criado_por: number;
  ativa: boolean;
  created_at: string | null;
  updated_at: string | null;
  participantes_online?: number;
}

export interface SalaTokenResponse {
  token: string; 
  url: string; 
  room: string; 
  sala: Sala;
}

// tipo: '' (ausente) ou 'progresso' == avanço normal de passo (compat com
// código antigo); 'entrou'/'saiu' == presença; 'iniciar_producao' == o
// professor disparou o início da atividade para este aluno.
export type SalaEventoTipo = '' | 'progresso' | 'entrou' | 'saiu';