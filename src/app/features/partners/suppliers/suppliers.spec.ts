// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../../api/models/me';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, SELLER, answerShell, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  choose,
  dialog,
  find,
  pickFile,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';
import { page } from '../../catalogue/catalogue-testing';
import { LIM_HENG, SUPPLIER_URL, TOTAL_TOOLS } from '../partners-testing';

describe('Suppliers', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function answerSuppliers(count: number): Promise<void> {
    let answered = 0;
    for (let tries = 0; tries < 200 && answered < count; tries++) {
      for (const req of http.match((r) => r.url === SUPPLIER_URL && r.method === 'GET')) {
        seen.push(req);
        req.flush(page([TOTAL_TOOLS, LIM_HENG]));
        answered++;
      }
      if (answered < count) await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (answered < count) throw new Error(`Expected ${count} supplier lists, got ${answered}`);
  }

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/partners/suppliers');
    await answerSuppliers(1);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const lastParams = () => seen.at(-1)!.request.params;

  it('lists suppliers with type, contact, Telegram and province', async () => {
    await open();
    const first = screen.querySelector('tbody tr')!;
    expect(texts(first, 'td').slice(0, 9)).toEqual([
      'SUP-000001',
      'Total Tools (Cambodia) Co., Ltd តូតាល់ ធូល',
      'Distributor',
      'Chan Sopheak',
      '010 888 121',
      '@totaltools_kh',
      'Phnom Penh',
      '1',
      'Active',
    ]);
    expect(find(first, 'img.thumb').getAttribute('src')).toBe('/media/suppliers/total.png');
    expect(screen.querySelector('.tiles')).toBeNull();
  });

  it('filters by type and status on the server', async () => {
    await open();
    choose(screen, 'select[aria-label="Type"]', 'SERVICE_CENTRE');
    await answerSuppliers(1);
    expect(lastParams().get('supplier_type')).toBe('SERVICE_CENTRE');
    expect(lastParams().get('active')).toBe('true');
    choose(screen, 'select[aria-label="Status"]', 'inactive');
    await answerSuppliers(1);
    expect(lastParams().get('active')).toBe('false');
  });

  it('asks for a type before sending anything', async () => {
    await open();
    press(screen, 'Add supplier');
    await settle();
    const card = dialog();
    type(card, '#s-name', 'Angkor Beverage Distribution');
    press(card, 'Save supplier');
    await settle();
    expect(texts(card, '.hint.warn')).toContain('Choose what kind of supplier this is.');
    press(card, 'Cancel');
    await settle();
  });

  it('adds a supplier with a logo, as multipart', async () => {
    await open();
    press(screen, 'Add supplier');
    await settle();
    const card = dialog();
    const logo = new File(['png'], 'angkor.png', { type: 'image/png' });
    type(card, '#s-name', 'Angkor Beverage Distribution');
    const typeSelect = find<HTMLSelectElement>(card, '#s-type');
    typeSelect.value = Array.from(typeSelect.options).find((o) => o.text === 'Distributor')!.value;
    typeSelect.dispatchEvent(new Event('change'));
    pickFile(card, '#s-logo', logo);
    press(card, 'Save supplier');

    const req = http.expectOne((r) => r.url === SUPPLIER_URL && r.method === 'POST');
    const body = req.request.body as FormData;
    expect(body.get('name')).toBe('Angkor Beverage Distribution');
    expect(body.get('supplier_type')).toBe('DISTRIBUTOR');
    expect(body.get('code')).toBe('');
    expect(body.get('logo')).toBe(logo);
    req.flush({ ...LIM_HENG, id: 3 });
    await answerSuppliers(1);
    await settle();
  });

  it('changes a supplier as JSON', async () => {
    await open();
    screen.querySelectorAll<HTMLButtonElement>('tbody .rowlink')[1].click();
    await settle();
    const card = dialog();
    type(card, '#s-telegram', '@limheng_import');
    press(card, 'Save supplier');

    const req = http.expectOne(`${SUPPLIER_URL}2/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(
      expect.objectContaining({ telegram: '@limheng_import', supplier_type: 'IMPORTER' }),
    );
    req.flush(LIM_HENG);
    await answerSuppliers(1);
    await settle();
  });

  it('lets a Seller read the list but change nothing', async () => {
    await open(SELLER);
    expect(screen.querySelector('.filters .btn')).toBeNull();
    expect(screen.querySelector('tbody .rowlink')).toBeNull();
  });
});
