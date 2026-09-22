/**
 * EPFO / ESIC Statutory Rate Configuration
 *
 * Centralised, date-aware statutory ceiling lookup.
 * Based on Union Cabinet notification (PIB PRID 2310973) effective 17-Sep-2026.
 *
 * ── How it works ──────────────────────────────────────────────────────
 * STATUTORY_ERAS is sorted newest-first.  `getStatutoryConfig()` walks
 * the list and returns the first era whose `effectiveFrom` falls within
 * the requested salary month, with an override for employees who exited
 * before the era took effect.
 *
 * To add a future ceiling change, simply prepend a new entry to the
 * array — no other file needs to change.
 */

export interface StatutoryEra {
  /** Inclusive start date (YYYY-MM-DD). */
  effectiveFrom: string
  /** EPF wage ceiling (monthly gross cap for contribution calc). */
  epfCeiling: number
  /** Pre-computed: ceiling × epfRate, rounded. */
  maxEpfDeduction: number
  /** Employee EPF contribution rate (fraction). */
  epfRate: number
  /** Employee ESIC contribution rate (fraction). */
  esicEmployeeRate: number
  /** Employer ESIC contribution rate (fraction). */
  esicEmployerRate: number
}

/**
 * Sorted newest-first.  The last entry is the catch-all fallback.
 */
const STATUTORY_ERAS: ReadonlyArray<StatutoryEra> = [
  {
    effectiveFrom: '2026-09-17',
    epfCeiling: 25_000,
    maxEpfDeduction: 3_000, // 25000 × 0.12
    epfRate: 0.12,
    esicEmployeeRate: 0.0075,
    esicEmployerRate: 0.0325,
  },
  {
    effectiveFrom: '1952-01-01', // EPF Act, 1952 — catch-all for all prior months
    epfCeiling: 15_000,
    maxEpfDeduction: 1_800, // 15000 × 0.12
    epfRate: 0.12,
    esicEmployeeRate: 0.0075,
    esicEmployerRate: 0.0325,
  },
]

/**
 * Resolves the applicable statutory config for a given salary month.
 *
 * @param salaryMonth  `YYYY-MM` (e.g. `'2026-09'`)
 * @param dateOfExit   Optional `YYYY-MM-DD`.  If the employee exited
 *                     **before** the era's `effectiveFrom`, the previous
 *                     (older) era is used instead.
 */
export function getStatutoryConfig(
  salaryMonth: string,
  dateOfExit?: string | null | undefined,
): StatutoryEra {
  // Derive the last calendar day of the salary month for comparison.
  const parts = salaryMonth.split('-').map(Number)
  const y = parts[0] ?? 2026
  const m = parts[1] ?? 1
  const lastDay = new Date(y, m, 0).getDate() // day-0 of next month = last day of m
  const monthEnd = `${salaryMonth}-${String(lastDay).padStart(2, '0')}`

  for (const era of STATUTORY_ERAS) {
    if (era.effectiveFrom <= monthEnd) {
      // Edge case: employee exited before this era took effect →
      // skip to the next (older) era so the old ceiling applies.
      if (dateOfExit && dateOfExit < era.effectiveFrom) {
        continue
      }
      return era
    }
  }

  // Fallback — should never be reached because the last era starts at 1952.
  return STATUTORY_ERAS[STATUTORY_ERAS.length - 1]!
}

// ── Convenience helpers ─────────────────────────────────────────────

/** EPF employee deduction: min(round(gross × rate), maxCap) */
export function computeEpfDeduction(
  gross: number,
  salaryMonth: string,
  dateOfExit?: string | null | undefined,
): number {
  const cfg = getStatutoryConfig(salaryMonth, dateOfExit)
  return Math.min(Math.round(gross * cfg.epfRate), cfg.maxEpfDeduction)
}

/** ESIC employee deduction: ceil(gross × rate) */
export function computeEsicDeduction(
  gross: number,
  salaryMonth: string,
  dateOfExit?: string | null | undefined,
): number {
  const cfg = getStatutoryConfig(salaryMonth, dateOfExit)
  return Math.ceil(gross * cfg.esicEmployeeRate)
}

/** ESIC employer contribution: ceil(gross × rate) */
export function computeEmployerEsic(
  gross: number,
  salaryMonth: string,
  dateOfExit?: string | null | undefined,
): number {
  const cfg = getStatutoryConfig(salaryMonth, dateOfExit)
  return Math.ceil(gross * cfg.esicEmployerRate)
}
