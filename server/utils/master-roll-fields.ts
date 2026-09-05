/**
 * Master Roll Field Definitions & Allowlist
 *
 * Defines all client-submittable fields for MasterRoll to prevent mass-assignment
 * while ensuring required fields (like father_husband_name, date_of_birth, address)
 * and statutory fields are not dropped.
 */

export const MASTER_ROLL_FIELDS = [
  'employee_name',
  'father_husband_name',
  'date_of_birth',
  'aadhar',
  'pan',
  'phone_no',
  'address',
  'bank',
  'account_no',
  'ifsc',
  'branch',
  'uan',
  'esic_no',
  's_kalyan_no',
  'category',
  'p_day_wage',
  'project',
  'site',
  'date_of_joining',
  'date_of_exit',
  'doe_rem',
  'resignation_notice_period',
  'card_valid_until',
  'status',
] as const;

export type MasterRollField = (typeof MASTER_ROLL_FIELDS)[number];

export function pickMasterRollFields(data: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const field of MASTER_ROLL_FIELDS) {
    if (data[field] !== undefined) {
      clean[field] = data[field];
    }
  }
  return clean;
}
