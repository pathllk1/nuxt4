import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import Firm from '~~/server/models/Firm';
import { connectDB } from '~~/server/utils/db';

function processLocations(locations: any[]) {
  let locs = Array.isArray(locations) ? [...locations] : [];
  locs = locs.map(loc => {
    const { _fetched, ...clean } = loc;
    if (clean.gst_number && clean.gst_number.length >= 2) {
      clean.state_code = clean.gst_number.substring(0, 2);
    }
    if (!clean.registration_type) clean.registration_type = 'PPOB';
    return clean;
  });

  if (locs.length > 0) {
    const defaultIndex = locs.findIndex(l => l.is_default);
    if (defaultIndex >= 0) {
      locs.forEach((loc, idx) => {
        loc.is_default = idx === defaultIndex;
      });
    } else {
      locs[0].is_default = true;
      locs.forEach((loc, idx) => {
        if (idx > 0) loc.is_default = false;
      });
    }
  }

  return locs;
}

function syncLegacyFields(processedLocations: any[]) {
  const def = processedLocations.find(l => l.is_default) || processedLocations[0] || {};
  return {
    gst_number: def.gst_number || '',
    address: def.address || '',
    city: def.city || '',
    state: def.state || '',
    pincode: def.pincode || '',
  };
}

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  const firmId = event.context.params?.firmId;
  if (!firmId) {
    throw createError({ statusCode: 400, statusMessage: 'Firm ID is required' });
  }

  try {
    const body = await readBody(event);

    if (body.name) {
      const clash = await Firm.findOne({ name: body.name, _id: { $ne: firmId } }).lean();
      if (clash) {
        throw createError({ statusCode: 409, statusMessage: 'Another firm with this name already exists' });
      }
    }

    if (body.locations) {
      body.locations = processLocations(body.locations);
      const legacy = syncLegacyFields(body.locations);
      Object.assign(body, legacy);
    }

    const firm = await Firm.findByIdAndUpdate(firmId, { $set: body }, { new: true });
    if (!firm) {
      throw createError({ statusCode: 404, statusMessage: 'Firm not found' });
    }

    return {
      success: true,
      message: 'Firm updated successfully',
      data: firm
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error updating firm'
    });
  }
});
