// Efeitos sonoros da comunidade: um "pop" para mensagem nova e uma
// campainha curta para quando alguém entra na chamada de voz. Os arquivos
// são sintetizados (sem depender de nenhum asset externo) — ver o script
// que os gerou nos comentários do zip entregue junto desta mudança.
//
// Cada som tem seu próprio <audio> reaproveitado entre chamadas (em vez de
// criar um novo elemento a cada play) e um "cooldown" curto pra evitar que
// uma rajada de mensagens/entradas dispare o som dezenas de vezes seguidas.

const sons = {
  mensagem: new Audio('/sounds/mensagem.wav'),
  chamadaEntrada: new Audio('/sounds/chamada-entrada.wav'),
  // Placeholder sintetizado — troque o arquivo em
  // frontend/public/sounds/compartilhar-tela.wav pelo som definitivo
  // quando quiser (mesmo nome/caminho, sem precisar mexer no código).
  compartilharTela: new Audio('/sounds/compartilhar-tela.wav'),
} as const;

type NomeSom = keyof typeof sons;

const ultimoPlay: Record<NomeSom, number> = { mensagem: 0, chamadaEntrada: 0, compartilharTela: 0 };
const COOLDOWN_MS = 350;

function tocar(nome: NomeSom, volume = 0.6) {
  const agora = Date.now();
  if (agora - ultimoPlay[nome] < COOLDOWN_MS) return;
  ultimoPlay[nome] = agora;

  const audio = sons[nome];
  audio.volume = volume;
  audio.currentTime = 0;
  // Navegadores podem bloquear autoplay antes de qualquer interação do
  // usuário — ignora silenciosamente nesse caso.
  void audio.play().catch(() => {});
}

export const sounds = {
  mensagem: () => tocar('mensagem'),
  chamadaEntrada: () => tocar('chamadaEntrada', 0.7),
  compartilharTela: () => tocar('compartilharTela', 0.7),
};
