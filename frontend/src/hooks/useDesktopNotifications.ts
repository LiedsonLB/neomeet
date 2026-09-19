// hooks/useDesktopNotifications.ts
//
// Notificações estilo:
//   🔔 Resenha
//   João entrou na sala "Minecraft".
//   [Entrar]
//
// Não existe um jeito de "assinar" eventos de todas as comunidades de uma
// vez no backend hoje (o SSE de /salas/{id}/eventos é por sala) — em vez de
// criar um hub novo só pra isso, reaproveita o mesmo endpoint que já
// alimenta a seção "O que está rolando agora" do Dashboard
// (GET /painel/atividades) e compara com o snapshot anterior a cada
// poll, notificando só o que mudou (canal que ficou ativo, ou pessoa nova
// que entrou). Funciona igual no navegador e dentro do app Electron — a
// Notification API do navegador já vira notificação nativa do SO lá.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { painelApi } from '../api/client';
import type { AtividadeAgora } from '../api/types';

const POLL_MS = 25_000;

export default function useDesktopNotifications() {
  const { session, usuario } = useAuth();
  const navigate = useNavigate();
  // canalId -> Set de identities (LiveKit) que já geraram notificação,
  // pra não repetir "fulano entrou" a cada poll enquanto ele continua lá.
  const conhecidosRef = useRef<Map<number, Set<string>>>(new Map());
  const primeiraCargaRef = useRef(true);

  useEffect(() => {
    if (!session || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let ativo = true;

    function notificar(titulo: string, corpo: string, aoClicar: () => void) {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const n = new Notification(titulo, { body: corpo, icon: '/icon-192.png' });
      n.onclick = () => { window.focus(); aoClicar(); };
    }

    function processar(atividades: AtividadeAgora[]) {
      const anterior = conhecidosRef.current;
      const atual = new Map<number, Set<string>>();

      for (const a of atividades) {
        const vistosAntes = anterior.get(a.canal_id) ?? new Set<string>();
        const vistosAgora = new Set<string>();

        for (const p of a.participantes) {
          vistosAgora.add(p.identity);
          const jaConhecia = vistosAntes.has(p.identity);
          const souEu = usuario && p.nome === usuario.nome;
          // Só notifica gente nova, que não seja eu mesmo, e não na
          // primeira carga (senão notifica tudo que já estava rolando
          // assim que o app abre).
          if (!jaConhecia && !souEu && !primeiraCargaRef.current) {
            notificar(
              '🔔 Resenha',
              `${p.nome} entrou na sala "${a.canal_nome}" (${a.comunidade_nome}).`,
              () => navigate(`/comunidades/${a.comunidade_id}?canal=${a.canal_id}`),
            );
          }
        }
        atual.set(a.canal_id, vistosAgora);
      }

      conhecidosRef.current = atual;
      primeiraCargaRef.current = false;
    }

    const carregar = () => painelApi.atividades(session).then(list => { if (ativo) processar(list); }).catch(() => {});
    carregar();
    const iv = setInterval(carregar, POLL_MS);
    return () => { ativo = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, usuario?.nome]);
}
