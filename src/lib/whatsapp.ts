import { toLatinDigits } from './format';

/** يحوّل أي صيغة محلية للجوال إلى صيغة دولية مناسبة لـ wa.me */
export function normalizePhone(raw: string, dialCode: string): string {
  let d = toLatinDigits(raw).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = dialCode + d.slice(1);
  else if (!d.startsWith(dialCode)) d = dialCode + d;
  return d;
}

export function waLink(phone: string, dialCode: string, text: string): string {
  const p = normalizePhone(phone, dialCode);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(phone: string, dialCode: string, text: string) {
  window.open(waLink(phone, dialCode, text), '_blank', 'noopener,noreferrer');
}
