import { z } from 'zod';
import { createError } from 'h3';

// ============================================================
// Fix #20: Zod-based input validation schemas
// ============================================================

/** Auth schemas */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required').max(128)
});

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email format').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firmId: z.string().min(1, 'Firm selection is required')
});

/** Master Roll schemas */
export const masterRollSchema = z.object({
  employee_name: z.string().min(1).max(200).trim(),
  father_husband_name: z.string().min(1).max(200).trim().optional(),
  date_of_birth: z.string().max(20).optional(),
  aadhar: z.string().min(12).max(12).regex(/^\d{12}$/, 'Aadhar must be 12 digits'),
  pan: z.string().max(20).optional(),
  phone_no: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  bank: z.string().max(100).optional(),
  account_no: z.string().max(30).optional(),
  ifsc: z.string().max(15).optional(),
  branch: z.string().max(100).optional(),
  uan: z.string().max(30).optional(),
  esic_no: z.string().max(30).optional(),
  s_kalyan_no: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  project: z.string().max(100).optional(),
  site: z.string().max(100).optional(),
  p_day_wage: z.number().min(0).max(999999).optional(),
  date_of_joining: z.string().max(20).optional(),
  date_of_exit: z.string().max(20).optional(),
  doe_rem: z.string().max(500).optional(),
  resignation_notice_period: z.number().min(0).max(365).optional(),
  card_valid_until: z.string().max(20).optional(),
  status: z.enum(['Active', 'Inactive', 'Left', 'Terminated']).optional()
});

/** Document schemas */
export const documentSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  reference_number: z.string().max(50).optional(),
  original_expiry_date: z.string().max(20).optional(),
  extended_expiry_date: z.string().max(20).optional(),
  value: z.number().min(0).optional(),
  status: z.enum(['Active', 'Closed', 'Pending']).optional(),
  notes: z.string().max(2000).optional()
});

/** Generic pagination query schema */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().max(200).optional()
});

/**
 * Validate request body against a Zod schema.
 * Throws h3 createError(400) with structured validation errors on failure.
 */
export function validateBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    
    
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors }
    });
  }
  return result.data;
}
