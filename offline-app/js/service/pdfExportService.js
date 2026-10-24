// service/pdfExportService.js
(function (global) {
  'use strict';

  const PdfExportService = {
    generateInvoicePdf(bill, items = [], firm = {}) {
      if (!global.jspdf || !global.jspdf.jsPDF) {
        throw new Error('jsPDF library is not loaded');
      }

      const doc = new global.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const firmName = firm.name || firm.legal_name || 'TAX INVOICE';
      const firmGst = firm.activeGstin || firm.gst_number || firm.gstin || '';
      const firmAddr = firm.address || '';
      const firmState = firm.state || 'Maharashtra';
      const firmStateCode = firm.state_code || '27';

      // 1. Top Header Banner
      doc.setFillColor(30, 64, 175); // Blue 800
      doc.rect(0, 0, 210, 24, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(firmName, 14, 11);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const subLine = [
        firmGst ? `GSTIN: ${firmGst}` : '',
        firmState ? `State: ${firmState} (${firmStateCode})` : '',
        firmAddr
      ].filter(Boolean).join(' | ');
      doc.text(subLine || 'Registered Business Invoice', 14, 17);

      const isGstEnabled = (firm.gst_enabled !== 0 && firm.gst_enabled !== false && firm.gst_enabled !== '0') &&
        ((Number(bill.cgst || 0) > 0 || Number(bill.sgst || 0) > 0 || Number(bill.igst || 0) > 0) || Boolean(firmGst));

      let voucherTitle = (bill.btype || 'TAX INVOICE').replace(/_/g, ' ');
      if (voucherTitle === 'SALES' || voucherTitle === 'TAX INVOICE') {
        voucherTitle = isGstEnabled ? 'TAX INVOICE' : 'BILL OF SUPPLY';
      } else if (voucherTitle === 'PURCHASE') {
        voucherTitle = 'PURCHASE VOUCHER';
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(voucherTitle, 196, 14, { align: 'right' });

      // 2. Invoice & Party Information Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 28, 88, 30, 2, 2, 'FD'); // Bill To Box
      doc.roundedRect(108, 28, 88, 30, 2, 2, 'FD'); // Details Box

      // Bill To Details
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('BILL TO / PARTY DETAILS:', 17, 34);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(bill.partyName || 'Cash Customer', 17, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`GSTIN: ${bill.partyGstin || 'UNREGISTERED'}`, 17, 46);
      doc.text(`Address: ${bill.partyAddress || 'Local Address'}`, 17, 51);

      // Voucher Details
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DOCUMENT DETAILS:', 111, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Voucher No : ${bill.bno || '-'}`, 111, 41);
      doc.text(`Date       : ${bill.bdate || '-'}`, 111, 46);
      if (bill.vehicleNo) doc.text(`Vehicle No : ${bill.vehicleNo}`, 111, 51);
      if (bill.orderNo) doc.text(`Order Ref  : ${bill.orderNo}`, 111, 56);

      // 3. Line Items Table via autoTable
      const tableRows = (items || []).map((it, idx) => {
        if (isGstEnabled) {
          return [
            idx + 1,
            it.item,
            it.hsn || '-',
            it.qty,
            it.uom || 'PCS',
            Number(it.rate || 0).toFixed(2),
            Number(it.disc || 0) + '%',
            Number(it.taxable || (it.qty * it.rate)).toFixed(2),
            Number(it.grate || 0) + '%',
            Number(it.total || 0).toFixed(2)
          ];
        } else {
          return [
            idx + 1,
            it.item,
            it.qty,
            it.uom || 'PCS',
            Number(it.rate || 0).toFixed(2),
            Number(it.disc || 0) + '%',
            Number(it.total || (it.qty * it.rate)).toFixed(2)
          ];
        }
      });

      const tableHead = isGstEnabled
        ? [['#', 'Item Description', 'HSN', 'Qty', 'UOM', 'Rate', 'Disc', 'Taxable', 'GST%', 'Total']]
        : [['#', 'Item Description', 'Qty', 'UOM', 'Rate', 'Disc', 'Total']];

      const columnStyles = isGstEnabled ? {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 55 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'right', cellWidth: 12 },
        4: { halign: 'center', cellWidth: 10 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 12 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'center', cellWidth: 12 },
        9: { halign: 'right', cellWidth: 22 }
      } : {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 80 },
        2: { halign: 'right', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 16 },
        6: { halign: 'right', cellWidth: 24 }
      };

      doc.autoTable({
        startY: 62,
        head: tableHead,
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        columnStyles: columnStyles,
        margin: { left: 14, right: 14 }
      });

      const finalY = doc.lastAutoTable.finalY || 160;

      // 4. Tax / Amount Summary & Net Total Box
      const taxBoxY = finalY + 4;
      const boxHeight = isGstEnabled ? 36 : 24;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(120, taxBoxY, 76, boxHeight, 1.5, 1.5, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);

      if (isGstEnabled) {
        doc.text('Taxable Amount:', 124, taxBoxY + 6);
        doc.text(Number(bill.taxableTotal || bill.grossTotal || 0).toFixed(2), 192, taxBoxY + 6, { align: 'right' });

        doc.text('CGST / SGST:', 124, taxBoxY + 12);
        const halfTax = (Number(bill.cgst || 0) + Number(bill.sgst || 0)).toFixed(2);
        doc.text(halfTax, 192, taxBoxY + 12, { align: 'right' });

        doc.text('IGST:', 124, taxBoxY + 18);
        doc.text(Number(bill.igst || 0).toFixed(2), 192, taxBoxY + 18, { align: 'right' });

        doc.text('Round Off:', 124, taxBoxY + 24);
        doc.text(Number(bill.roundOff || 0).toFixed(2), 192, taxBoxY + 24, { align: 'right' });

        doc.setFillColor(37, 99, 235);
        doc.rect(120, taxBoxY + 27, 76, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text('NET TOTAL:', 124, taxBoxY + 33);
        doc.text(`INR ${Number(bill.netTotal || 0).toFixed(2)}`, 192, taxBoxY + 33, { align: 'right' });
      } else {
        doc.text('Subtotal:', 124, taxBoxY + 6);
        doc.text(Number(bill.taxableTotal || bill.grossTotal || 0).toFixed(2), 192, taxBoxY + 6, { align: 'right' });

        doc.text('Round Off:', 124, taxBoxY + 12);
        doc.text(Number(bill.roundOff || 0).toFixed(2), 192, taxBoxY + 12, { align: 'right' });

        doc.setFillColor(37, 99, 235);
        doc.rect(120, taxBoxY + 15, 76, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text('NET TOTAL:', 124, taxBoxY + 21);
        doc.text(`INR ${Number(bill.netTotal || 0).toFixed(2)}`, 192, taxBoxY + 21, { align: 'right' });
      }

      // Amount in Words
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Amount in Words:', 14, taxBoxY + 6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const words = global.numberToWords ? global.numberToWords(bill.netTotal) : `${bill.netTotal} Only`;
      doc.text(words, 14, taxBoxY + 12, { maxWidth: 100 });

      // Signature Area
      const sigY = taxBoxY + 48;
      doc.setDrawColor(203, 213, 225);
      doc.line(140, sigY, 196, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`For ${firmName}`, 168, sigY + 4, { align: 'center' });
      doc.text('Authorized Signatory', 168, sigY + 8, { align: 'center' });

      doc.save(`${bill.bno || 'Invoice'}_${Date.now()}.pdf`);
    }
  };

  global.PdfExportService = PdfExportService;
})(window);
