// v1.0.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { DocumentCounter } from '../../../api/models/document-counter';
import { PaginatedDocumentCounterList } from '../../../api/models/paginated-document-counter-list';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  find,
  openScreen,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';

const counter = (
  id: number,
  doc_type: DocumentCounter['doc_type'],
  prefix: string,
  next: number,
): DocumentCounter => ({
  id,
  doc_type,
  prefix,
  next_number: next,
  next_value: prefix + String(next).padStart(6, '0'),
});

// The backend keeps ten counters; the screen shows two.
const COUNTERS: PaginatedDocumentCounterList = {
  count: 4,
  results: [
    counter(4, 'CUSTOMER', 'CUS-', 7),
    counter(2, 'INVOICE', 'INV-', 148),
    counter(3, 'PAYMENT', 'PAY-', 47),
    counter(1, 'QUOTATION', 'QUO-', 43),
  ],
};

describe('Rules & numbering', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    harness = await openScreen(http, '/company/numbering', [
      { url: '/api/company/numbering/', body: COUNTERS },
    ]);
    page = harness.routeNativeElement!;
  });

  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const nextNumbers = () => texts(page, '.field .hint b');

  it('shows the quotation and invoice prefixes only, with the next number of each', () => {
    expect(texts(page, '.field label')).toEqual(['Quotation prefix', 'Invoice prefix']);
    expect(find<HTMLInputElement>(page, '#prefix-QUOTATION').value).toBe('QUO-');
    expect(nextNumbers()).toEqual(['QUO-000043', 'INV-000148']);
  });

  it('previews the next number as the prefix is typed', async () => {
    type(page, '#prefix-INVOICE', 'SH-');
    await settle();
    expect(nextNumbers()).toEqual(['QUO-000043', 'SH-000148']);
  });

  it('saves only the prefix that changed', async () => {
    type(page, '#prefix-INVOICE', 'SH-INV-');
    press(page, 'Save changes');

    const req = http.expectOne('/api/company/numbering/2/');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ prefix: 'SH-INV-' });
    req.flush(counter(2, 'INVOICE', 'SH-INV-', 148));
    await settle();

    expect(texts(page, '.form-foot .saved')).toEqual(['Saved.']);
    expect(nextNumbers()).toEqual(['QUO-000043', 'SH-INV-000148']);
  });

  it('sends nothing when nothing changed', async () => {
    press(page, 'Save changes');
    await settle();
    expect(texts(page, '.form-foot .saved')).toEqual(['Saved.']);
    // http.verify() in afterEach: nothing was sent.
  });

  it('keeps a refused prefix as typed, with the reason, and saves the other', async () => {
    type(page, '#prefix-QUOTATION', 'Q-');
    type(page, '#prefix-INVOICE', 'I-');
    press(page, 'Save changes');

    http.expectOne('/api/company/numbering/1/').flush(counter(1, 'QUOTATION', 'Q-', 43));
    http
      .expectOne('/api/company/numbering/2/')
      .flush(
        { prefix: ['That prefix is not allowed.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(find<HTMLInputElement>(page, '#prefix-INVOICE').value).toBe('I-');
    expect(texts(find(page, '#prefix-INVOICE').closest('.field')!, '.hint.warn')).toEqual([
      'That prefix is not allowed.',
    ]);
    expect(nextNumbers()[0]).toBe('Q-000043');
    expect(page.querySelector('.form-foot .saved')).toBeNull();
  });

  it('needs a prefix of up to ten characters', async () => {
    type(page, '#prefix-QUOTATION', '');
    press(page, 'Save changes');
    await settle();
    expect(texts(page, '.hint.warn')).toEqual(['Enter a prefix of up to 10 characters.']);
  });

  it('Cancel puts back what was saved', async () => {
    type(page, '#prefix-QUOTATION', 'XX-');
    press(page, 'Cancel');
    await settle();
    expect(find<HTMLInputElement>(page, '#prefix-QUOTATION').value).toBe('QUO-');
    expect(nextNumbers()[0]).toBe('QUO-000043');
  });
});
