// v1.2.0 — turns a refusal from the API into messages a screen can show.
//
// DRF sends one of: {"detail": "..."}, {"non_field_errors": [...]}, or
// {"<field>": [...]} per field. Screens show the server's own words. A
// document's lines come back as one entry per line — {} for a line that was
// fine — and are read as "Line 2: ...".
import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrors {
  /** About the request as a whole. */
  readonly form: string[];
  /** Per field, keyed by the API's field name. */
  readonly fields: Record<string, string[]>;
}

export function readApiErrors(error: unknown): ApiErrors {
  const out: ApiErrors = { form: [], fields: {} };
  // An Angular resource hands over a non-Error failure wrapped, with the
  // original as its cause.
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (!(error instanceof HttpErrorResponse) && cause instanceof HttpErrorResponse) error = cause;

  if (error instanceof HttpErrorResponse && error.status === 0) {
    out.form.push('Cannot reach the server. Check the connection and try again.');
    return out;
  }

  const body: unknown = error instanceof HttpErrorResponse ? error.error : null;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body)) {
      const messages = toMessages(value);
      if (messages.length === 0) continue;
      if (key === 'detail' || key === 'non_field_errors') out.form.push(...messages);
      else out.fields[key] = messages;
    }
  }

  if (out.form.length === 0 && Object.keys(out.fields).length === 0) {
    const status = error instanceof HttpErrorResponse ? ` (HTTP ${error.status})` : '';
    out.form.push(`Something went wrong${status}. Try again.`);
  }
  return out;
}

function toMessages(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      typeof item === 'string'
        ? [item]
        : item && typeof item === 'object'
          ? Object.values(item)
              .flatMap(toMessages)
              .map((message) => `Line ${i + 1}: ${message}`)
          : [],
    );
  }
  return [];
}
