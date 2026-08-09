export interface BankSignature {
  code: string;
  name: string;
  nameMatches: RegExp[];
  ifscPrefix: string;
  headerSignature: RegExp;
}

export const BANK_SIGNATURES: BankSignature[] = [
  {
    code: 'BOI',
    name: 'Bank of India',
    nameMatches: [/bank of india/i, /\bBOI\b/i],
    ifscPrefix: 'BKID',
    headerSignature: /date.*description.*debits.*credits.*balance/i
  },
  {
    code: 'SBI',
    name: 'State Bank of India',
    nameMatches: [/state bank of india/i, /\bSBI\b/i],
    ifscPrefix: 'SBIN',
    headerSignature: /txn date.*value date.*description|narration.*cheque/i
  },
  {
    code: 'HDFC',
    name: 'HDFC Bank',
    nameMatches: [/hdfc bank/i, /\bHDFC\b/i],
    ifscPrefix: 'HDFC',
    headerSignature: /narration.*chq.*ref.*withdrawal.*deposit/i
  },
  {
    code: 'ICICI',
    name: 'ICICI Bank',
    nameMatches: [/icici bank/i, /\bICICI\b/i],
    ifscPrefix: 'ICIC',
    headerSignature: /transaction remarks|particulars.*withdrawal.*deposit/i
  },
  {
    code: 'AXIS',
    name: 'Axis Bank',
    nameMatches: [/axis bank/i, /\bAXIS\b/i],
    ifscPrefix: 'UTIB',
    headerSignature: /tran date.*particulars.*debit.*credit/i
  },
  {
    code: 'PNB',
    name: 'Punjab National Bank',
    nameMatches: [/punjab national bank/i, /\bPNB\b/i],
    ifscPrefix: 'PUNB',
    headerSignature: /txn date.*remarks.*debit.*credit/i
  },
  {
    code: 'UBI',
    name: 'Union Bank of India',
    nameMatches: [/union bank of india/i, /\bunion bank\b/i, /\bvyom\b/i, /\bUBI\b/i],
    ifscPrefix: 'UBIN',
    headerSignature: /date.*particulars.*chq.*withdrawal.*deposit/i
  },
  {
    code: 'BOB',
    name: 'Bank of Baroda',
    nameMatches: [/bank of baroda/i, /\bBOB\b/i],
    ifscPrefix: 'BARB',
    headerSignature: /date.*particulars.*withdrawals.*deposits/i
  },
  {
    code: 'KOTAK',
    name: 'Kotak Mahindra Bank',
    nameMatches: [/kotak mahindra bank/i, /\bKOTAK\b/i],
    ifscPrefix: 'KKBK',
    headerSignature: /date.*description|narration.*amount.*dr\/cr/i
  }
];

export interface BankDetectionResult {
  bankCode: string;
  bankName: string;
  confidence: 'high' | 'medium' | 'low';
}

export function detectBank(rawText: string): BankDetectionResult {
  if (!rawText || !rawText.trim()) {
    return { bankCode: 'UNKNOWN', bankName: 'Unknown Bank', confidence: 'low' };
  }

  const lowerText = rawText.toLowerCase();

  // Priority 1: IFSC Prefix Match (Highest Confidence)
  const ifscMatch = rawText.match(/IFSC\s*[:\-]?\s*([A-Z]{4})/i);
  if (ifscMatch && ifscMatch[1]) {
    const prefix = ifscMatch[1].toUpperCase();
    const found = BANK_SIGNATURES.find(b => b.ifscPrefix === prefix);
    if (found) {
      return { bankCode: found.code, bankName: found.name, confidence: 'high' };
    }
  }

  // Priority 2: Explicit Bank Name Text Match
  for (const sig of BANK_SIGNATURES) {
    if (sig.nameMatches.some(re => re.test(rawText))) {
      return { bankCode: sig.code, bankName: sig.name, confidence: 'high' };
    }
  }

  // Priority 3: Table Header Signature Pattern Match (Medium Confidence)
  for (const sig of BANK_SIGNATURES) {
    if (sig.headerSignature.test(lowerText)) {
      return { bankCode: sig.code, bankName: sig.name, confidence: 'medium' };
    }
  }

  return { bankCode: 'UNKNOWN', bankName: 'Generic Statement', confidence: 'low' };
}
