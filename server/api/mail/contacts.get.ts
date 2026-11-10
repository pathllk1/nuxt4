import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import User from '../../models/User';
import Contact from '../../models/Contact';
import { connectDB } from '../../plugins/mongodb';
import type { MailContact } from '../../../app/types/mail';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const query = getQuery(event);
    const search = query.search ? String(query.search).trim() : undefined;

    // 1. Fetch personal contacts from Couchbase Capella
    const couchbaseContacts = await MailCouchbaseService.getContacts(firmId, userId, search, 100);

    // 2. Fetch Global Address List (GAL) from MongoDB users & contacts
    let galContacts: MailContact[] = [];
    try {
      await connectDB();
      const userDocs = await User.find({
        $or: [{ 'firms.firm': firmId }, { role: 'superadmin' }]
      }).select('name email role phone').lean();

      for (const u of userDocs) {
        if (!u.email) continue;
        const displayName: string = u.name || u.email.split('@')[0] || 'User';
        galContacts.push({
          id: `gal::user::${u._id}`,
          type: 'contact',
          firmId,
          userId: 'GLOBAL',
          name: displayName,
          email: u.email.toLowerCase(),
          phone: (u as any).phone || undefined,
          company: 'Enterprise Staff',
          jobTitle: (u as any).role === 'superadmin' ? 'Super Administrator' : 'Staff Member',
          categories: ['ERP User'],
          source: 'GAL_SYNC',
          isFavorite: false,
          interactionStats: { sentCount: 0, receivedCount: 0, frequencyScore: 5 },
          erpLinks: { userId: String(u._id) },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // External Contacts (Vendors / Customers) from MongoDB Contact model
      const extContacts = await (Contact as any).find({
        firmId: firmId,
        status: 'active'
      }).select('name email phone company contactType').limit(50).lean();

      for (const c of extContacts) {
        if (!c.email) continue;
        galContacts.push({
          id: `gal::contact::${c._id}`,
          type: 'contact',
          firmId,
          userId: 'GLOBAL',
          name: c.name,
          email: c.email.toLowerCase(),
          phone: c.phone || undefined,
          company: c.company || `${c.contactType || 'Vendor'}`,
          categories: ['External Contact'],
          source: 'GAL_SYNC',
          isFavorite: false,
          interactionStats: { sentCount: 0, receivedCount: 0, frequencyScore: 3 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (dbErr: any) {
      console.warn('[MailContacts] MongoDB GAL fetch notice:', dbErr.message);
    }

    // Deduplicate by email address
    const emailMap = new Map<string, MailContact>();
    for (const c of galContacts) {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }
      emailMap.set(c.email.toLowerCase(), c);
    }
    for (const c of couchbaseContacts) {
      emailMap.set(c.email.toLowerCase(), c);
    }

    const merged = Array.from(emailMap.values()).sort((a, b) => {
      return (b.interactionStats?.frequencyScore || 0) - (a.interactionStats?.frequencyScore || 0);
    });

    return { success: true, data: merged };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error fetching contacts'
    });
  }
});
