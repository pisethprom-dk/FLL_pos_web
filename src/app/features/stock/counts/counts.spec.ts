// v1.1.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, answer, answerShell, signIn } from '../../../core/session/session-testing';
import { today } from '../../../shared/dates';
import {
  APP_PROVIDERS,
  dialog,
  dialogCount,
  find,
  press,
  texts,
} from '../../../shared/screen-testing';
import { CATEGORIES, CATEGORY_URL, page } from '../../catalogue/catalogue-testing';
import { CNT_OPEN, CNT_POSTED, COUNT_URL, answerEach, chooseLabel, key } from '../stock-testing';

function listFor(req: TestRequest): object {
  const params = req.request.params;
  if (params.has('page')) return page([CNT_OPEN, CNT_POSTED]);
  if (params.get('status') === 'DRAFT') return page([CNT_OPEN]);
  return page([], 5);
}

describe('Stock count', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    const created = RouterTestingHarness.create('/stock/counts');
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await answerEach(http, COUNT_URL, listFor, 3, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const reloaded = () => answerEach(http, COUNT_URL, listFor, 3, seen);
  const box = (line: number) => find<HTMLInputElement>(dialog(), `#count-${line}`);

  /** Opens the count in progress, from its row. */
  async function openSheet(): Promise<HTMLElement> {
    find<HTMLButtonElement>(screen.querySelector('tbody tr')!, '.rowlink').click();
    await settle();
    return dialog();
  }

  /** Types into a line's box and leaves it, as the counter would. */
  function enter(line: number, value: string): void {
    box(line).value = value;
    box(line).dispatchEvent(new Event('change'));
  }

  it('lists counts with their progress, and differences once posted', async () => {
    await open();
    const list = seen.find((r) => r.request.params.has('page'))!;
    expect(list.request.params.get('date_from')).toBe(`${today().slice(0, 4)}-01-01`);
    const rows = Array.from(screen.querySelectorAll('tbody tr'), (tr) =>
      texts(tr, 'td').slice(0, 8),
    );
    expect(rows).toEqual([
      [
        'CNT-000005',
        '30 Sep 2026',
        'Hand tools → Wrenches',
        'Bopha Ly',
        '1 of 3',
        '—',
        '—',
        'Counting',
      ],
      [
        'CNT-000004',
        '29 Sep 2026',
        'Power tools → Drills',
        'Bopha Ly',
        '1 of 2',
        '1',
        '−$104.80',
        'Posted',
      ],
    ]);
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b, .sub'))).toEqual(
      [
        ['Posted this year', '5', 'Counts with their differences written'],
        ['In progress', '1', 'Hand tools → Wrenches · 1 of 3'],
      ],
    );
  });

  it('starts a count for a category and opens its sheet, blind', async () => {
    await open();
    press(screen, 'Start a count');
    await settle();
    chooseLabel(dialog(), '#count-category', '— Wrenches');
    press(dialog(), 'Start the count');
    const req = http.expectOne((r) => r.url === COUNT_URL && r.method === 'POST');
    expect(req.request.body).toEqual({ category: 4, doc_date: today(), note: '' });
    req.flush(CNT_OPEN);
    await reloaded();
    await settle();

    expect(dialogCount()).toBe(1);
    const card = dialog();
    expect(find(card, 'h3').textContent).toBe('Counting Hand tools → Wrenches');
    expect(texts(card, 'thead th')).toEqual(['Product', 'Shelf', 'Unit', 'Counted']);
    expect(find(card, '.progress').textContent!.trim()).toBe('1 of 3 counted');
    expect(box(71).value).toBe('42');
    expect(box(72).value).toBe('');
  });

  it("says why a count cannot start, in the server's words", async () => {
    await open();
    press(screen, 'Start a count');
    await settle();
    chooseLabel(dialog(), '#count-category', 'Hand tools');
    press(dialog(), 'Start the count');
    http
      .expectOne((r) => r.url === COUNT_URL && r.method === 'POST')
      .flush(
        {
          detail:
            'Some of these products are already on an open count: CNT-000005. Post or abandon it first.',
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(texts(dialog(), '.form-error')).toEqual([
      'Some of these products are already on an open count: CNT-000005. Post or abandon it first.',
    ]);
  });

  it('saves each line as it is entered, and a cleared one as not counted', async () => {
    await open();
    const card = await openSheet();
    enter(72, '60');
    const req = http.expectOne(`${COUNT_URL}5/record/`);
    expect(req.request.body).toEqual({ lines: [{ line: 72, counted_qty: '60' }] });
    req.flush(CNT_OPEN);
    await settle();
    expect(texts(box(72).closest('td')!, '.entry-state')).toEqual(['Saved']);
    expect(find(card, '.progress').textContent!.trim()).toBe('2 of 3 counted');

    enter(71, '');
    const cleared = http.expectOne(`${COUNT_URL}5/record/`);
    expect(cleared.request.body).toEqual({ lines: [{ line: 71, counted_qty: null }] });
    cleared.flush(CNT_OPEN);
    await settle();
    expect(find(card, '.progress').textContent!.trim()).toBe('1 of 3 counted');

    // Not a number: nothing is sent, and closing asks first.
    enter(73, 'ten');
    await settle();
    expect(texts(box(73).closest('td')!, '.entry-state')).toEqual([
      'A number, zero or more, up to two decimals.',
    ]);
    press(card, 'Close');
    await settle();
    expect(find(dialog(), '.confirm-message').textContent).toContain('Some counts were not saved');
    press(dialog(), 'Close anyway');
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('moves to the next line on Enter, and narrows the sheet', async () => {
    await open();
    const card = await openSheet();
    box(71).focus();
    key(box(71), 'Enter');
    expect(document.activeElement?.id).toBe('count-72');

    find<HTMLInputElement>(card, '.sheet-tools input[type=checkbox]').click();
    await settle();
    expect(texts(card, 'tbody td:first-child .cell-sub')).toEqual([
      'TL-0238',
      'Wrenches',
      'TL-0244',
      'Total · Wrenches',
    ]);
    const words = find<HTMLInputElement>(card, '.sheet-tools input[type=search]');
    words.value = 'b2';
    words.dispatchEvent(new Event('input'));
    await settle();
    expect(texts(card, 'tbody td:first-child .cell-sub')).toEqual(['TL-0244', 'Total · Wrenches']);
  });

  it('posts the differences once confirmed, then shows them', async () => {
    await open();
    const card = await openSheet();
    press(card, 'Post differences');
    await settle();
    expect(find(dialog(), '.confirm-message').textContent).toContain(
      '1 of 3 lines counted. The 2 left blank are skipped, not counted as zero.',
    );
    press(dialog(), 'Post differences');
    http.expectOne(`${COUNT_URL}5/post/`).flush({ ...CNT_POSTED, id: 5, number: 'CNT-000005' });
    await settle();

    expect(texts(card, 'thead th')).toEqual([
      'Product',
      'Shelf',
      'Counted',
      'Expected',
      'Difference',
      'Unit cost',
      'Value',
    ]);
    expect(texts(card, 'tbody td:first-child .cell-sub')).toEqual([
      'TL-0101',
      'Bosch · Drills',
      'TL-0103',
      'Bosch · Rotary hammers',
    ]);
    expect(Array.from(card.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td').slice(1))).toEqual(
      [
        ['A1-1', '12', '14', '−2', '$52.4000', '−$104.80'],
        ['A1-2', 'Not counted — skipped'],
      ],
    );
    expect(texts(card, 'tfoot td')).toEqual(['1 of 2 counted · 1 difference', '−$104.80']);
    press(card, 'Close');
    await reloaded();
    await settle();
  });

  it('abandons a count once confirmed', async () => {
    await open();
    const card = await openSheet();
    press(card, 'Abandon count');
    await settle();
    press(dialog(), 'Abandon count');
    const req = http.expectOne(`${COUNT_URL}5/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });
});
