import { kr, type Lang, type Ore } from './money';

export interface Product {
  id: string;
  name: Record<Lang, string>;
  emoji: string;
  priceOre: Ore;
}

export const PRODUCTS: readonly Product[] = [
  { id: 'headphones', name: { sv: 'Trådlösa hörlurar', en: 'Wireless headphones' }, emoji: '🎧', priceOre: kr(2_490) },
  { id: 'coffee-machine', name: { sv: 'Espressomaskin', en: 'Espresso machine' }, emoji: '☕', priceOre: kr(4_490) },
  { id: 'bike', name: { sv: 'Stadscykel', en: 'City bike' }, emoji: '🚲', priceOre: kr(8_990) },
  { id: 'sofa', name: { sv: 'Soffa', en: 'Sofa' }, emoji: '🛋️', priceOre: kr(14_990) },
  { id: 'laptop', name: { sv: 'Laptop', en: 'Laptop' }, emoji: '💻', priceOre: kr(24_990) },
];

export const findProduct = (id: string): Product | undefined => PRODUCTS.find((p) => p.id === id);
