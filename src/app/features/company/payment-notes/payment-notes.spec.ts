// v1.0.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { PaginatedPaymentNoteList } from '../../../api/models/paginated-payment-note-list';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, answer, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  dialog,
  dialogCount,
  find,
  openScreen,
  pickFile,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';

// In the server's order: row order, then type.
const NOTES: PaginatedPaymentNoteList = {
  count: 3,
  results: [
    {
      id: 1,
      payment_type: 'ABA Bank',
      payment_info: 'Account 000 123 456\nSok Heng Mart Co., Ltd',
      image: '/media/payment_notes/aba.png',
      row_order: 1,
      is_active: true,
    },
    {
      id: 3,
      payment_type: 'Wing',
      payment_info: '012 345 678',
      image: null,
      row_order: 3,
      is_active: true,
    },
    {
      id: 2,
      payment_type: 'Cheque',
      payment_info: 'Payable to Sok Heng Mart Co., Ltd',
      image: null,
      row_order: 5,
      is_active: false,
    },
  ],
};

describe('Payment notes', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    harness = await openScreen(http, '/company/payment-notes', [
      { url: '/api/company/payment-notes/', body: NOTES },
    ]);
    page = harness.routeNativeElement!;
  });

  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const reloaded = async () => {
    await answer(http, '/api/company/payment-notes/', NOTES);
    await settle();
  };
  const editNote = async (index: number) => {
    page.querySelectorAll<HTMLButtonElement>('tbody .rowlink')[index].click();
    await settle();
    return dialog();
  };

  it('lists every note, hidden ones marked', () => {
    const rows = Array.from(page.querySelectorAll('tbody tr'), (tr) =>
      texts(tr, 'td')
        .slice(0, 5)
        .concat(tr.querySelector('img') ? 'image' : 'no image'),
    );
    expect(rows).toEqual([
      ['1', 'ABA Bank', 'Account 000 123 456 Sok Heng Mart Co., Ltd', '', 'Shown', 'image'],
      ['3', 'Wing', '012 345 678', '—', 'Shown', 'no image'],
      ['5', 'Cheque', 'Payable to Sok Heng Mart Co., Ltd', '—', 'Hidden', 'no image'],
    ]);
  });

  it('previews only the shown notes, in order, under the shop name', () => {
    const preview = find(page, '.print-preview');
    expect(find(preview, '.shop').textContent).toBe('Sok Heng Mart');
    expect(texts(preview, '.way b')).toEqual(['ABA Bank', 'Wing']);
    // The line break typed in the information is kept.
    expect(find(preview, '.way .keep-lines').textContent).toBe(
      'Account 000 123 456\nSok Heng Mart Co., Ltd',
    );
  });

  it('adds a note at the bottom of the order, as JSON when there is no image', async () => {
    press(page, 'Add note');
    await settle();
    const card = dialog();
    expect(find<HTMLInputElement>(card, '#note-order').value).toBe('6');
    type(card, '#note-type', 'Cash at the shop');
    type(card, '#note-info', 'Street 315 — open 07:00 to 21:00');
    press(card, 'Save note');

    const req = http.expectOne('/api/company/payment-notes/');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      payment_type: 'Cash at the shop',
      payment_info: 'Street 315 — open 07:00 to 21:00',
      row_order: 6,
      is_active: true,
    });
    req.flush({ id: 9, payment_type: 'Cash at the shop' });
    await reloaded();
    expect(dialogCount()).toBe(0);
  });

  it('sends a note with an image as multipart', async () => {
    press(page, 'Add note');
    await settle();
    const card = dialog();
    const qr = new File(['png'], 'wing-qr.png', { type: 'image/png' });
    type(card, '#note-type', 'Wing QR');
    pickFile(card, '#note-image', qr);
    press(card, 'Save note');

    const req = http.expectOne('/api/company/payment-notes/');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('image')).toBe(qr);
    expect(body.get('payment_type')).toBe('Wing QR');
    expect(body.get('is_active')).toBe('true');
    req.flush({ id: 9, payment_type: 'Wing QR', image: '/media/payment_notes/wing-qr.png' });
    await reloaded();
  });

  it('removes an image from a note with a null', async () => {
    const card = await editNote(0);
    expect(find(card, 'h3').textContent!.trim()).toBe('Edit ABA Bank');
    press(card, 'remove it');
    await settle();
    press(card, 'Save note');

    const req = http.expectOne('/api/company/payment-notes/1/');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(expect.objectContaining({ image: null }));
    req.flush({ ...NOTES.results[0], image: null });
    await reloaded();
  });

  it("shows the server's refusal in the dialog", async () => {
    press(page, 'Add note');
    await settle();
    const card = dialog();
    type(card, '#note-type', 'ABA Bank');
    press(card, 'Save note');
    http
      .expectOne('/api/company/payment-notes/')
      .flush(
        { payment_type: ['payment note with this payment type already exists.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(dialogCount()).toBe(1);
    expect(texts(find(card, '#note-type').closest('.field')!, '.hint.warn')).toEqual([
      'payment note with this payment type already exists.',
    ]);
  });

  it('asks before deleting, and does nothing when the user backs out', async () => {
    const card = await editNote(0);
    press(card, 'Delete');
    await settle();
    expect(dialogCount()).toBe(2);
    const confirm = dialog();
    expect(find(confirm, 'h3').textContent).toBe('Delete ABA Bank?');
    press(confirm, 'Cancel');
    await settle();

    expect(dialogCount()).toBe(1);
    // http.verify() in afterEach: no DELETE went out.
  });

  it('deletes once confirmed', async () => {
    const card = await editNote(1);
    press(card, 'Delete');
    await settle();
    press(dialog(), 'Delete note');

    const req = http.expectOne('/api/company/payment-notes/3/');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await reloaded();
    expect(dialogCount()).toBe(0);
  });
});
