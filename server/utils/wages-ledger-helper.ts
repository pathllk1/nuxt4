import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Ledger from '../models/Ledger';
import ChartOfAccounts from '../models/ChartOfAccounts';
import BankAccount from '../models/BankAccount';
import MasterRoll from '../models/MasterRoll';
import type { IWage } from '../models/Wage';

/* ─────────────────────────────────────────────────────────────────────────
   VALIDATION FUNCTIONS
───────────────────────────────────────────────────────────────────────── */

export async function validateWageForPosting(wage: IWage) {
  const errors: string[] = [];

  if (!wage.gross_salary || wage.gross_salary <= 0) {
    errors.push('Gross salary must be greater than 0');
  }

  if (!wage.net_salary || wage.net_salary <= 0) {
    errors.push('Net salary must be greater than 0');
  }

  const totalDeductions = (wage.epf_deduction || 0) +
                         (wage.esic_deduction || 0) +
                         (wage.other_deduction || 0) +
                         (wage.advance_deduction || 0);

  if (totalDeductions > wage.gross_salary) {
    errors.push(`Total deductions (${totalDeductions}) cannot exceed gross salary (${wage.gross_salary})`);
  }

  if (wage.paid_date && !wage.bank_account_id && wage.payment_mode !== 'CASH') {
    errors.push('Bank account is required for paid wages via non-cash mode');
  }

  if (wage.paid_date && !wage.payment_mode) {
    errors.push('Payment mode is required for paid wages');
  }

  if (!/^\d{4}-\d{2}$/.test(wage.salary_month)) {
    errors.push('Salary month must be in YYYY-MM format');
  }

  if (errors.length > 0) {
    throw new Error(`Wage validation failed: ${errors.join('; ')}`);
  }
}

