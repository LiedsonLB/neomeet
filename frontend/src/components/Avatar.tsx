import { resolveFotoUrl } from '../api/client';

// Presets de moldura decorativa em volta do avatar (estilo "avatar
// decorations" do Discord). Por enquanto são anéis gerados via CSS
// (gradientes), sem depender de nenhuma imagem externa — dá pra trocar
// por assets ilustrados depois sem mudar a interface (o valor salvo em
// `usuario.moldura` continua sendo só uma chave string).
export const MOLDURAS = [
  { id: '', nome: 'Nenhuma', gradient: null },
  { id: 'eletrica', nome: 'Elétrica', gradient: 'linear-gradient(135deg, #b8c3ff, #124af0)' },
  { id: 'violeta', nome: 'Violeta', gradient: 'linear-gradient(135deg, #d4bbff, #6c04de)' },
  { id: 'ciano', nome: 'Ciano', gradient: 'linear-gradient(135deg, #63f7ff, #00797e)' },
  { id: 'aurora', nome: 'Aurora', gradient: 'linear-gradient(135deg, #b8c3ff, #00dce5, #d4bbff)' },
  { id: 'fogo', nome: 'Fogo', gradient: 'linear-gradient(135deg, #ffcb7a, #ff6b6b)' },
] as const;

export type MolduraId = (typeof MOLDURAS)[number]['id'];

function molduraGradient(moldura: string | null | undefined): string | null {
  return MOLDURAS.find(m => m.id === moldura)?.gradient ?? null;
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  nome: string;
  foto?: string | null;
  moldura?: string | null;
  /** Tamanho do avatar em pixels (a moldura, quando houver, some ~18% a mais). */
  size?: number;
  className?: string;
  online?: boolean;
}

export default function Avatar({ nome, foto, moldura, size = 40, className = '', online }: AvatarProps) {
  const gradient = molduraGradient(moldura);
  const fotoUrl = resolveFotoUrl(foto);
  const ringSize = gradient ? Math.round(size * 1.16) : size;

  const avatarNode = fotoUrl ? (
    <img
      src={fotoUrl}
      alt={nome}
      className="h-full w-full rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-secondary-container font-bold text-on-primary-container"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials(nome)}
    </div>
  );

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: ringSize, height: ringSize }}>
      {gradient ? (
        <div
          className="flex items-center justify-center rounded-full p-[3px]"
          style={{ width: ringSize, height: ringSize, background: gradient }}
        >
          <div className="flex items-center justify-center rounded-full bg-surface-container-lowest p-[2px]">
            {avatarNode}
          </div>
        </div>
      ) : (
        avatarNode
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-surface-container-lowest ${online ? 'bg-tertiary' : 'bg-outline'}`}
          style={{ width: Math.max(10, size * 0.3), height: Math.max(10, size * 0.3) }}
        />
      )}
    </div>
  );
}
