// utils/badges.ts
//
// Badges do perfil (ver Perfil.tsx / PerfilUsuarioModal.tsx) — em vez de
// criar uma tabela nova pra "conquistas", calcula um pequeno conjunto a
// partir de dados que a API já devolve (perfil, created_at, quantas
// comunidades a pessoa é dona). Simples e honesto: só mostra o que dá pra
// derivar de verdade, sem inventar métricas.

export interface Badge {
  id: string;
  label: string;
  emoji: string;
}

// Tipo propositalmente mínimo (não importa Usuario/LoginResponse): tanto
// faz vir do /usuarios/{id} (Usuario) quanto do login (LoginResponse) —
// esse último não tem created_at/updated_at/aluno_id, então usar o tipo
// Usuario inteiro aqui quebraria a chamada em Perfil.tsx (que usa o
// usuario do useAuth(), tipo LoginResponse). Só pedimos o que de fato
// usamos, com created_at opcional.
interface UsuarioParaBadges {
  perfil: number;
  created_at?: string | null;
}

export function computeBadges(usuario: UsuarioParaBadges, comunidadesCriadas: number): Badge[] {
  const badges: Badge[] = [];

  if (usuario.perfil === 1) {
    badges.push({ id: 'admin', label: 'Administrador', emoji: '🛡️' });
  }
  if (comunidadesCriadas > 0) {
    badges.push({ id: 'fundador', label: 'Fundador de comunidade', emoji: '👑' });
  }
  if (usuario.created_at) {
    const dias = (Date.now() - new Date(usuario.created_at).getTime()) / 86_400_000;
    if (dias >= 180) badges.push({ id: 'veterano', label: 'Membro veterano', emoji: '⭐' });
    else if (dias <= 7) badges.push({ id: 'novato', label: 'Novo na resenha', emoji: '🌱' });
  }

  return badges;
}