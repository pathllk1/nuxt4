// service/excelExportService.js
(function (global) {
  'use strict';

  const ExcelExportService = {
    async exportStocks(stocks = [], filename = 'Stock_Inventory_Report.xlsx') {
      if (!global.ExcelJS) {
        throw new Error('ExcelJS library is not loaded');
      }

      const workbook = new global.ExcelJS.Workbook();
      workbook.creator = 'Offline WebSQL Inventory';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Stock Master', {
        views: [{ showGridLines: true }]
      });

      // Title Row
      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'OFFLINE INVENTORY SYSTEM - STOCK VALUATION REPORT';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; // Blue 800
      sheet.getRow(1).height = 30;

      // Metadata Row
      sheet.mergeCells('A2:J2');
      const metaCell = sheet.getCell('A2');
      metaCell.value = `Generated: ${new Date().toLocaleString()} | Total Items: ${stocks.length}`;
      metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 18;

      // Header Row
      const headers = [
        'ID', 'Item Name', 'Part No', 'OEM', 'HSN/SAC', 'UOM',
        'Quantity', 'Cost Rate', 'Selling Rate', 'Total Valuation'
      ];
      const headerRow = sheet.addRow(headers);
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue 600
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        };
      });

      // Data Rows
      let totalValuation = 0;
      stocks.forEach((item) => {
        const val = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        totalValuation += val;

        const row = sheet.addRow([
          item.id,
          item.item,
          item.pno || '-',
          item.oem || '-',
          item.hsn || '-',
          item.uom || 'PCS',
          Number(item.qty) || 0,
          Number(item.cost_rate || item.rate) || 0,
          Number(item.rate) || 0,
          val
        ]);

        row.height = 20;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alignments & formats
          if (colNumber === 1 || colNumber === 6) {
            cell.alignment = { horizontal: 'center' };
          } else if (colNumber >= 7) {
            cell.alignment = { horizontal: 'right' };
            if (colNumber >= 8) {
              cell.numFmt = '₹#,##0.00';
            }
          }
        });
      });

      // Summary Row
      const summaryRow = sheet.addRow([
        'Total', '', '', '', '', '', '', '', '', totalValuation
      ]);
      summaryRow.height = 22;
      sheet.mergeCells(`A${summaryRow.number}:I${summaryRow.number}`);
      const summaryLabel = sheet.getCell(`A${summaryRow.number}`);
      summaryLabel.alignment = { horizontal: 'right' };
      summaryLabel.font = { name: 'Arial', size: 10, bold: true };

      const summaryVal = sheet.getCell(`J${summaryRow.number}`);
      summaryVal.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
      summaryVal.numFmt = '₹#,##0.00';
      summaryVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

      // Set Auto Column Widths
      sheet.columns = [
        { width: 8 },  // ID
        { width: 32 }, // Item Name
        { width: 14 }, // Part No
        { width: 14 }, // OEM
        { width: 12 }, // HSN
        { width: 8 },  // UOM
        { width: 12 }, // Qty
        { width: 14 }, // Cost Rate
        { width: 14 }, // Selling Rate
        { width: 18 }  // Valuation
      ];

      // Generate & Trigger Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this._saveBlob(blob, filename);
    },

    async exportBills(bills = [], filename = 'Bills_Register.xlsx') {
      if (!global.ExcelJS) throw new Error('ExcelJS not loaded');

      const workbook = new global.ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Bills & Vouchers');

      // Header
      sheet.mergeCells('A1:J1');
      const title = sheet.getCell('A1');
      title.value = 'SALES & PURCHASE VOUCHER REGISTER';
      title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // Teal
      sheet.getRow(1).height = 28;

      const headers = ['Voucher No', 'Date', 'Type', 'Party Name', 'Party GSTIN', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Net Total'];
      const hRow = sheet.addRow(headers);
      hRow.height = 22;
      hRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14B8A6' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      bills.forEach((b) => {
        const row = sheet.addRow([
          b.bno,
          b.bdate,
          b.btype,
          b.partyName,
          b.partyGstin || 'UNREGISTERED',
          Number(b.taxableTotal || b.grossTotal) || 0,
          Number(b.cgst) || 0,
          Number(b.sgst) || 0,
          Number(b.igst) || 0,
          Number(b.netTotal) || 0
        ]);
        row.height = 19;
        row.eachCell((cell, col) => {
          cell.font = { name: 'Arial', size: 9 };
          if (col >= 6) {
            cell.numFmt = '₹#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });
      });

      sheet.columns = [
        { width: 14 }, { width: 12 }, { width: 16 }, { width: 28 }, { width: 18 },
        { width: 14 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 15 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this._saveBlob(blob, filename);
    },

    _saveBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  global.ExcelExportService = ExcelExportService;
})(window);
