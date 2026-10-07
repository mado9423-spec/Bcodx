export const PALETTE = ['#6d4aff', '#00b8a9', '#ff7a59', '#f5b50a', '#3b82f6', '#ec4899', '#12b76a', '#8b5cf6', '#06b6d4', '#ef4444'];

export function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
