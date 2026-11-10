import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import type { MailAccount } from '../../../app/types/mail';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const body = await readBody(event);

    if (!body.emailAddress || !body.imapConfig?.host || !body.smtpConfig?.host) {
      throw createError({ statusCode: 400, statusMessage: 'Email and server configuration required' });
    }

    const accountId = body.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const accountDoc: MailAccount = {
      id: accountId,
      firmId,
      userId,
      emailAddress: body.emailAddress.trim().toLowerCase(),
      displayName: body.displayName || body.emailAddress.split('@')[0],
      provider: body.provider || 'CUSTOM_IMAP',
      imapConfig: {
        host: body.imapConfig.host.trim(),
        port: Number(body.imapConfig.port) || 993,
        secure: body.imapConfig.secure !== false
      },
      smtpConfig: {
        host: body.smtpConfig.host.trim(),
        port: Number(body.smtpConfig.port) || 465,
        secure: body.smtpConfig.secure !== false
      },
      syncSettings: {
        syncIntervalMinutes: Number(body.syncSettings?.syncIntervalMinutes) || 15,
        daysOfMailToKeep: Number(body.syncSettings?.daysOfMailToKeep) || 90,
        syncFolders: body.syncSettings?.syncFolders || ['INBOX', 'Sent']
      },
      encryptedVaultBlob: body.encryptedVaultBlob || undefined,
      lastSyncAt: null,
      lastSyncStatus: 'SUCCESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await MailCouchbaseService.saveAccount(accountDoc);
    if (!saved) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to write account to Couchbase' });
    }

    // Initialize standard Outlook system folders for this account
    const standardFolders = [
      { id: 'INBOX', name: 'Inbox', path: 'INBOX', specialUse: 'INBOX' as const, orderIndex: 1 },
      { id: 'Sent', name: 'Sent Items', path: 'Sent', specialUse: 'SENT' as const, orderIndex: 2 },
      { id: 'Drafts', name: 'Drafts', path: 'Drafts', specialUse: 'DRAFTS' as const, orderIndex: 3 },
      { id: 'Archive', name: 'Archive', path: 'Archive', specialUse: 'ARCHIVE' as const, orderIndex: 4 },
      { id: 'Junk', name: 'Junk Email', path: 'Junk', specialUse: 'JUNK' as const, orderIndex: 5 },
      { id: 'Trash', name: 'Deleted Items', path: 'Trash', specialUse: 'TRASH' as const, orderIndex: 6 }
    ];

    for (const sf of standardFolders) {
      await MailCouchbaseService.saveFolder({
        id: sf.id,
        accountId,
        firmId,
        name: sf.name,
        path: sf.path,
        delimiter: '/',
        specialUse: sf.specialUse,
        unreadCount: 0,
        totalCount: 0,
        orderIndex: sf.orderIndex,
        updatedAt: new Date().toISOString()
      });
    }

    return { success: true, data: accountDoc };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error saving mail account'
    });
  }
});

