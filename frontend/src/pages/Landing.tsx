import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bolt,
  Check,
  ChevronDown,
  Download,
  Gamepad2,
  HardDriveDownload,
  MessageSquare,
  Mic,
  Monitor,
  Music4,
  Shield,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

/* ==================================================================== */
/* DOWNLOADS — mude só aqui quando lançar versão nova                    */
/* ==================================================================== */
/*
 * `url` precisa ser link DIRETO pro arquivo (abrir no navegador já baixa,
 * sem tela de confirmação). GitHub Releases funciona bem pra isso.
 * Não funciona: Google Drive, OneDrive, Dropbox, MEGA.
 */
const VERSAO = '1.0.0';

const DOWNLOADS = [
  {
    id: 'windows',
    label: 'Windows',
    detalhe: 'Windows 10 ou superior (64 bits)',
    formato: 'Instalador .exe',
    size: '72 MB',
    icon: Monitor,
    url: `https://github.com/LiedsonLB/neomeet/releases/download/v${VERSAO}/Resenha.${VERSAO}.exe`,
    recomendado: 'windows' as const,
  },
  {
    id: 'linux-deb',
    label: 'Linux — Debian / Ubuntu',
    detalhe: 'Pacote nativo para distros baseadas em Debian',
    formato: 'Pacote .deb (amd64)',
    size: '73 MB',
    icon: HardDriveDownload,
    url: `https://github.com/LiedsonLB/neomeet/releases/download/v${VERSAO}/Resenha_${VERSAO}_amd64.deb`,
    recomendado: 'linux' as const,
  },
  {
    id: 'linux-appimage',
    label: 'Linux — AppImage',
    detalhe: 'Portátil, roda em qualquer distribuição',
    formato: 'AppImage',
    size: '105 MB',
    icon: HardDriveDownload,
    url: `https://github.com/LiedsonLB/neomeet/releases/download/v${VERSAO}/Resenha-${VERSAO}.AppImage`,
    recomendado: 'linux' as const,
  },
] as const;

type Plataforma = 'windows' | 'linux' | 'outro';

function detectarPlataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'outro';
  const ua = navigator.userAgent;
  if (/Windows|Win32|Win64|WOW64/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'outro';
}

/* ------------------------------------------------------------------ */
/* Recursos mostrados na grade                                         */
/* ------------------------------------------------------------------ */
const RECURSOS = [
  {
    icon: Video,
    titulo: 'Salas de vídeo',
    texto: 'Chamadas em grupo com áudio e vídeo em tempo real, sem instalar nada.',
  },
  {
    icon: Users,
    titulo: 'Comunidades',
    texto: 'Crie sua comunidade, organize canais e reúna a galera num lugar só.',
  },
  {
    icon: MessageSquare,
    titulo: 'Chat integrado',
    texto: 'Converse por texto durante a call, com imagens e histórico da sala.',
  },
  {
    icon: Mic,
    titulo: 'Canais de voz',
    texto: 'Entra e sai do canal de voz a qualquer momento, estilo mesa de bar.',
  },
  {
    icon: Gamepad2,
    titulo: 'Feito pra jogar',
    texto: 'Supressão de ruído e widget flutuante pra falar enquanto joga.',
  },
  {
    icon: Music4,
    titulo: 'Soundboard',
    texto: 'Solte os efeitos na hora certa e faça a resenha acontecer.',
  },
] as const;

/* Cards de destaque do bloco "Sobre" — troque os números quando tiver
   dados reais de uso; por enquanto são só ganchos do produto. */
const DESTAQUES = [
  { valor: '100%', legenda: 'No navegador, sem instalar nada' },
  { valor: '24/7', legenda: 'Canais de voz sempre disponíveis' },
  { valor: '1', legenda: 'Login só pra chat, call e sala' },
] as const;

