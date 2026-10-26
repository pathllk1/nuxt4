import sqlite3
import os
import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(script_dir)
db_path = os.path.join(root_dir, 'database.sqlite')

if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Stocks
cur.execute('''
CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  pno TEXT,
  oem TEXT,
  hsn TEXT,
  qty REAL DEFAULT 0,
  uom TEXT DEFAULT 'PCS',
  rate REAL DEFAULT 0,
  cost_rate REAL DEFAULT 0,
  grate REAL DEFAULT 0,
  total REAL DEFAULT 0,
  mrp REAL DEFAULT 0,
  min_qty REAL DEFAULT 5,
  batch TEXT DEFAULT '',
  batches TEXT DEFAULT '[]',
  user TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 2. Parties
cur.execute('''
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gstin TEXT DEFAULT 'UNREGISTERED',
  contact TEXT,
  state TEXT DEFAULT 'Maharashtra',
  stateCode TEXT DEFAULT '27',
  address TEXT,
  pin TEXT,
  pan TEXT,
  gstLocations TEXT DEFAULT '[]',
  partyType TEXT NOT NULL DEFAULT 'CUSTOMER',
  openingBalance REAL DEFAULT 0,
  balanceType TEXT DEFAULT 'CR',
  currentBalance REAL DEFAULT 0,
  bankName TEXT,
  accountNumber TEXT,
  ifscCode TEXT,
  branchName TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 3. Bills
cur.execute('''
CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bno TEXT NOT NULL UNIQUE,
  bdate TEXT NOT NULL,
  btype TEXT NOT NULL,
  billSubtype TEXT,
  invoiceMode TEXT DEFAULT 'INVENTORY',
  partyId INTEGER,
  partyName TEXT NOT NULL,
  partyGstin TEXT,
  partyAddress TEXT,
  partyState TEXT,
  partyStateCode TEXT,
  partyPin TEXT,
  firmGstin TEXT,
  firmState TEXT,
  firmStateCode TEXT,
  grossTotal REAL DEFAULT 0,
  taxableTotal REAL DEFAULT 0,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0,
  cess REAL DEFAULT 0,
  roundOff REAL DEFAULT 0,
  netTotal REAL NOT NULL,
  reverseCharge INTEGER DEFAULT 0,
  supplierBillNo TEXT,
  orderNo TEXT,
  vehicleNo TEXT,
  dispatchThrough TEXT,
  narration TEXT,
  refBillId INTEGER,
  refBillNo TEXT,
  status TEXT DEFAULT 'ACTIVE',
  consigneeName TEXT,
  consigneeGstin TEXT,
  consigneeAddress TEXT,
  consigneeState TEXT,
  consigneePin TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 4. Bill Items
cur.execute('''
CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billId INTEGER NOT NULL,
  stockId INTEGER,
  item TEXT NOT NULL,
  hsn TEXT,
  qty REAL NOT NULL,
  uom TEXT DEFAULT 'PCS',
  rate REAL NOT NULL,
  grate REAL DEFAULT 0,
  disc REAL DEFAULT 0,
  taxable REAL NOT NULL,
  total REAL NOT NULL,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0,
  batch TEXT,
  itemType TEXT DEFAULT 'GOODS',
  narration TEXT
);
''')

# 5. Stock Register
cur.execute('''
CREATE TABLE IF NOT EXISTS stock_reg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  bno TEXT,
  bdate TEXT,
  supply TEXT,
  item_type TEXT DEFAULT 'GOODS',
  item TEXT NOT NULL,
  item_narration TEXT,
  batch TEXT,
  hsn TEXT,
  qty REAL NOT NULL,
  uom TEXT DEFAULT 'PCS',
  rate REAL DEFAULT 0,
  grate REAL DEFAULT 0,
  disc REAL DEFAULT 0,
  total REAL DEFAULT 0,
  cost_rate REAL DEFAULT 0,
  stock_id INTEGER,
  bill_id INTEGER,
  partyName TEXT,
  qtyh REAL NOT NULL,
  timestamp TEXT NOT NULL
);
''')

# 6. Audit Log
cur.execute('''
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);
''')

# 7. Firm Settings
cur.execute('''
CREATE TABLE IF NOT EXISTS firm_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  legal_name TEXT,
  code TEXT,
  description TEXT,
  phone_number TEXT,
  secondary_phone TEXT,
  email TEXT,
  website TEXT,
  business_type TEXT DEFAULT 'Partnership / LLP',
  industry_type TEXT,
  establishment_year INTEGER,
  employee_count INTEGER DEFAULT 0,
  registration_number TEXT,
  registration_date TEXT,
  cin_number TEXT,
  pan_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch TEXT,
  ifsc_code TEXT,
  payment_terms TEXT,
  currency TEXT DEFAULT 'INR',
  locations TEXT DEFAULT '[]',
  gst_enabled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 8. Bank Accounts
