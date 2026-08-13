/**
 * Server-Side Master Roll Quality Audit Engine
 * 
 * Synchronized with app/utils/masterRollAudit.ts for complete audit integrity across frontend & backend Excel export.
 */

export interface AuditFieldDefinition {
  key: string;
  label: string;
  category: 'identity' | 'banking' | 'statutory' | 'contact' | 'work';
  severity: 'CRITICAL' | 'WARNING';
}

export const AUDIT_FIELDS: AuditFieldDefinition[] = [
  { key: 'employee_name', label: 'Employee Name', category: 'identity', severity: 'CRITICAL' },
  { key: 'father_husband_name', label: 'Father/Husband Name', category: 'identity', severity: 'CRITICAL' },
  { key: 'date_of_birth', label: 'Date of Birth', category: 'identity', severity: 'CRITICAL' },
  { key: 'date_of_joining', label: 'Date of Joining', category: 'work', severity: 'CRITICAL' },
  { key: 'project', label: 'Project', category: 'work', severity: 'CRITICAL' },
  { key: 'site', label: 'Site', category: 'work', severity: 'CRITICAL' },
  { key: 'category', label: 'Skill Category', category: 'work', severity: 'CRITICAL' },
  { key: 'p_day_wage', label: 'Daily Wage Rate', category: 'work', severity: 'CRITICAL' },

  { key: 'aadhar', label: 'Aadhaar Number', category: 'statutory', severity: 'CRITICAL' },
  { key: 'bank', label: 'Bank Name', category: 'banking', severity: 'CRITICAL' },
  { key: 'account_no', label: 'Bank Account Number', category: 'banking', severity: 'CRITICAL' },
  { key: 'ifsc', label: 'IFSC Code', category: 'banking', severity: 'CRITICAL' },

  { key: 'phone_no', label: 'Phone Number', category: 'contact', severity: 'WARNING' },
  { key: 'address', label: 'Address', category: 'identity', severity: 'WARNING' },
  { key: 'pan', label: 'PAN Number', category: 'statutory', severity: 'WARNING' },
  { key: 'uan', label: 'UAN (EPFO)', category: 'statutory', severity: 'WARNING' },
  { key: 'esic_no', label: 'ESIC Number', category: 'statutory', severity: 'WARNING' },
];

export function isFieldEmpty(value: any): boolean {
  if (value === undefined || value === null) return true;
  const str = String(value).trim();
  if (str === '') return true;

  const lower = str.toLowerCase();
  return ['n/a', 'na', 'none', 'null', 'undefined', '-', '--', 'nil'].includes(lower);
}

export function validatePhone(phone: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(phone)) return { valid: true };
  const str = String(phone).trim();

  if (!/^\d{10}$/.test(str)) {
    return { valid: false, issue: 'Must be exactly 10 digits' };
  }
  if (!/^[6-9]/.test(str)) {
    return { valid: false, issue: 'Invalid mobile prefix (must start with 6-9)' };
  }
  if (/^(\d)\1{9}$/.test(str)) {
    return { valid: false, issue: 'Dummy/Repeated digits detected' };
  }
  if ('0123456789876543210'.includes(str)) {
    return { valid: false, issue: 'Sequential digits pattern detected' };
  }

  return { valid: true };
}

export function validateAadhaar(aadhar: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(aadhar)) return { valid: true };
  const str = String(aadhar).trim().replace(/\s+/g, '');

  if (!/^\d{12}$/.test(str)) {
    return { valid: false, issue: 'Must be exactly 12 digits' };
  }
  if (!/^[2-9]/.test(str)) {
    return { valid: false, issue: 'Invalid Aadhaar start digit (cannot start with 0 or 1)' };
  }
  if (/^(\d)\1{11}$/.test(str)) {
    return { valid: false, issue: 'Dummy/Repeated digits detected' };
  }
  if ('01234567890123456789'.includes(str) || '98765432109876543210'.includes(str)) {
    return { valid: false, issue: 'Sequential digits pattern detected' };
  }

  return { valid: true };
}

