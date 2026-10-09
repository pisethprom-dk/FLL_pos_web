// v1.0.0
import { importTemplate, templateCsv } from './import-template';

describe('import templates', () => {
  it('gives a stock-in every column the import reads, packs included', () => {
    expect(importTemplate('stock-in', true)).toEqual({
      fileName: 'stock-in-template.csv',
      columns: ['Product code', 'Product name', 'Quantity', 'Unit cost', 'Pack size', 'Pack unit'],
    });
  });

  it('gives an opening balance a cost column, and any other adjustment none', () => {
    expect(importTemplate('adjustment', true)).toEqual({
      fileName: 'opening-balance-template.csv',
      columns: ['Product code', 'Product name', 'Quantity', 'Unit cost'],
    });
    expect(importTemplate('adjustment', false)).toEqual({
      fileName: 'adjustment-template.csv',
      columns: ['Product code', 'Product name', 'Quantity'],
    });
  });

  it('writes the header row alone, after a UTF-8 mark for Excel', () => {
    expect(templateCsv(importTemplate('adjustment', true))).toBe(
      '﻿Product code,Product name,Quantity,Unit cost\r\n',
    );
  });
});
