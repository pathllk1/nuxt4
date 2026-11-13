import postgres from 'postgres';

/**
 * Ensures PostgreSQL tables and indexes exist for the Labor Management System
 */
export const initLaborPgTables = async (clientSql: postgres.Sql<any> | null) => {
  if (!clientSql) return;

  try {
    // 1. Labor Leaders
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_leaders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firm_id VARCHAR(24) NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          pan VARCHAR(10),
          aadhaar_number VARCHAR(12),
          gst_number VARCHAR(15),
          bank_name VARCHAR(255),
          account_number VARCHAR(50),
          ifsc_code VARCHAR(20),
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Safe non-destructive column additions for existing live tables
    await clientSql`
      ALTER TABLE labor_leaders 
      ADD COLUMN IF NOT EXISTS pan VARCHAR(10),
      ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12),
      ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15);
    `;

    // 2. Labor Periods (Work Batches)
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_periods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firm_id VARCHAR(24) NOT NULL,
          leader_id UUID REFERENCES labor_leaders(id) ON DELETE CASCADE,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(20) DEFAULT 'Open',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. Labor Workers (Dynamic roster per period)
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_workers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          period_id UUID REFERENCES labor_periods(id) ON DELETE CASCADE,
          labor_name VARCHAR(255) NOT NULL,
          daily_wage DECIMAL(12, 2) NOT NULL DEFAULT 0,
          total_present_days DECIMAL(5, 1) DEFAULT 0,
          total_wages DECIMAL(12, 2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Labor Attendance (Daily log: 0 = Leave, 0.5 = Half, 1 = Full, 1.5/2/2.5 = Overtime)
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_attendance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          worker_id UUID REFERENCES labor_workers(id) ON DELETE CASCADE,
          attendance_date DATE NOT NULL,
          day_value DECIMAL(3, 1) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(worker_id, attendance_date)
      );
    `;

    // 5. Labor Expenses (Dynamic period expenses)
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          period_id UUID REFERENCES labor_periods(id) ON DELETE CASCADE,
          description VARCHAR(255) NOT NULL,
          amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 6. Labor Advances
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_advances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firm_id VARCHAR(24) NOT NULL,
          period_id UUID REFERENCES labor_periods(id) ON DELETE CASCADE,
          amount DECIMAL(12, 2) NOT NULL,
          payment_date DATE NOT NULL,
          paid_from_bank_account_id VARCHAR(24),
          ledger_voucher_group_id VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 7. Labor Settlements (Final Payout)
    await clientSql`
      CREATE TABLE IF NOT EXISTS labor_settlements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          period_id UUID REFERENCES labor_periods(id) ON DELETE CASCADE,
          total_wages DECIMAL(12, 2) NOT NULL,
          total_expenses DECIMAL(12, 2) NOT NULL,
          total_advances DECIMAL(12, 2) NOT NULL,
          net_payable DECIMAL(12, 2) NOT NULL,
          paid_amount DECIMAL(12, 2) NOT NULL,
          payment_date DATE NOT NULL,
          paid_from_bank_account_id VARCHAR(24),
          ledger_voucher_group_id VARCHAR(100),
          adjustment_reason VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Safe non-destructive column additions for existing live tables
    await clientSql`
      ALTER TABLE labor_advances 
      ADD COLUMN IF NOT EXISTS paid_from_bank_account_id VARCHAR(24),
      ADD COLUMN IF NOT EXISTS ledger_voucher_group_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tds_mode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS leg_index INT DEFAULT 0;
    `;

    await clientSql`
      ALTER TABLE labor_settlements 
      ADD COLUMN IF NOT EXISTS paid_from_bank_account_id VARCHAR(24),
      ADD COLUMN IF NOT EXISTS ledger_voucher_group_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS adjustment_reason VARCHAR(255),
      ADD COLUMN IF NOT EXISTS tds_mode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12, 2);
    `;

    // ── Preflight and Conflict Detection before Indexing (F-06, F-09) ──
    // 1. Classify and Detect Duplicate Advance Rows before Indexing (F-06)
    // Never silently turn duplicate retry rows into distinct legs by assigning sequential indexes!
    const duplicateAdvances = await clientSql`
      SELECT firm_id, period_id, ledger_voucher_group_id, COUNT(*) as count, ARRAY_AGG(id) as advance_ids, ARRAY_AGG(amount) as amounts
      FROM labor_advances
      WHERE ledger_voucher_group_id IS NOT NULL
      GROUP BY firm_id, period_id, ledger_voucher_group_id
      HAVING COUNT(*) > 1;
    `;

    if (duplicateAdvances && duplicateAdvances.length > 0) {
      const conflictSummary = duplicateAdvances
        .map((r: any) => `Group "${r.ledger_voucher_group_id}" in Period #${r.period_id} (${r.count} duplicate rows: IDs [${(r.advance_ids || []).join(', ')}], amounts [${(r.amounts || []).join(', ')}])`)
        .join('; ');
      console.error(`🚨 [Labor Schema Critical] Conflicting duplicate labor advance rows detected: ${conflictSummary}`);
      throw new Error(
        `[Labor Schema Conflict - F-06] Duplicate advance records detected: ${conflictSummary}. ` +
        `Startup readiness blocked to prevent duplicate financial effects. Reconcile duplicate rows before initialization.`
      );
    }

    // Assign default leg_index = 0 for single-leg advances where leg_index is not yet set
    await clientSql`
      UPDATE labor_advances
      SET leg_index = 0
      WHERE leg_index IS NULL;
    `;

    // 2. Non-Destructive Duplicate Settlement Detection (F-09)
    // Never silently discard financial records during schema initialization!
    // Detect duplicates, preserve all source rows, and block readiness with a conflict report.
    const duplicateSettlements = await clientSql`
      SELECT period_id, COUNT(*) as count, ARRAY_AGG(id) as settlement_ids
      FROM labor_settlements
      GROUP BY period_id
      HAVING COUNT(*) > 1;
    `;

    if (duplicateSettlements && duplicateSettlements.length > 0) {
      const conflictSummary = duplicateSettlements
        .map((r: any) => `Period #${r.period_id} (${r.count} records: IDs [${(r.settlement_ids || []).join(', ')}])`)
        .join('; ');
      console.error(`🚨 [Labor Schema Critical] Conflicting duplicate labor settlement rows detected: ${conflictSummary}`);
      throw new Error(
        `[Labor Schema Conflict - F-09] Duplicate settlement records detected for periods: ${conflictSummary}. ` +
        `Startup readiness blocked to prevent financial data loss. Preserve all records and perform explicit reviewed reconciliation.`
      );
    }

    // Performance & Idempotency Indexes (F-06)
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_leaders_firm ON labor_leaders(firm_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_periods_leader ON labor_periods(leader_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_workers_period ON labor_workers(period_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_attendance_worker ON labor_attendance(worker_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_expenses_period ON labor_expenses(period_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_advances_period ON labor_advances(period_id);`;
    await clientSql`CREATE UNIQUE INDEX IF NOT EXISTS uq_labor_advances_vg_leg ON labor_advances (firm_id, period_id, ledger_voucher_group_id, leg_index);`;
    await clientSql`CREATE UNIQUE INDEX IF NOT EXISTS uq_labor_settlements_period ON labor_settlements (period_id);`;

    console.log('✅ PostgreSQL Labor System tables schema verified/initialized');
  } catch (err: any) {
    console.error('⚠️ Failed to initialize Labor System tables schema:', err.message);
    throw err;
  }
};