export function validatePAN(pan: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(pan)) return { valid: true };
  const str = String(pan).trim().toUpperCase();

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(str)) {
    return { valid: false, issue: 'Invalid PAN format (Expected: ABCDE1234F)' };
  }

  return { valid: true };
}

export function validateIFSC(ifsc: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(ifsc)) return { valid: true };
  const str = String(ifsc).trim().toUpperCase();

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(str)) {
    return { valid: false, issue: 'Invalid IFSC format (Expected: 4 letters, 0, 6 alphanumeric e.g. SBIN0001234)' };
  }

  return { valid: true };
}

export function validateBankAccount(accountNo: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(accountNo)) return { valid: true };
  const str = String(accountNo).trim();

  if (!/^\d{9,18}$/.test(str)) {
    return { valid: false, issue: 'Bank account number must be 9 to 18 digits' };
  }
  if (/^(\d)\1{8,}$/.test(str)) {
    return { valid: false, issue: 'Dummy repeated digits in account number' };
  }

  return { valid: true };
}

export function validateUAN(uan: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(uan)) return { valid: true };
  const str = String(uan).trim();

  if (!/^\d{12}$/.test(str)) {
    return { valid: false, issue: 'UAN must be exactly 12 digits' };
  }
  if (/^(\d)\1{11}$/.test(str)) {
    return { valid: false, issue: 'Dummy repeated digits in UAN' };
  }

  return { valid: true };
}

export function validateESIC(esic: any): { valid: boolean; issue?: string } {
  if (isFieldEmpty(esic)) return { valid: true };
  const str = String(esic).trim();

  if (!/^\d{10}$|^\d{17}$/.test(str)) {
    return { valid: false, issue: 'ESIC Insurance Number must be 10 or 17 digits' };
  }

  return { valid: true };
}

export interface MissingRecordItem {
  employee: any;
  missingFields: AuditFieldDefinition[];
  criticalCount: number;
  warningCount: number;
}

export interface FormatFailureItem {
  employee: any;
  targetField: string;
  value: string;
  issue: string;
  severity: 'CRITICAL' | 'WARNING';
}

export interface ComplianceItem {
  employee: any;
  category: 'AGE' | 'CHRONOLOGY' | 'WAGE';
  issue: string;
  severity: 'CRITICAL' | 'WARNING';
  detail: string;
}

export interface DuplicateGroupItem {
  field: string;
  value: string;
  count: number;
  employees: any[];
}

export interface FullAuditReport {
  totalActive: number;
  healthScore: number;
  perfectRecordsCount: number;
  missingData: MissingRecordItem[];
  formatFailures: FormatFailureItem[];
  complianceIssues: ComplianceItem[];
  duplicates: DuplicateGroupItem[];
  summary: {
    criticalCount: number;
    warningCount: number;
    affectedEmployeesCount: number;
  };
}

