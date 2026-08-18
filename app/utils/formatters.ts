/**
 * Indian Number & Currency Formatting Utilities
 * Formats numbers in Lakhs, Crores, Thousands (en-IN) instead of Millions/Billions.
 */

/**
 * Format a number/string into Indian Currency (e.g. ₹2,45,19,610.50)
 */
export function formatCurrency(
  val: number | string | null | undefined,
  options: {
    decimals?: number;
    showSymbol?: boolean;
    spaceAfterSymbol?: boolean;
  } = {}
): string {
  const { decimals = 2, showSymbol = true, spaceAfterSymbol = false } = options;
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  
  if (val === null || val === undefined || isNaN(num)) {
    return showSymbol ? (spaceAfterSymbol ? '₹ 0.00' : '₹0.00') : '0.00';
  }

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);

  if (!showSymbol) return formatted;
  return spaceAfterSymbol ? `₹ ${formatted}` : `₹${formatted}`;
}

/**
 * Format a number in Indian numbering system without currency symbol (e.g. 2,45,19,610.50)
 */
export function formatIndianNumber(
  val: number | string | null | undefined,
  decimals: number = 2
): string {
  return formatCurrency(val, { decimals, showSymbol: false });
}

/**
 * Format a number into compact Indian notation (Lakhs / Crores / K) for Charts and compact badges
 * Example:
 *  15,000,000 -> 1.5 Cr
 *  1,400,000  -> 14 L
 *  25,000     -> 25 K
 */
export function formatIndianCompact(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (val === null || val === undefined || isNaN(num)) return '0';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 10000000) { // 1 Crore = 10,000,000
    const cr = abs / 10000000;
    const formatted = cr >= 100 ? cr.toFixed(0) : cr >= 10 ? cr.toFixed(1) : cr.toFixed(2);
    return `${sign}${formatted.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')} Cr`;
  }

  if (abs >= 100000) { // 1 Lakh = 100,000
    const l = abs / 100000;
    const formatted = l >= 100 ? l.toFixed(0) : l >= 10 ? l.toFixed(1) : l.toFixed(2);
    return `${sign}${formatted.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')} L`;
  }

  if (abs >= 1000) { // 1 Thousand
    const k = abs / 1000;
    return `${sign}${k.toFixed(k >= 10 ? 0 : 1).replace(/\.0$/, '')} K`;
  }

  return `${sign}${abs.toLocaleString('en-IN')}`;
}
