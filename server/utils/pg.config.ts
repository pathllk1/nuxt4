import postgres from 'postgres';

let sql: postgres.Sql<any> | null = null;
let pgReady = false;

/**
 * Initialize PostgreSQL connection using postgres-js
 */
export const connectPostgres = async (): Promise<postgres.Sql<any> | null> => {
  if (sql) return sql;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('⚠️ PostgreSQL connection skipped: No connection string found (POSTGRES_URL or DATABASE_URL)');
    return null;
  }

  try {
    sql = postgres(connectionString, {
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      connect_timeout: 15,
      onnotice: () => {},
    });

    // Test connection
    await sql`SELECT 1`;
    console.log('✅ PostgreSQL (postgres-js) connected in Nuxt server');
    pgReady = true;

    // Auto-migrate Documents table if not created yet
    await initDocumentsPgTable(sql);

  } catch (err: any) {
    console.error('⚠️ PostgreSQL connection failed:', err.message);
    sql = null;
    pgReady = false;
  }

  return sql;
};

export const getSql = (): postgres.Sql<any> | null => sql;
export const isPgReady = (): boolean => pgReady;

/**
 * Ensures the `documents` PostgreSQL table and performance indexes exist
 */
export const initDocumentsPgTable = async (clientSql?: postgres.Sql<any> | null) => {
  const db = clientSql || sql;
  if (!db) return;

  try {
    await db`
      CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firm_id VARCHAR(24) NOT NULL,
          user_id VARCHAR(24) NOT NULL,
          name VARCHAR(255) NOT NULL,
          reference_number VARCHAR(255) NOT NULL,
          description TEXT,
          start_date DATE,
          original_expiry_date DATE NOT NULL,
          closed_date DATE,
          extended_expiry_date DATE,
          value DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
          status VARCHAR(50) NOT NULL DEFAULT 'Active',
          file_url VARCHAR(1000),
          file_name VARCHAR(255),
          file_size BIGINT,
          file_type VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_documents_firm ON documents(firm_id);
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(extended_expiry_date, original_expiry_date);
    `;

    console.log('✅ PostgreSQL `documents` table schema verified/initialized');
  } catch (err: any) {
    console.error('⚠️ Failed to initialize `documents` table schema:', err.message);
  }
};
