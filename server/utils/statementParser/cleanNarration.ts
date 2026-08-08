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

  // Remove NEFT/RTGS/IMPS/UPI prefix noise
  cleaned = cleaned.replace(/^(IBNEFT|IBRTGS|StUBP|StCon|NEFT|RTGS|IMPS|UPI|BY CASH|TO TR)\b/gi, '');
  cleaned = cleaned.replace(/^[\/\-:\s]+/, '');

  // Remove long UTR / RRN numbers (22-char UTRs or 12-digit RRNs)
  cleaned = cleaned.replace(/\/([A-Z0-9]{12,22})\b/gi, '');
  cleaned = cleaned.replace(/\b[A-Z]{4}[0-9]{8,14}\b/gi, '');

  // Clean UPI Handles (keep counterparty name before @)
  cleaned = cleaned.replace(/@\w+/gi, '');

  // Remove SOL-ID lines or location metadata blocks
  cleaned = cleaned.replace(/SOL-ID\s+\d+.*$/gi, '');
  cleaned = cleaned.replace(/MUMBAI\s*\([^)]*\)/gi, '');

  // Strip bank charge prefixes
  cleaned = cleaned.replace(/^Charges\s*:\s*/gi, '');
  cleaned = cleaned.replace(/Int\.Coll\s*:\s*/gi, '');

  // Strip slash delimiters and extra spaces
  cleaned = cleaned.replace(/[\/\-_]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

const bankNarrationCleaners: Record<string, (t: string) => string> = {
  HDFC: (t) => t.replace(/\/INF\/[A-Z0-9]+/gi, ''),
  ICICI: (t) => t.replace(/-TXT-[A-Z0-9]+/gi, ''),
  BOI: (t) => t.replace(/BKID[A-Z0-9]+/gi, '')
};
