import { H3Event, createError } from 'h3';
import User from '../models/User';
import type { AuthSession } from './auth';

type Grade = 'Owner' | 'Admin' | 'Manager' | 'Staff';

/**
 * Ensures the authenticated user holds one of the allowed grades within
 * the firm they're currently scoped to (session.firm_id).
 *
 * Must be called AFTER requireAuthSession(event), passing its result in.
 * Throws 403 if the user has no membership in the firm or an insufficient grade.
 */
export async function requireWageRole(
  event: H3Event,
  session: AuthSession,
  allowedGrades: Grade[]
): Promise<Grade> {
  const user = await User.findById(session._id).select('firms').lean();

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const membership = user.firms.find((f: any) => f.firm.toString() === session.firm_id.toString());
  const grade = membership?.grade as Grade | undefined;

  if (!grade || !allowedGrades.includes(grade)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient permissions for this wage operation',
    });
  }

  return grade;
}