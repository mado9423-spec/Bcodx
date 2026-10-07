/** تدريج «نظيف»: خطوات 1 / 2 / 5 × 10^k بحيث تكون الأرقام على محور الرسم مستديرة (0، 10K، 20K …) */
export function niceScale(maxValue: number, target = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 1, ticks: [0, 1] };
  const raw = maxValue / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(maxValue / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step * 1e-6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks };
}
