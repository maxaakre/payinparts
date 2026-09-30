/** All money is integer öre (1 kr = 100 öre). */
export type Ore = number;

export type Lang = 'sv' | 'en';

export const kr = (amount: number): Ore => Math.round(amount * 100);

export function formatKr(ore: Ore, lang: Lang = 'sv'): string {
  const hasOre = ore % 100 !== 0;
  return new Intl.NumberFormat(lang === 'sv' ? 'sv-SE' : 'en-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(ore / 100);
}
