import { defineEventHandler, createError } from 'h3';
import { getSql, connectPostgres } from '../../utils/pg.config';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  let sql = getSql();
  if (!sql) {
    sql = await connectPostgres();
  }

  if (!sql) {
    throw createError({
      statusCode: 530,
      statusMessage: 'PostgreSQL database connection not ready'
    });
  }

  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);

    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

    const expiringDocs = await sql`
      SELECT * FROM documents
      WHERE firm_id = ${firmId}
        AND status != 'Closed'
        AND COALESCE(extended_expiry_date, original_expiry_date) <= ${thirtyDaysLaterStr}::DATE
    `;

    const normalizedToday = new Date();
    normalizedToday.setHours(0, 0, 0, 0);

    const alerts = expiringDocs.map((doc: any) => {
      const expiryDateStr = doc.extended_expiry_date || doc.original_expiry_date;
      const expiry = new Date(expiryDateStr);
      expiry.setHours(0, 0, 0, 0);

      const daysRemaining = Math.ceil((expiry.getTime() - normalizedToday.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: doc.id,
        name: doc.name,
        reference_number: doc.reference_number,
        expiry_date: expiryDateStr,
        days_remaining: daysRemaining,
        alert_type: daysRemaining < 0 ? 'expired' : 'expiring_soon'
      };
    });

    return {
      success: true,
      message: 'Notifications processed successfully',
      summary: {
        total_alerts: alerts.length,
        expired: alerts.filter(a => a.alert_type === 'expired').length,
        expiring_soon: alerts.filter(a => a.alert_type === 'expiring_soon').length
      },
      alerts
    };
  } catch (err: any) {
    console.error('[DOCUMENTS_NOTIFICATIONS] Error:', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Failed to process notifications'
    });
  }
});
