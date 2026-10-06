// v1.0.0 — the words the screens show for the API's codes. The codes come
// from the backend's choices (partners/models.py); only the wording lives here.
import { CreditStatusEnum } from '../../api/models/credit-status-enum';
import { PriceTierEnum } from '../../api/models/price-tier-enum';
import { SupplierTypeEnum } from '../../api/models/supplier-type-enum';

export const PRICE_TIERS: readonly { value: PriceTierEnum; label: string }[] = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WHOLESALE', label: 'Wholesale' },
];

export const SUPPLIER_TYPES: readonly { value: SupplierTypeEnum; label: string }[] = [
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'IMPORTER', label: 'Importer' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'WHOLESALER', label: 'Wholesaler' },
  { value: 'SERVICE_CENTRE', label: 'Service centre' },
  { value: 'LOCAL_MARKET', label: 'Local market' },
];

export function tierLabel(tier: PriceTierEnum | undefined): string {
  return PRICE_TIERS.find((t) => t.value === tier)?.label ?? 'Retail';
}

export function supplierTypeLabel(type: SupplierTypeEnum): string {
  return SUPPLIER_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** The Credit column: the word and the pill colour. */
export function creditPill(status: CreditStatusEnum): { label: string; tone: 'ok' | 'low' } {
  if (status === 'YES') return { label: 'Yes', tone: 'ok' };
  if (status === 'HOLD') return { label: 'On hold', tone: 'low' };
  return { label: 'No', tone: 'low' };
}
