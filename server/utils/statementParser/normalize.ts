import crypto from 'node:crypto';
import type { RawTransaction } from './registry';

export type SourceFileType = 'xlsx' | 'pdf' | 'html-xls' | 'xls-legacy';

export interface NormalizedTransaction {
  date: string;
  rawNarration: string;
  cleanedNarration?: string;
  refNo?: string;
  debit: number;
  credit: number;
  balance?: number;
  bankCode: string;
  sourceFileType: SourceFileType;
  unverified: boolean;
  rowHash: string;
  isDuplicate?: boolean;
  balanceMismatch?: boolean;
  suggestedAccountHead?: string;
}

export function normalize(
  rawList: RawTransaction[],
  bankCode: string,
  sourceFileType: SourceFileType,
  unverified: boolean
): NormalizedTransaction[] {
  return rawList.map(r => {
    const isoDate = parseIndianDate(r.date);
    const debit = r.debit || 0;
    const credit = r.credit || 0;
    const rowHash = computeRowHash(isoDate, r.narration, debit, credit);

    return {
      date: isoDate,
      rawNarration: r.narration,
      refNo: r.refNo || '',
      debit,
      credit,
      balance: r.balance,
      bankCode,
      sourceFileType,
      unverified,
      rowHash
    };
  });
}

export function parseIndianDate(input: string): string {
  if (!input) return new Date().toISOString().split('T')[0];

  const cleaned = input.trim();

  // 1. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const numMatch = cleaned.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // 2. DD-MMM-YYYY (e.g. 02-APR-2026 or 02 APR 2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const textMatch = cleaned.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[-/. ](\d{2,4})$/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const mStr = textMatch[2].toLowerCase();
    const month = monthMap[mStr] || '01';
    let year = textMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}

  return new Date().toISOString().split('T')[0];
}

export function computeRowHash(date: string, narration: string, debit: number, credit: number): string {
  const payload = `${date}|${narration.trim()}|${debit}|${credit}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
}
