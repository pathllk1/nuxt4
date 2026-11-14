import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Ledger from '../models/Ledger';
import ChartOfAccounts from '../models/ChartOfAccounts';
import BankAccount from '../models/BankAccount';
import MasterRoll from '../models/MasterRoll';
import type { IWage } from '../models/Wage';
import { computeEmployerEsic } from '../../shared/utils/statutory-rates';
import type { IVoucherLeg } from '../types/accounting';

export const toCurrency = (val: number): number => Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;

/* ─────────────────────────────────────────────────────────────────────────
   VALIDATION FUNCTIONS
───────────────────────────────────────────────────────────────────────── */

export async function validateWageForPosting(wage: IWage) {
  const errors: string[] = [];

  if (wage.gross_salary === undefined || wage.gross_salary === null || wage.gross_salary <= 0) {
    errors.push('Gross salary must be greater than 0');
  }

  if (wage.net_salary === undefined || wage.net_salary === null || wage.net_salary < 0) {
    errors.push('Net salary must be greater than or equal to 0');
  }

  const totalDeductions = (wage.epf_deduction || 0) +
                         (wage.esic_deduction || 0) +
                         (wage.professional_tax || 0) +
                         (wage.other_deduction || 0) +
                         (wage.advance_deduction || 0);

  if (totalDeductions > (wage.gross_salary + (wage.other_benefit || 0))) {
    errors.push(`Total deductions (${totalDeductions}) cannot exceed gross earnings (${wage.gross_salary + (wage.other_benefit || 0)})`);
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
   DISBURSEMENT QUERY HELPER
───────────────────────────────────────────────────────────────────────── */

export async function getWageDisbursedAmount(
  wageId: mongoose.Types.ObjectId | string,
  firmId: mongoose.Types.ObjectId | string,
  session?: mongoose.ClientSession | null
): Promise<number> {
  const wageIdObj = typeof wageId === 'string' ? new mongoose.Types.ObjectId(wageId) : wageId;
  const firmIdObj = typeof firmId === 'string' ? new mongoose.Types.ObjectId(firmId) : firmId;

  const payoutEntries = await Ledger.find(
    {
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      refType: 'WAGE_PAYOUT',
      refId: wageIdObj,
      accountHead: 'Salaries & Wages Payable',
      isReversed: { $ne: true },
    },
    null,
    session ? { session } : {}
  ).lean();

  const totalDisbursed = payoutEntries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
  return toCurrency(totalDisbursed);
}

/* ─────────────────────────────────────────────────────────────────────────
   ACCRUAL LEGS BUILDER
───────────────────────────────────────────────────────────────────────── */

export async function buildWageAccrualLegs(
  wage: IWage,
  session?: mongoose.ClientSession | null
): Promise<{ legs: IVoucherLeg[]; accrualDate: string; empName: string }> {
  await validateWageForPosting(wage);

  const firmId = wage.firm_id;
  const userId = wage.created_by || wage.updated_by;
  const salaryMonth = wage.salary_month;

  // Accrual transaction date is the last day of the salary month
  const [y, m] = salaryMonth.split('-').map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const accrualDate = `${salaryMonth}-${String(lastDay).padStart(2, '0')}`;

  const employee = await MasterRoll.findById(wage.master_roll_id).session(session || null).lean();
  const empName = employee?.employee_name || 'Employee';

  const legs: IVoucherLeg[] = [];

  // 1. DR: Gross Salaries & Wages Expense
  const expenseAccount = await resolveAccountHead(firmId, 'Salaries & Wages', 'EXPENSE', userId, session || null);
  legs.push({
    accountHead: expenseAccount.account_name,
    accountType: expenseAccount.account_type,
    debitAmount: toCurrency(wage.gross_salary),
    creditAmount: 0,
    narration: `Salaries & Wages for ${salaryMonth} - ${empName}`,
  });

  // 2. DR: Employer Statutory Contributions (EPF & ESIC)
  const employerEpf = (wage.epf_deduction || 0) > 0 ? (wage.epf_deduction || 0) : 0; // Matching 12%
  if (employerEpf > 0) {
    const employerEpfAcc = await resolveAccountHead(firmId, 'Employer EPF Contribution', 'EXPENSE', userId, session || null);
    legs.push({
      accountHead: employerEpfAcc.account_name,
      accountType: employerEpfAcc.account_type,
      debitAmount: toCurrency(employerEpf),
      creditAmount: 0,
      narration: `Employer EPF Contribution for ${empName} - ${salaryMonth}`,
    });
  }

  const employerEsic = (wage.esic_deduction || 0) > 0
    ? computeEmployerEsic(wage.gross_salary, salaryMonth, employee?.date_of_exit)
    : 0;
  if (employerEsic > 0) {
    const employerEsicAcc = await resolveAccountHead(firmId, 'Employer ESIC Contribution', 'EXPENSE', userId, session || null);
    legs.push({
      accountHead: employerEsicAcc.account_name,
      accountType: employerEsicAcc.account_type,
      debitAmount: toCurrency(employerEsic),
      creditAmount: 0,
      narration: `Employer ESIC Contribution for ${empName} - ${salaryMonth}`,
    });
  }

  // 3. DR: Other Benefits (if any)
  if ((wage.other_benefit || 0) > 0) {
    const benefitAccount = await resolveAccountHead(firmId, 'Staff Benefits', 'EXPENSE', userId, session || null);
    legs.push({
      accountHead: benefitAccount.account_name,
      accountType: benefitAccount.account_type,
      debitAmount: toCurrency(wage.other_benefit),
      creditAmount: 0,
      narration: `Staff Benefits for ${empName} - ${salaryMonth}`,
    });
  }

  // 4. CR: Total EPF Payable (Employee 12% + Employer 12% = 24%)
  const totalEpf = (wage.epf_deduction || 0) + employerEpf;
  if (totalEpf > 0) {
    const epfAccount = await resolveAccountHead(firmId, 'EPF Payable', 'PAYABLE', userId, session || null);
    legs.push({
      accountHead: epfAccount.account_name,
      accountType: epfAccount.account_type,
      debitAmount: 0,
      creditAmount: toCurrency(totalEpf),
      narration: `EPF Payable (Emp + Empr) for ${empName} - ${salaryMonth}`,
    });
  }

  // 5. CR: Total ESIC Payable (Employee 0.75% + Employer 3.25% = 4%)
  const totalEsic = (wage.esic_deduction || 0) + employerEsic;
  if (totalEsic > 0) {
    const esicAccount = await resolveAccountHead(firmId, 'ESIC Payable', 'PAYABLE', userId, session || null);
    legs.push({
      accountHead: esicAccount.account_name,
      accountType: esicAccount.account_type,
      debitAmount: 0,
      creditAmount: toCurrency(totalEsic),
      narration: `ESIC Payable (Emp + Empr) for ${empName} - ${salaryMonth}`,
    });
  }

  // 6. CR: Professional Tax Payable (Statutory Liability)
  if ((wage.professional_tax || 0) > 0) {
    const ptAccount = await resolveAccountHead(firmId, 'Professional Tax Payable', 'PAYABLE', userId, session || null);
    legs.push({
      accountHead: ptAccount.account_name,
      accountType: ptAccount.account_type,
      debitAmount: 0,
      creditAmount: toCurrency(wage.professional_tax),
      narration: `Professional Tax for ${empName} - ${salaryMonth}`,
    });
  }

  // 7. CR: Other Deductions (Non-statutory Miscellaneous Deductions)
  if ((wage.other_deduction || 0) > 0) {
    const otherAccount = await resolveAccountHead(firmId, 'Other Deductions', 'PAYABLE', userId, session || null);
    legs.push({
      accountHead: otherAccount.account_name,
      accountType: otherAccount.account_type,
      debitAmount: 0,
      creditAmount: toCurrency(wage.other_deduction),
      narration: `Other Deductions for ${empName} - ${salaryMonth}`,
    });
  }

  // 7. CR: Advance to Employees (Recovery)
  if ((wage.advance_deduction || 0) > 0) {
    const advanceAccount = await resolveAccountHead(firmId, 'Advance to Employees', 'ASSET', userId, session || null);
    legs.push({
      accountHead: advanceAccount.account_name,
      accountType: advanceAccount.account_type,
      debitAmount: 0,
      creditAmount: toCurrency(wage.advance_deduction),
      narration: `Advance Recovery from ${empName} - ${salaryMonth}`,
    });
  }

  // 8. CR: Salaries & Wages Payable (Net Take-Home Liability)
  if (wage.net_salary > 0) {
    const payableAccount = await resolveAccountHead(firmId, 'Salaries & Wages Payable', 'PAYABLE', userId, session || null);
    legs.push({
      accountHead: payableAccount.account_name,
      accountType: payableAccount.account_type,
      debitAmount: 0,
      creditAmount: toCurrency(wage.net_salary),
      narration: `Salary Payable to ${empName} - ${salaryMonth}`,
    });
  }

  await validateLedgerEntries(legs, firmId, session || null);

  return { legs, accrualDate, empName };
}

/* ─────────────────────────────────────────────────────────────────────────
   LEDGER POSTING
───────────────────────────────────────────────────────────────────────── */

export async function postWageLedger(wage: IWage, session: mongoose.ClientSession): Promise<string> {
  const firmId = wage.firm_id;
  const userId = wage.created_by || wage.updated_by;
  const salaryMonth = wage.salary_month;

  try {
    const { legs, accrualDate, empName } = await buildWageAccrualLegs(wage, session);
    const { UnifiedPostingService } = await import('./accounting/unified-posting.service');

    // If wage already has an accrual voucher posted, update it in-place
    if (wage.voucher_group_id) {
      const existingEntries = await Ledger.find({
        $or: [{ firmId }, { firm_id: firmId }],
        voucherGroupId: wage.voucher_group_id,
        isReversed: { $ne: true },
      }, null, { session }).lean();

      if (existingEntries && existingEntries.length > 0) {
        await UnifiedPostingService.updateVoucher({
          firmId,
          voucherGroupId: wage.voucher_group_id,
          payload: {
            firmId,
            voucherType: 'JOURNAL',
            transactionDate: accrualDate,
            narration: `Payroll Accrual for ${salaryMonth} - ${empName}`,
            legs,
            createdBy: String(userId || 'system'),
            refType: 'WAGE',
            refId: wage._id,
            tags: { masterRollId: wage.master_roll_id, salaryMonth: wage.salary_month, isWageEntry: true },
          },
          session,
        });

        return wage.voucher_group_id;
      }
    }

    const postResult = await UnifiedPostingService.postVoucher({
      firmId,
      voucherType: 'JOURNAL',
      transactionDate: accrualDate,
      narration: `Payroll Accrual for ${salaryMonth} - ${empName}`,
      legs,
      createdBy: String(userId || 'system'),
      refType: 'WAGE',
      refId: wage._id,
      tags: { masterRollId: wage.master_roll_id, salaryMonth: wage.salary_month, isWageEntry: true },
    }, session);

    wage.voucher_group_id = postResult.voucherGroupId;

    // If wage already contains payment details on INITIAL creation, immediately post the Settlement Payment Voucher
    if (wage.paid_date && wage.net_salary > 0 && (wage.paid_amount || 0) === 0) {
      await postWageDisbursement(wage, session);
    } else {
      if (!wage.payment_status) {
        wage.payment_status = 'UNPAID';
      }
      wage.paid_amount = wage.paid_amount || 0;
      wage.balance_due = wage.balance_due !== undefined ? wage.balance_due : wage.net_salary;
    }

    return postResult.voucherGroupId;
  } catch (error: any) {
    throw new Error(`Ledger posting failed: ${error.message}`);
  }
}

export async function postWageDisbursement(
  wage: IWage,
  session: mongoose.ClientSession,
  amountToDisburse?: number
): Promise<string> {
  const firmId = wage.firm_id;
  const userId = wage.created_by || wage.updated_by;
  const transactionDate = wage.paid_date || (new Date().toISOString().split('T')[0] as string);

  const disburseAmt = toCurrency(
    amountToDisburse !== undefined
      ? amountToDisburse
      : (wage.balance_due && wage.balance_due > 0 ? wage.balance_due : wage.net_salary)
  );

  if (disburseAmt <= 0) {
    return wage.payment_voucher_group_id || '';
  }

  const employee = await MasterRoll.findById(wage.master_roll_id).session(session).lean();
  const empName = employee?.employee_name || 'Employee';

  const payableAcc = await resolveAccountHead(firmId, 'Salaries & Wages Payable', 'PAYABLE', userId, session);

  let payoutAcc;
  if (wage.payment_mode !== 'CASH' && wage.bank_account_id) {
    payoutAcc = await resolveBankAccount(firmId, wage.bank_account_id, userId, session);
  } else {
    payoutAcc = await getDefaultCashAccount(firmId, userId, session);
  }

  const legs: IVoucherLeg[] = [
    {
      accountHead: payableAcc.account_name,
      accountType: payableAcc.account_type,
      debitAmount: disburseAmt,
      creditAmount: 0,
      narration: `Salary Disbursement to ${empName} for ${wage.salary_month}`,
    },
    {
      accountHead: payoutAcc.account_name,
      accountType: payoutAcc.account_type,
      debitAmount: 0,
      creditAmount: disburseAmt,
      bankAccountId: payoutAcc.account_type === 'BANK' ? (wage.bank_account_id || null) : null,
      paymentMode: wage.payment_mode || 'CASH',
      narration: `Salary payout to ${empName} (${wage.payment_mode || 'CASH'})${wage.cheque_no ? ` - Chq: ${wage.cheque_no}` : ''}`,
    }
  ];

  await validateLedgerEntries(legs, firmId, session);

  const { UnifiedPostingService } = await import('./accounting/unified-posting.service');
  const postResult = await UnifiedPostingService.postVoucher({
    firmId,
    voucherType: 'PAYMENT',
    transactionDate,
    referenceNo: wage.cheque_no || undefined,
    narration: `Salary Payment for ${wage.salary_month} - ${empName}`,
    legs,
    createdBy: String(userId || 'system'),
    refType: 'WAGE_PAYOUT',
    refId: wage._id,
    tags: { masterRollId: wage.master_roll_id, salaryMonth: wage.salary_month, isWageEntry: true },
  }, session);

  const totalDisbursed = await getWageDisbursedAmount(wage._id as mongoose.Types.ObjectId, firmId, session);
  wage.paid_amount = totalDisbursed;
  wage.balance_due = Math.max(0, toCurrency(wage.net_salary - totalDisbursed));

  if (Math.abs(totalDisbursed - wage.net_salary) <= 0.01) {
    wage.payment_status = 'PAID';
  } else if (totalDisbursed > wage.net_salary) {
    wage.payment_status = 'OVERPAID';
  } else {
    wage.payment_status = 'PARTIALLY_PAID';
  }

  wage.payment_voucher_group_id = postResult.voucherGroupId;
  if (!wage.payment_voucher_group_ids) {
    wage.payment_voucher_group_ids = [];
  }
  if (!wage.payment_voucher_group_ids.includes(postResult.voucherGroupId)) {
    wage.payment_voucher_group_ids.push(postResult.voucherGroupId);
  }
  await wage.save({ session });

  return postResult.voucherGroupId;
}

export async function deleteWageLedger(
  wageId: mongoose.Types.ObjectId,
  firmId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession,
  includeDisbursements = false
) {
  try {
    const filter: any = {
      $or: [{ firmId }, { firm_id: firmId }],
      isReversed: { $ne: true },
    };

    if (includeDisbursements) {
      filter.$and = [
        {
          $or: [
            { refType: 'WAGE', refId: wageId },
            { refType: 'WAGE_PAYOUT', refId: wageId },
          ]
        }
      ];
    } else {
      filter.refType = 'WAGE';
      filter.refId = wageId;
    }

    const origEntries = await Ledger.find(filter, null, { session }).lean();

    const voucherGroupIds = Array.from(new Set(
      origEntries
        .filter(e => !e.isReversed && Boolean(e.voucherGroupId))
        .map(e => e.voucherGroupId as string)
    ));

    const { UnifiedPostingService } = await import('./accounting/unified-posting.service');
    for (const vGroupId of voucherGroupIds) {
      await UnifiedPostingService.reverseVoucher({
        originalVoucherGroupId: vGroupId,
        firmId,
        reason: 'Wage record deleted/cancelled',
        createdBy: 'system',
        session
      });
    }

    if (voucherGroupIds.length > 0) {
      await Ledger.updateMany(
        { voucherGroupId: { $in: voucherGroupIds }, $or: [{ firmId }, { firm_id: firmId }] },
        { $set: { isReversed: true } },
        { session }
      );
    }

    return origEntries.length;
  } catch (error: any) {
    throw new Error(`Ledger reversal failed: ${error.message}`);
  }
}

export async function recalculateWageLedger(wage: IWage, session: mongoose.ClientSession) {
  try {
    return await postWageLedger(wage, session);
  } catch (error: any) {
    throw new Error(`Ledger recalculation failed: ${error.message}`);
  }
}
