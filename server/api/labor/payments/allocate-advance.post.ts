import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  throw createError({
    statusCode: 409,
    statusMessage: 'Ledger advances cannot be allocated without a source-linked transfer between the General Ledger and labor register. No records were changed.'
  });
});
