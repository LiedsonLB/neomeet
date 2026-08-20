import type { ReactNode } from 'react';
import { MessagesSquare } from 'lucide-react';

// Classes de campo compartilhadas pelas telas de auth
export const authField = {
  wrap: 'relative rounded-lg transition-shadow duration-300 focus-within:shadow-glow',
  input:
    'block w-full rounded-lg border border-outline-variant bg-surface-container-highest py-3 pl-10 pr-3 text-body-md text-on-surface placeholder-outline transition-colors focus:border-primary-container focus:ring-1 focus:ring-primary-container',
  label: 'ml-1 block text-label-md text-on-surface',
  icon: 'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3',
};

type AuthShellProps = {
  children: ReactNode;
  /** largura máxima do card em px (440 login, 500 formulários maiores) */
  maxWidth?: number;
  /** conteúdo abaixo do card (ex.: tagline) */
  footer?: ReactNode;
};

export default function AuthShell({ children, maxWidth = 440, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-surface-container-lowest px-margin-mobile py-10 text-on-surface md:px-margin-desktop">
      {/* Glows ambientes */}
      <div className="pointer-events-none absolute -left-[10%] -top-[10%] h-[50vw] w-[50vw] rounded-full bg-secondary-container/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-[10%] -right-[10%] h-[40vw] w-[40vw] rounded-full bg-tertiary-container/20 blur-[100px]" />

      <main className="relative z-10 w-full" style={{ maxWidth }}>
        {/* Logo — para voltar a usar a imagem, troque este bloco por:
            <img src="/webleia_logo.png" alt="WebLeia" className="mx-auto mb-stack-sm h-14" /> */}
        <div className="mb-stack-lg flex flex-col items-center justify-center">
          <img src="/resenha_logo.png" alt="Resenha" className="h-24" />
        </div>

        {/* Card glassmorphism */}
        <div className="glass-panel w-full rounded-2xl p-6 md:p-stack-lg">{children}</div>

        {footer}
      </main>
    </div>
  );
}