/* ------------------------------------------------------------------ */
/* Modal de download — abre ao clicar em qualquer botão de download    */
/* ------------------------------------------------------------------ */
function ModalDownload({
  aberto,
  onFechar,
  plataforma,
}: {
  aberto: boolean;
  onFechar: () => void;
  plataforma: Plataforma;
}) {
  const [baixando, setBaixando] = useState<string | null>(null);

  // Fecha com ESC e trava scroll do body
  useEffect(() => {
    if (!aberto) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', onKey);

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, onFechar]);

  function handleBaixar(id: string) {
    setBaixando(id);
    window.setTimeout(() => setBaixando(null), 2500);
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-download"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-outline-variant/30 bg-surface-container-low shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 p-6 pb-5">
          <div>
            <h2
              id="titulo-download"
              className="text-headline-md text-on-surface"
            >
              Baixar o Resenha
            </h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Escolha a versão para o seu sistema. Versão {VERSAO}.
            </p>
          </div>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de plataformas */}
        <div className="space-y-3 p-6 pt-5">
          {DOWNLOADS.map(
            ({ id, label, detalhe, formato, size, icon: Icon, url, recomendado }) => {
              const ehRecomendado = plataforma === recomendado;
              const estaBaixando = baixando === id;

              return (
                <a
                  key={id}
                  href={url}
                  onClick={() => handleBaixar(id)}
                  className="group flex items-center gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container p-4 transition-all hover:border-primary/40 hover:bg-surface-container-high"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
                    <Icon size={22} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-label-md text-on-surface">
                        {label}
                      </span>
                      {ehRecomendado && (
                        <span className="rounded-full bg-tertiary/20 px-2 py-0.5 text-label-sm uppercase tracking-wide text-tertiary">
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-label-sm text-on-surface-variant">
                      {detalhe}
                    </span>
                    <span className="mt-1 block text-label-sm text-on-surface-variant/60">
                      {formato} · {size}
                    </span>
                  </span>

                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                    <Download
                      size={18}
                      className={estaBaixando ? 'animate-pulse' : ''}
                    />
                  </span>
                </a>
              );
            },
          )}

          <p className="pt-2 text-center text-label-sm text-on-surface-variant/60">
            macOS chega em breve. Dúvidas? Fale com a gente no chat.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing                                                             */
/* ------------------------------------------------------------------ */
export default function Landing() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [plataforma, setPlataforma] = useState<Plataforma>('outro');
  const [rolou, setRolou] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    setPlataforma(detectarPlataforma());
  }, []);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** Destino do botão principal: já logado vai direto pro painel */
  const destinoApp = session ? '/painel' : '/login';

  /** Texto auxiliar abaixo dos CTAs — detecta a plataforma do usuário */
  const textoPlataforma =
    plataforma === 'windows'
      ? `Detectamos Windows · versão ${VERSAO}`
      : plataforma === 'linux'
        ? `Detectamos Linux · versão ${VERSAO}`
        : `Disponível para Windows e Linux · versão ${VERSAO}`;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-surface-container-lowest text-on-surface">
      {/* Glows ambientes fixos no fundo */}
      <div className="pointer-events-none fixed -left-[10%] -top-[15%] h-[55vw] w-[55vw] rounded-full bg-secondary-container/20 blur-[140px]" />
      <div className="pointer-events-none fixed -right-[15%] top-[30%] h-[45vw] w-[45vw] rounded-full bg-primary-container/15 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-[15%] left-[20%] h-[40vw] w-[40vw] rounded-full bg-tertiary-container/15 blur-[110px]" />

      {/* ============================ NAVBAR ============================ */}
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          rolou
            ? 'border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-xl shadow-glow-soft'
            : 'bg-surface-container-lowest/40 backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto flex max-w-container-max items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
          <img src="/resenha_logo.png" alt="Resenha" className="h-8 md:h-9" />

          <nav className="hidden items-center gap-8 text-label-md uppercase tracking-wide md:flex">
            <a
              href="#recursos"
              className="text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Recursos
            </a>
            <a
              href="#sobre"
              className="text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Sobre
            </a>
            <a
              href="#download"
              className="text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Download
            </a>
          </nav>

          <Link to={destinoApp} className="btn-primary px-4 py-2 text-sm">
            {session ? 'Ir para o painel' : 'Entrar'}
          </Link>
        </div>
      </header>

      {/* ============================= HERO ============================= */}
      <section className="relative z-10 mx-auto max-w-container-max px-margin-mobile pb-stack-lg pt-32 md:px-margin-desktop md:pb-20 md:pt-20">
        {/* Moldura "print" do app — placeholder elegante enquanto não há screenshot */}
        <div className="mx-auto mt-stack-lg max-w-3xl">
          <div className="glass-panel overflow-hidden rounded-2xl p-2">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-tertiary/70" />
            </div>
            {/* Troque a <div> abaixo por: <img src="/preview-app.png" alt="Resenha" className="w-full rounded-xl" /> */}
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high">
              <img
                src="/resenha_print.jfif"
                alt=""
                aria-hidden="true"
                className="opacity-30"
              />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl text-center md:mt-10">
          <h1 className="text-headline-lg-mobile uppercase md:text-headline-xl">
            Reuniões, jogos e conversas —{' '}
            <span className="gradient-text italic">sua resenha, sua sala.</span>
          </h1>

          <p className="mx-auto mt-stack-md max-w-xl text-body-md text-on-surface-variant md:text-body-lg">
            Salas de vídeo, canais de voz, chat e comunidades num lugar só. Use
            direto no navegador ou instale o app no Windows ou Linux.
          </p>

          {/* -------------------------- CTAs -------------------------- */}
          <div className="mt-stack-lg flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(destinoApp)}
              className="btn-primary w-full px-6 py-3 text-base sm:w-auto"
            >
              Acessar a plataforma
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="btn-ghost w-full px-6 py-3 text-base sm:w-auto"
            >
              <Download size={18} />
              Baixar o app
              <ChevronDown size={16} className="opacity-70" />
            </button>
          </div>

          <p className="mt-4 text-label-sm text-on-surface-variant/70">
            {textoPlataforma}
          </p>
        </div>
      </section>

      {/* ============================= SOBRE ============================= */}
      <section
        id="sobre"
        className="relative z-10 mx-auto max-w-container-max scroll-mt-24 px-margin-mobile py-stack-lg md:px-margin-desktop md:py-20"
      >
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
          {/* Card principal — história do projeto */}
          <div className="group relative overflow-hidden rounded-2xl bg-surface-container-low p-8 md:col-span-8 md:p-12">
            <div className="relative z-10">
              <span className="mb-3 block text-label-sm uppercase tracking-[0.3em] text-primary">
                Por que o Resenha existe
              </span>
              <h2 className="mb-4 text-headline-md md:text-headline-lg">
                Menos abas abertas, mais resenha
              </h2>
              <p className="max-w-2xl text-body-md text-on-surface-variant md:text-body-lg">
                Cansamos de trocar de app toda vez que a call acabava e a
                conversa continuava — um pro jogo, outro pro chat, outro pra
                marcar o próximo encontro. O Resenha junta sala de vídeo,
                canal de voz e chat num lugar só, pra galera ficar de fato
                junta.
              </p>
            </div>
            <Users
              size={280}
              strokeWidth={0.5}
              className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 text-on-surface opacity-[0.06] transition-opacity duration-500 group-hover:opacity-10 md:block"
            />
          </div>

          {/* Card de destaque — gradiente */}
          <div className="flex flex-col justify-end rounded-2xl bg-gradient-to-br from-primary-container to-secondary-container p-8 text-on-primary-container md:col-span-4 md:p-10">
            <Bolt size={40} strokeWidth={1.5} className="mb-stack-md" />
            <h3 className="mb-2 text-headline-md">Sempre online</h3>
            <p className="text-body-md text-on-primary-container/80">
              Entra no canal de voz quando quiser — presença, chat e call
              acompanham a sala em tempo real.
            </p>
          </div>

          {/* Cards de estatística */}
          {DESTAQUES.map((item) => (
            <div
              key={item.legenda}
              className="rounded-2xl border border-outline-variant/10 bg-surface-container-highest p-8 md:col-span-4"
            >
              <h4 className="mb-2 text-headline-lg text-secondary-container">
                {item.valor}
              </h4>
              <p className="text-label-sm uppercase tracking-widest text-on-surface-variant">
                {item.legenda}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================== RECURSOS =========================== */}
      <section
        id="recursos"
        className="relative z-10 mx-auto max-w-container-max scroll-mt-24 px-margin-mobile py-stack-lg md:px-margin-desktop md:py-20"
      >
        <div className="mb-stack-lg text-center">
          <h2 className="text-headline-md md:text-headline-lg">
            Tudo que a resenha precisa
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-body-md text-on-surface-variant">
            Sem enrolação, sem mil abas abertas.
          </p>
        </div>

        <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icon: Icon, titulo, texto }) => (
            <div
              key={titulo}
              className="glass-card rounded-xl p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="mb-stack-md inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container/20 text-primary">
                <Icon size={22} />
              </div>
              <h3 className="mb-1.5 text-label-md text-on-surface">{titulo}</h3>
              <p className="text-body-md text-on-surface-variant">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================== DOWNLOAD =========================== */}
      <section
        id="download"
        className="relative z-10 mx-auto max-w-container-max scroll-mt-24 px-margin-mobile py-stack-lg md:px-margin-desktop md:py-20"
      >
        <div className="glass-panel rounded-2xl p-6 md:p-stack-lg">
          <div className="flex flex-col items-center gap-stack-lg md:flex-row md:justify-between">
            <div className="max-w-xl text-center md:text-left">
              <div className="mb-stack-md inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
                <Monitor size={24} />
              </div>

              <h2 className="text-headline-md">Resenha para desktop</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">
                App nativo, abre mais rápido, roda em segundo plano e avisa
                quando a galera entra na sala. Disponível para Windows e Linux.
              </p>

              <ul className="mt-stack-md space-y-2 text-left text-body-md text-on-surface-variant">
                {[
                  'Instalação em poucos cliques',
                  'Notificações na área de trabalho',
                  'Atalho de microfone mesmo minimizado',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={18} className="mt-0.5 shrink-0 text-tertiary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full shrink-0 text-center md:w-auto">
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="btn-primary w-full px-7 py-3.5 text-base md:w-auto"
              >
                <Download size={20} />
                Baixar o app
                <ChevronDown size={16} className="opacity-80" />
              </button>

              <p className="mt-stack-sm text-label-sm text-on-surface-variant/70">
                Versão {VERSAO}
                <br />
                Windows 10+ · Linux (.deb / AppImage)
              </p>

              <p className="mt-stack-sm inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant/60">
                <Shield size={14} />
                macOS em breve
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================== CTA FINAL =========================== */}
      <section className="relative z-10 overflow-hidden py-24 text-center md:py-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[30vw] w-[60vw] -translate-x-1/2 rounded-full bg-primary-container/20 blur-[130px]" />

        <div className="relative z-10 mx-auto max-w-3xl px-margin-mobile md:px-margin-desktop">
          <h2 className="text-headline-lg-mobile uppercase md:text-headline-xl">
            Bora começar?
          </h2>
          <p className="mx-auto mt-stack-md max-w-md text-body-md text-on-surface-variant md:text-body-lg">
            Cria sua conta em menos de um minuto e chama a galera.
          </p>
          <div className="mt-stack-lg flex flex-wrap items-center justify-center gap-4">
            <Link to={destinoApp} className="btn-primary px-8 py-3.5 text-base">
              Acessar a plataforma
              <ArrowRight size={18} />
            </Link>
            {!session && (
              <Link to="/cadastro" className="btn-secondary px-8 py-3.5 text-base">
                Criar conta grátis
              </Link>
            )}
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="btn-ghost px-8 py-3.5 text-base"
            >
              <Download size={18} />
              Baixar o app
              <ChevronDown size={16} className="opacity-70" />
            </button>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="relative z-10 border-t border-outline-variant/30 bg-surface-container-lowest py-8">
        <div className="mx-auto max-w-container-max px-margin-mobile text-center md:px-margin-desktop">
          <p className="text-xs text-on-surface-variant/60">
            Resenha © 2026 · Desenvolvido por{' '}
            <a
              href="https://liedsonbarros.vercel.app"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary hover:underline"
            >
              Liedson Barros
            </a>
            {' · '}
            <a
              href="https://github.com/LiedsonLB"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>

      {/* Modal de download — renderizado no fim pra ficar por cima de tudo */}
      <ModalDownload
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        plataforma={plataforma}
      />
    </div>
  );
}