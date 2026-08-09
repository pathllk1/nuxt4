import { parseBoiPdf } from './parsers/boi.pdf';
import { parseBoiExcel } from './parsers/boi.excel';
import { parseSbiPdf } from './parsers/sbi.pdf';
import { parseSbiExcel } from './parsers/sbi.excel';
import { parseHdfcPdf } from './parsers/hdfc.pdf';
import { parseHdfcExcel } from './parsers/hdfc.excel';
import { parseIciciPdf } from './parsers/icici.pdf';
import { parseIciciExcel } from './parsers/icici.excel';
import { parseAxisPdf } from './parsers/axis.pdf';
import { parseAxisExcel } from './parsers/axis.excel';
import { parsePnbPdf } from './parsers/pnb.pdf';
import { parsePnbExcel } from './parsers/pnb.excel';
import { parseUbiPdf } from './parsers/ubi.pdf';
import { parseUbiExcel } from './parsers/ubi.excel';
import { parseBobPdf } from './parsers/bob.pdf';
import { parseBobExcel } from './parsers/bob.excel';
import { parseKotakPdf } from './parsers/kotak.pdf';
import { parseKotakExcel } from './parsers/kotak.excel';
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
  ['HDFC:pdf', parseHdfcPdf],
  ['HDFC:xlsx', parseHdfcExcel],
  ['ICICI:pdf', parseIciciPdf],
  ['ICICI:xlsx', parseIciciExcel],
  ['AXIS:pdf', parseAxisPdf],
  ['AXIS:xlsx', parseAxisExcel],
  ['PNB:pdf', parsePnbPdf],
  ['PNB:xlsx', parsePnbExcel],
  ['UBI:pdf', parseUbiPdf],
  ['UBI:xlsx', parseUbiExcel],
  ['BOB:pdf', parseBobPdf],
  ['BOB:xlsx', parseBobExcel],
  ['KOTAK:pdf', parseKotakPdf],
  ['KOTAK:xlsx', parseKotakExcel]
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
