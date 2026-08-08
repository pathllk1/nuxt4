import { parseBoiPdf } from './parsers/boi.pdf';
import { parseBoiExcel } from './parsers/boi.excel';
import { parseSbiPdf } from './parsers/sbi.pdf';
import { parseSbiExcel } from './parsers/sbi.excel';
import { parseGenericPdf } from './parsers/generic.pdf';
import { parseGenericExcel } from './parsers/generic.excel';

export interface RawTransaction {
  date: string;
  narration: string;
  refNo?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

export interface ParserInput {
  buffer: Buffer;
  rawText?: string;
  password?: string;
}

export type ParserFn = (input: ParserInput) => Promise<RawTransaction[]>;

export type RegistryKey = `${string}:${'xlsx' | 'pdf'}`;

const registry = new Map<RegistryKey, ParserFn>([
  ['BOI:pdf', parseBoiPdf],
  ['BOI:xlsx', parseBoiExcel],
  ['SBI:pdf', parseSbiPdf],
  ['SBI:xlsx', parseSbiExcel],
  ['HDFC:pdf', parseGenericPdf],
  ['ICICI:pdf', parseGenericPdf],
  ['AXIS:pdf', parseGenericPdf]
]);

export function getParser(bankCode: string, fileType: 'xlsx' | 'pdf'): { parser: ParserFn; isFallback: boolean } {
  const key = `${bankCode}:${fileType}` as RegistryKey;
  const found = registry.get(key);

  if (found) {
    return { parser: found, isFallback: false };
  }

  const fallback = fileType === 'xlsx' ? parseGenericExcel : parseGenericPdf;
  return { parser: fallback, isFallback: true };
}
