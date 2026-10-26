// service/pdfExportService.js
// 100% Faithful Replica of Nuxt 4 server/utils/accounting/pdf-export.utils.ts & Print Suite
(function (global) {
  'use strict';

  const C = {
    primary: [15, 23, 42],      // #0F172A Deep Slate / Charcoal
    border: [203, 213, 225],     // #CBD5E1 Hairline Border
    borderDark: [51, 65, 85],    // #334155 Boundary Border
    tableHdrBg: [248, 250, 252], // #F8FAFC Ink-efficient background
    tableHdrText: [15, 23, 42],  // #0F172A Bold table header text
    textDark: [15, 23, 42],      // #0F172A Primary text
    textMid: [51, 65, 85],       // #334155 Secondary meta labels
    textLight: [100, 116, 139]   // #64748B Small hints / footnotes
  };

  const formatCurrency = (val) => {
    return 'Rs. ' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatCurrencyHtml = (val) => {
    return '₹ ' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const s = String(dateString);
      const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
      if (isNaN(d.getTime())) return String(dateString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return String(dateString);
    }
  };

  const getInvoiceTypeLabel = (btype) => {
    switch ((btype || 'SALES').toUpperCase()) {
      case 'SALES': return 'TAX INVOICE';
      case 'PURCHASE': return 'PURCHASE INVOICE';
      case 'CREDIT_NOTE': return 'CREDIT NOTE';
      case 'DEBIT_NOTE': return 'DEBIT NOTE';
      case 'PROFORMA': return 'PROFORMA INVOICE';
      case 'DELIVERY_NOTE': return 'DELIVERY CHALLAN';
      default: return String(btype).toUpperCase();
    }
  };

  const getBillType = (bill) => {
    if (!bill) return 'intra-state';
    const src = (bill.billSubtype || '').toLowerCase();
    if (src.includes('intra')) return 'intra-state';
    if (src.includes('inter')) return 'inter-state';
    return (Number(bill.cgst || 0) > 0 || Number(bill.sgst || 0) > 0) ? 'intra-state' : 'inter-state';
  };

  const buildHsnSummary = (bill, items, otherCharges, gstEnabled) => {
    const hsnMap = new Map();
    const billType = getBillType(bill);

    (items || []).forEach((item) => {
      const hsn = item.hsn || 'NA';
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || 0);
      const disc = Number(item.disc || 0);
      const grate = Number(item.grate || item.gstRate || 0);
      const taxableValue = Number(item.taxable) || (qty * rate * (1 - disc / 100));
      const taxAmount = (taxableValue * grate) / 100;

      if (!hsnMap.has(hsn)) {
        hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
      }
      const row = hsnMap.get(hsn);
      row.taxableValue += taxableValue;
      if (gstEnabled) {
        row.totalTax += taxAmount;
        if (billType === 'intra-state') {
          row.cgst += taxAmount / 2;
          row.sgst += taxAmount / 2;
        } else {
          row.igst += taxAmount;
        }
      }
    });

    (otherCharges || []).forEach((ch) => {
      const hsn = ch.hsnSac || '9999';
      const taxableValue = Number(ch.amount || 0);
      const grate = Number(ch.grate || ch.gstRate || 0);
      const taxAmount = (taxableValue * grate) / 100;

      if (!hsnMap.has(hsn)) {
        hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
      }
      const row = hsnMap.get(hsn);
      row.taxableValue += taxableValue;
      if (gstEnabled) {
        row.totalTax += taxAmount;
        if (billType === 'intra-state') {
          row.cgst += taxAmount / 2;
          row.sgst += taxAmount / 2;
        } else {
          row.igst += taxAmount;
        }
      }
    });

    return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
  };

  const PdfExportService = {
    /**
     * Resolves complete print configuration merging bill, firm settings, and overrides
     */
    resolveConfig(bill, firm, printConfig = {}) {
      const b = bill || {};
      const f = firm || {};
      const isPurchase = (b.btype || 'SALES').toUpperCase() === 'PURCHASE';

      // GST Enabled Check
      const gstEnabled = (f.gst_enabled !== 0 && f.gst_enabled !== false && f.gst_enabled !== '0') &&
        ((Number(b.cgst || 0) > 0 || Number(b.sgst || 0) > 0 || Number(b.igst || 0) > 0) || Boolean(f.gst_number || f.activeGstin || f.gstin));

      // Active Bank Account Details
      let bank = null;
      if (printConfig.showBank !== false) {
        if (printConfig.targetBank) {
          bank = printConfig.targetBank;
        } else if (f.bank_account_number || f.bank_name) {
          bank = {
            account_holder_name: f.name || '',
            bank_name: f.bank_name || '',
            branch_name: f.bank_branch || '',
            account_number: f.bank_account_number || '',
            ifsc_code: f.ifsc_code || '',
            upi_id: f.upi_id || null
          };
        }
      }

      const defaultCopy = isPurchase ? 'ORIGINAL FOR SUPPLIER' : 'ORIGINAL FOR RECIPIENT';
      const copyType = printConfig.copyType !== undefined ? printConfig.copyType : defaultCopy;

      const customJurisdiction = (printConfig.jurisdiction || (f.city ? `Subject to ${f.city} Jurisdiction only.` : 'Subject to local jurisdiction only.')).trim();
      const declarationText = (printConfig.declaration || 'Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged.').trim();
      const signatoryTitle = (printConfig.signatoryTitle || 'Authorised Signatory').trim();

      return {
        copyType,
        showHsn: printConfig.showHsn !== false,
        showQty: printConfig.showQty !== false,
        showUom: printConfig.showUom !== false,
        showRate: printConfig.showRate !== false,
        showDisc: printConfig.showDisc !== false,
        showGst: printConfig.showGst !== false && gstEnabled,
        showBatch: printConfig.showBatch !== false,
        showNarration: printConfig.showNarration !== false,
        showBank: printConfig.showBank !== false && Boolean(bank),
        gstEnabled,
        bank,
        jurisdiction: customJurisdiction,
        declaration: declarationText,
        signatoryTitle,
        isPurchase
      };
    },

    /**
     * Generates a pristine, vector-rendered A4 PDF matching Nuxt 4's exact pdf-export.utils.ts
     */
    generateInvoicePdf(bill, items = [], firm = {}, printConfig = {}) {
      if (!global.jspdf || !global.jspdf.jsPDF) {
        throw new Error('jsPDF library is not loaded');
      }

      const config = this.resolveConfig(bill, firm, printConfig);
      const btype = (bill.btype || 'SALES').toUpperCase();
      const billType = getBillType(bill);

      // Parse other charges if present
      let otherCharges = [];
      if (Array.isArray(bill.otherCharges)) {
        otherCharges = bill.otherCharges;
      } else if (typeof bill.otherCharges === 'string' && bill.otherCharges.startsWith('[')) {
        try { otherCharges = JSON.parse(bill.otherCharges); } catch (_) {}
      }

      const hsnSummary = buildHsnSummary(bill, items, otherCharges, config.gstEnabled);

      const doc = new global.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      // Seller and Buyer data
      const sellerName = (firm.name || firm.legal_name || 'Business Name').toUpperCase();
      const sellerAddr = [firm.address, firm.city, firm.pincode ? `PIN: ${firm.pincode}` : ''].filter(Boolean).join(', ');
      const sellerState = firm.state || 'Maharashtra';
      const sellerStateCode = firm.state_code || '27';
      const sellerGst = firm.activeGstin || firm.gst_number || firm.gstin || '';
      const sellerPan = firm.pan_number || (sellerGst.length >= 12 ? sellerGst.substring(2, 12) : '');

      const buyerName = bill.partyName || 'Cash Customer';
      const buyerAddr = [bill.partyAddress, bill.partyPin ? `PIN: ${bill.partyPin}` : ''].filter(Boolean).join(', ');
      const buyerState = bill.partyState || 'Maharashtra';
      const buyerStateCode = bill.partyStateCode || '27';
      const buyerGstin = bill.partyGstin || 'UNREGISTERED';
      const buyerPan = bill.partyPan || (buyerGstin.length >= 12 && buyerGstin !== 'UNREGISTERED' ? buyerGstin.substring(2, 12) : '');

      // Consignee data
      const consigneeName = config.isPurchase ? sellerName : (bill.consigneeName || buyerName);
      const consigneeAddr = config.isPurchase ? sellerAddr : (bill.consigneeAddress || buyerAddr);
      const consigneeState = config.isPurchase ? sellerState : (bill.consigneeState || buyerState);
      const consigneeGstin = config.isPurchase ? sellerGst : (bill.consigneeGstin || buyerGstin);

      let currentY = margin;

      // 1. Optional Copy Title Badge (e.g. ORIGINAL FOR RECIPIENT)
      if (config.copyType) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.textMid);
        doc.text(config.copyType.toUpperCase(), pageWidth - margin - 1, currentY + 3, { align: 'right' });
        currentY += 5;
      }

      // Outer Frame
      doc.setDrawColor(...C.borderDark);
      doc.setLineWidth(0.4);
      doc.rect(margin, currentY, contentWidth, pageHeight - currentY - margin);

      const boxStartY = currentY;

      // 2. Header Box: Title & Seller Meta (Left) + Invoice Metadata Table (Right)
      const headerBoxHeight = 32;
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(margin, boxStartY + headerBoxHeight, pageWidth - margin, boxStartY + headerBoxHeight);

      // Split header into 62% Left (Seller info) and 38% Right (Voucher details)
      const metaSplitX = margin + (contentWidth * 0.62);
      doc.line(metaSplitX, boxStartY, metaSplitX, boxStartY + headerBoxHeight);

      // Left Header Content
      const voucherLabel = getInvoiceTypeLabel(btype);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...C.primary);
      doc.text(voucherLabel, margin + 3, boxStartY + 5.5);

      const subTag = btype === 'PROFORMA' ? 'PROFORMA INVOICE / ESTIMATE'
        : (btype === 'DELIVERY_NOTE' ? 'DELIVERY CHALLAN / TRANSPORT NOTE'
        : (config.gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)'));

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(subTag, margin + 3, boxStartY + 9.5);

      // Hairline accent under title
      doc.setDrawColor(...C.border);
      doc.line(margin + 3, boxStartY + 11, metaSplitX - 3, boxStartY + 11);

      // Seller Company Name & Address
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...C.primary);
      doc.text(sellerName, margin + 3, boxStartY + 15.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMid);
      const splitSellerAddr = doc.splitTextToSize(sellerAddr || 'Registered Business Address', metaSplitX - margin - 6);
      doc.text(splitSellerAddr.slice(0, 2), margin + 3, boxStartY + 19.5);

      const sellerGstLine = [
        sellerGst ? `GSTIN: ${sellerGst}` : '',
        sellerPan ? `PAN: ${sellerPan}` : '',
        `State: ${sellerState} (${sellerStateCode})`
      ].filter(Boolean).join('  |  ');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textDark);
      doc.text(sellerGstLine, margin + 3, boxStartY + 29.5);

      // Right Header Content (Invoice Metadata Table)
      const metaRows = [
        [config.isPurchase ? 'Bill No' : 'Invoice No', bill.bno || '-'],
        ['Date', formatDate(bill.bdate)],
        ...(bill.orderNo ? [['PO / Ref No', bill.orderNo]] : []),
        ...(bill.vehicleNo ? [['Vehicle No', bill.vehicleNo]] : []),
        ...(bill.dispatchThrough ? [['Dispatch Via', bill.dispatchThrough]] : []),
        ['Place of Supply', `${buyerState} (${buyerStateCode})`]
      ];

      let metaY = boxStartY + 4.5;
      metaRows.slice(0, 5).forEach(([lbl, val]) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textLight);
        doc.text(lbl, metaSplitX + 3, metaY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.textDark);
        doc.text(String(val), pageWidth - margin - 3, metaY, { align: 'right' });

        metaY += 5.5;
      });

      // 3. Two-Column Party Details Grid
      const partyBoxY = boxStartY + headerBoxHeight;
      const partyBoxHeight = 27;
      const halfWidth = contentWidth / 2;
      const partySplitX = margin + halfWidth;

      doc.setDrawColor(...C.border);
      doc.line(margin, partyBoxY + partyBoxHeight, pageWidth - margin, partyBoxY + partyBoxHeight);
      doc.line(partySplitX, partyBoxY, partySplitX, partyBoxY + partyBoxHeight);

      // Left: BILL TO (BUYER) / BILL FROM (SUPPLIER)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(config.isPurchase ? 'BILL FROM (SUPPLIER)' : 'BILL TO (BUYER)', margin + 3, partyBoxY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.textDark);
      doc.text(buyerName, margin + 3, partyBoxY + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMid);
      const splitBuyerAddr = doc.splitTextToSize(buyerAddr || 'Local Address', halfWidth - 6);
      doc.text(splitBuyerAddr.slice(0, 2), margin + 3, partyBoxY + 13);

      doc.text(`State: ${buyerState} (${buyerStateCode})`, margin + 3, partyBoxY + 20.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textDark);
      const buyerGstLine = `GSTIN: ${buyerGstin}${buyerPan ? '  |  PAN: ' + buyerPan : ''}`;
      doc.text(buyerGstLine, margin + 3, partyBoxY + 24.5);

      // Right: SHIP TO (CONSIGNEE) / BILL TO (RECEIVER)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(config.isPurchase ? 'BILL TO (RECEIVER)' : 'SHIP TO (CONSIGNEE)', partySplitX + 3, partyBoxY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.textDark);
      doc.text(consigneeName, partySplitX + 3, partyBoxY + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMid);
      const splitConsigneeAddr = doc.splitTextToSize(consigneeAddr || buyerAddr || 'Local Address', halfWidth - 6);
      doc.text(splitConsigneeAddr.slice(0, 2), partySplitX + 3, partyBoxY + 13);

      doc.text(`State: ${consigneeState}`, partySplitX + 3, partyBoxY + 20.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textDark);
      doc.text(`GSTIN: ${consigneeGstin}`, partySplitX + 3, partyBoxY + 24.5);

      // 4. Line Items Table via autoTable
      const itemsStartY = partyBoxY + partyBoxHeight;

      const tableHead = ['#', 'Description of Goods / Services'];
      if (config.showHsn) tableHead.push('HSN/SAC');
      if (config.showQty) tableHead.push('Qty');
      if (config.showUom) tableHead.push('UOM');
      if (config.showRate) tableHead.push('Rate (Rs.)');
      if (config.showDisc) tableHead.push('Disc %');
      if (config.showGst) tableHead.push('GST %');
      tableHead.push('Amount (Rs.)');

      const tableRows = [];

      // Items
      (items || []).forEach((it, idx) => {
        let desc = it.item || 'Goods / Services';
        if (config.showBatch && it.batch) desc += `\nBatch: ${it.batch}`;
        if (config.showNarration && (it.narration || it.itemNarration)) desc += `\nNote: ${it.narration || it.itemNarration}`;

        const row = [idx + 1, desc];
        if (config.showHsn) row.push(it.hsn || '-');
        if (config.showQty) row.push(Number(it.qty || 0).toFixed(2));
        if (config.showUom) row.push(it.uom || 'PCS');
        if (config.showRate) row.push(Number(it.rate || 0).toFixed(2));
        if (config.showDisc) row.push(Number(it.disc || 0).toFixed(2) + '%');
        if (config.showGst) row.push(Number(it.grate || it.gstRate || 0) + '%');
        row.push(Number(it.total || 0).toFixed(2));

        tableRows.push(row);
      });

      // Other Charges (Freight, Loading, Insurance, etc.)
      (otherCharges || []).forEach((ch, idx) => {
        let desc = ch.name || ch.type || 'Other Charge';
        if (ch.hsnSac) desc += `\nSAC: ${ch.hsnSac}`;

        const row = [items.length + idx + 1, desc];
        if (config.showHsn) row.push(ch.hsnSac || '9999');
        if (config.showQty) row.push('1.00');
        if (config.showUom) row.push('NOS');
        if (config.showRate) row.push(Number(ch.amount || 0).toFixed(2));
        if (config.showDisc) row.push('0.00%');
        if (config.showGst) row.push(Number(ch.grate || ch.gstRate || 0) + '%');
        row.push(Number(ch.amount || 0).toFixed(2));

        tableRows.push(row);
      });

      doc.autoTable({
        startY: itemsStartY,
        head: [tableHead],
        body: tableRows,
        theme: 'plain',
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: C.tableHdrBg,
          textColor: C.tableHdrText,
          fontSize: 7.5,
          fontStyle: 'bold',
          lineColor: C.borderDark,
          lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 },
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: C.textDark,
          lineColor: C.border,
          lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 }
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { cellWidth: 'auto' },
          [tableHead.indexOf('HSN/SAC')]: { halign: 'center', cellWidth: 16 },
          [tableHead.indexOf('Qty')]: { halign: 'center', cellWidth: 14 },
          [tableHead.indexOf('UOM')]: { halign: 'center', cellWidth: 12 },
          [tableHead.indexOf('Rate (Rs.)')]: { halign: 'right', cellWidth: 20 },
          [tableHead.indexOf('Disc %')]: { halign: 'right', cellWidth: 14 },
          [tableHead.indexOf('GST %')]: { halign: 'center', cellWidth: 14 },
          [tableHead.length - 1]: { halign: 'right', cellWidth: 24, fontStyle: 'bold' }
        },
        didDrawPage: () => {
          // Re-draw outer page frame if table wraps onto multiple pages
          doc.setDrawColor(...C.borderDark);
          doc.setLineWidth(0.4);
          doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2));
        }
      });

      let finalY = doc.lastAutoTable.finalY + 3;

      // Check if we need a new page for HSN Summary & Totals
      if (finalY > 215) {
        doc.addPage();
        finalY = margin + 5;
        doc.setDrawColor(...C.borderDark);
        doc.setLineWidth(0.4);
        doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2));
      }

      // 5. Statutory HSN Summary Table (if GST is enabled)
      if (config.gstEnabled && hsnSummary.length > 0) {
        const hsnHead = [
          'HSN/SAC',
          'Taxable Value (Rs.)',
          billType === 'intra-state' ? 'CGST (Rs.)' : 'IGST (Rs.)',
          ...(billType === 'intra-state' ? ['SGST (Rs.)'] : []),
          'Total Tax (Rs.)'
        ];

        const hsnRows = hsnSummary.map(row => {
          const cells = [
            row.hsn,
            row.taxableValue.toFixed(2),
            billType === 'intra-state' ? row.cgst.toFixed(2) : row.igst.toFixed(2)
          ];
          if (billType === 'intra-state') {
            cells.push(row.sgst.toFixed(2));
          }
          cells.push(row.totalTax.toFixed(2));
          return cells;
        });

        doc.autoTable({
          startY: finalY,
          head: [hsnHead],
          body: hsnRows,
          theme: 'plain',
          margin: { left: margin, right: margin },
          headStyles: {
            fillColor: C.tableHdrBg,
            textColor: C.tableHdrText,
            fontSize: 7,
            fontStyle: 'bold',
            lineColor: C.borderDark,
            lineWidth: { top: 0.25, bottom: 0.25, left: 0, right: 0 },
            halign: 'right'
          },
          bodyStyles: {
            fontSize: 7,
            textColor: C.textMid,
            lineColor: C.border,
            lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
            halign: 'right'
          },
          columnStyles: {
            0: { halign: 'center' }
          }
        });

        finalY = doc.lastAutoTable.finalY + 3;
      }

      // 6. Summary & Financial Totals Section
      if (finalY > 220) {
        doc.addPage();
        finalY = margin + 5;
        doc.setDrawColor(...C.borderDark);
        doc.setLineWidth(0.4);
        doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2));
      }

      const totalsBoxY = finalY;
      const totalsBoxHeight = 36;
      const totalsSplitX = margin + (contentWidth * 0.58);

      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(margin, totalsBoxY, pageWidth - margin, totalsBoxY);
      doc.line(margin, totalsBoxY + totalsBoxHeight, pageWidth - margin, totalsBoxY + totalsBoxHeight);
      doc.line(totalsSplitX, totalsBoxY, totalsSplitX, totalsBoxY + totalsBoxHeight);

      // Left Box: Amount in Words, Bank Details, Narration
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text('AMOUNT IN WORDS', margin + 3, totalsBoxY + 4);

      const words = global.numberToWords ? global.numberToWords(bill.netTotal) : `${bill.netTotal} Only`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.textDark);
      const splitWords = doc.splitTextToSize(words, (contentWidth * 0.58) - 6);
      doc.text(splitWords.slice(0, 2), margin + 3, totalsBoxY + 8);

      let subLeftY = totalsBoxY + 15;
      if (config.showBank && config.bank) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.textLight);
        doc.text('BENEFICIARY BANK DETAILS', margin + 3, subLeftY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMid);
        doc.text(`Bank: ${config.bank.bank_name || '-'}  |  Branch: ${config.bank.branch_name || '-'}`, margin + 3, subLeftY + 4);
        doc.setFont('helvetica', 'bold');
        doc.text(`A/C No: ${config.bank.account_number || '-'}   IFSC: ${config.bank.ifsc_code || '-'}`, margin + 3, subLeftY + 8);
      } else if (bill.narration) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.textLight);
        doc.text('NARRATION', margin + 3, subLeftY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMid);
        const splitNarr = doc.splitTextToSize(bill.narration, (contentWidth * 0.58) - 6);
        doc.text(splitNarr.slice(0, 2), margin + 3, subLeftY + 4);
      }

      // Right Box: Totals Breakdown Table
      const grossVal = Number(bill.taxableTotal || bill.grossTotal || 0);
      const cgstVal = Number(bill.cgst || 0);
      const sgstVal = Number(bill.sgst || 0);
      const igstVal = Number(bill.igst || 0);
      const totalTax = cgstVal + sgstVal + igstVal;
      const roundOffVal = Number(bill.roundOff || 0);
      const netTotalVal = Number(bill.netTotal || 0);

      const totRows = [
        ['Taxable Value', formatCurrency(grossVal)]
      ];

      if (config.gstEnabled) {
        if (billType === 'intra-state') {
          totRows.push(['Add: CGST', formatCurrency(cgstVal)]);
          totRows.push(['Add: SGST', formatCurrency(sgstVal)]);
        } else {
          totRows.push(['Add: IGST', formatCurrency(igstVal)]);
        }
      }

      if (roundOffVal !== 0) {
        totRows.push(['Round Off', formatCurrency(roundOffVal)]);
      }

      let totY = totalsBoxY + 4;
      totRows.forEach(([lbl, val]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMid);
        doc.text(lbl, totalsSplitX + 3, totY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.textDark);
        doc.text(val, pageWidth - margin - 3, totY, { align: 'right' });
        totY += 4.5;
      });

      // Grand Total Highlight Bar
      doc.setDrawColor(...C.borderDark);
      doc.setLineWidth(0.3);
      doc.line(totalsSplitX, totalsBoxY + totalsBoxHeight - 8, pageWidth - margin, totalsBoxY + totalsBoxHeight - 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.primary);
      doc.text('GRAND TOTAL', totalsSplitX + 3, totalsBoxY + totalsBoxHeight - 2.5);
      doc.text(formatCurrency(netTotalVal), pageWidth - margin - 3, totalsBoxY + totalsBoxHeight - 2.5, { align: 'right' });

      // 7. Statutory Declarations & Signatures Box
      const sigBoxY = totalsBoxY + totalsBoxHeight;
      const sigBoxHeight = 22;
      const sigSplitX = margin + (contentWidth * 0.65);

      doc.setDrawColor(...C.border);
      doc.line(sigSplitX, sigBoxY, sigSplitX, pageHeight - margin);

      // Left: Declaration & Terms
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.textLight);
      doc.text('DECLARATION & TERMS', margin + 3, sigBoxY + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.textLight);
      const splitDecl = doc.splitTextToSize(config.declaration, (contentWidth * 0.65) - 6);
      doc.text(splitDecl.slice(0, 2), margin + 3, sigBoxY + 7.5);

      const terms = [
        config.isPurchase ? '1. Subject to mutually agreed supplier terms.' : '1. Goods once sold will not be taken back.',
        `2. ${config.jurisdiction}`,
        '3. E. & O.E.'
      ];
      let termY = sigBoxY + 12;
      terms.forEach(t => {
        doc.text(t, margin + 3, termY);
        termY += 3.2;
      });

      // Right: Authorized Signatory
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textDark);
      doc.text(`For ${sellerName}`, pageWidth - margin - 3, sigBoxY + 4.5, { align: 'right' });

      doc.setDrawColor(...C.borderDark);
      doc.setLineWidth(0.3);
      doc.line(pageWidth - margin - 45, sigBoxY + 15, pageWidth - margin - 3, sigBoxY + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textMid);
      doc.text(config.signatoryTitle, pageWidth - margin - 3, sigBoxY + 18.5, { align: 'right' });

      // Save PDF directly to user disk
      const filename = `Invoice_${String(bill.bno || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(filename);
      return filename;
    },

    /**
     * Generates responsive, ink-efficient A4 HTML representation matching Nuxt 4
     */
    generateInvoiceHtml(bill, items = [], firm = {}, printConfig = {}) {
      const b = bill || {};
      const f = firm || {};
      const config = this.resolveConfig(b, f, printConfig);
      const btype = (b.btype || 'SALES').toUpperCase();
      const billType = getBillType(b);

      let otherCharges = [];
      if (Array.isArray(b.otherCharges)) {
        otherCharges = b.otherCharges;
      } else if (typeof b.otherCharges === 'string' && b.otherCharges.startsWith('[')) {
        try { otherCharges = JSON.parse(b.otherCharges); } catch (_) {}
      }

      const hsnSummary = buildHsnSummary(b, items, otherCharges, config.gstEnabled);

      const sellerName = f.name || f.legal_name || 'Business Name';
      const sellerAddr = [f.address, f.city, f.pincode ? `PIN: ${f.pincode}` : ''].filter(Boolean).join(', ');
      const sellerGst = f.activeGstin || f.gst_number || f.gstin || '';
      const sellerPan = f.pan_number || (sellerGst.length >= 12 ? sellerGst.substring(2, 12) : '');
      const sellerState = f.state || 'Maharashtra';
      const sellerStateCode = f.state_code || '27';

      const buyerName = b.partyName || 'Cash Customer';
      const buyerAddr = [b.partyAddress, b.partyPin ? `PIN: ${b.partyPin}` : ''].filter(Boolean).join(', ');
      const buyerGstin = b.partyGstin || 'UNREGISTERED';
      const buyerState = b.partyState || 'Maharashtra';
      const buyerStateCode = b.partyStateCode || '27';

      const consigneeName = config.isPurchase ? sellerName : (b.consigneeName || buyerName);
      const consigneeAddr = config.isPurchase ? sellerAddr : (b.consigneeAddress || buyerAddr);
      const consigneeGstin = config.isPurchase ? sellerGst : (b.consigneeGstin || buyerGstin);
      const consigneeState = config.isPurchase ? sellerState : (b.consigneeState || buyerState);

      const grossVal = Number(b.taxableTotal || b.grossTotal || 0);
      const cgstVal = Number(b.cgst || 0);
      const sgstVal = Number(b.sgst || 0);
      const igstVal = Number(b.igst || 0);
      const totalTax = cgstVal + sgstVal + igstVal;
      const roundOffVal = Number(b.roundOff || 0);
      const netTotalVal = Number(b.netTotal || 0);
      const words = global.numberToWords ? global.numberToWords(netTotalVal) : `${netTotalVal} Only`;

      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Invoice - ${bill.bno || ''}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0F172A;
              background: #FFFFFF;
              font-size: 11px;
              line-height: 1.35;
              margin: 0;
              padding: 0;
            }
            .invoice-box {
              border: 1.5px solid #334155;
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              background: #FFF;
            }
            .header-table, .party-table, .totals-table, .statutory-table {
              width: 100%;
              border-collapse: collapse;
            }
            .copy-title {
              text-align: right;
              font-size: 10px;
              font-weight: 800;
              color: #475569;
              padding: 2px 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .hdr-left {
              width: 62%;
              padding: 10px 12px;
              border-right: 1px solid #CBD5E1;
              border-bottom: 1px solid #CBD5E1;
              vertical-align: top;
            }
            .hdr-right {
              width: 38%;
              padding: 8px 12px;
              border-bottom: 1px solid #CBD5E1;
              vertical-align: top;
            }
            .voucher-title {
              font-size: 16px;
              font-weight: 900;
              color: #0F172A;
              letter-spacing: -0.3px;
              margin: 0;
            }
            .voucher-sub {
              font-size: 9px;
              font-weight: 800;
              color: #64748B;
              text-transform: uppercase;
              margin: 2px 0 6px 0;
            }
            .seller-title {
              font-size: 13px;
              font-weight: 900;
              color: #0F172A;
              margin-top: 4px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 10.5px;
            }
            .meta-lbl { color: #64748B; font-weight: 700; }
            .meta-val { color: #0F172A; font-weight: 800; }
            .party-cell {
              width: 50%;
              padding: 8px 12px;
              border-bottom: 1px solid #CBD5E1;
              vertical-align: top;
            }
            .party-cell:first-child { border-right: 1px solid #CBD5E1; }
            .party-tag {
              font-size: 8.5px;
              font-weight: 900;
              color: #64748B;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .party-name {
              font-size: 12px;
              font-weight: 800;
              color: #0F172A;
              margin: 2px 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
            }
            .items-table th {
              background: #F8FAFC;
              color: #0F172A;
              font-weight: 800;
              font-size: 9.5px;
              padding: 6px 8px;
              border-bottom: 1.5px solid #334155;
              text-transform: uppercase;
            }
            .items-table td {
              padding: 5px 8px;
              border-bottom: 1px solid #E2E8F0;
              vertical-align: top;
            }
            .hsn-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5px;
              margin-top: 6px;
            }
            .hsn-table th {
              background: #F8FAFC;
              font-weight: 800;
              padding: 4px 6px;
              border-top: 1px solid #CBD5E1;
              border-bottom: 1px solid #CBD5E1;
            }
            .hsn-table td {
              padding: 3px 6px;
              border-bottom: 1px solid #E2E8F0;
            }
            .tot-left {
              width: 58%;
              padding: 10px 12px;
              border-right: 1px solid #CBD5E1;
              border-bottom: 1px solid #CBD5E1;
              vertical-align: top;
            }
            .tot-right {
              width: 42%;
              padding: 6px 12px;
              border-bottom: 1px solid #CBD5E1;
              vertical-align: top;
            }
            .grand-tot-row {
              border-top: 1.5px solid #334155;
              padding-top: 4px;
              margin-top: 4px;
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: 900;
              color: #0F172A;
            }
            .sig-cell {
              width: 40%;
              padding: 8px 12px;
              text-align: right;
              vertical-align: top;
            }
            .decl-cell {
              width: 60%;
              padding: 8px 12px;
              border-right: 1px solid #CBD5E1;
              vertical-align: top;
              font-size: 8.5px;
              color: #64748B;
            }
            @media print {
              body { background: transparent; padding: 0; }
              .invoice-box { border: 1.5px solid #334155; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            ${config.copyType ? `<div class="copy-title">${config.copyType}</div>` : ''}

            <!-- Header -->
            <table class="header-table">
              <tr>
                <td class="hdr-left">
                  <h1 class="voucher-title">${getInvoiceTypeLabel(btype)}</h1>
                  <div class="voucher-sub">${config.gstEnabled ? 'TAX INVOICE UNDER GST' : 'BILL OF SUPPLY'}</div>
                  <div class="seller-title">${sellerName}</div>
                  <div style="color: #475569; font-size: 9.5px; margin-top: 2px;">${sellerAddr}</div>
                  <div style="font-weight: 700; margin-top: 4px;">
                    ${sellerGst ? `GSTIN: ${sellerGst} &nbsp;|&nbsp; ` : ''}
                    ${sellerPan ? `PAN: ${sellerPan} &nbsp;|&nbsp; ` : ''}
                    State: ${sellerState} (${sellerStateCode})
                  </div>
                </td>
                <td class="hdr-right">
                  <div class="meta-row"><span class="meta-lbl">${config.isPurchase ? 'Bill No' : 'Invoice No'}:</span><span class="meta-val">${bill.bno || '-'}</span></div>
                  <div class="meta-row"><span class="meta-lbl">Date:</span><span class="meta-val">${formatDate(bill.bdate)}</span></div>
                  ${bill.orderNo ? `<div class="meta-row"><span class="meta-lbl">PO / Ref No:</span><span class="meta-val">${bill.orderNo}</span></div>` : ''}
                  ${bill.vehicleNo ? `<div class="meta-row"><span class="meta-lbl">Vehicle No:</span><span class="meta-val">${bill.vehicleNo}</span></div>` : ''}
                  ${bill.dispatchThrough ? `<div class="meta-row"><span class="meta-lbl">Dispatch Via:</span><span class="meta-val">${bill.dispatchThrough}</span></div>` : ''}
                  <div class="meta-row"><span class="meta-lbl">Place of Supply:</span><span class="meta-val">${buyerState} (${buyerStateCode})</span></div>
                </td>
              </tr>
            </table>

            <!-- Party Addresses -->
            <table class="party-table">
              <tr>
                <td class="party-cell">
                  <div class="party-tag">${config.isPurchase ? 'BILL FROM (SUPPLIER)' : 'BILL TO (BUYER)'}</div>
                  <div class="party-name">${buyerName}</div>
                  <div style="color: #475569; font-size: 10px;">${buyerAddr}</div>
                  <div style="margin-top: 4px;">State: <strong>${buyerState} (${buyerStateCode})</strong></div>
                  <div style="margin-top: 2px;">GSTIN: <strong>${buyerGstin}</strong></div>
                </td>
                <td class="party-cell">
                  <div class="party-tag">${config.isPurchase ? 'BILL TO (RECEIVER)' : 'SHIP TO (CONSIGNEE)'}</div>
                  <div class="party-name">${consigneeName}</div>
                  <div style="color: #475569; font-size: 10px;">${consigneeAddr}</div>
                  <div style="margin-top: 4px;">State: <strong>${consigneeState}</strong></div>
                  <div style="margin-top: 2px;">GSTIN: <strong>${consigneeGstin}</strong></div>
                </td>
              </tr>
            </table>

            <!-- Line Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">#</th>
                  <th style="text-align: left;">Description of Goods / Services</th>
                  ${config.showHsn ? '<th style="text-align: center; width: 65px;">HSN/SAC</th>' : ''}
                  ${config.showQty ? '<th style="text-align: center; width: 55px;">Qty</th>' : ''}
                  ${config.showUom ? '<th style="text-align: center; width: 45px;">UOM</th>' : ''}
                  ${config.showRate ? '<th style="text-align: right; width: 75px;">Rate</th>' : ''}
                  ${config.showDisc ? '<th style="text-align: right; width: 55px;">Disc%</th>' : ''}
                  ${config.showGst ? '<th style="text-align: center; width: 55px;">GST%</th>' : ''}
                  <th style="text-align: right; width: 90px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(items || []).map((it, idx) => `
                  <tr>
                    <td style="text-align: center; color: #64748B;">${idx + 1}</td>
                    <td>
                      <div style="font-weight: 800; color: #0F172A;">${it.item}</div>
                      ${config.showBatch && it.batch ? `<div style="font-size: 9px; color: #64748B;">Batch: ${it.batch}</div>` : ''}
                      ${config.showNarration && (it.narration || it.itemNarration) ? `<div style="font-size: 9px; color: #64748B;">Note: ${it.narration || it.itemNarration}</div>` : ''}
                    </td>
                    ${config.showHsn ? `<td style="text-align: center; font-family: monospace;">${it.hsn || '-'}</td>` : ''}
                    ${config.showQty ? `<td style="text-align: center; font-weight: 700;">${Number(it.qty || 0).toFixed(2)}</td>` : ''}
                    ${config.showUom ? `<td style="text-align: center;">${it.uom || 'PCS'}</td>` : ''}
                    ${config.showRate ? `<td style="text-align: right;">${Number(it.rate || 0).toFixed(2)}</td>` : ''}
                    ${config.showDisc ? `<td style="text-align: right;">${Number(it.disc || 0).toFixed(2)}%</td>` : ''}
                    ${config.showGst ? `<td style="text-align: center;">${Number(it.grate || it.gstRate || 0)}%</td>` : ''}
                    <td style="text-align: right; font-weight: 800;">${formatCurrencyHtml(it.total)}</td>
                  </tr>
                `).join('')}

                ${(otherCharges || []).map((ch, idx) => `
                  <tr style="background: #F8FAFC;">
                    <td style="text-align: center; color: #64748B;">${items.length + idx + 1}</td>
                    <td>
                      <div style="font-weight: 800;">${ch.name || ch.type || 'Other Charge'}</div>
                      ${ch.hsnSac ? `<div style="font-size: 9px; color: #64748B;">SAC: ${ch.hsnSac}</div>` : ''}
                    </td>
                    ${config.showHsn ? `<td style="text-align: center; font-family: monospace;">${ch.hsnSac || '9999'}</td>` : ''}
                    ${config.showQty ? `<td style="text-align: center;">1.00</td>` : ''}
                    ${config.showUom ? `<td style="text-align: center;">NOS</td>` : ''}
                    ${config.showRate ? `<td style="text-align: right;">${Number(ch.amount || 0).toFixed(2)}</td>` : ''}
                    ${config.showDisc ? `<td style="text-align: right;">0.00%</td>` : ''}
                    ${config.showGst ? `<td style="text-align: center;">${Number(ch.grate || ch.gstRate || 0)}%</td>` : ''}
                    <td style="text-align: right; font-weight: 800;">${formatCurrencyHtml(ch.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- HSN Summary Table -->
            ${config.gstEnabled && hsnSummary.length > 0 ? `
              <table class="hsn-table">
                <thead>
                  <tr>
                    <th style="text-align: center;">HSN/SAC</th>
                    <th style="text-align: right;">Taxable Value</th>
                    <th style="text-align: right;">${billType === 'intra-state' ? 'CGST' : 'IGST'}</th>
                    ${billType === 'intra-state' ? '<th style="text-align: right;">SGST</th>' : ''}
                    <th style="text-align: right;">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  ${hsnSummary.map(row => `
                    <tr>
                      <td style="text-align: center; font-family: monospace;">${row.hsn}</td>
                      <td style="text-align: right;">${formatCurrencyHtml(row.taxableValue)}</td>
                      <td style="text-align: right;">${formatCurrencyHtml(billType === 'intra-state' ? row.cgst : row.igst)}</td>
                      ${billType === 'intra-state' ? `<td style="text-align: right;">${formatCurrencyHtml(row.sgst)}</td>` : ''}
                      <td style="text-align: right; font-weight: 700;">${formatCurrencyHtml(row.totalTax)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <!-- Bottom Totals & Bank Details -->
            <table class="totals-table">
              <tr>
                <td class="tot-left">
                  <div style="font-size: 8.5px; font-weight: 800; color: #64748B; text-transform: uppercase;">Amount in Words</div>
                  <div style="font-size: 11px; font-weight: 800; color: #0F172A; margin: 3px 0 8px 0;">${words}</div>

                  ${config.showBank && config.bank ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CBD5E1;">
                      <div style="font-size: 8.5px; font-weight: 800; color: #64748B; text-transform: uppercase;">Beneficiary Bank Account</div>
                      <div style="font-size: 10px; color: #334155; margin-top: 2px;">
                        Bank: <strong>${config.bank.bank_name || '-'}</strong> | Branch: ${config.bank.branch_name || '-'}
                      </div>
                      <div style="font-size: 10.5px; font-weight: 800; color: #0F172A; margin-top: 2px;">
                        A/C No: ${config.bank.account_number || '-'} &nbsp;&nbsp;|&nbsp;&nbsp; IFSC: ${config.bank.ifsc_code || '-'}
                      </div>
                    </div>
                  ` : ''}

                  ${bill.narration ? `
                    <div style="margin-top: 6px; font-size: 9.5px; color: #475569;">
                      <strong>Narration:</strong> ${bill.narration}
                    </div>
                  ` : ''}
                </td>
                <td class="tot-right">
                  <div class="meta-row"><span class="meta-lbl">Taxable Amount:</span><span class="meta-val">${formatCurrencyHtml(grossVal)}</span></div>
                  ${config.gstEnabled ? (billType === 'intra-state' ? `
                    <div class="meta-row"><span class="meta-lbl">Add: CGST:</span><span class="meta-val">${formatCurrencyHtml(cgstVal)}</span></div>
                    <div class="meta-row"><span class="meta-lbl">Add: SGST:</span><span class="meta-val">${formatCurrencyHtml(sgstVal)}</span></div>
                  ` : `
                    <div class="meta-row"><span class="meta-lbl">Add: IGST:</span><span class="meta-val">${formatCurrencyHtml(igstVal)}</span></div>
                  `) : ''}
                  ${roundOffVal !== 0 ? `<div class="meta-row"><span class="meta-lbl">Round Off:</span><span class="meta-val">${formatCurrencyHtml(roundOffVal)}</span></div>` : ''}
                  <div class="grand-tot-row">
                    <span>GRAND TOTAL:</span>
                    <span>${formatCurrencyHtml(netTotalVal)}</span>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Statutory & Signatures -->
            <table class="statutory-table">
              <tr>
                <td class="decl-cell">
                  <div style="font-weight: 800; color: #475569; margin-bottom: 2px;">Declaration:</div>
                  <div>${config.declaration}</div>
                  <div style="margin-top: 5px; font-weight: 800; color: #475569;">Terms & Conditions:</div>
                  <div>1. ${config.isPurchase ? 'Subject to mutually agreed terms.' : 'Goods once sold will not be taken back.'}</div>
                  <div>2. ${config.jurisdiction}</div>
                  <div>3. E. & O.E.</div>
                </td>
                <td class="sig-cell">
                  <div style="font-weight: 800; font-size: 10.5px;">For ${sellerName}</div>
                  <div style="height: 38px;"></div>
                  <div style="border-top: 1px solid #334155; display: inline-block; width: 140px; padding-top: 2px; font-weight: 800; font-size: 9px;">
                    ${config.signatoryTitle}
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </body>
        </html>
      `;
    },

    /**
     * Direct browser print dialog triggering high-precision A4 print
     */
    printInvoice(bill, items = [], firm = {}, printConfig = {}) {
      const html = this.generateInvoiceHtml(bill, items, firm, printConfig);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Print error:', err);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 350);
    },

    /**
     * Tabular Landscape PDF Report for Bills & Vouchers Register
     * Faithful replica of Nuxt 4's exportBillsToPdfBuffer()
     */
    exportBillsPdf(bills = [], firm = {}, subtitle = '') {
      if (!global.jspdf || !global.jspdf.jsPDF) {
        throw new Error('jsPDF library is not loaded');
      }

      const doc = new global.jspdf.jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const firmObj = (firm && firm.value) ? firm.value : (firm || {});
      const firmName = (firmObj.name || firmObj.legal_name || 'OFFLINE ACCOUNTING ERP').toUpperCase();
      const firmGstin = firmObj.gstin || firmObj.gst_number || '';

      // Title & Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138); // Navy
      doc.text(firmName, 148.5, 14, { align: 'center' });

      doc.setFontSize(10.5);
      doc.setTextColor(15, 118, 110); // Teal
      doc.text('SALES & PURCHASE VOUCHERS REGISTER', 148.5, 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const subInfo = [
        firmGstin ? `GSTIN: ${firmGstin}` : '',
        subtitle || `Generated: ${new Date().toLocaleString()}`,
        `Total Vouchers: ${bills.length}`
      ].filter(Boolean).join('  |  ');
      doc.text(subInfo, 148.5, 25, { align: 'center' });

      let sumTaxable = 0;
      let sumCgst = 0;
      let sumSgst = 0;
      let sumIgst = 0;
      let sumNet = 0;

      const body = bills.map((b) => {
        const taxable = Number(b.taxableTotal || b.grossTotal) || 0;
        const cgst = Number(b.cgst) || 0;
        const sgst = Number(b.sgst) || 0;
        const igst = Number(b.igst) || 0;
        const net = Number(b.netTotal) || 0;

        sumTaxable += taxable;
        sumCgst += cgst;
        sumSgst += sgst;
        sumIgst += igst;
        sumNet += net;

        return [
          b.bno || '-',
          b.bdate || '-',
          (b.btype || 'SALES').replace(/_/g, ' '),
          b.partyName || 'Cash',
          b.partyGstin || '-',
          formatCurrency(taxable),
          cgst > 0 ? formatCurrency(cgst) : '-',
          sgst > 0 ? formatCurrency(sgst) : '-',
          igst > 0 ? formatCurrency(igst) : '-',
          formatCurrency(net)
        ];
      });

      const foot = [[
        'TOTAL',
        '',
        `${bills.length} Records`,
        '',
        '',
        formatCurrency(sumTaxable),
        formatCurrency(sumCgst),
        formatCurrency(sumSgst),
        formatCurrency(sumIgst),
        formatCurrency(sumNet)
      ]];

      doc.autoTable({
        startY: 28,
        head: [['Voucher No', 'Date', 'Type', 'Party Name', 'Party GSTIN', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Net Total']],
        body: body,
        foot: foot,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 1.8,
          lineColor: [226, 232, 240],
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 60, halign: 'left' },
          4: { cellWidth: 32, halign: 'center' },
          5: { cellWidth: 26, halign: 'right' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 22, halign: 'right' },
          8: { cellWidth: 22, halign: 'right' },
          9: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: (data) => {
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${doc.internal.getNumberOfPages()}`, 280, 204, { align: 'right' });
        }
      });

      doc.save(`Bills_Register_${Date.now()}.pdf`);
    },

    /**
     * Stock Valuation PDF Report
     */
    exportStocksPdf(stocks = [], firm = {}) {
      if (!global.jspdf || !global.jspdf.jsPDF) {
        throw new Error('jsPDF library is not loaded');
      }

      const doc = new global.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const firmObj = (firm && firm.value) ? firm.value : (firm || {});
      const firmName = (firmObj.name || firmObj.legal_name || 'OFFLINE ACCOUNTING ERP').toUpperCase();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 58, 138);
      doc.text(firmName, 105, 14, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text('INVENTORY STOCK VALUATION REPORT', 105, 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString()}  |  Total Products: ${stocks.length}`, 105, 25, { align: 'center' });

      let totalVal = 0;
      const body = stocks.map((it, idx) => {
        const val = (Number(it.qty) || 0) * (Number(it.rate) || 0);
        totalVal += val;
        return [
          idx + 1,
          it.item || '-',
          it.pno || '-',
          it.hsn || '-',
          it.uom || 'PCS',
          Number(it.qty) || 0,
          formatCurrency(it.rate),
          formatCurrency(val)
        ];
      });

      const foot = [['', 'TOTAL VALUATION', '', '', '', '', '', formatCurrency(totalVal)]];

      doc.autoTable({
        startY: 28,
        head: [['#', 'Item Name', 'Part No', 'HSN', 'UOM', 'Qty', 'Selling Rate', 'Valuation']],
        body: body,
        foot: foot,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 1.8,
          lineColor: [226, 232, 240],
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: [220, 252, 231],
          textColor: [21, 128, 61],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 62, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 26, halign: 'left' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 14, halign: 'center' },
          5: { cellWidth: 16, halign: 'right' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${doc.internal.getNumberOfPages()}`, 195, 290, { align: 'right' });
        }
      });

      doc.save(`Stock_Report_${Date.now()}.pdf`);
    }
  };

  global.PdfExportService = PdfExportService;
})(window);
