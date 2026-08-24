import * as ExcelJS from 'exceljs';
import type { Client, Work, Payment, Receipt, ClientSummary } from '../types/work-tracker';

export class WorkTrackerExcelExporter {
  static async exportClientLedger(client: Client, summary: ClientSummary, timeline: any[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BusinessPro Suite - Work Tracker';
    const sheet = workbook.addWorksheet(`${client.name} - Ledger`);

    sheet.addRow([`STATEMENT OF ACCOUNT: ${client.name.toUpperCase()}`]);
    sheet.addRow([`Generated: ${new Date().toLocaleString()} | Billed: ₹${summary.totalBilled} | Paid: ₹${summary.totalPaid} | Dues: ₹${summary.outstanding}`]);
    sheet.addRow([]);

    sheet.addRow(['Date', 'Description', 'Work Order (Debit ₹)', 'Payment (Credit ₹)', 'Running Balance ₹']);
    sheet.getRow(4).font = { bold: true };

    timeline.forEach(item => {
      sheet.addRow([
        item.date,
        item.description,
        item.debit || '',
        item.credit || '',
        item.runningBalance || 0
      ]);
    });

    await this.downloadWorkbook(workbook, `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_Ledger_${this.getDateStamp()}.xlsx`);
  }

  static async exportWorkLog(works: Work[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Work Orders Master Log');

    sheet.addRow(['Date Assigned', 'Date Submitted', 'Client', 'Work Type', 'Description', 'Contract Value ₹', 'Paid ₹', 'Pending ₹', 'Status']);
    sheet.getRow(1).font = { bold: true };

    works.forEach(w => {
      sheet.addRow([
        w.dateAssigned,
        w.dateSubmitted || '—',
        w.clientName || 'Unknown Client',
        w.workType,
        w.description || '',
        w.effectiveAmount || w.totalAmount || 0,
        w.totalPaid || 0,
        w.pendingAmount || 0,
        w.paymentStatusObj?.label || 'Active'
      ]);
    });

    await this.downloadWorkbook(workbook, `Work_Orders_Log_${this.getDateStamp()}.xlsx`);
  }

  static async exportPayments(payments: Payment[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payments Master Log');

    sheet.addRow(['Date Received', 'Client', 'Work Type', 'Description', 'Amount Paid ₹', 'Payment Type', 'Method', 'Reference']);
    sheet.getRow(1).font = { bold: true };

    payments.forEach(p => {
      sheet.addRow([
        p.date,
        p.clientName || 'Unknown Client',
        p.workType || '—',
        p.workDescription || '',
        p.amount,
        p.paymentType,
        p.method,
        p.reference || '—'
      ]);
    });

    await this.downloadWorkbook(workbook, `Payments_Log_${this.getDateStamp()}.xlsx`);
  }

  static async exportReceipts(receipts: Receipt[], getWalletName: (id: any) => string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Receipts Master Log');

    sheet.addRow(['Date Received', 'Category', 'Vault / Wallet', 'Amount ₹', 'Received From', 'Reference / Tx ID', 'Notes']);
    sheet.getRow(1).font = { bold: true };

    receipts.forEach(r => {
      sheet.addRow([
        r.date,
        r.category,
        getWalletName(r.walletId),
        r.amount,
        r.receivedFrom || '—',
        r.reference || '—',
        r.notes || ''
      ]);
    });

    await this.downloadWorkbook(workbook, `Receipts_Log_${this.getDateStamp()}.xlsx`);
  }

  static async exportPerformanceReport(monthlyBreakdown: any[], clients: Client[], getClientSummary: (id: number) => ClientSummary): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    const sheetMonthly = workbook.addWorksheet('Monthly Performance');
    sheetMonthly.addRow(['Month', 'Income Inflows (₹)', 'Expense Outflows (₹)', 'Net Margin (₹)', 'Profit Margin %']);
    sheetMonthly.getRow(1).font = { bold: true };
    monthlyBreakdown.forEach(m => {
      sheetMonthly.addRow([m.month, m.income, m.expense, m.net, `${m.margin}%`]);
    });

    const sheetClients = workbook.addWorksheet('Clients Summary');
    sheetClients.addRow(['Client Name', 'Total Works', 'Billed ₹', 'Paid ₹', 'Outstanding Dues ₹']);
    sheetClients.getRow(1).font = { bold: true };
    clients.forEach(c => {
      const s = getClientSummary(c.id);
      sheetClients.addRow([s.clientName, s.totalWorks, s.totalBilled, s.totalPaid, s.outstanding]);
    });

    await this.downloadWorkbook(workbook, `Performance_Report_${this.getDateStamp()}.xlsx`);
  }

  private static async downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private static getDateStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

