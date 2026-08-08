import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { detectFileType } from '../../../utils/statementParser/detectFileType';
import { detectBank } from '../../../utils/statementParser/detectBank';
import { getParser } from '../../../utils/statementParser/registry';
import { normalize } from '../../../utils/statementParser/normalize';
import { cleanNarration } from '../../../utils/statementParser/cleanNarration';
import { runPostProcessing } from '../../../utils/statementParser/postProcess';
import { extractPdfRows } from '../../../utils/statementParser/parsers/pdfTableExtractor';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const formData = await readMultipartFormData(event);

  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No statement file uploaded' });
  }

  const fileItem = formData.find(f => f.name === 'statement' || f.name === 'file');
  const passwordItem = formData.find(f => f.name === 'password');
  const password = passwordItem?.data ? passwordItem.data.toString('utf-8').trim() : undefined;

  const rawTextItem = formData.find(f => f.name === 'rawText');
  const providedRawText = rawTextItem?.data ? rawTextItem.data.toString('utf-8').trim() : undefined;

  if (!fileItem || !fileItem.data) {
    throw createError({ statusCode: 400, statusMessage: 'File buffer is missing' });
  }

  const buffer = fileItem.data;
  let fileType = detectFileType(buffer);

  if (fileType === 'unknown' && fileItem.filename?.toLowerCase().endsWith('.pdf')) {
    fileType = 'pdf';
  }

  if (fileType === 'unknown') {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported file format. Please upload a valid PDF, Excel (.xlsx, .xls), or CSV file.' });
  }

  // 1. Password check for PDF statements
  let rawText = providedRawText || '';
  if (fileType === 'pdf') {
    try {
      const pdfRes = await extractPdfRows(buffer, password, providedRawText);
      rawText = pdfRes.fullText;
    } catch (err: any) {
      if (err?.name === 'PasswordException' || String(err).includes('Password')) {
        return {
          success: false,
          requiresPassword: true,
          message: 'PDF statement is password protected. Please enter the password.'
        };
      }
      throw createError({ statusCode: 422, statusMessage: `Failed to parse PDF statement: ${err?.message || err}` });
    }
  }

  // 2. Bank Detection
  const bankResult = detectBank(rawText);
  const parserFileType = (fileType === 'pdf' ? 'pdf' : 'xlsx') as 'pdf' | 'xlsx';

  // 3. Dispatch to Registry Parser Adapter
  const { parser, isFallback } = getParser(bankResult.bankCode, parserFileType);
  const rawTxns = await parser({ buffer, rawText, password });

  // 4. Schema Normalization
  const normalized = normalize(rawTxns, bankResult.bankCode, fileType, isFallback);

  // 5. Narration Cleaning
  const cleaned = normalized.map(t => ({
    ...t,
    cleanedNarration: cleanNarration(t.rawNarration, bankResult.bankCode)
  }));

  // 6. Post-Processing (Deduplication, Integrity Checks, Party Matching)
  const finalTransactions = await runPostProcessing(cleaned, session.firm_id as any);

  return {
    success: true,
    fileType,
    bankCode: bankResult.bankCode,
    bankName: bankResult.bankName,
    confidence: bankResult.confidence,
    isFallbackParser: isFallback,
    requiresPassword: false,
    count: finalTransactions.length,
    transactions: finalTransactions
  };
});
