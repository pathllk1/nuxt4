import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import Firm from '~~/server/models/Firm';
import User from '~~/server/models/User';
import { connectDB } from '~~/server/utils/db';
import { hashPassword } from '~~/server/utils/crypto-hash';
import { invalidateCachePrefix } from '~~/server/utils/cache';

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

  try {
    const body = await readBody(event);
    const {
      name, legal_name, code, description, country,
      phone_number, secondary_phone, email, website,
      business_type, industry_type, establishment_year, employee_count,
      registration_number, registration_date, cin_number, pan_number,
      tax_id, vat_number, bank_account_number, bank_name,
      bank_branch, ifsc_code, payment_terms, status, license_numbers,
      insurance_details, currency, timezone, fiscal_year_start,
      invoice_prefix, quote_prefix, po_prefix, logo_url,
      invoice_template, enable_e_invoice,
      admin_account,
      locations,
    } = body || {};

    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Firm name is required' });
    }

    const existingFirm = await Firm.findOne({ name }).lean();
    if (existingFirm) {
      throw createError({ statusCode: 409, statusMessage: 'A firm with this name already exists' });
    }

    const processedLocations = processLocations(locations || []);
    const legacy = syncLegacyFields(processedLocations);

    const firm = await Firm.create({
      name,
      legal_name,
      code,
      description,
      locations: processedLocations,
      ...legacy,
      country: country || 'India',
      phone_number, secondary_phone, email, website,
      business_type, industry_type, establishment_year, employee_count,
      registration_number, registration_date, cin_number, pan_number,
      tax_id, vat_number, bank_account_number, bank_name,
      bank_branch, ifsc_code, payment_terms,
      status: status ?? 'approved',
      license_numbers, insurance_details,
      currency: currency ?? 'INR',
      timezone: timezone ?? 'Asia/Kolkata',
      fiscal_year_start, invoice_prefix, quote_prefix, po_prefix,
      logo_url, invoice_template,
      enable_e_invoice: !!enable_e_invoice,
    });

    if (admin_account && admin_account.email && admin_account.password) {
      const { name: adminName, email: adminEmail, password } = admin_account;
      
      const emailTaken = await User.findOne({ email: adminEmail.toLowerCase() }).lean();
      if (!emailTaken) {
        const hashedPassword = await hashPassword(password);
        await User.create({
          name: adminName || name + ' Owner',
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          role: 'standard',
          status: 'active',
          firms: [{ firm: firm._id, grade: 'Owner' }],
          securitySettings: {
            failedLoginAttempts: 0,
            trustedIPs: [],
            suspiciousActivityCount: 0
          }
        });
      }
    }

    // Invalidate cached firms list in Nitro / Redis
    await invalidateCachePrefix('nitro:handlers:_:api:firms');

    return {
      success: true,
      message: 'Firm created successfully',
      data: firm
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error creating firm'
    });
  }
});
