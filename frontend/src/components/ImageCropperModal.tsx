// components/ImageCropperModal.tsx
//
// Modal genérico de "corte" de imagem — usado tanto pro avatar (aspecto
// 1:1, preview redondo) quanto pro banner (aspecto 3:1) do EditarPerfilModal.
// Sem lib externa: desenha a imagem num <canvas>, permite arrastar (pan) e
// dar zoom (slider/scroll), e ao confirmar recorta exatamente a área
// visível pro tamanho de saída pedido, devolvendo um File pronto pra subir
// pro upload_handler.go existente.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';

interface ImageCropperModalProps {
  /** Imagem original (dataURL ou blob URL) a ser recortada. */
  src: string;
  /** 'avatar' usa aspecto 1:1 e preview redondo; 'banner' usa 3:1. */
  variant: 'avatar' | 'banner';
  /** Nome de arquivo a usar no File gerado. */
  fileName: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const OUTPUT = {
  avatar: { w: 512, h: 512 },
  banner: { w: 1200, h: 400 },
};

export default function ImageCropperModal({ src, variant, fileName, onCancel, onConfirm }: ImageCropperModalProps) {
  const aspect = variant === 'avatar' ? 1 : 3;
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Frame de recorte: largura fixa (limitada pela viewport), altura pelo aspecto.
  const [frameSize, setFrameSize] = useState({ w: 320, h: 320 });

  useEffect(() => {
    const w = Math.min(360, typeof window !== 'undefined' ? window.innerWidth - 64 : 360);
    setFrameSize({ w, h: Math.round(w / aspect) });
  }, [aspect]);

  // Carrega a imagem e calcula o zoom mínimo (que cobre 100% do frame).
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const coverZoom = Math.max(frameSize.w / img.width, frameSize.h / img.height);
      setMinZoom(coverZoom);
      setZoom(coverZoom);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = src;
    return () => { imgRef.current = null; setImgLoaded(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, frameSize.w, frameSize.h]);

  const clampOffset = useCallback((ox: number, oy: number, z: number) => {
    const img = imgRef.current;
    if (!img) return { x: ox, y: oy };
    const w = img.width * z;
    const h = img.height * z;
    const maxX = Math.max(0, (w - frameSize.w) / 2);
    const maxY = Math.max(0, (h - frameSize.h) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, ox)), y: Math.min(maxY, Math.max(-maxY, oy)) };
  }, [frameSize]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(clampOffset(dragState.current.origX + dx, dragState.current.origY + dy, zoom));
  };
  const onPointerUp = () => { dragState.current = null; };

  const handleZoom = (novoZoom: number) => {
    const z = Math.min(minZoom * 4, Math.max(minZoom, novoZoom));
    setZoom(z);
    setOffset(prev => clampOffset(prev.x, prev.y, z));
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(zoom - e.deltaY * 0.001 * zoom);
  };

  const confirmar = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setSalvando(true);

    const out = OUTPUT[variant];
    canvas.width = out.w;
    canvas.height = out.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setSalvando(false); return; }

    // Escala do frame visível (px na tela) para o canvas de saída.
    const scaleToOutput = out.w / frameSize.w;
    const drawW = img.width * zoom * scaleToOutput;
    const drawH = img.height * zoom * scaleToOutput;
    const cx = out.w / 2 + offset.x * scaleToOutput;
    const cy = out.h / 2 + offset.y * scaleToOutput;

    ctx.clearRect(0, 0, out.w, out.h);
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

    canvas.toBlob(blob => {
      setSalvando(false);
      if (!blob) return;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      onConfirm(file);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-high p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-on-surface">
            {variant === 'avatar' ? 'Ajustar avatar' : 'Ajustar banner'}
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest">
            <X size={18} />
          </button>
        </div>

        <div
          ref={frameRef}
          className={`relative mx-auto touch-none select-none overflow-hidden bg-black ${variant === 'avatar' ? 'rounded-full' : 'rounded-xl'}`}
          style={{ width: frameSize.w, height: frameSize.h, cursor: dragState.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
        >
          {imgLoaded && imgRef.current && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{
                width: imgRef.current.width * zoom,
                height: imgRef.current.height * zoom,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        {/* Zoom */}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => handleZoom(zoom / 1.15)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest">
            <Minus size={16} />
          </button>
          <input
            type="range"
            min={minZoom}
            max={minZoom * 4}
            step={(minZoom * 4 - minZoom) / 100 || 0.01}
            value={zoom}
            onChange={e => handleZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <button type="button" onClick={() => handleZoom(zoom * 1.15)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest">
            <Plus size={16} />
          </button>
        </div>
        <p className="mt-1 text-center text-[11px] text-on-surface-variant">Arraste pra posicionar · role/zoom pra ajustar o tamanho</p>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-highest">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={!imgLoaded || salvando} className="btn-primary flex items-center gap-2 px-5 py-2 text-sm">
            <Check size={16} /> {salvando ? 'Aplicando…' : 'Aplicar corte'}
          </button>
        </div>
      </div>
    </div>
  );
}
