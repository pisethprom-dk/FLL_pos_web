// v1.0.0 — for the catalogue specs: a small catalogue as the API returns it.
import { Brand } from '../../api/models/brand';
import { Category } from '../../api/models/category';
import { Product } from '../../api/models/product';
import { Unit } from '../../api/models/unit';

export const CATEGORY_URL = '/api/catalogue/categories/';
export const BRAND_URL = '/api/catalogue/brands/';
export const UNIT_URL = '/api/catalogue/units/';
export const PRODUCT_URL = '/api/catalogue/products/';

const top = (id: number, code: string, name: string, extra: Partial<Category> = {}): Category => ({
  id,
  code,
  name,
  full_name: name,
  parent: null,
  parent_name: null,
  display_order: id,
  is_active: true,
  ...extra,
});

const sub = (id: number, code: string, name: string, parent: Category): Category => ({
  id,
  code,
  name,
  full_name: `${parent.name} → ${name}`,
  parent: parent.id,
  parent_name: parent.name,
  display_order: id,
  is_active: true,
});

const POWER = top(1, 'CAT-01', 'Power tools', { name_kh: 'ឧបករណ៍អគ្គិសនី' });
const HAND = top(3, 'CAT-02', 'Hand tools');

/** Deliberately out of tree order: screens put each group before its sub-categories. */
export const CATEGORIES: Category[] = [
  POWER,
  HAND,
  sub(4, 'CAT-0201', 'Wrenches', HAND),
  sub(2, 'CAT-0101', 'Drills', POWER),
  top(5, 'CAT-09', 'Old stock', { is_active: false }),
];

export const BRANDS: Brand[] = [
  { id: 1, name: 'Bosch', country: 'Germany', display_order: 1, is_active: true },
  {
    id: 2,
    name: 'Makita',
    name_kh: 'ម៉ាគីតា',
    country: 'Japan',
    logo: '/media/brands/makita.png',
    display_order: 2,
    is_active: true,
  },
  { id: 3, name: 'Gone Tools', display_order: 9, is_active: false },
];

export const UNITS: Unit[] = [
  { id: 1, code: 'PCS', name: 'Piece', name_kh: 'ដុំ', display_order: 1, is_active: true },
  { id: 2, code: 'SET', name: 'Set', display_order: 2, is_active: true },
  { id: 3, code: 'HR', name: 'Hour', display_order: 9, is_active: false },
];

export function page<T>(results: T[], count = results.length) {
  return { count, next: null, previous: null, results };
}

const product = (p: Partial<Product> & Pick<Product, 'id' | 'code' | 'name'>): Product => ({
  category: 2,
  category_name: 'Power tools → Drills',
  brand: 1,
  brand_name: 'Bosch',
  unit: 1,
  unit_name: 'Piece',
  qty_on_hand: '0.00',
  avg_cost: '0.0000',
  stock_value: '0.00',
  retail_price: '0.00',
  wholesale_price: '0.00',
  reorder_level: '0.00',
  reorder_qty: '0.00',
  track_stock: true,
  is_active: true,
  needs_reorder: false,
  is_out_of_stock: false,
  ...p,
});

export const DRILL = product({
  id: 11,
  code: 'TL-0101',
  name: 'Impact drill 13mm 710W',
  model_no: 'GSB 550',
  warranty_months: 12,
  qty_on_hand: '14.00',
  avg_cost: '52.4000',
  retail_price: '78.00',
  wholesale_price: '69.00',
  reorder_level: '6.00',
  reorder_qty: '12.00',
  shelf_location: 'A1-1',
});

export const GRINDER = product({
  id: 12,
  code: 'TL-0118',
  name: 'Angle grinder 100mm 570W',
  brand: 2,
  brand_name: 'Makita',
  qty_on_hand: '3.00',
  avg_cost: '38.9000',
  retail_price: '59.00',
  wholesale_price: '52.00',
  reorder_level: '8.00',
  needs_reorder: true,
});

export const KEY_CUTTING = product({
  id: 13,
  code: 'SV-0001',
  name: 'Key cutting',
  brand: null,
  brand_name: null,
  category: 5,
  category_name: 'Old stock',
  track_stock: false,
  retail_price: '1.50',
  wholesale_price: '1.50',
});
