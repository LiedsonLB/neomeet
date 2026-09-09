// components/PresenceHeartbeat.tsx
//
// Componente invisível (não renderiza nada) que só fica avisando o
// backend "ainda estou aqui" a cada 30s enquanto há sessão ativa — ver
// POST /usuarios/heartbeat e UsuarioRepository.TouchAcesso no backend.
// Isso alimenta a bolinha online/offline da aba "Membros" de uma
// comunidade (MembrosModal.tsx / GET /comunidades/{id}/membros).
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usuarioApi } from '../api/client';

const INTERVALO_MS = 30_000;

export default function PresenceHeartbeat() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    let ativo = true;
    const enviar = () => { if (ativo) usuarioApi.heartbeat(session).catch(() => { }); };
    enviar();
    const iv = setInterval(enviar, INTERVALO_MS);
    return () => { ativo = false; clearInterval(iv); };
  }, [session]);

  return null;
}
