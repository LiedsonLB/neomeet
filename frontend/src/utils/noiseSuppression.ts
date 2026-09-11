// utils/noiseSuppression.ts
//
// Supressão de ruído (vento, ventilador, teclado, ruído de fundo em
// geral) aplicada ao microfone local ANTES de publicar no LiveKit.
//
// O `noiseSuppression: true` nativo do navegador (usado por baixo dos
// panos pelo getUserMedia) foca em ruído ESTACIONÁRIO (chiado, hum de
// ventilador constante) e mal segura ruído de vento — que é justamente
// o problema relatado. Pra isso precisa de um modelo de verdade: RNNoise
// (rede neural treinada especificamente pra separar voz de ruído de
// fundo, incluindo vento), rodando num AudioWorklet via WebAssembly —
// 100% no navegador da própria pessoa, sem depender de nenhum serviço
// externo.
//
// Nota sobre o Krisp da própria LiveKit (`@livekit/krisp-noise-filter`):
// não dá pra usar aqui porque (a) só funciona com LiveKit Cloud, e este
// projeto usa LiveKit self-hosted (ver ../../../livekit.yaml e
// ../../../docker-compose.yml), e (b) no navegador só é suportado no
// Safari >=17.4. O RNNoise via `@sapphi-red/web-noise-suppressor`
// funciona em qualquer navegador com AudioWorklet (todos os atuais) e
// roda inteiramente no cliente, sem exigir nenhum backend específico.
import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import type { Track } from 'livekit-client';
import type { AudioProcessorOptions, TrackProcessor } from 'livekit-client';

// O binário do WASM é sempre o mesmo — busca (e detecta suporte a SIMD)
// só uma vez por carregamento de página, mesmo entrando/saindo de vários
// canais de voz na mesma sessão.
let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;
function getWasmBinary(): Promise<ArrayBuffer> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseWasmSimdPath });
  }
  return wasmBinaryPromise;
}

/**
 * TrackProcessor (interface do livekit-client — ver
 * node_modules/livekit-client/.../track/processor/types.ts) que roda o
 * microfone cru através do RnnoiseWorkletNode antes de publicar.
 * Implementado na mão em vez de usar um pacote de processor pronto pra
 * não depender do Krisp (ver nota acima).
 */
export class NoiseSuppressionProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'neomeet-rnnoise';
  processedTrack?: MediaStreamTrack;

  // AudioContext DEDICADO (não o compartilhado pela Room) — o
  // RnnoiseWorkletNode assume 48kHz (ver doc do pacote), então força essa
  // taxa aqui em vez de depender do padrão do navegador/hardware (que às
  // vezes é 44.1kHz), o que causaria distorção de velocidade/tom.
  private context?: AudioContext;
  private sourceNode?: MediaStreamAudioSourceNode;
  private rnnoiseNode?: RnnoiseWorkletNode;
  private destinationNode?: MediaStreamAudioDestinationNode;

  async init(opts: AudioProcessorOptions) {
    await this.montarGrafo(opts.track);
  }

  // Chamado pelo próprio livekit-client quando a faixa crua muda (ex.:
  // troca de microfone) — reconstrói o grafo de áudio em cima da faixa
  // nova em vez de continuar processando a antiga.
  async restart(opts: AudioProcessorOptions) {
    await this.destruirGrafo();
    await this.montarGrafo(opts.track);
  }

  async destroy() {
    await this.destruirGrafo();
  }

  private async montarGrafo(rawTrack: MediaStreamTrack) {
    const context = new AudioContext({ sampleRate: 48000 });

    // Em navegadores mais restritivos (Safari/iOS) o AudioContext pode
    // nascer "suspended" até um gesto do usuário — como aqui já viemos de
    // um clique em "entrar no canal de voz", isso quase sempre resolve
    // de primeira; o listener abaixo é só uma rede de segurança pros
    // casos em que não resolve (mesmo padrão que o próprio livekit-client
    // usa pro AudioContext dele, ver getNewAudioContext em livekit-client).
    if (context.state === 'suspended') {
      void context.resume().catch(() => { });
      const tentarResumir = () => {
        if (context.state === 'suspended') void context.resume().catch(() => { });
        else document.removeEventListener('click', tentarResumir);
      };
      document.addEventListener('click', tentarResumir);
    }

    const wasmBinary = await getWasmBinary();
    await context.audioWorklet.addModule(rnnoiseWorkletPath);

    const sourceNode = context.createMediaStreamSource(new MediaStream([rawTrack]));
    const rnnoiseNode = new RnnoiseWorkletNode(context, { wasmBinary, maxChannels: 1 });
    const destinationNode = context.createMediaStreamDestination();
    sourceNode.connect(rnnoiseNode).connect(destinationNode);

    this.context = context;
    this.sourceNode = sourceNode;
    this.rnnoiseNode = rnnoiseNode;
    this.destinationNode = destinationNode;
    this.processedTrack = destinationNode.stream.getAudioTracks()[0];
  }

  private async destruirGrafo() {
    try { this.sourceNode?.disconnect(); } catch { /* já desconectado */ }
    try { this.rnnoiseNode?.disconnect(); } catch { /* já desconectado */ }
    try { this.rnnoiseNode?.destroy(); } catch { /* já destruído */ }
    try { this.destinationNode?.disconnect(); } catch { /* já desconectado */ }
    if (this.context) {
      try { await this.context.close(); } catch { /* já fechado */ }
    }
    this.sourceNode = undefined;
    this.rnnoiseNode = undefined;
    this.destinationNode = undefined;
    this.context = undefined;
    this.processedTrack = undefined;
  }
}