cur.execute('''
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL,
  account_holder_name TEXT,
  bank_name TEXT NOT NULL,
  branch_name TEXT,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  account_type TEXT DEFAULT 'CURRENT',
  upi_id TEXT,
  notes TEXT,
  opening_balance REAL DEFAULT 0,
  balance_type TEXT DEFAULT 'DR',
  current_balance REAL DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 9. Chart of Accounts (COA)
cur.execute('''
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL,
  bs_classification TEXT,
  description TEXT,
  pan TEXT,
  gstin TEXT,
  phone TEXT,
  is_system INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 10. General Ledger (Double-Entry Ledger)
cur.execute('''
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transactionDate TEXT NOT NULL,
  accountHead TEXT NOT NULL,
  accountType TEXT NOT NULL,
  debitAmount REAL DEFAULT 0,
  creditAmount REAL DEFAULT 0,
  narration TEXT,
  voucherGroupId TEXT NOT NULL,
  voucherNo TEXT NOT NULL,
  voucherType TEXT NOT NULL,
  refType TEXT DEFAULT 'VOUCHER',
  refId INTEGER,
  partyId INTEGER,
  bankAccountId INTEGER,
  stockId INTEGER,
  stockRegId INTEGER,
  paymentMode TEXT,
  createdBy TEXT DEFAULT 'Admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
''')

# 11. Voucher Sequences
cur.execute('''
CREATE TABLE IF NOT EXISTS voucher_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucherType TEXT NOT NULL,
  financialYear TEXT NOT NULL,
  currentSequence INTEGER DEFAULT 0,
  UNIQUE(voucherType, financialYear)
);
''')

# 12. Period Locks
cur.execute('''
CREATE TABLE IF NOT EXISTS period_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lockDate TEXT NOT NULL,
  reason TEXT,
  lockedBy TEXT DEFAULT 'Admin',
  created_at TEXT NOT NULL
);
''')

# Indexes
cur.execute('CREATE INDEX IF NOT EXISTS idx_bill_items_billId ON bill_items(billId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_stock_reg_stock_id ON stock_reg(stock_id);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_bills_partyId ON bills(partyId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_bills_bno ON bills(bno);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_ledger_voucherGroupId ON ledger(voucherGroupId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_ledger_voucherNo ON ledger(voucherNo);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_ledger_transactionDate ON ledger(transactionDate);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_ledger_accountHead ON ledger(accountHead);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_ledger_partyId ON ledger(partyId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_ledger_bankAccountId ON ledger(bankAccountId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_coa_account_name ON chart_of_accounts(account_name);')

now = datetime.datetime.now().isoformat()

# Seed Firm Creation (WITHOUT GST: gst_enabled = 0)
cur.execute('''
INSERT INTO firm_settings (
  name, legal_name, code, description, phone_number, secondary_phone, email, website,
  business_type, industry_type, establishment_year, employee_count, registration_number,
  pan_number, address, city, state, country, pincode, bank_name, bank_account_number,
  bank_branch, ifsc_code, payment_terms, currency, locations, gst_enabled, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', (
  'Apex Industrial & Hardware Mart',
  'Apex Industrial & Hardware Mart LLP',
  'APEX-01',
  'Wholesale & Retail Distributor of Tools, Hardware, Bearings, and Safety Gear',
  '+91 98765 43210',
  '+91 98230 11223',
  'sales@apexhardware.in',
  'https://apexhardware.in',
  'Partnership / LLP',
  'Industrial & Hardware Supplies',
  2021,
  12,
  'REG-MH-2021-8841',
  'AAFAA1234K',
  'Plot 42, Sector 10, MIDC Industrial Area',
  'Pune',
  'Maharashtra',
  'India',
  '411018',
  '',
  '',
  '',
  '',
  'Net 30 Days',
  'INR',
  '[]',
  0, # WITHOUT GST
  now,
  now
))

# Seed Universal Chart of Accounts (COA) - Essential double-entry system accounts only (Zero Fake Data)
default_coa = [
  ('Cash in Hand', 'CASH', 'BALANCE_SHEET', 'Liquid physical cash kept in store petty cash register', 1, 1),
  ('Sales', 'INCOME', 'PNL', 'Revenue earned from outward sales of goods and supplies', 1, 1),
  ('Purchases', 'EXPENSE', 'PNL', 'Cost of goods procured from wholesale suppliers', 1, 1),
  ('Inventory', 'ASSET', 'BALANCE_SHEET', 'Total value of physical stocks on hand', 1, 1),
  ('COGS', 'EXPENSE', 'PNL', 'Cost of goods sold during sales invoicing', 1, 1),
  ('Round Off', 'GENERAL', 'PNL', 'Fractional rounding differences on invoices and vouchers', 1, 1),
  ('Stock Adjustment', 'INCOME', 'PNL', 'Gains or losses arising from physical inventory audits', 1, 1),
  ('Capital Account', 'CAPITAL', 'BALANCE_SHEET', 'Partner equity investment and retained business reserves', 1, 1),
  ('Opening Balance', 'CAPITAL', 'BALANCE_SHEET', 'Initial balance migration offset account', 1, 1),
  ('Difference in Opening Balances', 'CAPITAL', 'BALANCE_SHEET', 'Temporary suspense for unallocated opening entries', 1, 1),
  ('CGST Input Credit', 'ASSET', 'BALANCE_SHEET', 'Central GST tax credit claimable on inward purchases', 1, 1),
  ('SGST Input Credit', 'ASSET', 'BALANCE_SHEET', 'State GST tax credit claimable on inward purchases', 1, 1),
  ('IGST Input Credit', 'ASSET', 'BALANCE_SHEET', 'Integrated GST tax credit claimable on inter-state purchases', 1, 1),
  ('Cess Input Credit', 'ASSET', 'BALANCE_SHEET', 'GST Compensation Cess claimable on inward purchases', 1, 1),
  ('CGST Payable', 'LIABILITY', 'BALANCE_SHEET', 'Central GST collected on outward taxable sales', 1, 1),
  ('SGST Payable', 'LIABILITY', 'BALANCE_SHEET', 'State GST collected on outward taxable sales', 1, 1),
  ('IGST Payable', 'LIABILITY', 'BALANCE_SHEET', 'Integrated GST collected on inter-state outward taxable sales', 1, 1),
  ('Cess Payable', 'LIABILITY', 'BALANCE_SHEET', 'GST Cess collected on outward taxable sales', 1, 1),
  ('TDS Payable u/s 194C', 'DUTIES_AND_TAXES', 'BALANCE_SHEET', 'TDS withheld from contractor and vendor payments', 1, 1),
  ('Salaries & Wages', 'EXPENSE', 'PNL', 'Remuneration paid to staff and laborers', 1, 1),
  ('Office Rent', 'EXPENSE', 'PNL', 'Monthly commercial premises rent and lease charges', 0, 1),
  ('Electricity & Utilities', 'EXPENSE', 'PNL', 'Power, internet, water, and essential facility utilities', 0, 1),
  ('Freight & Logistics', 'DIRECT_EXPENSE', 'PNL', 'Transportation and courier charges on goods movement', 0, 1),
]

cur.executemany('''
INSERT INTO chart_of_accounts (account_name, account_type, bs_classification, description, is_system, is_active, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
''', [(row[0], row[1], row[2], row[3], row[4], row[5], now, now) for row in default_coa])

# Seed Initial Voucher Sequences (Clean 0 start)
sequences = [
  ('OPENING_BALANCE', '2026-27', 0),
  ('PAYMENT', '2026-27', 0),
  ('RECEIPT', '2026-27', 0),
  ('CONTRA', '2026-27', 0),
  ('JOURNAL', '2026-27', 0),
  ('SALES', '2026-27', 0),
  ('PURCHASE', '2026-27', 0),
  ('CREDIT_NOTE', '2026-27', 0),
  ('DEBIT_NOTE', '2026-27', 0),
  ('PROFORMA', '2026-27', 0),
  ('DELIVERY_NOTE', '2026-27', 0),
]

cur.executemany('''
INSERT OR IGNORE INTO voucher_sequences (voucherType, financialYear, currentSequence)
VALUES (?, ?, ?)
''', sequences)

conn.commit()
conn.close()

size = os.path.getsize(db_path)
print(f"Clean Production Database created at: {db_path} ({size} bytes)")
