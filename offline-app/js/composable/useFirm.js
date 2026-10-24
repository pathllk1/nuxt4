// composable/useFirm.js
// Dedicated Firm Settings & Multi-GSTIN Locations Management (100% Matching Nuxt 4 Firm.ts & useBillingState.ts)
(function (global) {
  'use strict';

  function useFirm(notify, audit) {
    const { ref, computed } = Vue;

    const firm = ref({
      id: null,
      name: '',
      legal_name: '',
      code: '',
      description: '',
      phone_number: '',
      secondary_phone: '',
      email: '',
      website: '',
      business_type: 'Private Limited',
      industry_type: '',
      establishment_year: new Date().getFullYear(),
      employee_count: 0,
      registration_number: '',
      registration_date: '',
      cin_number: '',
      pan_number: '',
      address: '',
      city: '',
      state: 'Maharashtra',
      country: 'India',
      pincode: '',
      bank_name: '',
      bank_account_number: '',
      bank_branch: '',
      ifsc_code: '',
      payment_terms: '',
      currency: 'INR',
      locations: [],
      gst_enabled: 1
    });

    const loading = ref(false);

    const locations = computed(() => {
      if (!firm.value.locations) return [];
      if (Array.isArray(firm.value.locations)) return firm.value.locations;
      try {
        return JSON.parse(firm.value.locations);
      } catch {
        return [];
      }
    });

    const activeLocation = computed(() => {
      const locs = locations.value;
      if (!locs.length) return null;
      const def = locs.find((l) => l.is_default);
      return def || locs[0];
    });

    const isFirmConfigured = computed(() => {
      return Boolean(firm.value && firm.value.name && firm.value.name.trim().length > 0);
    });

    const loadFirmSettings = async () => {
      loading.value = true;
      try {
        let res = await global.WebSqlService.executeSql('SELECT * FROM firm_settings ORDER BY id ASC LIMIT 1');
        
        // If no firm settings exist, auto-seed demo firm (GST OFF) and reload
        if ((!res || !res.rows || res.rows.length === 0) && global.WebSqlService && typeof global.WebSqlService.seedDemoData === 'function') {
          console.info('[useFirm] No firm settings found. Auto-seeding demo firm (GST OFF)...');
          await global.WebSqlService.seedDemoData(false);
          res = await global.WebSqlService.executeSql('SELECT * FROM firm_settings ORDER BY id ASC LIMIT 1');
        }

        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          let parsedLocations = [];
          if (row.locations) {
            try {
              parsedLocations = typeof row.locations === 'string' ? JSON.parse(row.locations) : row.locations;
            } catch {
              parsedLocations = [];
            }
          }
          firm.value = {
            ...row,
            gst_enabled: row.gst_enabled !== undefined && row.gst_enabled !== null ? Number(row.gst_enabled) : 0,
            locations: parsedLocations
          };
        } else {
          // Clean initial state (Zero dummy/mock data)
          firm.value = {
            id: null,
            name: '',
            legal_name: '',
            code: '',
            description: '',
            phone_number: '',
            secondary_phone: '',
            email: '',
            website: '',
            business_type: 'Private Limited',
            industry_type: '',
            establishment_year: new Date().getFullYear(),
            employee_count: 0,
            registration_number: '',
            registration_date: '',
            cin_number: '',
            pan_number: '',
            address: '',
            city: '',
            state: 'Maharashtra',
            country: 'India',
            pincode: '',
            bank_name: '',
            bank_account_number: '',
            bank_branch: '',
            ifsc_code: '',
            payment_terms: '',
            currency: 'INR',
            locations: [],
            gst_enabled: 1
          };
        }
      } catch (err) {
        console.error('Failed to load firm settings:', err);
        if (notify) notify('Failed to load firm settings', 'error');
      } finally {
        loading.value = false;
      }
    };

    const saveFirmSettings = async (formData) => {
      loading.value = true;
      const now = new Date().toISOString();
      const locationsJson = JSON.stringify(formData.locations || []);
      const gstEnabledVal = formData.gst_enabled !== undefined ? (formData.gst_enabled ? 1 : 0) : 1;

      try {
        if (firm.value && firm.value.id) {
          await global.WebSqlService.executeSql(
            `UPDATE firm_settings SET
              name = ?, legal_name = ?, code = ?, description = ?,
              phone_number = ?, secondary_phone = ?, email = ?, website = ?,
              business_type = ?, industry_type = ?, establishment_year = ?, employee_count = ?,
              registration_number = ?, registration_date = ?, cin_number = ?, pan_number = ?,
              address = ?, city = ?, state = ?, country = ?, pincode = ?,
              bank_name = ?, bank_account_number = ?, bank_branch = ?, ifsc_code = ?, payment_terms = ?,
              currency = ?, locations = ?, gst_enabled = ?, updated_at = ?
            WHERE id = ?`,
            [
              formData.name || '',
              formData.legal_name || '',
              formData.code || '',
              formData.description || '',
              formData.phone_number || '',
              formData.secondary_phone || '',
              formData.email || '',
              formData.website || '',
              formData.business_type || 'Private Limited',
              formData.industry_type || '',
              Number(formData.establishment_year) || new Date().getFullYear(),
              Number(formData.employee_count) || 0,
              formData.registration_number || '',
              formData.registration_date || '',
              formData.cin_number || '',
              formData.pan_number || '',
              formData.address || '',
              formData.city || '',
              formData.state || '',
              formData.country || 'India',
              formData.pincode || '',
              formData.bank_name || '',
              formData.bank_account_number || '',
              formData.bank_branch || '',
              formData.ifsc_code || '',
              formData.payment_terms || '',
              formData.currency || 'INR',
              locationsJson,
              gstEnabledVal,
              now,
              firm.value.id
            ]
          );
        } else {
          const insertRes = await global.WebSqlService.executeSql(
            `INSERT INTO firm_settings (
              name, legal_name, code, description,
              phone_number, secondary_phone, email, website,
              business_type, industry_type, establishment_year, employee_count,
              registration_number, registration_date, cin_number, pan_number,
              address, city, state, country, pincode,
              bank_name, bank_account_number, bank_branch, ifsc_code, payment_terms,
              currency, locations, gst_enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              formData.name || '',
              formData.legal_name || '',
              formData.code || '',
              formData.description || '',
              formData.phone_number || '',
              formData.secondary_phone || '',
              formData.email || '',
              formData.website || '',
              formData.business_type || 'Private Limited',
              formData.industry_type || '',
              Number(formData.establishment_year) || new Date().getFullYear(),
              Number(formData.employee_count) || 0,
              formData.registration_number || '',
              formData.registration_date || '',
              formData.cin_number || '',
              formData.pan_number || '',
              formData.address || '',
              formData.city || '',
              formData.state || '',
              formData.country || 'India',
              formData.pincode || '',
              formData.bank_name || '',
              formData.bank_account_number || '',
              formData.bank_branch || '',
              formData.ifsc_code || '',
              formData.payment_terms || '',
              formData.currency || 'INR',
              locationsJson,
              gstEnabledVal,
              now,
              now
            ]
          );
          firm.value.id = insertRes.insertId;
        }

        firm.value = {
          ...firm.value,
          ...formData,
          locations: formData.locations || []
        };

        if (notify) notify('Firm Settings saved successfully', 'success');
        if (audit) audit('UPDATE_FIRM_SETTINGS', `Updated firm settings for ${formData.name}`);
        return true;
      } catch (err) {
        console.error('Save firm settings error:', err);
        if (notify) notify('Failed to save firm settings: ' + err.message, 'error');
        return false;
      } finally {
        loading.value = false;
      }
    };

    return {
      firm,
      locations,
      activeLocation,
      isFirmConfigured,
      loading,
      loadFirmSettings,
      saveFirmSettings
    };
  }

  global.useFirm = useFirm;
})(window);
