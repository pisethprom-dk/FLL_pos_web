// v1.0.0 — for the Warranty claims spec: claims as the API returns them, in
// the mockup's examples.
import { WarrantyClaim } from '../../api/models/warranty-claim';

export const CLAIM_URL = '/api/warranty/claims/';

const claim = (
  c: Partial<WarrantyClaim> & Pick<WarrantyClaim, 'id' | 'warranty_number' | 'product_name'>,
): WarrantyClaim => ({
  product_code: '',
  warranty_months: 12,
  expiry_date: null,
  customer_name: '',
  customer_phone: '',
  note: '',
  status: 'RECEIVED',
  out_of_warranty: false,
  created_at: '2026-09-30T02:00:00Z',
  logged_by_name: 'Sokha Chan',
  updated_at: '2026-09-30T02:00:00Z',
  changed_by_name: null,
  ...c,
});

export const DRILL_CLAIM = claim({
  id: 148,
  warranty_number: 'WR-2026-0148',
  product_code: 'TL-0101',
  product_name: 'Impact drill 13mm 710W',
  expiry_date: '2027-09-30',
  customer_name: 'Sok Shop',
  customer_phone: '012 330 441',
  note: 'Will not start. Customer called 30 Sep.',
});

/** Moved along since by an Admin. */
export const GRINDER_CLAIM = claim({
  id: 121,
  warranty_number: 'WR-2026-0121',
  product_code: 'TL-0118',
  product_name: 'Angle grinder 100mm 570W',
  warranty_months: 6,
  expiry_date: '2027-03-18',
  note: 'Sparks from motor. Sent to Makita 22 Sep, job MSC-7741.',
  status: 'SENT_FOR_REPAIR',
  created_at: '2026-09-22T02:00:00Z',
  updated_at: '2026-10-01T03:00:00Z',
  changed_by_name: 'Bopha Ly',
});

/** Claimed after its warranty ended in July. */
export const DRIVER_CLAIM = claim({
  id: 41,
  warranty_number: 'WR-2026-0041',
  product_code: 'TL-0150',
  product_name: 'Cordless driver 12V',
  expiry_date: '2026-07-12',
  customer_name: 'Dara',
  customer_phone: '097 555 120',
  note: 'Out of warranty. Customer agreed to pay $18.00 for the repair.',
  status: 'READY',
  out_of_warranty: true,
  created_at: '2026-09-10T02:00:00Z',
});
