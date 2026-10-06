// v1.2.0
import { HttpErrorResponse } from '@angular/common/http';
import { readApiErrors } from './api-errors';

const refusal = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('readApiErrors', () => {
  it('puts detail and non_field_errors on the form', () => {
    expect(
      readApiErrors(refusal(400, { non_field_errors: ['Username or password is not correct.'] })),
    ).toEqual({ form: ['Username or password is not correct.'], fields: {} });
    expect(readApiErrors(refusal(403, { detail: 'Your role does not allow this.' })).form).toEqual([
      'Your role does not allow this.',
    ]);
  });

  it('keeps field messages by field name', () => {
    const errors = readApiErrors(
      refusal(400, {
        new_password: ['This password is too short.', 'This password is too common.'],
      }),
    );
    expect(errors.form).toEqual([]);
    expect(errors.fields['new_password']).toEqual([
      'This password is too short.',
      'This password is too common.',
    ]);
  });

  it("reads a document's line refusals as numbered lines", () => {
    const errors = readApiErrors(
      refusal(400, {
        lines: [{}, { packs: ['Ensure this value is greater than or equal to 0.01.'] }],
        supplier: ['Lim Heng Import Export is inactive.'],
      }),
    );
    expect(errors.fields['lines']).toEqual([
      'Line 2: Ensure this value is greater than or equal to 0.01.',
    ]);
    expect(errors.fields['supplier']).toEqual(['Lim Heng Import Export is inactive.']);
    expect(readApiErrors(refusal(400, { lines: ['TL-0101 is listed twice.'] })).fields).toEqual({
      lines: ['TL-0101 is listed twice.'],
    });
  });

  it('says so when the server cannot be reached', () => {
    expect(readApiErrors(refusal(0, null)).form[0]).toContain('Cannot reach the server');
  });

  it('falls back to a general message with the status', () => {
    expect(readApiErrors(refusal(500, '<html>…</html>')).form).toEqual([
      'Something went wrong (HTTP 500). Try again.',
    ]);
    expect(readApiErrors(new Error('boom')).form).toEqual(['Something went wrong. Try again.']);
  });

  it('reads the refusal inside an error an Angular resource wrapped', () => {
    const wrapped = new Error('Resource is currently in an error state', {
      cause: refusal(503, { detail: 'Server is down for upkeep.' }),
    });
    expect(readApiErrors(wrapped).form).toEqual(['Server is down for upkeep.']);
  });
});
