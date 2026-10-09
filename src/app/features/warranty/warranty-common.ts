// v1.0.0 — a warranty claim's statuses, in the order an item moves through
// them, with the mockup's pill for each. Received, Sent for repair and Ready
// for collection are "open": the customer is still waiting.
import { ClaimStatusEnum } from '../../api/models/claim-status-enum';

export interface ClaimState {
  readonly value: ClaimStatusEnum;
  readonly label: string;
  readonly tone: 'credit' | 'low' | 'ok';
}

export const STATUSES: readonly ClaimState[] = [
  { value: 'RECEIVED', label: 'Received', tone: 'credit' },
  { value: 'SENT_FOR_REPAIR', label: 'Sent for repair', tone: 'low' },
  { value: 'READY', label: 'Ready for collection', tone: 'ok' },
  { value: 'CLOSED', label: 'Closed', tone: 'credit' },
  { value: 'REJECTED', label: 'Rejected', tone: 'low' },
];

export function stateOf(status: string | undefined): ClaimState {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0];
}
