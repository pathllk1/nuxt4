// components/PartyModalComponent.js
// 100% Faithful Replica of Nuxt 4 app/components/accounting/PartyAccountMasterModal.vue
(function (global) {
  'use strict';

  const GST_STATE_MAP = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
    '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
    '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
    '37': 'Andhra Pradesh', '38': 'Ladakh'
  };

  let uidCounter = 0;
  function nextUid() {
    return 'loc_' + Date.now() + '_' + (uidCounter++);
  }

  const typeOptions = [
    // 👥 Trade Parties
    { value: 'SUNDRY_DEBTORS', label: 'Customer', icon: '🏢', pillar: 'PARTIES', badge: 'AR' },
    { value: 'SUNDRY_CREDITORS', label: 'Supplier / Vendor', icon: '🏭', pillar: 'PARTIES', badge: 'AP' },
    { value: 'TRANSPORTER', label: 'Transporter / Freight', icon: '🚚', pillar: 'PARTIES', badge: 'Logistics' },

    // 👷 People & Labor
    { value: 'CASUAL_LABOR', label: 'Casual Labour / Worker', icon: '👷‍♂️', pillar: 'PEOPLE', badge: 'Direct Wages' },
    { value: 'LABOR_LEADER', label: 'Labor Leader (Contractor)', icon: '👷', pillar: 'PEOPLE', badge: 'Work Period' },
    { value: 'STAFF', label: 'Employee / Staff', icon: '👔', pillar: 'PEOPLE', badge: 'Payroll' },

    // 💼 Capital & Loans
    { value: 'LOANS_BORROWINGS', label: 'Loans & Borrowings', icon: '💳', pillar: 'FINANCE', badge: 'Liability' },
    { value: 'LOANS_ADVANCES', label: 'Loans & Advances Given', icon: '🤝', pillar: 'FINANCE', badge: 'Asset' },
    { value: 'CAPITAL', label: 'Capital & Equity', icon: '🏛️', pillar: 'FINANCE', badge: 'Equity' },

    // 📊 Expenses & Income
    { value: 'DIRECT_EXPENSE', label: 'Direct Expense (COGS)', icon: '⚙️', pillar: 'PL', badge: 'Factory/Mfg' },
    { value: 'EXPENSE', label: 'Indirect Expense Head', icon: '🧾', pillar: 'PL', badge: 'Admin/Overhead' },
    { value: 'INCOME', label: 'Income Head', icon: '📈', pillar: 'PL', badge: 'Revenue' },

    // 🏦 Treasury & Assets
    { value: 'BANK', label: 'Bank Account', icon: '🏦', pillar: 'TREASURY', badge: 'Company Bank' },
    { value: 'CASH', label: 'Cash in Hand', icon: '💵', pillar: 'TREASURY', badge: 'Petty Cash' },
    { value: 'DUTIES_AND_TAXES', label: 'Duties & Taxes', icon: '⚖️', pillar: 'TREASURY', badge: 'Statutory' },
    { value: 'FIXED_ASSETS', label: 'Fixed Assets', icon: '🏗️', pillar: 'TREASURY', badge: 'Non-Current' }
  ];

  const pillars = [
    { id: 'ALL', label: 'All Types' },
    { id: 'PARTIES', label: '👥 Trade Parties' },
    { id: 'PEOPLE', label: '👷 People & Labor' },
    { id: 'FINANCE', label: '💼 Capital & Loans' },
    { id: 'PL', label: '📊 Expenses & Income' },
    { id: 'TREASURY', label: '🏦 Treasury & Assets' }
  ];

  const PartyModalComponent = {
    props: {
      show: { type: Boolean, default: false },
      partyToEdit: { type: Object, default: null },
      editingParty: { type: Object, default: null },
      initialName: { type: String, default: '' },
      defaultType: { type: String, default: 'SUNDRY_DEBTORS' },
      mode: { type: String, default: 'sales' }
    },
    emits: ['close', 'save', 'update:show'],
    data() {
      return {
        pillars,
        typeOptions,
        selectedPillar: 'ALL',
        isSaving: false,
        form: {
          id: null,
          _id: '',
          account_name: '',
          account_type: 'SUNDRY_DEBTORS',
          phone: '',
          pan: '',
          aadhaar_number: '',
          bank_name: '',
          branch_name: '',
          account_number: '',
          ifsc_code: '',
          bank_account_type: 'CURRENT',
          is_default: false,
          status: 'ACTIVE',
          enable_beneficiary_banking: false,
          hsn_sac: '',
          gst_rate: null,
          description: '',
          opening_balance: 0,
          balance_type: 'CR',
          gstLocations: [
            { _uid: nextUid(), gstin: '', state: 'Maharashtra', stateCode: '27', address: '', pincode: '', isPrimary: true }
          ]
        }
      };
    },
    computed: {
      activeParty() {
        return this.partyToEdit || this.editingParty || null;
      },
      isEditing() {
        return !!(this.form.id || this.form._id || (this.activeParty && (this.activeParty.id || this.activeParty._id)));
      },
      filteredTypeOptions() {
        if (this.selectedPillar === 'ALL') return typeOptions;
        return typeOptions.filter(opt => opt.pillar === this.selectedPillar);
      },
      selectedPillarLabel() {
        const p = this.pillars.find(item => item.id === this.selectedPillar);
        return p ? p.label : 'All Master Types';
      },
      isParty() {
        return ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'TRANSPORTER', 'CUSTOMER', 'SUPPLIER', 'BOTH'].includes(this.form.account_type);
      },
      isLaborLeader() {
        return this.form.account_type === 'LABOR_LEADER';
      },
      isCasualLabor() {
        return this.form.account_type === 'CASUAL_LABOR';
      },
      isStaff() {
        return this.form.account_type === 'STAFF';
      },
      isLoan() {
        return ['LOANS_BORROWINGS', 'LOANS_ADVANCES'].includes(this.form.account_type);
      },
      isCapital() {
        return this.form.account_type === 'CAPITAL';
      },
      isBank() {
        return this.form.account_type === 'BANK';
      },
      isCash() {
        return this.form.account_type === 'CASH';
      },
      isTaxOrExpense() {
        return ['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'INCOME', 'DIRECT_INCOME', 'DUTIES_AND_TAXES'].includes(this.form.account_type);
      },
      requiresContact() {
        return !this.isCash && this.form.account_type !== 'DUTIES_AND_TAXES';
      },
      requiresPan() {
        return this.isParty || this.isLaborLeader || this.isStaff || this.isLoan || this.isCapital || this.isTaxOrExpense || this.requiresBankSection;
      },
      requiresAadhaar() {
        return this.isLaborLeader || this.isCasualLabor || this.isStaff;
      },
      requiresGstSection() {
        return this.isParty;
      },
      requiresTaxHsnSection() {
        return this.isTaxOrExpense || this.form.account_type === 'TRANSPORTER';
      },
      autoRequiresBank() {
        return [
          'BANK', 'CASUAL_LABOR', 'LABOR_LEADER', 'STAFF', 'SUNDRY_CREDITORS',
          'SUPPLIER', 'TRANSPORTER', 'LOANS_BORROWINGS', 'LOANS_ADVANCES'
        ].includes(this.form.account_type);
      },
      canOfferBeneficiaryBanking() {
        return ['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'CAPITAL', 'SUNDRY_DEBTORS', 'CUSTOMER'].includes(this.form.account_type);
      },
      requiresBankSection() {
        return this.autoRequiresBank || (this.canOfferBeneficiaryBanking && this.form.enable_beneficiary_banking);
      },
      modalTitleByType() {
        switch (this.form.account_type) {
          case 'SUNDRY_DEBTORS':
          case 'CUSTOMER':
            return 'Register Customer Master';
          case 'SUNDRY_CREDITORS':
          case 'SUPPLIER':
            return 'Register Supplier / Vendor Master';
          case 'TRANSPORTER':
            return 'Register Transporter / Logistics Master';
          case 'CASUAL_LABOR':
            return 'Register Casual Worker / Direct Labour (Wages)';
          case 'LABOR_LEADER':
            return 'Register Labor Leader / Contractor';
          case 'STAFF':
            return 'Register Employee / Staff Master';
          case 'LOANS_BORROWINGS':
            return 'Register Loan & Borrowing (Liability)';
          case 'LOANS_ADVANCES':
            return 'Register Loan & Advance Given (Asset)';
          case 'CAPITAL':
            return 'Register Capital / Partner Equity Head';
          case 'DIRECT_EXPENSE':
            return 'Register Direct Expense (Factory/COGS)';
          case 'EXPENSE':
            return 'Register Indirect Expense (Overheads)';
          case 'INCOME':
            return 'Register Income Head';
          case 'BANK':
            return 'Register Company Bank Account';
          case 'CASH':
            return 'Register Cash Counter / Petty Cash';
          case 'DUTIES_AND_TAXES':
            return 'Register Statutory Tax / Duty Head';
          case 'FIXED_ASSETS':
            return 'Register Fixed Asset Head';
          default:
            return 'Register Master Account Head';
        }
      },
      nameLabelByType() {
        switch (this.form.account_type) {
          case 'SUNDRY_DEBTORS':
          case 'CUSTOMER':
            return 'Customer / Firm Trade Name *';
          case 'SUNDRY_CREDITORS':
          case 'SUPPLIER':
            return 'Supplier / Vendor Trade Name *';
          case 'TRANSPORTER':
            return 'Transporter / Fleet Name *';
          case 'CASUAL_LABOR':
            return 'Casual Worker / Labour Name *';
          case 'LABOR_LEADER':
            return 'Labor Leader / Contractor Name *';
          case 'STAFF':
            return 'Employee / Staff Full Name *';
          case 'LOANS_BORROWINGS':
            return 'Lender / Loan Provider Name *';
          case 'LOANS_ADVANCES':
            return 'Borrower / Advance Recipient Name *';
          case 'CAPITAL':
            return 'Owner / Partner Capital Account Name *';
          case 'BANK':
            return 'Bank Account Ledger Name *';
          case 'CASH':
            return 'Cash Register / Counter Name *';
          default:
            return 'Account Head Name *';
        }
      },
      namePlaceholderByType() {
        switch (this.form.account_type) {
          case 'CASUAL_LABOR':
            return 'e.g. Raju Loader / Shyam Moulder';
          case 'LABOR_LEADER':
            return 'e.g. Moti Kumar (Thekedar)';
          case 'STAFF':
            return 'e.g. Rajesh Sharma (Plant Supervisor)';
          case 'LOANS_BORROWINGS':
            return 'e.g. Ramesh Bhai Unsecured Loan / HDFC Term Loan';
          case 'LOANS_ADVANCES':
            return 'e.g. Advance to Artisan / Security Deposit Rent';
          case 'CAPITAL':
            return 'e.g. Sharma Ji Partner Capital / Drawings';
          case 'DIRECT_EXPENSE':
            return 'e.g. Coal & Fuel / Direct Kiln Wages / Freight Inward';
          case 'EXPENSE':
            return 'e.g. Office Rent / Printing & Stationery / Audit Fees';
          case 'CASH':
            return 'e.g. Main Cash in Hand / Factory Cash Drawer';
          case 'BANK':
            return 'e.g. State Bank of India - Current A/c';
          default:
            return 'e.g. Ramesh Kumar / Acme Corp India';
        }
      }
    },
    watch: {
      show(isOpen) {
        if (isOpen) {
          this.syncForm();
          this.focusFirstInput();
        } else {
          this.resetForm();
        }
      },
      activeParty() {
        if (this.show) {
          this.syncForm();
        }
      }
    },
    methods: {
      resetForm() {
        const fallbackType = this.defaultType === 'SUPPLIER' || this.mode === 'purchase'
          ? 'SUNDRY_CREDITORS'
          : 'SUNDRY_DEBTORS';

        this.form = {
          id: null,
          _id: '',
          account_name: this.initialName ? this.initialName.trim() : '',
          account_type: fallbackType,
          phone: '',
          pan: '',
          aadhaar_number: '',
          bank_name: '',
          branch_name: '',
          account_number: '',
          ifsc_code: '',
          bank_account_type: 'CURRENT',
          is_default: false,
          status: 'ACTIVE',
          enable_beneficiary_banking: false,
          hsn_sac: '',
          gst_rate: null,
          description: '',
          opening_balance: 0,
          balance_type: 'CR',
          gstLocations: [
            { _uid: nextUid(), gstin: '', state: 'Maharashtra', stateCode: '27', address: '', pincode: '', isPrimary: true }
          ]
        };

        const matchedOpt = typeOptions.find(o => o.value === fallbackType);
        this.selectedPillar = matchedOpt ? matchedOpt.pillar : 'PARTIES';
      },
      syncForm() {
        this.resetForm();
        const p = this.activeParty;
        if (!p) {
          if (this.initialName) {
            this.form.account_name = this.initialName.trim();
          }
          return;
        }

        this.form.id = p.id || null;
        this.form._id = p._id ? String(p._id) : (p.id ? String(p.id) : '');
        this.form.account_name = p.account_name || p.name || this.initialName || '';

        // Determine Entity Type
        const rawType = (p.account_type || p.partyType || p.type || '').toUpperCase();
        if (rawType === 'CUSTOMER' || rawType === 'SUNDRY_DEBTORS') {
          this.form.account_type = 'SUNDRY_DEBTORS';
        } else if (rawType === 'SUPPLIER' || rawType === 'SUNDRY_CREDITORS') {
          this.form.account_type = 'SUNDRY_CREDITORS';
        } else if (typeOptions.some(opt => opt.value === rawType)) {
          this.form.account_type = rawType;
        } else {
          this.form.account_type = this.mode === 'purchase' ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS';
        }

        const matchedOpt = typeOptions.find(o => o.value === this.form.account_type);
        if (matchedOpt) this.selectedPillar = matchedOpt.pillar;

        this.form.phone = p.phone || p.contact || '';
        this.form.pan = p.pan ? p.pan.toUpperCase() : '';
        this.form.aadhaar_number = p.aadhaar_number || p.aadhaar || '';
        this.form.bank_name = p.bankName || p.bank_name || '';
        this.form.branch_name = p.branchName || p.branch_name || '';
        this.form.account_number = p.accountNumber || p.account_number || '';
        this.form.ifsc_code = p.ifscCode || p.ifsc_code ? (p.ifscCode || p.ifsc_code).toUpperCase() : '';
        this.form.bank_account_type = p.bank_account_type || 'CURRENT';
        this.form.is_default = !!p.is_default;
        this.form.status = p.status || 'ACTIVE';
        this.form.hsn_sac = p.hsn_sac || p.hsn || '';
        this.form.gst_rate = p.gst_rate !== undefined ? p.gst_rate : null;
        this.form.description = p.description || p.notes || '';
        this.form.opening_balance = p.openingBalance !== undefined ? p.openingBalance : (p.opening_balance || 0);
        this.form.balance_type = p.balanceType || p.balance_type || 'CR';

        if (this.form.bank_name || this.form.account_number || this.form.ifsc_code) {
          this.form.enable_beneficiary_banking = true;
        }

        // Parse GST Locations
        let locs = [];
        if (Array.isArray(p.gstLocations) && p.gstLocations.length > 0) {
          locs = p.gstLocations.map(l => ({
            _uid: nextUid(),
            gstin: (l.gstin && l.gstin !== 'UNREGISTERED') ? l.gstin.toUpperCase() : '',
            state: l.state || 'Maharashtra',
            stateCode: l.stateCode || '27',
            address: l.address || '',
            pincode: l.pincode || l.pin || '',
            isPrimary: !!l.isPrimary
          }));
        } else if (typeof p.gstLocations === 'string' && p.gstLocations.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(p.gstLocations);
            if (Array.isArray(parsed) && parsed.length > 0) {
              locs = parsed.map(l => ({
                _uid: nextUid(),
                gstin: (l.gstin && l.gstin !== 'UNREGISTERED') ? l.gstin.toUpperCase() : '',
                state: l.state || 'Maharashtra',
                stateCode: l.stateCode || '27',
                address: l.address || '',
                pincode: l.pincode || l.pin || '',
                isPrimary: !!l.isPrimary
              }));
            }
          } catch (_) {}
        }

        if (locs.length === 0) {
          const rawGstin = (p.gstin && p.gstin !== 'UNREGISTERED') ? p.gstin.toUpperCase() : '';
          const rawState = p.state || 'Maharashtra';
          const rawStateCode = p.stateCode || (rawGstin.length >= 2 ? rawGstin.substring(0, 2) : '27');
          locs.push({
            _uid: nextUid(),
            gstin: rawGstin,
            state: rawState,
            stateCode: rawStateCode,
            address: p.address || '',
            pincode: p.pin || p.pincode || '',
            isPrimary: true
          });
        }

        // Guarantee at least one is primary
        if (!locs.some(l => l.isPrimary)) {
          locs[0].isPrimary = true;
        }

        this.form.gstLocations = locs;
      },
      setType(val) {
        this.form.account_type = val;
        const matched = typeOptions.find(o => o.value === val);
        if (matched) this.selectedPillar = matched.pillar;
      },
      addGstLocation() {
        this.form.gstLocations.push({
          _uid: nextUid(),
          gstin: '',
          state: 'Maharashtra',
          stateCode: '27',
          address: '',
          pincode: '',
          isPrimary: false
        });
      },
      removeGstLocation(index) {
        if (this.form.gstLocations.length <= 1) return;
        const wasPrimary = this.form.gstLocations[index].isPrimary;
        this.form.gstLocations.splice(index, 1);
        if (wasPrimary && this.form.gstLocations.length > 0) {
          this.form.gstLocations[0].isPrimary = true;
        }
      },
      setPrimaryGstLocation(index) {
        this.form.gstLocations.forEach((loc, idx) => {
          loc.isPrimary = (idx === index);
        });
      },
      onGstinInput(loc) {
        loc.gstin = (loc.gstin || '').toUpperCase().trim();
        if (loc.gstin.length >= 2) {
          const code = loc.gstin.substring(0, 2);
          if (GST_STATE_MAP[code]) {
            loc.stateCode = code;
            loc.state = GST_STATE_MAP[code];
          }
        }
        // If PAN field is empty on identity, extract from GSTIN chars 2..12
        if (loc.gstin.length >= 12 && !this.form.pan) {
          this.form.pan = loc.gstin.substring(2, 12);
        }
      },
      focusFirstInput() {
        const tryFocus = () => {
          const container = (this.$el && typeof this.$el.querySelector === 'function') ? this.$el : document.querySelector('[role="dialog"]');
          const el = this.$refs.firstInput || (container && typeof container.querySelector === 'function' && container.querySelector('input.first-input, input[type="text"]:not([disabled])'));
          if (el && typeof el.focus === 'function' && el.offsetHeight > 0) {
            el.focus();
            if (typeof el.select === 'function') el.select();
            return true;
          }
          return false;
        };
        this.$nextTick(tryFocus);
        setTimeout(tryFocus, 25);
        setTimeout(tryFocus, 80);
        setTimeout(tryFocus, 180);
      },
      onInputEnter(e) {
        const target = e.target;
        if (target && target.tagName === 'TEXTAREA' && !e.ctrlKey) return;
        const formEl = (target && target.closest('form')) || (this.$el && typeof this.$el.querySelector === 'function' ? this.$el.querySelector('form') : document.querySelector('form'));
        if (!formEl) return;
        const focusable = Array.from(
          formEl.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
        ).filter(el => el.offsetHeight > 0);
        const idx = focusable.indexOf(target);
        if (idx > -1 && idx < focusable.length - 1) {
          e.preventDefault();
          focusable[idx + 1].focus();
          if (typeof focusable[idx + 1].select === 'function') focusable[idx + 1].select();
        } else {
          e.preventDefault();
          this.handleSave();
        }
      },
      onInputBackspace(e) {
        const target = e.target;
        if (!target) return;

        let shouldMoveBack = false;

        if (target instanceof HTMLInputElement) {
          const textTypes = ['text', 'number', 'search', 'tel', 'url', 'date', 'email', 'password'];
          if (textTypes.includes(target.type)) {
            // Only move back if field is empty or cursor is at the very beginning with no selection
            if (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0)) {
              shouldMoveBack = true;
            }
          } else if (target.type === 'checkbox' || target.type === 'radio') {
            shouldMoveBack = true;
          }
        } else if (target instanceof HTMLSelectElement) {
          // Select dropdowns have no text to delete, so backspace navigates to the previous field
          shouldMoveBack = true;
        } else if (target instanceof HTMLTextAreaElement) {
          if (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0)) {
            shouldMoveBack = true;
          }
        }

        if (shouldMoveBack) {
          const formEl = (target && target.closest('form')) || (this.$el && typeof this.$el.querySelector === 'function' ? this.$el.querySelector('form') : document.querySelector('form'));
          if (!formEl) return;
          const focusable = Array.from(
            formEl.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
          ).filter(el => el.offsetHeight > 0);
          const idx = focusable.indexOf(target);
          if (idx > 0) {
            e.preventDefault();
            const prev = focusable[idx - 1];
            prev.focus();
            if (typeof prev.select === 'function') prev.select();
          }
        }
      },
      handleGlobalKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('close');
        } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter'))) {
          e.preventDefault();
          e.stopPropagation();
          this.handleSave();
        } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          if (this.requiresGstSection) {
            e.preventDefault();
            e.stopPropagation();
            this.addGstLocation();
          }
        }
      },
      handleSave() {
        if (!this.form.account_name || !this.form.account_name.trim()) {
          alert('Party / Account Name is required');
          this.focusFirstInput();
          return;
        }

        const primaryLoc = this.form.gstLocations.find(l => l.isPrimary) || this.form.gstLocations[0] || {
          gstin: '',
          state: 'Maharashtra',
          stateCode: '27',
          address: '',
          pincode: ''
        };

        const payload = {
          id: this.form.id || (this.activeParty && this.activeParty.id) || null,
          _id: this.form._id || (this.activeParty && this.activeParty._id) || '',
          name: this.form.account_name.trim(),
          account_name: this.form.account_name.trim(),
          account_type: this.form.account_type,
          partyType: (this.form.account_type === 'SUNDRY_CREDITORS' || this.form.account_type === 'SUPPLIER') ? 'SUPPLIER' : 'CUSTOMER',
          gstin: primaryLoc.gstin || 'UNREGISTERED',
          contact: this.form.phone || '',
          phone: this.form.phone || '',
          pan: this.form.pan ? this.form.pan.toUpperCase().trim() : '',
          aadhaar_number: this.form.aadhaar_number || '',
          state: primaryLoc.state || 'Maharashtra',
          stateCode: primaryLoc.stateCode || '27',
          address: primaryLoc.address || '',
          pin: primaryLoc.pincode || '',
          pincode: primaryLoc.pincode || '',
          gstLocations: this.form.gstLocations.map(({ _uid, ...rest }) => rest),
          bankName: this.form.bank_name || '',
          bank_name: this.form.bank_name || '',
          branchName: this.form.branch_name || '',
          branch_name: this.form.branch_name || '',
          accountNumber: this.form.account_number || '',
          account_number: this.form.account_number || '',
          ifscCode: this.form.ifsc_code ? this.form.ifsc_code.toUpperCase().trim() : '',
          ifsc_code: this.form.ifsc_code ? this.form.ifsc_code.toUpperCase().trim() : '',
          bank_account_type: this.form.bank_account_type || 'CURRENT',
          is_default: !!this.form.is_default,
          status: this.form.status || 'ACTIVE',
          hsn_sac: this.form.hsn_sac || '',
          gst_rate: this.form.gst_rate,
          description: this.form.description || '',
          openingBalance: Number(this.form.opening_balance) || 0,
          opening_balance: Number(this.form.opening_balance) || 0,
          balanceType: this.form.balance_type || 'CR',
          balance_type: this.form.balance_type || 'CR'
        };

        this.$emit('save', payload);
      }
    },
    mounted() {
      this._windowKeyHandler = (e) => {
        if (!this.show) return;
        this.handleGlobalKeydown(e);
      };
      window.addEventListener('keydown', this._windowKeyHandler, true);
    },
    beforeUnmount() {
      if (this._windowKeyHandler) {
        window.removeEventListener('keydown', this._windowKeyHandler, true);
      }
    },
    template: `
      <div 
        v-if="show" 
        class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" 
        style="z-index: 100;"
        @click.self="$emit('close')"
      >
        <div 
          role="dialog"
          aria-modal="true"
          class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col"
        >
          <!-- Vibrant Gradient Header (Matching Nuxt 4 Emerald/Teal/Cyan) -->
          <header class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-white/20">
                  {{ isEditing ? 'Edit Master Record' : 'Universal Master Registration' }}
                </span>
                <span class="text-xs opacity-80 font-mono font-bold" v-if="form.id || form._id">
                  ID: #{{ form.id || form._id }}
                </span>
              </div>
              <h2 class="text-base sm:text-lg font-black uppercase tracking-tight mt-0.5">
                {{ isEditing ? ('Edit: ' + (form.account_name || 'Account Head')) : modalTitleByType }}
              </h2>
              <p class="text-[10px] font-bold text-emerald-100 uppercase tracking-wider mt-0.5">
                ENTER: NEXT FIELD • BACKSPACE: PREV FIELD • INSERT: ADD LOCATION • F8 / CTRL+S: SAVE • ESC: CLOSE
              </p>
            </div>
            <button 
              type="button" 
              @click="$emit('close')" 
              class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer text-xl font-bold"
              title="Close (ESC)"
            >
              &times;
            </button>
          </header>

          <!-- Scrollable Form Body -->
          <div class="overflow-y-auto p-5 sm:p-6 flex-1 custom-scrollbar space-y-4">
            <form @submit.prevent="handleSave" class="space-y-4" @keydown.enter="onInputEnter($event)" @keydown.backspace="onInputBackspace($event)">
              
              <!-- Classification Selector (Adaptive Switch with Category Pillars) -->
              <div class="p-3.5 bg-slate-50 dark:bg-zinc-800/70 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <div class="flex items-center justify-between">
                  <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    ACCOUNT CLASSIFICATION / ENTITY TYPE *
                  </label>
                  <span class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {{ selectedPillarLabel }}
                  </span>
                </div>

                <!-- Keyboard-accessible Entity Type Dropdown -->
                <div class="flex items-center gap-2">
                  <select
                    v-model="form.account_type"
                    @change="setType(form.account_type)"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <optgroup v-for="p in pillars.filter(x => x.id !== 'ALL')" :key="p.id" :label="p.label">
                      <option 
                        v-for="opt in typeOptions.filter(t => t.pillar === p.id)" 
                        :key="opt.value" 
                        :value="opt.value"
                      >
                        {{ opt.icon }} {{ opt.label }} ({{ opt.badge }})
                      </option>
                    </optgroup>
                  </select>
                </div>

                <!-- Category Pillar Tabs -->
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  <button
                    v-for="p in pillars"
                    :key="p.id"
                    type="button"
                    @click="selectedPillar = p.id"
                    class="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-1.5 cursor-pointer"
                    :class="selectedPillar === p.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'"
                  >
                    <span>{{ p.label }}</span>
                  </button>
                </div>

                <!-- Dynamic Entity Type Options Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                  <button
                    v-for="opt in filteredTypeOptions"
                    :key="opt.value"
                    type="button"
                    @click="setType(opt.value)"
                    class="px-2.5 py-2 rounded-xl text-left border text-xs font-black transition-all flex items-center justify-between gap-1.5 cursor-pointer"
                    :class="form.account_type === opt.value
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300'"
                  >
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-sm shrink-0">{{ opt.icon }}</span>
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <span 
                      v-if="opt.badge" 
                      class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tighter shrink-0"
                      :class="form.account_type === opt.value ? 'bg-emerald-200/60 text-emerald-900' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ opt.badge }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Section 1: Basic Identity Information -->
              <div class="p-4 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span class="text-emerald-600 font-bold">1.</span>
                  <span>BASIC IDENTITY & CREDENTIALS</span>
                </h3>

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <!-- Name -->
                  <div class="sm:col-span-6 space-y-1">
                    <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      {{ nameLabelByType }}
                    </label>
                    <input
                      ref="firstInput"
                      type="text"
                      v-model="form.account_name"
                      required
                      :placeholder="namePlaceholderByType"
                      class="first-input w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-bold text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <!-- Contact / Phone -->
                  <div class="sm:col-span-3 space-y-1" v-if="requiresContact">
                    <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      {{ isStaff ? 'Staff Mobile Phone *' : 'Contact Phone' }}
                    </label>
                    <input
                      type="text"
                      v-model="form.phone"
                      placeholder="10-digit Mobile"
                      class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-bold text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <!-- PAN Number -->
                  <div class="sm:col-span-3 space-y-1" v-if="requiresPan">
                    <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      {{ isStaff ? 'Employee PAN' : (isLoan ? 'Lender / Borrower PAN' : 'PAN Number') }}
                    </label>
                    <input
                      type="text"
                      v-model="form.pan"
                      maxlength="10"
                      placeholder="ABCDE1234F"
                      class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-mono font-bold uppercase text-xs text-slate-900 dark:text-white"
                      @input="form.pan = form.pan.toUpperCase()"
                    />
                  </div>

                  <!-- Aadhaar Number -->
                  <div class="sm:col-span-3 space-y-1" v-if="requiresAadhaar">
                    <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      {{ isCasualLabor ? 'Worker Aadhaar' : 'Aadhaar (12 Digits)' }}
                    </label>
                    <input
                      type="text"
                      v-model="form.aadhaar_number"
                      maxlength="12"
                      placeholder="123456789012"
                      class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-mono font-bold text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 2: Multi-Location GST Registrations (Visible ONLY for Commercial Parties) -->
              <div v-if="requiresGstSection" class="p-4 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span class="text-emerald-600 font-bold">2.</span>
                    <span>GST REGISTRATIONS & WAREHOUSE LOCATIONS</span>
                  </h3>
                  <button 
                    type="button" 
                    @click="addGstLocation" 
                    class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add Location (Insert)</span>
                  </button>
                </div>

                <div class="space-y-3">
                  <div 
                    v-for="(loc, index) in form.gstLocations" 
                    :key="loc._uid" 
                    class="bg-white dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700 p-3.5 relative transition-all shadow-2xs"
                    :class="{ 'ring-2 ring-emerald-500': loc.isPrimary }"
                  >
                    <div class="absolute top-2.5 right-2.5 flex items-center gap-2">
                      <label class="flex items-center gap-1 cursor-pointer select-none">
                        <input 
                          type="radio" 
                          name="primaryGstLocation" 
                          :checked="loc.isPrimary" 
                          @change="setPrimaryGstLocation(index)" 
                          class="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                        />
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Primary Location</span>
                      </label>
                      <button 
                        v-if="form.gstLocations.length > 1" 
                        type="button" 
                        @click="removeGstLocation(index)" 
                        class="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer text-xs font-bold"
                        title="Remove Location"
                      >
                        ✕
                      </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2">
                      <!-- GSTIN -->
                      <div class="sm:col-span-4 space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">GSTIN</label>
                        <input
                          type="text"
                          v-model="loc.gstin"
                          maxlength="15"
                          placeholder="27ABCDE1234F1Z5"
                          class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs uppercase text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                          @input="onGstinInput(loc)"
                        />
                      </div>

                      <!-- State Code -->
                      <div class="sm:col-span-2 space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">State Code</label>
                        <input
                          type="text"
                          v-model="loc.stateCode"
                          maxlength="2"
                          placeholder="27"
                          class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>

                      <!-- State -->
                      <div class="sm:col-span-4 space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">State Name</label>
                        <input
                          type="text"
                          v-model="loc.state"
                          placeholder="e.g. Maharashtra"
                          class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>

                      <!-- Pincode -->
                      <div class="sm:col-span-2 space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pincode</label>
                        <input
                          type="text"
                          v-model="loc.pincode"
                          maxlength="6"
                          placeholder="400001"
                          class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>

                      <!-- Full Address -->
                      <div class="sm:col-span-12 space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Full Address / Street</label>
                        <input
                          type="text"
                          v-model="loc.address"
                          placeholder="Street address, building, premises..."
                          class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Beneficiary Banking Opt-In Banner for Customer/Expense -->
              <div 
                v-if="canOfferBeneficiaryBanking && !requiresBankSection" 
                class="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-dashed border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-3"
              >
                <div>
                  <p class="text-xs font-black text-blue-950 dark:text-blue-200 uppercase tracking-tight">Beneficiary Bank & Payout Details (Optional)</p>
                  <p class="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mt-0.5">Need to record bank account details, NEFT/RTGS, or CMS digital payouts for this party?</p>
                </div>
                <button
                  type="button"
                  @click="form.enable_beneficiary_banking = true"
                  class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer shadow-xs"
                >
                  + Enable Banking
                </button>
              </div>

              <!-- Section 3: Banking & Treasury Details -->
              <div v-if="requiresBankSection" class="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span class="text-blue-600 font-bold">3.</span>
                      <span>{{ isBank ? 'Corporate Treasury Bank Account Details' : 'Beneficiary Banking & Digital Payout Details' }}</span>
                    </h3>
                    <p class="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase mt-0.5" v-if="!isBank">
                      Used for direct electronic transfers, UPI, NEFT, and bank records
                    </p>
                  </div>
                  <button
                    v-if="canOfferBeneficiaryBanking && !autoRequiresBank && form.enable_beneficiary_banking"
                    type="button"
                    @click="form.enable_beneficiary_banking = false"
                    class="text-[9px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider cursor-pointer"
                  >
                    Remove Banking
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <!-- IFSC Code -->
                  <div class="sm:col-span-3 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">IFSC Code</label>
                    <input
                      type="text"
                      v-model="form.ifsc_code"
                      maxlength="11"
                      placeholder="SBIN0001171"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold uppercase text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      @input="form.ifsc_code = (form.ifsc_code || '').toUpperCase()"
                    />
                  </div>

                  <!-- Bank Name -->
                  <div class="sm:col-span-3 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Bank Name</label>
                    <input
                      type="text"
                      v-model="form.bank_name"
                      placeholder="e.g. State Bank of India"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <!-- Branch Name -->
                  <div class="sm:col-span-3 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Branch / City</label>
                    <input
                      type="text"
                      v-model="form.branch_name"
                      placeholder="e.g. Nariman Point"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <!-- Account Number -->
                  <div class="sm:col-span-3 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Account Number</label>
                    <input
                      type="text"
                      v-model="form.account_number"
                      placeholder="A/C Number"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <!-- Bank-Specific Fields -->
                  <div v-if="isBank" class="sm:col-span-6 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Account Type</label>
                    <select
                      v-model="form.bank_account_type"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                    >
                      <option value="CURRENT">Current Account</option>
                      <option value="SAVINGS">Savings Account</option>
                      <option value="OD">Overdraft (OD)</option>
                      <option value="CC">Cash Credit (CC)</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div v-if="isBank" class="sm:col-span-6 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Status</label>
                    <select
                      v-model="form.status"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>

                  <div v-if="isBank" class="sm:col-span-12 mt-1">
                    <label class="flex items-center gap-3 p-3 rounded-xl bg-blue-100/60 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/60 cursor-pointer group transition-all">
                      <input
                        type="checkbox"
                        v-model="form.is_default"
                        class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <p class="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">Set as Primary Treasury Account</p>
                        <p class="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mt-0.5">Used by default for company payouts, transfers and receipts</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Section 4: HSN/SAC & Tax Rates (For Expense / Income / Taxes) -->
              <div v-if="requiresTaxHsnSection" class="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 space-y-3">
                <h3 class="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span class="text-amber-600 font-bold">4.</span>
                  <span>STATUTORY TAX RATES & HSN/SAC MAPPING</span>
                </h3>

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div class="sm:col-span-4 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">HSN / SAC Code</label>
                    <input
                      type="text"
                      v-model="form.hsn_sac"
                      placeholder="e.g. 996511"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  <div class="sm:col-span-4 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Default GST Rate (%)</label>
                    <select
                      v-model.number="form.gst_rate"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    >
                      <option :value="null">-- No Default Tax Rate --</option>
                      <option :value="0">0% (Nil / Exempt)</option>
                      <option :value="5">5% (Essential Goods/Services)</option>
                      <option :value="12">12% (Standard)</option>
                      <option :value="18">18% (Standard Services)</option>
                      <option :value="28">28% (Luxury / Sin)</option>
                    </select>
                  </div>

                  <div class="sm:col-span-4 space-y-1">
                    <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Description / Remarks</label>
                    <input
                      type="text"
                      v-model="form.description"
                      placeholder="Ledger purpose or remarks"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 5: Opening Balance -->
              <div class="p-4 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span class="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    FINANCIAL OPENING BALANCE (₹)
                  </span>
                  <p class="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    Initial balance brought forward into offline books
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    v-model.number="form.opening_balance"
                    placeholder="0.00"
                    class="w-36 px-3 py-1.5 text-right bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <select
                    v-model="form.balance_type"
                    class="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="CR">Credit (CR)</option>
                    <option value="DR">Debit (DR)</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          <!-- Modal Footer -->
          <footer class="px-6 py-3.5 bg-slate-100 dark:bg-zinc-800/70 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 rounded-xl text-xs font-black text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Discard (ESC)
            </button>

            <button
              type="button"
              @click="handleSave"
              :disabled="!form.account_name || !form.account_name.trim()"
              class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{{ isEditing ? 'Update Master (F8)' : 'Register Master (F8)' }}</span>
            </button>
          </footer>
        </div>
      </div>
    `
  };

  global.PartyModalComponent = PartyModalComponent;
  global.PartyAccountMasterModal = PartyModalComponent;
})(window);
