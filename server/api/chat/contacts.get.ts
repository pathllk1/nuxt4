import { defineEventHandler, createError } from 'h3';
import User from '../../models/User';
import Firm from '../../models/Firm';
import { connectDB } from '../../plugins/mongodb';
import { useRedis } from '../../utils/redis';
import type { ChatContact } from '../../../app/types/chat';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const currentUserId = (user.id || user._id).toString();
  await connectDB();

  try {
    // 1. Fetch current user to determine their associated firms
    const currentUserDoc: any = await User.findById(currentUserId).lean();
    const currentUserFirmIds = new Set<string>(
      (currentUserDoc?.firms || []).map((f: any) => 
        (typeof f.firm === 'object' && f.firm?._id ? f.firm._id.toString() : f.firm?.toString())
      ).filter(Boolean)
    );

    // 2. Fetch all other active users with populated firm data
    const allUsers: any[] = await User.find({ _id: { $ne: currentUserId } })
      .select('name email role status firms createdAt')
      .populate({ path: 'firms.firm', model: Firm, select: 'name code' })
      .lean();

    // 3. Fetch unread counts and last seen activity from Upstash Redis
    const redis = useRedis();
    let unreadMap: Record<string, string> = {};
    let lastSeenMap: Record<string, string> = {};

    if (redis) {
      try {
        // Record current user's active timestamp silently
        await redis.hset('chat:user:last_seen', { [currentUserId]: Date.now() });

        const [unreadData, lastSeenData] = await Promise.all([
          redis.hgetall(`chat:unread:${currentUserId}`),
          redis.hgetall('chat:user:last_seen')
        ]);
        unreadMap = (unreadData as any) || {};
        lastSeenMap = (lastSeenData as any) || {};
      } catch (err) {
        console.warn('[Chat] Failed to fetch unread or lastSeen data from Redis:', err);
      }
    }

    // 4. Format and categorize contacts
    const contacts: ChatContact[] = allUsers.map((u: any) => {
      const uId = u._id.toString();
      const formattedFirms = (u.firms || []).map((f: any) => ({
        firmId: typeof f.firm === 'object' && f.firm ? f.firm._id.toString() : f.firm?.toString(),
        firmName: typeof f.firm === 'object' && f.firm ? f.firm.name : 'Enterprise Firm',
        grade: f.grade || 'Staff'
      }));

      // Check if contact shares at least one firm with the logged-in user
      const isOwnFirm = formattedFirms.some((f: any) => currentUserFirmIds.has(f.firmId));
      const primaryFirmName = formattedFirms[0]?.firmName || 'Independent';

      // Look up unread count for the deterministic chatId
      const chatId = [currentUserId, uId].sort().join(':');
      const unreadCount = parseInt(unreadMap[chatId] || '0', 10);
      const rawLastSeen = lastSeenMap[uId];
      const lastSeenAt = rawLastSeen ? parseInt(rawLastSeen, 10) : undefined;

      return {
        id: uId,
        _id: uId,
        name: u.name || u.email.split('@')[0],
        email: u.email,
        role: u.role,
        status: u.status,
        firms: formattedFirms,
        isOwnFirm,
        primaryFirmName,
        unreadCount,
        lastSeenAt
      };
    });

    return {
      success: true,
      data: contacts
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch chat contacts'
    });
  }
});
