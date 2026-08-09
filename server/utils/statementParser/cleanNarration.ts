export function cleanNarration(rawNarration: string, bankCode?: string): string {
  if (!rawNarration) return '';

  let text = rawNarration;

  // 1. Shared universal cleanup
  text = stripCommonNoise(text);

  // 2. Bank-specific narration quirks
  if (bankCode && bankNarrationCleaners[bankCode]) {
    text = bankNarrationCleaners[bankCode](text);
  }

  return text.trim();
}

function stripCommonNoise(text: string): string {
  let cleaned = text;

  // Remove NEFT/RTGS/IMPS/UPI/TRANSFER prefix noise
  cleaned = cleaned.replace(/^(IBNEFT|IBRTGS|StUBP|StCon|NEFT|RTGS|IMPS|UPI|BY CASH|TO TR|TRF TO|TRF FROM|TRANSFER TO|TRANSFER FROM|MB\/|CMS\/|POS\s+)\b/gi, '');
  cleaned = cleaned.replace(/^[\/\-:\s]+/, '');

  // Remove long UTR / RRN / IMPS Reference numbers (22-char UTRs, 12-digit RRNs, IFSC refs)
  cleaned = cleaned.replace(/\/([A-Z0-9]{12,22})\b/gi, '');
  cleaned = cleaned.replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, ''); // IFSC Codes
  cleaned = cleaned.replace(/\b[A-Z]{4}[0-9]{8,14}\b/gi, '');
  cleaned = cleaned.replace(/\b\d{12,18}\b/g, ''); // Long 12-18 digit standalone reference numbers

  // Clean UPI Handles (keep counterparty name before @)
  cleaned = cleaned.replace(/@\w+/gi, '');

  // Remove SOL-ID lines or location metadata blocks
  cleaned = cleaned.replace(/SOL-ID\s+\d+.*$/gi, '');
  cleaned = cleaned.replace(/MUMBAI\s*\([^)]*\)/gi, '');

  // Strip bank charge prefixes
  cleaned = cleaned.replace(/^Charges\s*:\s*/gi, '');
  cleaned = cleaned.replace(/^Int\.Coll\s*:\s*/gi, '');
  cleaned = cleaned.replace(/^CONSOLIDATED CHARGES\b/gi, 'Bank Charges');

  // Strip slash delimiters and extra spaces
  cleaned = cleaned.replace(/[\/\-_]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

const bankNarrationCleaners: Record<string, (t: string) => string> = {
  HDFC: (t) => t.replace(/\/INF\/[A-Z0-9]+/gi, '').replace(/\bINF\b/gi, '').replace(/\bN\d{6,14}\b/gi, ''),
  ICICI: (t) => t.replace(/-TXT-[A-Z0-9]+/gi, '').replace(/MMT\/IMPS\/\d+/gi, '').replace(/INB\/[A-Z0-9]+/gi, ''),
  SBI: (t) => t.replace(/^TRANSFER FROM\s+/gi, '').replace(/^TRANSFER TO\s+/gi, '').replace(/\bCHEQUE TRANSFER\b/gi, ''),
  AXIS: (t) => t.replace(/^AXIS\s+BANK\s+/gi, '').replace(/\/AUTOSWEEP\b/gi, ''),
  PNB: (t) => t.replace(/PUNB\d+/gi, '').replace(/^UPI\/CR\//gi, '').replace(/^UPI\/DR\//gi, ''),
  UBI: (t) => t.replace(/UBIN\d+/gi, '').replace(/^UNION\s+BANK\s+/gi, ''),
  BOB: (t) => t.replace(/BARB\d+/gi, '').replace(/^BOB\s+WORLD\s+/gi, ''),
  BOI: (t) => t.replace(/BKID[A-Z0-9]+/gi, ''),
  KOTAK: (t) => t.replace(/^KOTAK\s+/gi, '').replace(/\bCRN\s+\d+\b/gi, '')
};
