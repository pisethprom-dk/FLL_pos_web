// v1.0.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, answer, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  choose,
  dialog,
  find,
  openScreen,
  pickFile,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';
import { CATEGORIES, CATEGORY_URL, page } from '../catalogue-testing';
import { asTree } from './categories';

describe('asTree', () => {
  it('puts each group before its own sub-categories', () => {
    expect(asTree(CATEGORIES).map((c) => c.code)).toEqual([
      'CAT-01',
      'CAT-0101',
      'CAT-02',
      'CAT-0201',
      'CAT-09',
    ]);
  });
});

describe('Categories', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    harness = await openScreen(http, '/catalogue/categories', [
      { url: CATEGORY_URL, body: page(CATEGORIES) },
    ]);
    screen = harness.routeNativeElement!;
  });

  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const codes = () => texts(screen, 'tbody tr td:first-child');
  const edit = async (code: string) => {
    const row = Array.from(screen.querySelectorAll('tbody tr')).find(
      (tr) => tr.querySelector('td')!.textContent!.trim() === code,
    )!;
    row.querySelector<HTMLButtonElement>('.rowlink')!.click();
    await settle();
    return dialog();
  };

  it('shows each group with its sub-categories indented under it', () => {
    expect(codes()).toEqual(['CAT-01', 'CAT-0101', 'CAT-02', 'CAT-0201', 'CAT-09']);
    const drills = screen.querySelectorAll('tbody tr')[1];
    expect(drills.querySelector('td.indent')!.textContent!.trim()).toBe('Drills');
    expect(texts(drills, 'td')[2]).toBe('Power tools');
  });

  it('shows top level only, or inactive only', async () => {
    choose(screen, 'select', 'top');
    await settle();
    expect(codes()).toEqual(['CAT-01', 'CAT-02', 'CAT-09']);
    choose(screen, 'select', 'inactive');
    await settle();
    expect(codes()).toEqual(['CAT-09']);
  });

  it('offers only active top-level categories as parents, never itself', async () => {
    const card = await edit('CAT-0101');
    const options = texts(card, '#cat-parent option');
    expect(options).toEqual(['— None (top level) —', 'Power tools', 'Hand tools']);
  });

  it('keeps a category with sub-categories at the top level', async () => {
    const card = await edit('CAT-01');
    expect(find<HTMLSelectElement>(card, '#cat-parent').disabled).toBe(true);
    expect(texts(card, '.field .hint')).toContain('It has sub-categories, so it stays top level.');
  });

  it('adds a sub-category', async () => {
    press(screen, 'Add category');
    await settle();
    const card = dialog();
    type(card, '#cat-code', 'CAT-0102');
    type(card, '#cat-name', 'Grinders');
    find<HTMLSelectElement>(card, '#cat-parent').selectedIndex = 1;
    find(card, '#cat-parent').dispatchEvent(new Event('change'));
    press(card, 'Save category');

    const req = http.expectOne(CATEGORY_URL);
    expect(req.request.body).toEqual(
      expect.objectContaining({ code: 'CAT-0102', name: 'Grinders', parent: 1 }),
    );
    req.flush({ id: 6 });
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await settle();
  });

  it('sends "no parent" as empty text when an image goes as multipart', async () => {
    press(screen, 'Add category');
    await settle();
    const card = dialog();
    const image = new File(['png'], 'fixings.png', { type: 'image/png' });
    type(card, '#cat-code', 'CAT-04');
    type(card, '#cat-name', 'Fixings');
    pickFile(card, '#cat-image', image);
    press(card, 'Save category');

    const req = http.expectOne(CATEGORY_URL);
    const body = req.request.body as FormData;
    // The client drops nulls from multipart; empty text reads as "none" on the server.
    expect(body.get('parent')).toBe('');
    expect(body.get('image')).toBe(image);
    req.flush({ id: 7 });
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await settle();
  });
});
