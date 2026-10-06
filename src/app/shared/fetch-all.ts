// v1.0.0 — every page of a paginated list. For the small reference lists
// (categories, brands, units) that a dropdown must show in full: the API
// pages at 50, and a list that silently stops there would hide choices.
import { EMPTY, Observable, expand, reduce } from 'rxjs';

export interface Page<T> {
  readonly results: T[];
  readonly next?: string | null;
}

/** Calls `load(1)`, `load(2)`, … while the server says there is a next page. */
export function fetchAll<T>(load: (page: number) => Observable<Page<T>>): Observable<T[]> {
  let page = 1;
  return load(page).pipe(
    expand((res) => (res.next ? load(++page) : EMPTY)),
    reduce((all, res) => all.concat(res.results), [] as T[]),
  );
}
