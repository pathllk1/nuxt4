// service/wordExportService.js
(function (global) {
  'use strict';

  const WordExportService = {
    async generateBillWordDoc(bill, items = [], filename = null, firm = {}) {
      const docName = filename || `${bill.bno || 'Voucher'}_${bill.btype || 'Document'}.doc`;
      const firmName = firm.name || firm.legal_name || 'MY COMPANY';
      const firmGstin = firm.gstin || firm.gst_number || firm.activeGstin || '';
      const firmAddress = firm.address || (firm.city ? `${firm.city}, ${firm.state || ''}` : '');
      const firmPan = firm.pan || '';

      // Formatted HTML template natively opened as Word Document (.doc/.docx compliant)
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>${bill.bno || 'Invoice'}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10pt; color: #1e293b; margin: 20px; }
            h1 { font-size: 16pt; color: #1e40af; margin-bottom: 4px; }
            .header-table { width: 100%; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px; }
            .info-box { width: 100%; margin-bottom: 15px; }
            .info-col { width: 50%; vertical-align: top; }
            table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table.data-table th { background-color: #2563eb; color: #ffffff; padding: 6px 8px; font-size: 9pt; border: 1px solid #1d4ed8; text-align: left; }
            table.data-table td { padding: 5px 8px; font-size: 9pt; border: 1px solid #cbd5e1; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals-table { width: 45%; float: right; margin-top: 15px; border-collapse: collapse; }
            .totals-table td { padding: 4px 8px; font-size: 9pt; border: 1px solid #e2e8f0; }
            .totals-table tr.net-row td { background-color: #2563eb; color: #ffffff; font-weight: bold; }
            .footer-sig { margin-top: 60px; width: 100%; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1>${firmName}</h1>
                <p style="margin:0; font-size: 8.5pt; color: #475569;">
                  ${firmGstin ? `GSTIN: ${firmGstin} ` : ''}${firmPan ? `| PAN: ${firmPan} ` : ''}<br/>
                  ${firmAddress || ''}
                </p>
              </td>
              <td class="text-right" style="vertical-align: top;">
                <h2 style="margin:0; color:#1e40af;">${(bill.btype || 'TAX INVOICE').replace(/_/g, ' ')}</h2>
                <p style="margin:2px 0 0 0; font-size: 9pt; font-weight:bold;">Voucher: ${bill.bno || '-'}</p>
                <p style="margin:0; font-size: 8.5pt; color: #64748b;">Date: ${bill.bdate || '-'}</p>
              </td>
            </tr>
          </table>

          <table class="info-box">
            <tr>
              <td class="info-col">
                <strong>BILL TO:</strong><br/>
                <span style="font-size: 11pt; font-weight:bold; color:#0f172a;">${bill.partyName || 'Party Name'}</span><br/>
                GSTIN: ${bill.partyGstin || 'UNREGISTERED'}<br/>
                Address: ${bill.partyAddress || '-'}
              </td>
              <td class="info-col text-right">
                ${bill.vehicleNo ? `<strong>Vehicle No:</strong> ${bill.vehicleNo}<br/>` : ''}
                ${bill.dispatchThrough ? `<strong>Dispatch Via:</strong> ${bill.dispatchThrough}<br/>` : ''}
                ${bill.orderNo ? `<strong>Order Ref:</strong> ${bill.orderNo}<br/>` : ''}
              </td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th class="text-center" style="width:5%;">#</th>
                <th style="width:40%;">Item Description</th>
                <th class="text-center" style="width:12%;">HSN</th>
                <th class="text-right" style="width:10%;">Qty</th>
                <th class="text-center" style="width:8%;">UOM</th>
                <th class="text-right" style="width:12%;">Rate (₹)</th>
                <th class="text-right" style="width:13%;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map((it, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><strong>${it.item}</strong></td>
                  <td class="text-center">${it.hsn || '-'}</td>
                  <td class="text-right">${it.qty}</td>
                  <td class="text-center">${it.uom || 'PCS'}</td>
                  <td class="text-right">${Number(it.rate || 0).toFixed(2)}</td>
                  <td class="text-right font-bold">${Number(it.total || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <table class="totals-table">
            <tr>
              <td>Taxable Amount:</td>
              <td class="text-right">₹${Number(bill.taxableTotal || bill.grossTotal || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>CGST / SGST:</td>
              <td class="text-right">₹${(Number(bill.cgst || 0) + Number(bill.sgst || 0)).toFixed(2)}</td>
            </tr>
            <tr>
              <td>IGST:</td>
              <td class="text-right">₹${Number(bill.igst || 0).toFixed(2)}</td>
            </tr>
            <tr class="net-row">
              <td><strong>NET TOTAL:</strong></td>
              <td class="text-right"><strong>₹${Number(bill.netTotal || 0).toFixed(2)}</strong></td>
            </tr>
          </table>
          <div style="clear:both;"></div>

          <table class="footer-sig">
            <tr>
              <td style="width:60%; font-size: 8.5pt; color:#64748b;">
                Thank you for your business.<br/>
                Terms: Subject to local jurisdiction.
              </td>
              <td style="width:40%; text-align:center;">
                <p style="margin-bottom: 40px; font-weight:bold;">For ${firmName}</p>
                <p style="border-top: 1px solid #94a3b8; display:inline-block; padding-top: 4px; font-size: 8.5pt;">Authorized Signatory</p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  global.WordExportService = WordExportService;
})(window);
