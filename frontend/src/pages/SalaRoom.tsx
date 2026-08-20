import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { ChevronLeft, Eye, Radio } from 'lucide-react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

import { useAuth } from '../auth/AuthContext';
import { salaApi, ApiError } from '../api/client';
import type { Sala } from '../api/types';

/** Sala de vídeo (LiveKit) — ver mockup "Chamada de Vídeo". A grade de
 * participantes, controles de mic/câmera/tela/chat e o layout responsivo
 * vêm prontos do prefab `VideoConference` da própria LiveKit; aqui só
 * adicionamos a barra superior com o nome da sala no visual do Resenha. */
export default function SalaRoom() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [url, setUrl] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !id) return;
    let mounted = true;
    salaApi.entrar(session, Number(id))
      .then(res => {
        if (!mounted) return;
        setToken(res.token);
        setUrl(res.url);
        setSala(res.sala);
      })
      .catch(err => {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : 'Não foi possível entrar na sala.');
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [session?.id, id]);

  const handleLeave = () => navigate('/salas');

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface-container-lowest">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-outline-variant border-t-primary" />
        <p className="text-sm text-on-surface-variant">Entrando na sala…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-surface-container-lowest px-6 text-center">
        <p className="text-error">{error}</p>
        <button
          type="button"
          onClick={handleLeave}
          className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Voltar para comunidades
        </button>
      </div>
    );
  }

  if (!token || !sala) return null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0A0C14]">
      <Toaster theme="dark" position="top-center" />

      {/* Barra superior no estilo Resenha */}
      <header className="glass-panel z-10 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <ChevronLeft size={16} /> Salas
          </button>
          <div className="h-6 w-px bg-outline-variant" />
          <span className="text-headline-md font-bold text-primary">{sala.nome}</span>
          <div className="flex items-center gap-2 rounded-full border border-error/20 bg-error/10 px-3 py-1 text-error">
            <Radio size={12} className="animate-pulse" />
            <span className="text-label-sm font-bold uppercase tracking-wider">Ao vivo</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant">
          <Eye size={16} />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <LiveKitRoom
          serverUrl={url}
          token={token}
          connect
          data-lk-theme="default"
          style={{ height: '100%' }}
          onDisconnected={() => { toast.warning('Você saiu da sala'); navigate('/salas'); }}
          onError={err => toast.error('Erro: ' + err.message)}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    </div>
  );
}
