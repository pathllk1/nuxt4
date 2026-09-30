/**
 * West Bengal Professional Tax (PT) calculation helper module.
 *
 * Date-aware, era-based slab lookup for salaried employees (Part-A, Sl.1).
 * Pattern mirrors `shared/utils/statutory-rates.ts` (EPF/ESIC eras).
 *
 * ── Era History ────────────────────────────────────────────────────────
 * 1. **Pre Oct 2026** (old WB PT Act schedule):
 *    ≤₹10,000: ₹0 | ₹10,001–₹15,000: ₹110 | ₹15,001–₹25,000: ₹130
 *    ₹25,001–₹40,000: ₹150 | >₹40,000: ₹200
 *
 * 2. **From 1-Oct-2026** (Gazette Notification 1407-F.T., 18-Aug-2026):
 *    ≤₹20,000: ₹0 | ₹20,001–₹30,000: ₹100 | ₹30,001–₹50,000: ₹140
 *    ₹50,001–₹1,00,000: ₹170 | >₹1,00,000: ₹208
 *
 * To add a future slab revision, prepend a new entry to PT_ERAS.
 */

interface PTSlab {
  /** Gross salary ceiling (inclusive). Use Infinity for the top bracket. */
  ceiling: number
  /** Monthly PT amount for this bracket. */
  tax: number
}

interface PTEra {
  /** Inclusive start date (YYYY-MM-DD). */
  effectiveFrom: string
  /** Ordered slabs — first match wins (gross ≤ ceiling). */
  slabs: ReadonlyArray<PTSlab>
}

/**
 * Sorted newest-first.  The last entry is the catch-all fallback.
 */
const PT_ERAS: ReadonlyArray<PTEra> = [
  {
    // Gazette Notification No. 1407-F.T., 18-Aug-2026
    // Part-A Sl.1 — effective 1-Oct-2026
    effectiveFrom: '2026-10-01',
    slabs: [
      { ceiling: 20_000,    tax: 0   },
      { ceiling: 30_000,    tax: 100 },
      { ceiling: 50_000,    tax: 140 },
      { ceiling: 1_00_000,  tax: 170 },
      { ceiling: Infinity,  tax: 208 },
    ],
  },
  {
    // Old WB PT Act schedule — catch-all for all prior months
    effectiveFrom: '1979-01-01',
    slabs: [
      { ceiling: 10_000,   tax: 0   },
      { ceiling: 15_000,   tax: 110 },
      { ceiling: 25_000,   tax: 130 },
      { ceiling: 40_000,   tax: 150 },
      { ceiling: Infinity, tax: 200 },
    ],
  },
]

/**
 * Resolves the applicable PT era for a given salary month.
 *
 * @param salaryMonth `YYYY-MM` (e.g. `'2026-10'`)
 */
function getPTEra(salaryMonth: string): PTEra {
  // Derive the last calendar day of the salary month for comparison.
  const parts = salaryMonth.split('-').map(Number)
  const y = parts[0] ?? 2026
  const m = parts[1] ?? 1
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${salaryMonth}-${String(lastDay).padStart(2, '0')}`

  for (const era of PT_ERAS) {
    if (era.effectiveFrom <= monthEnd) {
      return era
    }
  }

  // Fallback — should never be reached because the last era starts at 1979.
  return PT_ERAS[PT_ERAS.length - 1]!
}

/**
 * Calculate West Bengal Professional Tax for a salaried employee.
 *
 * @param grossSalary  Monthly gross salary.
 * @param salaryMonth  `YYYY-MM` (e.g. `'2026-10'`).  Optional — defaults
 *                     to the current calendar month so existing callers
 *                     without a month argument still work safely.
 * @returns Monthly PT amount.
 */
export const calculateWBProfessionalTax = (
  grossSalary: number,
  salaryMonth?: string,
): number => {
  const gross = Math.max(0, grossSalary || 0)

  // Default to current month if caller doesn't supply one.
  const month = salaryMonth
    || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const era = getPTEra(month)

  for (const slab of era.slabs) {
    if (gross <= slab.ceiling) {
      return slab.tax
    }
  }

  // Fallback — return last slab's tax (should be reached via Infinity ceiling).
  return era.slabs[era.slabs.length - 1]!.tax
}
