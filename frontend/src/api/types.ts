// ============================================================
// types.ts
// ============================================================

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  foto: string | null;
  banner: string | null;   // Adicionado
  moldura: string | null;  // Adicionado
  perfil: number;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  aluno_id: number | null;
  foto_url?: string | null;
  thumb?: string | null;
}
export interface LoginResponse {
  id: number;
  nome: string;
  email: string;
  foto: string | null;
  banner: string | null;
  moldura: string | null;
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

// ============================================================
// COMUNIDADES (estilo Discord: servidor -> canais texto/voz)
// ============================================================

export type PapelComunidade = 'dono' | 'membro' | '';

export interface Comunidade {
  id: number;
  nome: string;
  descricao: string | null;
  icone_url: string | null;
  banner_url: string | null;
  criado_por: number;
  created_at: string | null;
  updated_at: string | null;
  /** Papel do usuário logado nessa comunidade — preenchido pelo backend. */
  papel?: PapelComunidade;
  total_membros?: number;
}

export type CanalTipo = 'texto' | 'voz';

export interface Canal {
  id: number;
  comunidade_id: number;
  nome: string;
  icone?: string | null;
  tipo: 'texto' | 'voz';
  sala_id: number | null;
  posicao: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  participantes_online: number;
  participantes_lista?: ParticipanteInfo[];
}

export interface ParticipanteInfo {
  identity: string;
  nome: string;
  foto?: string | null;
  micEnabled: boolean;
}

export interface CanalMensagem {
  id: number;
  canal_id: number;
  usuario_id: number;
  conteudo: string;
  created_at: string | null;
  updated_at: string | null;
  usuario_nome: string;
  usuario_foto: string | null;
}