export async function validateLedgerEntries(entries: any[], firmId: mongoose.Types.ObjectId, session: mongoose.ClientSession | null = null) {
  const errors: string[] = [];

  const totalDebits = entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    errors.push(`Debits (${totalDebits.toFixed(2)}) != Credits (${totalCredits.toFixed(2)})`);
  }

  for (const entry of entries) {
    const account = await ChartOfAccounts.findOne({
      firm_id: firmId,
      account_name: entry.accountHead,
      is_active: true,
    }).session(session).lean();

    if (!account) {
      errors.push(`Account head not found or inactive: ${entry.accountHead}`);
    }
  }

  for (const entry of entries) {
    if ((entry.debitAmount || 0) === 0 && (entry.creditAmount || 0) === 0) {
      errors.push(`Zero-amount entry for ${entry.accountHead}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Ledger validation failed: ${errors.join('; ')}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ACCOUNT RESOLUTION
───────────────────────────────────────────────────────────────────────── */

export async function resolveAccountHead(firmId: mongoose.Types.ObjectId, accountName: string, accountType: string, userId: mongoose.Types.ObjectId | string, session: mongoose.ClientSession | null = null) {
  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: accountName,
  }).session(session).lean();

  if (account) {
    if (account.account_type !== accountType) {
      console.log(`⚠️ Account "${accountName}" found with type ${account.account_type}, expected ${accountType}. Using existing.`);
    }
    
    if (!account.is_active) {
      await ChartOfAccounts.updateOne(
        { _id: account._id },
        { $set: { is_active: true, updated_by: userId } },
        { session: session || undefined }
      );
    }
    
    return account;
  }

  const createdAccounts = await ChartOfAccounts.create([{
    firm_id: firmId,
    account_name: accountName,
    account_type: accountType,
    is_system: true,
    is_active: true,
    created_by: userId,
    updated_by: userId,
  }], { session });
  
  return createdAccounts[0]!.toObject();
}

export async function resolveBankAccount(firmId: mongoose.Types.ObjectId, bankAccountId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId | string, session: mongoose.ClientSession | null = null) {
  const bankAcc = await BankAccount.findOne({
    _id: bankAccountId,
    firm_id: firmId,
    status: { $ne: 'INACTIVE' },
  }).session(session).lean();

  if (!bankAcc) {
    throw new Error(`Bank account not found or inactive: ${bankAccountId}`);
  }

  // Use the exact account_name from the centralized BankAccount model to prevent duplicate COA creation
  const accountName = bankAcc.account_name;
  return await resolveAccountHead(firmId, accountName, 'BANK', userId, session);
}

export async function getDefaultCashAccount(firmId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId | string, session: mongoose.ClientSession | null = null) {
  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: 'Cash in Hand',
  }).session(session).lean();

  if (account) {
    if (!account.is_active) {
      await ChartOfAccounts.updateOne(
        { _id: account._id },
        { $set: { is_active: true, updated_by: userId } },
        { session: session || undefined }
      );
    }
    return account;
  }

  const createdAccounts = await ChartOfAccounts.create([{
    firm_id: firmId,
    account_name: 'Cash in Hand',
    account_type: 'CASH',
    is_system: true,
    is_active: true,
    created_by: userId,
    updated_by: userId,
  }], { session });
  
  return createdAccounts[0]!.toObject();
}

/* ─────────────────────────────────────────────────────────────────────────
   LEDGER POSTING
───────────────────────────────────────────────────────────────────────── */

export async function postWageLedger(wage: IWage, session: mongoose.ClientSession) {
  await validateWageForPosting(wage);

  const voucherId = uuidv4();
  const entries: any[] = [];
  const firmId = wage.firm_id;
  const userId = wage.created_by || wage.updated_by;
  const transactionDate = wage.paid_date || new Date().toISOString().split('T')[0];

  try {
    const employee = await MasterRoll.findById(wage.master_roll_id).session(session).lean();
    const empName = employee?.employee_name || 'Unknown Employee';

    const expenseAccount = await resolveAccountHead(firmId, 'Salaries & Wages', 'EXPENSE', userId, session);
    entries.push({
      firmId: firmId,
      accountHead: expenseAccount.account_name,
      accountType: expenseAccount.account_type,
      debitAmount: wage.gross_salary,
      creditAmount: 0,
      refType: 'WAGE',
      refId: wage._id,
      masterRollId: wage.master_roll_id,
      voucherGroupId: voucherId,
      transactionDate: transactionDate,
      narration: `Wages for ${wage.salary_month} - ${empName}`,
      isWageEntry: true,
    });

    if ((wage.other_benefit || 0) > 0) {
      const benefitAccount = await resolveAccountHead(firmId, 'Staff Benefits', 'EXPENSE', userId, session);
      entries.push({
        firmId: firmId,
        accountHead: benefitAccount.account_name,
        accountType: benefitAccount.account_type,
        debitAmount: wage.other_benefit,
        creditAmount: 0,
        refType: 'WAGE',
        refId: wage._id,
        masterRollId: wage.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `Other Benefits for ${empName} - ${wage.salary_month}`,
        isWageEntry: true,
      });
    }

    let bankAccount;
    if (wage.paid_date && wage.bank_account_id) {
      bankAccount = await resolveBankAccount(firmId, wage.bank_account_id, userId, session);
    } else {
      bankAccount = await getDefaultCashAccount(firmId, userId, session);
    }

    entries.push({
      firmId: firmId,
      accountHead: bankAccount.account_name,
      accountType: bankAccount.account_type,
      debitAmount: 0,
      creditAmount: wage.net_salary,
      refType: 'WAGE',
      refId: wage._id,
      masterRollId: wage.master_roll_id,
      voucherGroupId: voucherId,
      bankAccountId: wage.bank_account_id || null,
      paymentMode: wage.payment_mode || null,
      transactionDate: transactionDate,
      narration: `Wages paid to ${empName} - ${wage.salary_month}${wage.cheque_no ? ` - Chq: ${wage.cheque_no}` : ''}`,
      isWageEntry: true,
    });

    if ((wage.epf_deduction || 0) > 0) {
      const epfAccount = await resolveAccountHead(firmId, 'EPF Payable', 'PAYABLE', userId, session);
      entries.push({
        firmId: firmId,
        accountHead: epfAccount.account_name,
        accountType: epfAccount.account_type,
        debitAmount: 0,
        creditAmount: wage.epf_deduction,
        refType: 'WAGE',
        refId: wage._id,
        masterRollId: wage.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `EPF Payable for ${empName} - ${wage.salary_month}`,
        isWageEntry: true,
      });
    }

    if ((wage.esic_deduction || 0) > 0) {
      const esicAccount = await resolveAccountHead(firmId, 'ESIC Payable', 'PAYABLE', userId, session);
      entries.push({
        firmId: firmId,
        accountHead: esicAccount.account_name,
        accountType: esicAccount.account_type,
        debitAmount: 0,
        creditAmount: wage.esic_deduction,
        refType: 'WAGE',
        refId: wage._id,
        masterRollId: wage.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `ESIC Payable for ${empName} - ${wage.salary_month}`,
        isWageEntry: true,
      });
    }

    if ((wage.other_deduction || 0) > 0) {
      const otherAccount = await resolveAccountHead(firmId, 'Other Deductions', 'PAYABLE', userId, session);
      entries.push({
        firmId: firmId,
        accountHead: otherAccount.account_name,
        accountType: otherAccount.account_type,
        debitAmount: 0,
        creditAmount: wage.other_deduction,
        refType: 'WAGE',
        refId: wage._id,
        masterRollId: wage.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `Other Deductions for ${empName} - ${wage.salary_month}`,
        isWageEntry: true,
      });
    }

    if ((wage.advance_deduction || 0) > 0) {
      const advanceAccount = await resolveAccountHead(firmId, 'Advance to Employees', 'ASSET', userId, session);
      entries.push({
        firmId: firmId,
        accountHead: advanceAccount.account_name,
        accountType: advanceAccount.account_type,
        debitAmount: 0,
        creditAmount: wage.advance_deduction,
        refType: 'WAGE',
        refId: wage._id,
        masterRollId: wage.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `Advance Recovery from ${empName} - ${wage.salary_month}`,
        isWageEntry: true,
      });
    }

    await validateLedgerEntries(entries, firmId, session);
    await Ledger.insertMany(entries, { session });
    return voucherId;

  } catch (error: any) {
    throw new Error(`Ledger posting failed: ${error.message}`);
  }
}

export async function deleteWageLedger(wageId: mongoose.Types.ObjectId, firmId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  try {
    const result = await Ledger.deleteMany(
      {
        refType: 'WAGE',
        refId: wageId,
        firmId: firmId,
      },
      { session }
    );
    return result.deletedCount;
  } catch (error: any) {
    throw new Error(`Ledger deletion failed: ${error.message}`);
  }
}

export async function recalculateWageLedger(wage: IWage, session: mongoose.ClientSession) {
  try {
    await deleteWageLedger(wage._id as mongoose.Types.ObjectId, wage.firm_id, session);
    return await postWageLedger(wage, session);
  } catch (error: any) {
    throw new Error(`Ledger recalculation failed: ${error.message}`);
  }
}
