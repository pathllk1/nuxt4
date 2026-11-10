import { createError } from 'h3';
import type { AuthSession } from './auth';
import { MailCouchbaseService } from './mail-couchbase.service';
import type { MailAccount, MailMessage } from '../../app/types/mail';

/**
 * Asserts that the authenticated user strictly owns the specified mail account.
 * Throws 404 if account does not exist.
 * Throws 403 if account belongs to another user or firm.
 */
export async function assertAccountAccess(accountId: string, session: AuthSession): Promise<MailAccount> {
  const firmId = String(session.firm_id);
  const userId = String(session._id);

  const account = await MailCouchbaseService.getAccountById(accountId);
  if (!account) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Mail account not found'
    });
  }

  if (String(account.firmId) !== firmId || String(account.userId) !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You do not have permission to access this mail account'
    });
  }

  return account;
}

/**
 * Asserts that the authenticated user strictly owns the specified mail message.
 * Throws 404 if message does not exist.
 * Throws 403 if message belongs to another user or firm.
 */
export async function assertMessageAccess(messageId: string, session: AuthSession): Promise<MailMessage> {
  const firmId = String(session.firm_id);
  const userId = String(session._id);

  const message = await MailCouchbaseService.getMessage(messageId);
  if (!message) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Email message not found'
    });
  }

  if (String(message.firmId) !== firmId || String(message.userId) !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You do not have permission to access this message'
    });
  }

  return message;
}

