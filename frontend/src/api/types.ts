// ============================================================
// types.ts
// ============================================================

/** Um link do perfil (GitHub, site pessoal, etc.) — ver campo `links`. */
export interface UsuarioLink {
  label: string;
  url: string;
}

/** "" (vazio) == só "disponível", sem atividade específica agora. */
export type AtividadeTipo = 'jogo' | 'voz' | '';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  foto: string | null;
  banner: string | null;
  moldura: string | null;
  /** Bio/descrição do usuário, mostrada no perfil (dele e dos outros). */
  descricao: string | null;
  /** JSON serializado — usar parseLinks()/parseJogos() de api/client.ts pra ler. */
  links: string | null;
  jogos: string | null;
  /** Status curto tipo bio rápida, ex.: "fazendo código e resenha". */
  status_customizado: string | null;
  /** Presença rica (ver PresencaBadge.tsx) — o que a pessoa está fazendo agora. */
  atividade: string | null;
  atividade_tipo: AtividadeTipo | null;
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
  descricao: string | null;
  links: string | null;
  jogos: string | null;
  status_customizado: string | null;
  atividade: string | null;
  atividade_tipo: AtividadeTipo | null;
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

/** "" = não tem vínculo nenhum (usado em /comunidades/explorar). */
export type PapelComunidade = 'dono' | 'membro' | 'pendente' | '';
export type Visibilidade = 'publica' | 'privada';

export interface Comunidade {
  id: number;
  nome: string;
  descricao: string | null;
  /** Categoria livre (sugestões em CATEGORIAS_COMUNIDADE) — filtro em "Descobrir". */
  categoria: string | null;
  visibilidade: Visibilidade;
  icone_url: string | null;
  banner_url: string | null;
  criado_por: number;
  created_at: string | null;
  updated_at: string | null;
  /** Papel do usuário logado nessa comunidade — preenchido pelo backend. */
  papel?: PapelComunidade;
  total_membros?: number;
}

/** Uma solicitação de entrada pendente numa comunidade privada. */
export interface ComunidadeMembro {
  id: number;
  comunidade_id: number;
  usuario_id: number;
  papel: PapelComunidade;
  created_at: string | null;
  usuario_nome?: string;
  usuario_foto?: string | null;
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
  moldura?: string | null;
  micEnabled: boolean;
  deafened?: boolean;
  cameraOn?: boolean;
  screenShare?: boolean;
}

export interface CanalMensagem {
  id: number;
  canal_id: number;
  usuario_id: number;
  conteudo: string;
  editado_em: string | null;
  created_at: string | null;
  updated_at: string | null;
  usuario_nome: string;
  usuario_foto: string | null;
}

/** Um membro efetivo (dono ou membro — nunca pendente) de uma comunidade,
 * com indicador de presença (ver GET /comunidades/{id}/membros no
 * backend). Usado pela aba "Membros" (MembrosModal.tsx). */
export interface MembroComPresenca {
  usuario_id: number;
  nome: string;
  foto: string | null;
  moldura: string | null;
  papel: PapelComunidade;
  online: boolean;
}

/** Um clipe do soundboard de uma comunidade (estilo Discord). */
export interface ComunidadeSom {
  id: number;
  comunidade_id: number;
  nome: string;
  emoji: string | null;
  arquivo_url: string;
  criado_por: number;
  created_at: string | null;
}

// ============================================================
// PAINEL (home): "o que está rolando agora"
// ============================================================

/** Um canal de voz com gente dentro agora, numa comunidade do usuário. */
export interface AtividadeAgora {
  comunidade_id: number;
  comunidade_nome: string;
  comunidade_icone: string | null;
  canal_id: number;
  canal_nome: string;
  canal_icone: string | null;
  total_participantes: number;
  participantes: ParticipanteInfo[];
}