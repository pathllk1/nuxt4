import mongoose from 'mongoose';
import FirmSettings from '../../models/FirmSettings';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const body = await readBody(event);

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Payload required' });
  }

  const allowedKeys = [
    'showHsn',
    'showQty',
    'showUom',
    'showRate',
    'showDisc',
    'showGst',
    'showBatch',
    'showNarration',
    'showBank',
    'defaultBankAccountId',
    'jurisdiction',
    'terms',
    'declaration',
    'signatoryTitle',
    'defaultCopyType'
  ];

  const operations = [];

  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      let valStr: string;
      if (typeof body[key] === 'object') {
        valStr = JSON.stringify(body[key]);
      } else {
        valStr = String(body[key]);
      }

      operations.push(
        FirmSettings.findOneAndUpdate(
          { firmId: firmIdObj, settingKey: `print_${key}` },
          { $set: { settingValue: valStr } },
          { upsert: true, returnDocument: 'after' }
        )
      );
    }
  }

  await Promise.all(operations);

  return {
    success: true,
    message: 'Print settings updated successfully'
  };
});
