export type DetectedFileType = 'xlsx' | 'xls-legacy' | 'pdf' | 'html-xls' | 'unknown';

export function detectFileType(buffer: Buffer): DetectedFileType {
  if (!buffer || buffer.length < 4) return 'unknown';

  const hex = buffer.subarray(0, 8).toString('hex').toUpperCase();

  // 1. Check ZIP magic bytes (XLSX, DOCX, ZIP)
  if (hex.startsWith('504B0304')) {
    return 'xlsx';
  }

  // 2. Check OLE2 Compound File magic bytes (Legacy binary XLS)
  if (hex.startsWith('D0CF11E0A1B11AE1')) {
    return 'xls-legacy';
  }

  // 3. Check PDF magic bytes (%PDF)
  if (hex.startsWith('25504446')) {
    return 'pdf';
  }

  // 4. Check for HTML tables saved with .xls/.xlsx extension (common in SBI/BOI netbanking exports)
  if (isHtmlDisguisedAsExcel(buffer)) {
    return 'html-xls';
  }

  return 'unknown';
}

export function isHtmlDisguisedAsExcel(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 500).toString('utf-8').trim().toLowerCase();
  return (
    head.startsWith('<html') ||
    head.startsWith('<table') ||
    head.startsWith('<?xml') ||
    head.includes('<html') ||
    head.includes('<table')
  );
}
