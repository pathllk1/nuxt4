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

# Indexes
cur.execute('CREATE INDEX IF NOT EXISTS idx_bill_items_billId ON bill_items(billId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_stock_reg_stock_id ON stock_reg(stock_id);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_bills_partyId ON bills(partyId);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_bills_bno ON bills(bno);')

now = datetime.datetime.now().isoformat()
today = datetime.date.today().isoformat()

# Seed Firm Settings (GST OFF: gst_enabled = 0)
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
  'sales@apexhardware.demo',
  'https://apexhardware.demo',
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
  'HDFC Bank',
  '50200012345678',
  'Pimpri MIDC Branch',
  'HDFC0001234',
  'Net 30 Days',
  'INR',
  '[]',
  0, # GST OFF!
  now,
  now
))

# Seed 8 Stock Items (grate = 0)
demo_stocks = [
  (1, 'Bosch Cordless Drill Driver 18V', 'GSR-18V-50', 'Bosch', '8467', 35, 'PCS', 4850.00, 3950.00, 0, 171500.00, 5800.00, 5, '', '[]', 'Admin', now, now),
  (2, 'Makita Angle Grinder 850W 100mm', 'M0900B', 'Makita', '8467', 48, 'PCS', 2650.00, 2150.00, 0, 127200.00, 3200.00, 10, '', '[]', 'Admin', now, now),
  (3, 'Stanley 46-Piece Metric Socket Set', 'STMT72794-8', 'Stanley', '8204', 28, 'SET', 1750.00, 1400.00, 0, 49000.00, 2250.00, 5, '', '[]', 'Admin', now, now),
  (4, 'Taparia Heavy Duty Bench Vice 6 Inch', 'BV-06-HD', 'Taparia', '8205', 15, 'PCS', 3800.00, 3100.00, 0, 57000.00, 4500.00, 3, '', '[]', 'Admin', now, now),
  (5, 'Fluke 101 Pocket Digital Multimeter', 'FLUKE-101', 'Fluke', '9030', 22, 'PCS', 3150.00, 2550.00, 0, 69300.00, 3850.00, 4, '', '[]', 'Admin', now, now),
  (6, 'Karam Safety Helmet Ratchet Type', 'SHEL-RT-WHT', 'Karam', '6506', 120, 'PCS', 340.00, 260.00, 0, 40800.00, 480.00, 20, '', '[]', 'Admin', now, now),
  (7, '3M Cut-Resistant Gloves Comfort Grip L', '3M-CG-L', '3M', '6116', 180, 'PAIR', 190.00, 140.00, 0, 34200.00, 270.00, 25, '', '[]', 'Admin', now, now),
  (8, 'SKF Deep Groove Ball Bearing 6205-2RS', '6205-2RS1', 'SKF', '8482', 95, 'PCS', 220.00, 165.00, 0, 20900.00, 295.00, 15, '', '[]', 'Admin', now, now)
]

cur.executemany('''
INSERT INTO stocks (id, item, pno, oem, hsn, qty, uom, rate, cost_rate, grate, total, mrp, min_qty, batch, batches, user, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', demo_stocks)

# Seed Opening Balance Stock Register
cur.execute('''
INSERT INTO stock_reg (type, bno, bdate, supply, item_type, item, item_narration, batch, hsn, qty, uom, rate, grate, disc, total, cost_rate, stock_id, bill_id, partyName, qtyh, timestamp)
SELECT 'OPENING_BALANCE', 'OB-2026-001', ?, 'INWARD', 'GOODS', item, 'Initial physical inventory audit', '', hsn, qty, uom, rate, grate, 0, total, cost_rate, id, NULL, 'Opening Stock Balance', qty, ?
FROM stocks
''', (today, now))

# Seed Audit Log
cur.execute('''
INSERT INTO audit_log (action, details, timestamp) VALUES (?, ?, ?)
''', ('DEMO_INITIALIZATION', 'Created physical database.sqlite with Apex Industrial (GST OFF) and 8 demo stock items', now))

conn.commit()
conn.close()

size = os.path.getsize(db_path)
print(f"Database created at: {db_path} ({size} bytes)")
