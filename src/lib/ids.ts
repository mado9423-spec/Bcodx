export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 20);
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * رقم طلب مقروء وآمن للعمل دون إنترنت: لا يحتاج عدّادًا مركزيًا (الذي يتعارض مع المزامنة
 * بعد العمل دون اتصال)، ويُظهر التاريخ ليسهل على المندوب والعميل الرجوع إليه.
 */
export function newOrderNo(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rand}`;
}
