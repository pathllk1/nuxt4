// service/excelExportService.js
// 100% Faithful Replica of Nuxt 4 server/utils/accounting/export-utils.ts & excel-export.utils.ts
(function (global) {
  'use strict';

  const COLORS = {
    navy: 'FF1E3A8A',
    navyHeader: 'FF1E40AF',
    blue600: 'FF2563EB',
    teal700: 'FF0F766E',
    teal600: 'FF0D9488',
    slateDark: 'FF0F172A',
    slateBorder: 'FFCBD5E1',
    slateLight: 'FFF8FAFC',
    grayBg: 'FFF1F5F9',
    greenBg: 'FFDCFCE7',
    greenText: 'FF15803D',
    white: 'FFFFFFFF'
  };

  const ExcelExportService = {
    /**
     * 1. SINGLE VOUCHER / INVOICE EXPORT
     * 100% faithful replica of Nuxt 4's exportSingleBillToExcel()
     */
    async exportSingleBill(bill, items = [], firm = {}, filename = null) {
      if (!global.ExcelJS) throw new Error('ExcelJS library is not loaded');

      const billObj = bill || {};
      const firmObj = (firm && firm.value) ? firm.value : (firm || {});
      const btype = (billObj.btype || 'SALES').toUpperCase();
      const isPurchase = btype === 'PURCHASE';

      const docName = filename || `${billObj.bno || 'Voucher'}_${btype}_Invoice.xlsx`;

      const workbook = new global.ExcelJS.Workbook();
      workbook.creator = firmObj.name || 'Offline Accounting ERP';
      workbook.created = new Date();

      const ws = workbook.addWorksheet(btype === 'SALES' ? 'Tax Invoice' : 'Voucher', {
        views: [{ showGridLines: true }]
      });

      // 9-Column Architecture matching Nuxt 4
      ws.columns = [
        { key: 'colA', width: 6 },   // #
        { key: 'colB', width: 36 },  // Description
        { key: 'colC', width: 14 },  // HSN/SAC
        { key: 'colD', width: 10 },  // Qty
        { key: 'colE', width: 8 },   // UOM
        { key: 'colF', width: 14 },  // Rate
        { key: 'colG', width: 12 },  // Discount
        { key: 'colH', width: 10 },  // GST %
        { key: 'colI', width: 18 }   // Amount
      ];

      // Title Banner Row 1
      ws.mergeCells('A1:I1');
      const titleCell = ws.getCell('A1');
      const docTitles = {
        'SALES': 'TAX INVOICE',
        'PURCHASE': 'PURCHASE VOUCHER / BILL',
        'DELIVERY_CHALLAN': 'DELIVERY CHALLAN',
        'CREDIT_NOTE': 'CREDIT NOTE',
        'DEBIT_NOTE': 'DEBIT NOTE',
        'PROFORMA': 'PROFORMA INVOICE',
        'QUOTATION': 'ESTIMATE / QUOTATION'
      };
      titleCell.value = docTitles[btype] || `${btype.replace(/_/g, ' ')} INVOICE`;
      titleCell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: COLORS.white } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
      ws.getRow(1).height = 34;

      // Subtitle Row 2
      ws.mergeCells('A2:I2');
      const subCell = ws.getCell('A2');
      subCell.value = `GSTIN Registered Supply • Issued Under GST Rules 2017 • ${new Date().toLocaleDateString()}`;
      subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 18;

      // Spacing Row 3
      ws.getRow(3).height = 8;

      // Header Section Row 4: Seller & Document Meta
      ws.mergeCells('A4:D4');
      ws.mergeCells('F4:I4');
      const sellerHdr = ws.getCell('A4');
      sellerHdr.value = isPurchase ? 'BILL TO (BUYER DETAILS)' : 'SELLER / ISSUER DETAILS';
      sellerHdr.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.navy } };
      sellerHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };

      const docHdr = ws.getCell('F4');
      docHdr.value = 'DOCUMENT & DISPATCH PARTICULARS';
      docHdr.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.navy } };
      docHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
      ws.getRow(4).height = 20;

      // Detail Rows Helper
      const writeMetaRow = (rowNum, leftLabel, leftVal, rightLabel, rightVal) => {
        const row = ws.getRow(rowNum);
        ws.mergeCells(`A${rowNum}:D${rowNum}`);
        ws.mergeCells(`F${rowNum}:G${rowNum}`);
        ws.mergeCells(`H${rowNum}:I${rowNum}`);

        row.getCell(1).value = (leftLabel ? `${leftLabel} ` : '') + (leftVal || '-');
        row.getCell(1).font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.slateDark } };

        row.getCell(6).value = rightLabel || '';
        row.getCell(6).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.slateDark } };

        row.getCell(8).value = rightVal || '-';
        row.getCell(8).font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.slateDark } };
        row.height = 18;
      };

      const firmName = firmObj.name || firmObj.legal_name || 'My Company';
      const firmGstin = firmObj.gstin || firmObj.gst_number || 'UNREGISTERED';
      const firmAddr = firmObj.address || (firmObj.city ? `${firmObj.city}, ${firmObj.state || ''}` : '-');

      writeMetaRow(5, 'Name:', firmName, 'Voucher No:', billObj.bno || '');
      writeMetaRow(6, 'Address:', firmAddr, 'Date:', billObj.bdate || '');
      writeMetaRow(7, 'GSTIN:', firmGstin, 'Reference / Order No:', billObj.orderNo || 'N/A');
      writeMetaRow(8, 'State:', firmObj.state || '', 'Vehicle No:', billObj.vehicleNo || 'N/A');
      writeMetaRow(9, 'PAN:', firmObj.pan || '', 'Dispatch Via:', billObj.dispatchThrough || 'N/A');

      // Party / Consignee Section Row 11
      ws.getRow(10).height = 8;
      ws.mergeCells('A11:D11');
      ws.mergeCells('F11:I11');
      const partyHdr = ws.getCell('A11');
      partyHdr.value = isPurchase ? 'BILL FROM (SUPPLIER DETAILS)' : 'BILL TO (BUYER DETAILS)';
      partyHdr.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.navy } };
      partyHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };

      const shipHdr = ws.getCell('F11');
      shipHdr.value = isPurchase ? 'DELIVERED TO (RECEIVER)' : 'SHIP TO (CONSIGNEE)';
      shipHdr.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.navy } };
      shipHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
      ws.getRow(11).height = 20;

      writeMetaRow(12, 'Party:', billObj.partyName || 'Cash Customer', 'Consignee:', billObj.consigneeName || billObj.partyName || '-');
      writeMetaRow(13, 'Address:', billObj.partyAddress || '-', 'Address:', billObj.consigneeAddress || billObj.partyAddress || '-');
      writeMetaRow(14, 'GSTIN:', billObj.partyGstin || 'UNREGISTERED', 'GSTIN:', billObj.consigneeGstin || billObj.partyGstin || 'UNREGISTERED');
      writeMetaRow(15, 'Place of Supply:', billObj.placeOfSupply || billObj.partyState || '-', 'State Code:', billObj.partyState || '-');

      ws.getRow(16).height = 10;

      // Item Table Header Row 17
      const itemHeaders = ['#', 'Item Description', 'HSN/SAC', 'Qty', 'UOM', 'Rate (₹)', 'Disc (₹)', 'GST %', 'Amount (₹)'];
      const itemHdrRow = ws.getRow(17);
      itemHeaders.forEach((h, idx) => {
        const cell = itemHdrRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyHeader } };
        cell.alignment = { vertical: 'middle', horizontal: idx === 1 ? 'left' : (idx >= 3 && idx !== 4 ? 'right' : 'center') };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      itemHdrRow.height = 24;

      // Item Rows
      let currentRow = 18;
      const itemList = Array.isArray(items) && items.length > 0 ? items : (billObj.items || []);

      itemList.forEach((it, idx) => {
        const row = ws.getRow(currentRow);
        const isEven = idx % 2 === 0;
        const rowFill = isEven ? COLORS.white : COLORS.slateLight;

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = it.item || it.itemName || '-';
        row.getCell(3).value = it.hsn || it.hsnSac || '-';
        row.getCell(4).value = Number(it.qty) || 0;
        row.getCell(5).value = it.uom || 'PCS';
        row.getCell(6).value = Number(it.rate) || 0;
        row.getCell(7).value = Number(it.disc || it.discount || 0);
        row.getCell(8).value = Number(it.gst || it.taxRate || 0);
        row.getCell(9).value = Number(it.total || (Number(it.qty || 0) * Number(it.rate || 0))) || 0;

        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'left' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'right' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'right' };
        row.getCell(9).alignment = { horizontal: 'right' };

        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '₹#,##0.00';
        row.getCell(7).numFmt = '₹#,##0.00';
        row.getCell(8).numFmt = '0.00%';
        row.getCell(9).numFmt = '₹#,##0.00';

        for (let c = 1; c <= 9; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.slateBorder } },
            bottom: { style: 'thin', color: { argb: COLORS.slateBorder } },
            left: { style: 'thin', color: { argb: COLORS.slateBorder } },
            right: { style: 'thin', color: { argb: COLORS.slateBorder } }
          };
        }
        row.height = 20;
        currentRow++;
      });

      // Bottom Totals & Summary Calculation
      const taxable = Number(billObj.taxableTotal || billObj.grossTotal || 0);
      const cgst = Number(billObj.cgst || 0);
      const sgst = Number(billObj.sgst || 0);
      const igst = Number(billObj.igst || 0);
      const roundOff = Number(billObj.roundOff || 0);
      const netTotal = Number(billObj.netTotal || 0);

      // Spacer
      ws.getRow(currentRow).height = 8;
      currentRow++;

      // Bank & Terms on Left (Cols A:E) | Tax Summary on Right (Cols F:I)
      const writeSummaryRow = (label, val, isGrandTotal = false) => {
        const row = ws.getRow(currentRow);
        ws.mergeCells(`F${currentRow}:H${currentRow}`);

        const lblCell = row.getCell(6);
        lblCell.value = label;
        lblCell.alignment = { horizontal: 'right', vertical: 'middle' };
        lblCell.font = { name: 'Segoe UI', size: isGrandTotal ? 11 : 9.5, bold: true, color: { argb: isGrandTotal ? COLORS.white : COLORS.slateDark } };

        const valCell = row.getCell(9);
        valCell.value = val;
        valCell.numFmt = '₹#,##0.00';
        valCell.alignment = { horizontal: 'right', vertical: 'middle' };
        valCell.font = { name: 'Segoe UI', size: isGrandTotal ? 11 : 9.5, bold: true, color: { argb: isGrandTotal ? COLORS.white : COLORS.slateDark } };

        const bg = isGrandTotal ? COLORS.navy : COLORS.grayBg;
        lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

        lblCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        valCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

        row.height = isGrandTotal ? 26 : 20;
        currentRow++;
      };

      // Bank Information Box on A:E
      const bankStartRow = currentRow;
      ws.mergeCells(`A${bankStartRow}:E${bankStartRow}`);
      const bankTitle = ws.getCell(`A${bankStartRow}`);
      bankTitle.value = 'BANK SETTLEMENT PARTICULARS:';
      bankTitle.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.navy } };

      const bankInfoRows = [
        `Bank Name: ${firmObj.bank_name || 'HDFC Bank'}`,
        `A/c No: ${firmObj.bank_account_number || '-' } | IFSC: ${firmObj.bank_ifsc || '-'}`,
        `Branch: ${firmObj.bank_branch || '-'}`,
        'Terms: Payment is due according to agreed credit period. Disputes subject to local jurisdiction.'
      ];

      bankInfoRows.forEach((txt, bIdx) => {
        const bRow = bankStartRow + 1 + bIdx;
        ws.mergeCells(`A${bRow}:E${bRow}`);
        const c = ws.getCell(`A${bRow}`);
        c.value = txt;
        c.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF475569' } };
      });

      // Write Right Column Tax Totals
      writeSummaryRow('Taxable Total:', taxable);
      if (cgst > 0) writeSummaryRow('Central GST (CGST):', cgst);
      if (sgst > 0) writeSummaryRow('State GST (SGST):', sgst);
      if (igst > 0) writeSummaryRow('Integrated GST (IGST):', igst);
      if (roundOff !== 0) writeSummaryRow('Round Off (+/-):', roundOff);
      writeSummaryRow('GRAND TOTAL (NET):', netTotal, true);

      // Signatory Section
      currentRow += 2;
      ws.mergeCells(`G${currentRow}:I${currentRow}`);
      const sigTitle = ws.getCell(`G${currentRow}`);
      sigTitle.value = `For ${firmName}`;
      sigTitle.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.slateDark } };
      sigTitle.alignment = { horizontal: 'center' };

      currentRow += 3;
      ws.mergeCells(`G${currentRow}:I${currentRow}`);
      const sigAuth = ws.getCell(`G${currentRow}`);
      sigAuth.value = 'Authorised Signatory';
      sigAuth.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
      sigAuth.alignment = { horizontal: 'center' };
      sigAuth.border = { top: { style: 'thin', color: { argb: COLORS.slateBorder } } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this._saveBlob(blob, docName);
    },

    /**
     * 2. BILLS / VOUCHERS REGISTER EXPORT
     * Supports filtered lists with full tax breakdown and totals
     */
    async exportBills(bills = [], filename = 'Bills_Register.xlsx') {
      if (!global.ExcelJS) throw new Error('ExcelJS not loaded');

      const workbook = new global.ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Bills & Vouchers', {
        views: [{ showGridLines: true }]
      });

      // Header Banner
      sheet.mergeCells('A1:K1');
      const title = sheet.getCell('A1');
      title.value = 'SALES & PURCHASE VOUCHER REGISTER';
      title.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLORS.white } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.teal700 } };
      sheet.getRow(1).height = 30;

      sheet.mergeCells('A2:K2');
      const meta = sheet.getCell('A2');
      meta.value = `Generated: ${new Date().toLocaleString()} | Filtered Total: ${bills.length} Records`;
      meta.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
      meta.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 18;

      const headers = ['Voucher No', 'Date', 'Type', 'Party Name', 'Party GSTIN', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Round Off', 'Net Total'];
      const hRow = sheet.addRow(headers);
      hRow.height = 24;
      hRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.teal600 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });

      let sumTaxable = 0;
      let sumCgst = 0;
      let sumSgst = 0;
      let sumIgst = 0;
      let sumRoundOff = 0;
      let sumNet = 0;

      bills.forEach((b, idx) => {
        const taxable = Number(b.taxableTotal || b.grossTotal) || 0;
        const cgst = Number(b.cgst) || 0;
        const sgst = Number(b.sgst) || 0;
        const igst = Number(b.igst) || 0;
        const ro = Number(b.roundOff) || 0;
        const net = Number(b.netTotal) || 0;

        sumTaxable += taxable;
        sumCgst += cgst;
        sumSgst += sgst;
        sumIgst += igst;
        sumRoundOff += ro;
        sumNet += net;

        const isEven = idx % 2 === 0;
        const row = sheet.addRow([
          b.bno || '-',
          b.bdate || '-',
          b.btype || 'SALES',
          b.partyName || 'Cash',
          b.partyGstin || 'UNREGISTERED',
          taxable,
          cgst,
          sgst,
          igst,
          ro,
          net
        ]);
        row.height = 20;
        row.eachCell((cell, col) => {
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? COLORS.white : COLORS.slateLight } };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.slateBorder } },
            bottom: { style: 'thin', color: { argb: COLORS.slateBorder } },
            left: { style: 'thin', color: { argb: COLORS.slateBorder } },
            right: { style: 'thin', color: { argb: COLORS.slateBorder } }
          };

          if (col === 1 || col === 2 || col === 3) {
            cell.alignment = { horizontal: 'center' };
          } else if (col >= 6) {
            cell.numFmt = '₹#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });
      });

      // Total Summary Row
      const totRow = sheet.addRow([
        'TOTAL', '', `${bills.length} Vouchers`, '', '',
        sumTaxable, sumCgst, sumSgst, sumIgst, sumRoundOff, sumNet
      ]);
      totRow.height = 24;
      sheet.mergeCells(`A${totRow.number}:B${totRow.number}`);
      totRow.eachCell((cell, col) => {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.slateDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col >= 6) {
          cell.numFmt = '₹#,##0.00';
          cell.alignment = { horizontal: 'right' };
          if (col === 11) {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } };
          }
        }
      });

      sheet.columns = [
        { width: 15 }, { width: 12 }, { width: 16 }, { width: 28 }, { width: 18 },
        { width: 14 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 16 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this._saveBlob(blob, filename);
    },

    /**
     * 3. STOCK INVENTORY MASTER REPORT
     */
    async exportStocks(stocks = [], filename = 'Stock_Inventory_Report.xlsx') {
      if (!global.ExcelJS) throw new Error('ExcelJS library is not loaded');

      const workbook = new global.ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Stock Master', {
        views: [{ showGridLines: true }]
      });

      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'OFFLINE INVENTORY SYSTEM - STOCK VALUATION REPORT';
      titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.white } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyHeader } };
      sheet.getRow(1).height = 30;

      sheet.mergeCells('A2:J2');
      const metaCell = sheet.getCell('A2');
      metaCell.value = `Generated: ${new Date().toLocaleString()} | Total Items: ${stocks.length}`;
      metaCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 18;

      const headers = [
        'ID', 'Item Name', 'Part No', 'OEM', 'HSN/SAC', 'UOM',
        'Quantity', 'Cost Rate', 'Selling Rate', 'Total Valuation'
      ];
      const headerRow = sheet.addRow(headers);
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.blue600 } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
      });

      let totalValuation = 0;
      stocks.forEach((item, idx) => {
        const val = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        totalValuation += val;

        const isEven = idx % 2 === 0;
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
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? COLORS.white : COLORS.slateLight } };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.slateBorder } },
            left: { style: 'thin', color: { argb: COLORS.slateBorder } },
            bottom: { style: 'thin', color: { argb: COLORS.slateBorder } },
            right: { style: 'thin', color: { argb: COLORS.slateBorder } }
          };

          if (colNumber === 1 || colNumber === 5 || colNumber === 6) {
            cell.alignment = { horizontal: 'center' };
          } else if (colNumber === 7) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '#,##0.00';
          } else if (colNumber >= 8) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '₹#,##0.00';
          }
        });
      });

      const summaryRow = sheet.addRow(['Total Valuation', '', '', '', '', '', '', '', '', totalValuation]);
      summaryRow.height = 24;
      sheet.mergeCells(`A${summaryRow.number}:I${summaryRow.number}`);
      const summaryLabel = sheet.getCell(`A${summaryRow.number}`);
      summaryLabel.alignment = { horizontal: 'right', vertical: 'middle' };
      summaryLabel.font = { name: 'Segoe UI', size: 10, bold: true };
      summaryLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenBg } };

      const summaryVal = sheet.getCell(`J${summaryRow.number}`);
      summaryVal.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.greenText } };
      summaryVal.numFmt = '₹#,##0.00';
      summaryVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenBg } };

      sheet.columns = [
        { width: 8 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 12 },
        { width: 8 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 18 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this._saveBlob(blob, filename);
    },

    /**
     * 4. STOCK MOVEMENTS LEDGER EXPORT
     * 100% faithful replica of Nuxt 4's exportStockMovementsToExcel()
     */
    async exportStockMovements(movements = [], filename = 'Stock_Movements_Ledger.xlsx') {
      if (!global.ExcelJS) throw new Error('ExcelJS not loaded');

      const workbook = new global.ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Stock Movements', {
        views: [{ showGridLines: true }]
      });

      sheet.mergeCells('A1:J1');
      const title = sheet.getCell('A1');
      title.value = 'STOCK MOVEMENT & AUDIT TRAIL LEDGER';
      title.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLORS.white } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
      sheet.getRow(1).height = 28;

      const headers = ['Date', 'Type', 'Voucher / Bill No', 'Item Description', 'Batch No', 'Quantity', 'UOM', 'Rate (₹)', 'Total Value (₹)', 'Party / Transactor'];
      const hRow = sheet.addRow(headers);
      hRow.height = 22;
      hRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyHeader } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      let totalQty = 0;
      let totalVal = 0;

      movements.forEach((m, idx) => {
        const qty = Number(m.qty || m.quantity || 0);
        const rate = Number(m.rate || 0);
        const tot = Number(m.total || (qty * rate));
        totalQty += qty;
        totalVal += tot;

        const isEven = idx % 2 === 0;
        const row = sheet.addRow([
          m.bdate || m.date || '-',
          m.type || m.movementType || 'SALES',
          m.bno || m.billNo || '-',
          m.item || m.itemName || '-',
          m.batch || m.batchNo || '-',
          qty,
          m.uom || 'PCS',
          rate,
          tot,
          m.supply || m.partyName || '-'
        ]);

        row.height = 19;
        row.eachCell((cell, col) => {
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? COLORS.white : COLORS.slateLight } };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.slateBorder } },
            bottom: { style: 'thin', color: { argb: COLORS.slateBorder } },
            left: { style: 'thin', color: { argb: COLORS.slateBorder } },
            right: { style: 'thin', color: { argb: COLORS.slateBorder } }
          };

          if (col === 1 || col === 2 || col === 3 || col === 5 || col === 7) {
            cell.alignment = { horizontal: 'center' };
          } else if (col === 6) {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          } else if (col === 8 || col === 9) {
            cell.numFmt = '₹#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });
      });

      // Total Row
      const totRow = sheet.addRow(['TOTAL', '', '', '', '', totalQty, '', '', totalVal, '']);
      totRow.height = 22;
      sheet.mergeCells(`A${totRow.number}:E${totRow.number}`);
      totRow.eachCell((cell, col) => {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.slateDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
        if (col === 6) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (col === 9) {
          cell.numFmt = '₹#,##0.00';
          cell.alignment = { horizontal: 'right' };
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.greenText } };
        }
      });

      sheet.columns = [
        { width: 12 }, { width: 12 }, { width: 16 }, { width: 28 }, { width: 14 },
        { width: 12 }, { width: 8 }, { width: 13 }, { width: 15 }, { width: 24 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this._saveBlob(blob, filename);
    },

    /**
     * 5. PARTY MASTER DIRECTORY EXPORT
     */
    async exportParties(parties = [], filename = 'Party_Accounts_Directory.xlsx') {
      if (!global.ExcelJS) throw new Error('ExcelJS not loaded');

      const workbook = new global.ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Party Master', {
        views: [{ showGridLines: true }]
      });

      sheet.mergeCells('A1:J1');
      const title = sheet.getCell('A1');
      title.value = 'PARTIES & LEDGER ACCOUNTS DIRECTORY';
      title.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLORS.white } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Emerald 700
      sheet.getRow(1).height = 28;

      const headers = ['ID', 'Account / Party Name', 'Category / Role', 'GSTIN', 'PAN', 'Phone / Contact', 'Email', 'State', 'City / Address', 'Opening Balance'];
      const hRow = sheet.addRow(headers);
      hRow.height = 22;
      hRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      let totalBal = 0;
      parties.forEach((p, idx) => {
        const bal = Number(p.openingBalance || p.balance || 0);
        totalBal += bal;

        const isEven = idx % 2 === 0;
        const row = sheet.addRow([
          p.id || idx + 1,
          p.name || p.account_name || '-',
          p.partyType || p.type || p.account_type || 'CUSTOMER',
          p.gstin || 'UNREGISTERED',
          p.pan || '-',
          p.contact || p.phone || '-',
          p.email || '-',
          p.state || '-',
          p.address || p.city || '-',
          bal
        ]);

        row.height = 19;
        row.eachCell((cell, col) => {
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? COLORS.white : COLORS.slateLight } };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.slateBorder } },
            bottom: { style: 'thin', color: { argb: COLORS.slateBorder } },
            left: { style: 'thin', color: { argb: COLORS.slateBorder } },
            right: { style: 'thin', color: { argb: COLORS.slateBorder } }
          };

          if (col === 1 || col === 3 || col === 4 || col === 8) {
            cell.alignment = { horizontal: 'center' };
          } else if (col === 10) {
            cell.numFmt = '₹#,##0.00;[Red](₹#,##0.00);"—"';
            cell.alignment = { horizontal: 'right' };
          }
        });
      });

      // Total Row
      const totRow = sheet.addRow(['TOTAL', '', `${parties.length} Accounts`, '', '', '', '', '', '', totalBal]);
      totRow.height = 22;
      sheet.mergeCells(`A${totRow.number}:B${totRow.number}`);
      totRow.eachCell((cell, col) => {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
        if (col === 10) {
          cell.numFmt = '₹#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
      });

      sheet.columns = [
        { width: 8 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 13 },
        { width: 16 }, { width: 22 }, { width: 14 }, { width: 26 }, { width: 16 }
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
