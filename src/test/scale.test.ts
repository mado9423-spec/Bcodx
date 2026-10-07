import { describe, expect, it } from 'vitest';
import { niceScale } from '../lib/scale';

describe('niceScale — تدريج محور الرسم', () => {
  it('يعطي أرقامًا مستديرة تغطي القيمة العظمى', () => {
    const s = niceScale(29081);
    expect(s.ticks).toEqual([0, 10000, 20000, 30000]);
    expect(s.max).toBe(30000);
  });
  it('خطوات 1 و2 و5 فقط عبر المقاييس المختلفة', () => {
    for (const m of [7, 95, 130, 4_200, 88_000, 1_250_000]) {
      const { ticks, max } = niceScale(m);
      const step = ticks[1]! - ticks[0]!;
      const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 5]).toContain(Math.round(mantissa * 1000) / 1000);
      expect(max).toBeGreaterThanOrEqual(m);
      expect(ticks[0]).toBe(0);
    }
  });
  it('قيم صفرية أو سالبة لا تكسر الرسم', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(-5).max).toBe(1);
  });
});
