// v1.0.0 — the CSV a user downloads from "Import a list" to start from: the
// header row the backend's import reads, for the document being filled.
// The backend matches headers loosely (inventory/imports.py: lower case,
// spaces to "_"), so readable names work. Column names only (owner's choice,
// 2026-10-06): nothing in the file can be imported by mistake. "Product name"
// is not read by the import — it is there for whoever fills the sheet in.

export interface ImportTemplate {
  readonly fileName: string;
  /** The header row. */
  readonly columns: readonly string[];
}

export function importTemplate(
  kind: 'stock-in' | 'adjustment',
  needsCost: boolean,
): ImportTemplate {
  if (kind === 'stock-in') {
    return {
      fileName: 'stock-in-template.csv',
      columns: ['Product code', 'Product name', 'Quantity', 'Unit cost', 'Pack size', 'Pack unit'],
    };
  }
  if (needsCost) {
    return {
      fileName: 'opening-balance-template.csv',
      columns: ['Product code', 'Product name', 'Quantity', 'Unit cost'],
    };
  }
  return {
    fileName: 'adjustment-template.csv',
    columns: ['Product code', 'Product name', 'Quantity'],
  };
}

/**
 * The file's text: a UTF-8 mark, so Excel keeps Khmer names typed into it
 * (the backend reads the mark and drops it), then the header row.
 */
export function templateCsv(template: ImportTemplate): string {
  return `﻿${template.columns.join(',')}\r\n`;
}
