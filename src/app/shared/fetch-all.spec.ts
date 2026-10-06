// v1.0.0
import { firstValueFrom, of } from 'rxjs';
import { fetchAll } from './fetch-all';

describe('fetchAll', () => {
  it('reads every page while the server says there is a next one', async () => {
    const asked: number[] = [];
    const pages = [
      { results: ['a', 'b'], next: '/api/x/?page=2' },
      { results: ['c', 'd'], next: '/api/x/?page=3' },
      { results: ['e'], next: null },
    ];
    const all = await firstValueFrom(
      fetchAll((page) => {
        asked.push(page);
        return of(pages[page - 1]);
      }),
    );
    expect(all).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(asked).toEqual([1, 2, 3]);
  });

  it('stops after one page when there is no next', async () => {
    const all = await firstValueFrom(fetchAll(() => of({ results: [1, 2], next: null })));
    expect(all).toEqual([1, 2]);
  });
});
