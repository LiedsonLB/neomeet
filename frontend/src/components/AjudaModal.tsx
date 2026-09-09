// components/AjudaModal.tsx
//
// Modal de apoio/doação ("Ajude no café do dev ☕"), aberto pelo botão de
// ajuda no AppShell (rail lateral no desktop, bottom nav no mobile).
//
// Os três valores abaixo são placeholders — troque pelos seus reais
// quando quiser, sem precisar mexer em mais nada:
//  - CHAVE_PIX: sua chave Pix (copiar-e-colar) mostrada embaixo do QR.
//  - QR_CODE_SRC: imagem do QR Code (troque o arquivo em
//    frontend/public/ajuda-cafe-qrcode.svg, ou aponte pra outra URL/PNG).
//  - IMAGEM_LATERAL_SRC: a imagem ilustrativa ao lado do QR (troque o
//    arquivo em frontend/public/ajuda-cafe-imagem.svg).
import { useState } from 'react';
import { X, Coffee, Copy, Check } from 'lucide-react';

const CHAVE_PIX = 'liedson.b9@gmail.com';
const IMAGEM_LATERAL_SRC = '/ajuda-cafe-imagem.png';

interface Props {
  onClose: () => void;
}

export default function AjudaModal({ onClose }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function copiarChave() {
    try {
      await navigator.clipboard.writeText(CHAVE_PIX);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard indisponível (ex.: sem HTTPS) — a pessoa copia manualmente.
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee size={18} className="text-amber" />
            <h2 className="text-lg font-bold text-on-surface">Ajude no café do dev</h2>
          </div>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose}><X size={18} /></button>
        </div>

        <p className="mb-4 text-sm text-on-surface-variant">
          Se o Resenha te ajuda no dia a dia, considere pagar um café.
          qualquer valor ajuda a manter o projeto no ar.
        </p>

        <div className="flex flex-col items-center justify-around gap-4 sm:flex-row sm:items-start py-4">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020126580014BR.GOV.BCB.PIX013642506c64-02fb-4bc7-8ce1-b14fc42f636d5204000053039865802BR5924Francisco Liedson Bonfim6009SAO PAULO62140510pJrXCN5Zg46304F4A6"
              alt="QR Code Pix"
              style={{ width: 200, height: 200, paddingBottom: 8 }}
            />
            <button
              onClick={copiarChave}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              title="Copiar chave Pix"
            >
              {copiado ? <Check size={13} className="text-tertiary" /> : <Copy size={13} />}
              <span className="max-w-[160px] truncate">{copiado ? 'Copiado!' : CHAVE_PIX}</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center h-full max-w-[250px] gap-2 text-center sm:text-left">
            <img
              src={IMAGEM_LATERAL_SRC}
              alt=""
              className="h-28 rounded-xl object-cover mb-2"
            />
            <p className="text-xs text-center text-on-surface-variant">
              Escaneie o QR Code com o app do seu banco ou copie a chave Pix acima. Obrigado pelo apoio! 💜
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