export function runMasterRollAudit(employees: any[]): FullAuditReport {
  const missingData: MissingRecordItem[] = [];
  const formatFailures: FormatFailureItem[] = [];
  const complianceIssues: ComplianceItem[] = [];
  const affectedEmployeeIds = new Set<string>();

  const aadharMap = new Map<string, any[]>();
  const accountMap = new Map<string, any[]>();
  const phoneMap = new Map<string, any[]>();
  const uanMap = new Map<string, any[]>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  employees.forEach(emp => {
    const empId = String(emp._id || emp.id || Math.random());
    let hasIssue = false;

    // 1. Missing Data Audit
    const missingFields: AuditFieldDefinition[] = [];
    let criticalCount = 0;
    let warningCount = 0;

    AUDIT_FIELDS.forEach(fieldDef => {
      const val = emp[fieldDef.key];
      let missing = isFieldEmpty(val);

      if (fieldDef.key === 'p_day_wage' && (val === undefined || val === null || Number(val) <= 0)) {
        missing = true;
      }

      if (missing) {
        missingFields.push(fieldDef);
        if (fieldDef.severity === 'CRITICAL') criticalCount++;
        else warningCount++;
      }
    });

    if (missingFields.length > 0) {
      missingData.push({
        employee: emp,
        missingFields,
        criticalCount,
        warningCount
      });
      hasIssue = true;
    }

    // 2. Format & Pattern Failures
    if (!isFieldEmpty(emp.phone_no)) {
      const phoneRes = validatePhone(emp.phone_no);
      if (!phoneRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'Phone',
          value: String(emp.phone_no),
          issue: phoneRes.issue!,
          severity: 'WARNING'
        });
        hasIssue = true;
      } else {
        const cleaned = String(emp.phone_no).trim();
        if (!phoneMap.has(cleaned)) phoneMap.set(cleaned, []);
        phoneMap.get(cleaned)!.push(emp);
      }
    }

    if (!isFieldEmpty(emp.aadhar)) {
      const aadharRes = validateAadhaar(emp.aadhar);
      if (!aadharRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'Aadhaar',
          value: String(emp.aadhar),
          issue: aadharRes.issue!,
          severity: 'CRITICAL'
        });
        hasIssue = true;
      } else {
        const cleaned = String(emp.aadhar).trim().replace(/\s+/g, '');
        if (!aadharMap.has(cleaned)) aadharMap.set(cleaned, []);
        aadharMap.get(cleaned)!.push(emp);
      }
    }

    if (!isFieldEmpty(emp.pan)) {
      const panRes = validatePAN(emp.pan);
      if (!panRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'PAN',
          value: String(emp.pan),
          issue: panRes.issue!,
          severity: 'WARNING'
        });
        hasIssue = true;
      }
    }

    if (!isFieldEmpty(emp.ifsc)) {
      const ifscRes = validateIFSC(emp.ifsc);
      if (!ifscRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'IFSC Code',
          value: String(emp.ifsc),
          issue: ifscRes.issue!,
          severity: 'CRITICAL'
        });
        hasIssue = true;
      }
    }

    if (!isFieldEmpty(emp.account_no)) {
      const accRes = validateBankAccount(emp.account_no);
      if (!accRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'Bank Account No',
          value: String(emp.account_no),
          issue: accRes.issue!,
          severity: 'CRITICAL'
        });
        hasIssue = true;
      } else {
        const cleaned = String(emp.account_no).trim();
        if (!accountMap.has(cleaned)) accountMap.set(cleaned, []);
        accountMap.get(cleaned)!.push(emp);
      }
    }

    if (!isFieldEmpty(emp.uan)) {
      const uanRes = validateUAN(emp.uan);
      if (!uanRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'UAN',
          value: String(emp.uan),
          issue: uanRes.issue!,
          severity: 'WARNING'
        });
        hasIssue = true;
      } else {
        const cleaned = String(emp.uan).trim();
        if (!uanMap.has(cleaned)) uanMap.set(cleaned, []);
        uanMap.get(cleaned)!.push(emp);
      }
    }

    if (!isFieldEmpty(emp.esic_no)) {
      const esicRes = validateESIC(emp.esic_no);
      if (!esicRes.valid) {
        formatFailures.push({
          employee: emp,
          targetField: 'ESIC Number',
          value: String(emp.esic_no),
          issue: esicRes.issue!,
          severity: 'WARNING'
        });
        hasIssue = true;
      }
    }

    // 3. Statutory & Chronological Compliance
    if (!isFieldEmpty(emp.date_of_birth)) {
      const dobDate = new Date(emp.date_of_birth);
      if (!isNaN(dobDate.getTime())) {
        const ageDiffMs = today.getTime() - dobDate.getTime();
        const ageDate = new Date(ageDiffMs);
        const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);

        if (calculatedAge < 18) {
          complianceIssues.push({
            employee: emp,
            category: 'AGE',
            issue: 'Statutory Violation: Underage Labor (Age < 18)',
            severity: 'CRITICAL',
            detail: `Date of Birth ${emp.date_of_birth} indicates age is ${calculatedAge} years.`
          });
          hasIssue = true;
        } else if (calculatedAge > 75) {
          complianceIssues.push({
            employee: emp,
            category: 'AGE',
            issue: 'Unrealistic Age (> 75 years)',
            severity: 'WARNING',
            detail: `Date of Birth ${emp.date_of_birth} indicates age is ${calculatedAge} years.`
          });
          hasIssue = true;
        }
      }
    }

    if (!isFieldEmpty(emp.date_of_joining)) {
      const dojDate = new Date(emp.date_of_joining);
      if (!isNaN(dojDate.getTime())) {
        if (dojDate > today) {
          complianceIssues.push({
            employee: emp,
            category: 'CHRONOLOGY',
            issue: 'Future Joining Date',
            severity: 'WARNING',
            detail: `Joining date ${emp.date_of_joining} is set in the future.`
          });
          hasIssue = true;
        }

        if (!isFieldEmpty(emp.date_of_birth)) {
          const dobDate = new Date(emp.date_of_birth);
          if (!isNaN(dobDate.getTime()) && dojDate <= dobDate) {
            complianceIssues.push({
              employee: emp,
              category: 'CHRONOLOGY',
              issue: 'Chronological Conflict: Joining date before DOB',
              severity: 'CRITICAL',
              detail: `Joining date ${emp.date_of_joining} is earlier than Date of Birth ${emp.date_of_birth}.`
            });
            hasIssue = true;
          }
        }

        if (!isFieldEmpty(emp.date_of_exit)) {
          const doeDate = new Date(emp.date_of_exit);
          if (!isNaN(doeDate.getTime()) && doeDate < dojDate) {
            complianceIssues.push({
              employee: emp,
              category: 'CHRONOLOGY',
              issue: 'Chronological Conflict: Exit date before Joining date',
              severity: 'CRITICAL',
              detail: `Exit date ${emp.date_of_exit} is before Joining date ${emp.date_of_joining}.`
            });
            hasIssue = true;
          }
        }
      }
    }

    if (emp.p_day_wage !== undefined && emp.p_day_wage !== null && Number(emp.p_day_wage) <= 0) {
      complianceIssues.push({
        employee: emp,
        category: 'WAGE',
        issue: 'Zero or Negative Daily Wage',
        severity: 'CRITICAL',
        detail: `Daily wage rate is recorded as ₹${emp.p_day_wage}. Active employees must have a positive wage.`
      });
      hasIssue = true;
    }

    if (hasIssue) {
      affectedEmployeeIds.add(empId);
    }
  });

  // 4. Duplicate Cross-Record Detection
  const duplicates: DuplicateGroupItem[] = [];

  const checkDuplicateMap = (map: Map<string, any[]>, fieldName: string) => {
    map.forEach((empList, value) => {
      if (empList.length > 1) {
        duplicates.push({
          field: fieldName,
          value,
          count: empList.length,
          employees: empList
        });
        empList.forEach(e => affectedEmployeeIds.add(String(e._id || e.id)));
      }
    });
  };

  checkDuplicateMap(aadharMap, 'Aadhaar');
  checkDuplicateMap(accountMap, 'Bank Account');
  checkDuplicateMap(phoneMap, 'Phone Number');
  checkDuplicateMap(uanMap, 'UAN');

  let totalCritical = 0;
  let totalWarning = 0;

  missingData.forEach(m => {
    totalCritical += m.criticalCount;
    totalWarning += m.warningCount;
  });

  formatFailures.forEach(f => {
    if (f.severity === 'CRITICAL') totalCritical++;
    else totalWarning++;
  });

  complianceIssues.forEach(c => {
    if (c.severity === 'CRITICAL') totalCritical++;
    else totalWarning++;
  });

  duplicates.forEach(d => {
    totalCritical += d.count;
  });

  const totalActive = employees.length;
  const perfectRecordsCount = Math.max(0, totalActive - affectedEmployeeIds.size);
  const healthScore = totalActive > 0 ? Math.round((perfectRecordsCount / totalActive) * 100) : 100;

  return {
    totalActive,
    healthScore,
    perfectRecordsCount,
    missingData,
    formatFailures,
    complianceIssues,
    duplicates,
    summary: {
      criticalCount: totalCritical,
      warningCount: totalWarning,
      affectedEmployeesCount: affectedEmployeeIds.size
    }
  };
}
