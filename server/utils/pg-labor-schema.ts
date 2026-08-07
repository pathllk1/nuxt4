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
          bank_name VARCHAR(255),
          account_number VARCHAR(50),
          ifsc_code VARCHAR(20),
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
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

    // Performance Indexes
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_leaders_firm ON labor_leaders(firm_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_periods_leader ON labor_periods(leader_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_workers_period ON labor_workers(period_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_attendance_worker ON labor_attendance(worker_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_expenses_period ON labor_expenses(period_id);`;
    await clientSql`CREATE INDEX IF NOT EXISTS idx_labor_advances_period ON labor_advances(period_id);`;

    console.log('✅ PostgreSQL Labor System tables schema verified/initialized');
  } catch (err: any) {
    console.error('⚠️ Failed to initialize Labor System tables schema:', err.message);
  }
};
