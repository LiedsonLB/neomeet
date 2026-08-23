// Componente de badge para o administrador (liedson.b9@gmail.com)
import { ShieldCheck } from 'lucide-react';

interface Props {
  email?: string | null;
  size?: 'sm' | 'md';
}

const ADM_EMAIL = 'liedson.b9@gmail.com';

export function isAdm(email?: string | null): boolean {
  return email === ADM_EMAIL;
}

export default function AdmBadge({ email, size = 'sm' }: Props) {
  if (!isAdm(email)) return null;
  return size === 'md' ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
      <ShieldCheck size={11} /> ADM
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
      <ShieldCheck size={9} /> ADM
    </span>
  );
}
