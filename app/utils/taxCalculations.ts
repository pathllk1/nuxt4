/**
 * West Bengal Professional Tax (PT) calculation helper module.
 * Based on official monthly gross salary slab rates for salaried employees in West Bengal.
 * 
 * Monthly Gross Salary Slab Rules:
 * - Up to ₹10,000         : ₹0 (Nil)
 * - ₹10,001 to ₹15,000   : ₹110
 * - ₹15,001 to ₹25,000   : ₹130
 * - ₹25,001 to ₹40,000   : ₹150
 * - Above ₹40,000        : ₹200
 */
export const calculateWBProfessionalTax = (grossSalary: number): number => {
  const gross = Math.max(0, grossSalary || 0)
  
  if (gross <= 10000) return 0
  if (gross <= 15000) return 110
  if (gross <= 25000) return 130
  if (gross <= 40000) return 150
  return 200
}
