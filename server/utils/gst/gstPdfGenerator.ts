/**
 * Enterprise GST Statutory Tax Return PDF Generator Utility
 * 
 * Generates statutory GST reports (Form GSTR-3B, Form GSTR-1) conforming to:
 * 1. Rule 61(5) and Rule 59 of the Central Goods and Services Tax (CGST) Rules, 2017
 * 2. Enterprise Executive Tax Summary Ribbon (Outward Supplies, Tax Liability, Eligible ITC, Cash Payable)
 * 3. 0.5pt Hairline Slate Data Grids with Ind AS Financial Rigor
 */

function formatCurrency(val: number | undefined | null): string {
  const num = Number(val) || 0;
  return '\u20B9\u00A0' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

const C = {
  primary: '#0F172A',
  navy: '#1E3A8A',
  border: '#CBD5E1',
  borderDark: '#94A3B8',
  tableHdrBg: '#F8FAFC',
  textDark: '#0F172A',
  textMid: '#334155',
  textLight: '#64748B',
  emerald: '#059669',
  cardBg: '#F8FAFC',
};

const gstTableLayout = {
  hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.75 : 0.35,
  vLineWidth: () => 0.5,
  hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
  vLineColor: () => C.border
};

/**
 * Generate Enterprise GSTR-3B PDF Document Definition
 */
export function getGSTR3BPDFDefinition(report: any, firm: any): any {
  const { period_start, period_end, firm_gstin, table_3_1, table_4, table_5 } = report;

  // Entity Resolution: Prioritize Trade Name over Proprietor Name
  const rawFirmName = firm?.name || '';
  const rawLegalName = firm?.legal_name || '';
  const firmTradeName = (rawFirmName || rawLegalName || 'ENTERPRISE BUSINESS PRO').toUpperCase();
  const hasProprietor = Boolean(
    rawLegalName &&
    rawFirmName &&
    rawLegalName.trim().toUpperCase() !== rawFirmName.trim().toUpperCase()
  );

  // Calculate Executive Tax KPIs
  const totalTaxable = (Number(table_3_1?.a?.taxable_value) || 0) +
                       (Number(table_3_1?.b?.taxable_value) || 0) +
                       (Number(table_3_1?.c?.taxable_value) || 0) +
                       (Number(table_3_1?.d?.taxable_value) || 0);

  const totalOutputTax = (Number(table_3_1?.a?.igst) || 0) + (Number(table_3_1?.a?.cgst) || 0) + (Number(table_3_1?.a?.sgst) || 0) + (Number(table_3_1?.a?.cess) || 0) +
                         (Number(table_3_1?.b?.igst) || 0) + (Number(table_3_1?.b?.cess) || 0) +
                         (Number(table_3_1?.d?.igst) || 0) + (Number(table_3_1?.d?.cgst) || 0) + (Number(table_3_1?.d?.sgst) || 0) + (Number(table_3_1?.d?.cess) || 0);

  const totalItc = (Number(table_4?.a?.[5]?.igst) || 0) + (Number(table_4?.a?.[5]?.cgst) || 0) + (Number(table_4?.a?.[5]?.sgst) || 0) + (Number(table_4?.a?.[5]?.cess) || 0) +
                   (Number(table_4?.a?.[3]?.igst) || 0) + (Number(table_4?.a?.[3]?.cgst) || 0) + (Number(table_4?.a?.[3]?.sgst) || 0);

  const netCashPayable = Math.max(0, totalOutputTax - totalItc);
  const nowTimestamp = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  return {
    pageSize: 'A4',
    pageMargins: [30, 36, 30, 36],
    defaultStyle: {
      font: 'DejaVuSans',
      fontSize: 8,
      color: C.textDark
    },
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null;
      return {
        margin: [30, 12, 30, 0],
        columns: [
          { text: `${firmTradeName}  •  FORM GSTR-3B RETURN [Rule 61(5)]`, bold: true, fontSize: 7.5, color: C.textDark },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7.5, color: C.textLight }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [30, 10, 30, 0],
        columns: [
          { text: `Statutory GST Filing  •  GSTIN: ${firm_gstin || 'N/A'}  •  Generated: ${nowTimestamp}`, fontSize: 7, color: C.textLight },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7, color: C.textDark }
        ]
      };
    },
    content: [
      // 1. Corporate & Statutory Return Header
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: firmTradeName, fontSize: 13, bold: true, color: C.primary },
              ...(hasProprietor ? [{ text: `(Proprietor: ${rawLegalName.trim().toUpperCase()})`, fontSize: 8, italics: true, color: C.textMid }] : []),
              {
                text: [
                  firm?.address,
                  firm?.city,
                  firm?.state ? `${firm.state}${firm.pincode ? ' - ' + firm.pincode : ''}` : ''
                ].filter(Boolean).join(', '),
                fontSize: 7.5,
                color: C.textMid,
                margin: [0, 2, 0, 0]
              },
              {
                text: [
                  `GSTIN: ${firm_gstin || firm?.gst_number || 'N/A'}`,
                  firm?.pan_number ? `PAN: ${firm.pan_number}` : '',
                  firm?.cin_number ? `CIN: ${firm.cin_number}` : '',
                  firm?.phone_number ? `Phone: ${firm.phone_number}` : ''
                ].filter(Boolean).join('  |  '),
                fontSize: 7,
                color: C.textLight,
                margin: [0, 1, 0, 0]
              }
            ]
          },
          {
            width: 200,
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'FORM GSTR-3B', bold: true, fontSize: 10, color: C.navy, alignment: 'center' },
                      { text: '[See Rule 61(5) CGST Rules, 2017]', fontSize: 6.5, italics: true, color: C.textLight, alignment: 'center' },
                      { text: `Period: ${period_start || ''} to ${period_end || ''}`, fontSize: 7.5, bold: true, color: C.textDark, alignment: 'center', margin: [0, 2, 0, 0] },
                      { text: 'STATUS: SELF-ASSESSED SUMMARY RETURN', fontSize: 6, bold: true, color: C.emerald, alignment: 'center' }
                    ],
                    fillColor: '#F8FAFC',
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          }
        ]
      },

      // Divider line
      { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 535, y2: 8, lineWidth: 0.5, lineColor: C.border }], margin: [0, 0, 0, 10] },

      // 2. Executive Tax KPI Summary Ribbon
      {
        columns: [
          {
            width: '25%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'TOTAL OUTWARD TAXABLE', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(totalTaxable), fontSize: 9.5, bold: true, color: C.textDark, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          },
          {
            width: '25%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'TOTAL TAX LIABILITY', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(totalOutputTax), fontSize: 9.5, bold: true, color: C.navy, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          },
          {
            width: '25%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'ELIGIBLE ITC WITHHELD', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(totalItc), fontSize: 9.5, bold: true, color: C.emerald, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          },
          {
            width: '25%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'EST. NET CASH PAYABLE', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(netCashPayable), fontSize: 9.5, bold: true, color: netCashPayable > 0 ? '#DC2626' : C.emerald, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          }
        ],
        margin: [0, 0, 0, 10]
      },

      // 3. Table 3.1: Details of Outward Supplies & Reverse Charge Inward
      { text: '3.1 Details of Outward Supplies and inward supplies liable to reverse charge', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 75, 60, 60, 60, 50],
          body: [
            [
              { text: 'Nature of Supplies', style: 'tableHeader' },
              { text: 'Taxable Value', style: 'tableHeader', alignment: 'right' },
              { text: 'IGST', style: 'tableHeader', alignment: 'right' },
              { text: 'CGST', style: 'tableHeader', alignment: 'right' },
              { text: 'SGST / UTGST', style: 'tableHeader', alignment: 'right' },
              { text: 'Cess', style: 'tableHeader', alignment: 'right' }
            ],
            [
              { text: '(a) Outward taxable supplies (other than zero rated, nil rated & exempted)', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.a?.taxable_value), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.a?.igst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.a?.cgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.a?.sgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.a?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '(b) Outward taxable supplies (zero rated / exports)', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.b?.taxable_value), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.b?.igst), alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.b?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '(c) Other outward supplies (Nil rated, exempted)', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.c?.taxable_value), alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '(d) Inward supplies (liable to reverse charge)', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.d?.taxable_value), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.d?.igst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.d?.cgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.d?.sgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.d?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '(e) Non-GST outward supplies', fontSize: 7.5 },
              { text: formatCurrency(table_3_1?.e?.taxable_value), alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 }
            ]
          ]
        },
        layout: gstTableLayout,
        margin: [0, 4, 0, 12]
      },

      // 4. Table 4: Eligible ITC
      { text: '4. Eligible Input Tax Credit (ITC)', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 75, 75, 75, 60],
          body: [
            [
              { text: 'ITC Component Details', style: 'tableHeader' },
              { text: 'IGST', style: 'tableHeader', alignment: 'right' },
              { text: 'CGST', style: 'tableHeader', alignment: 'right' },
              { text: 'SGST / UTGST', style: 'tableHeader', alignment: 'right' },
              { text: 'Cess', style: 'tableHeader', alignment: 'right' }
            ],
            [{ text: '(A) ITC Available (whether in full or part)', style: 'tableSubHeader', colSpan: 5 }, {}, {}, {}, {}],
            [
              { text: '    (1) Import of goods', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[1]?.igst), alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[1]?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '    (2) Import of services', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[2]?.igst), alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: '₹ 0.00', alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[2]?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '    (3) Inward supplies liable to reverse charge', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[3]?.igst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[3]?.cgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[3]?.sgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[3]?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '    (4) Inward supplies from ISD', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[4]?.igst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[4]?.cgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[4]?.sgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.a?.[4]?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '    (5) All other ITC (General)', fontSize: 7.5, bold: true },
              { text: formatCurrency(table_4?.a?.[5]?.igst), alignment: 'right', fontSize: 7.5, bold: true },
              { text: formatCurrency(table_4?.a?.[5]?.cgst), alignment: 'right', fontSize: 7.5, bold: true },
              { text: formatCurrency(table_4?.a?.[5]?.sgst), alignment: 'right', fontSize: 7.5, bold: true },
              { text: formatCurrency(table_4?.a?.[5]?.cess), alignment: 'right', fontSize: 7.5, bold: true }
            ],
            [{ text: '(B) ITC Reversed', style: 'tableSubHeader', colSpan: 5 }, {}, {}, {}, {}],
            [
              { text: '    (1) As per rules 42 & 43 of CGST Rules', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[1]?.igst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[1]?.cgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[1]?.sgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[1]?.cess), alignment: 'right', fontSize: 7.5 }
            ],
            [
              { text: '    (2) Others', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[2]?.igst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[2]?.cgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[2]?.sgst), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_4?.b?.[2]?.cess), alignment: 'right', fontSize: 7.5 }
            ]
          ]
        },
        layout: gstTableLayout,
        margin: [0, 4, 0, 12]
      },

      // 5. Table 5: Inward Exempt & Non-GST Supplies
      { text: '5. Values of exempt, nil-rated and non-GST inward supplies', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 120, 120],
          body: [
            [
              { text: 'Nature of Supplies', style: 'tableHeader' },
              { text: 'Inter-State Supplies', style: 'tableHeader', alignment: 'right' },
              { text: 'Intra-State Supplies', style: 'tableHeader', alignment: 'right' }
            ],
            [
              { text: 'From a supplier under composition scheme, Exempt and Nil rated supply', fontSize: 7.5 },
              { text: formatCurrency(table_5?.inter), alignment: 'right', fontSize: 7.5 },
              { text: formatCurrency(table_5?.intra), alignment: 'right', fontSize: 7.5 }
            ]
          ]
        },
        layout: gstTableLayout,
        margin: [0, 4, 0, 14]
      },

      // 6. Statutory Verification & Attestation Block
      {
        dontBreakRows: true,
        stack: [
          {
            text: 'STATUTORY VERIFICATION: I hereby solemnly affirm and declare that the information given hereinabove is true and correct to the best of my knowledge and belief and nothing has been concealed therefrom. I am authorized to furnish this return in accordance with Section 39 of the CGST Act, 2017 read with Rule 61(5).',
            fontSize: 6.5,
            italics: true,
            color: C.textLight,
            margin: [0, 0, 0, 8]
          },
          {
            columns: [
              {
                width: '48%',
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          { text: 'Tax Practitioner / Internal Tax Officer', fontSize: 7, bold: true, color: C.textDark, alignment: 'center' },
                          { text: '\n\n', fontSize: 6 },
                          { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: C.borderDark }] },
                          { text: 'Prepared & Verified by Tax Department', fontSize: 6.5, color: C.textLight, alignment: 'center', margin: [0, 3, 0, 0] }
                        ],
                        borderColor: [C.border, C.border, C.border, C.border],
                        fillColor: '#FFFFFF'
                      }
                    ]
                  ]
                }
              },
              { width: '4%', text: '' },
              {
                width: '48%',
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          { text: `For ${firmTradeName}`, fontSize: 7, bold: true, color: C.textDark, alignment: 'center' },
                          { text: '\n\n', fontSize: 6 },
                          { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: C.borderDark }] },
                          { text: hasProprietor ? 'Authorized Signatory / Proprietor' : 'Authorized Signatory / Director', fontSize: 6.5, color: C.textLight, alignment: 'center', margin: [0, 3, 0, 0] }
                        ],
                        borderColor: [C.border, C.border, C.border, C.border],
                        fillColor: '#FFFFFF'
                      }
                    ]
                  ]
                }
              }
            ]
          }
        ]
      }
    ],
    styles: {
      sectionHeader: { fontSize: 8.5, bold: true, margin: [0, 8, 0, 3], color: C.primary },
      tableHeader: { fontSize: 7.5, bold: true, fillColor: C.tableHdrBg, color: C.primary, margin: [2, 3, 2, 3] },
      tableSubHeader: { fontSize: 7.5, bold: true, fillColor: '#F1F5F9', color: C.navy, margin: [2, 2, 2, 2] }
    }
  };
}

/**
 * Generate Enterprise GSTR-1 PDF Document Definition
 */
export function getGSTR1PDFDefinition(report: any, firm: any): any {
  const { summary, tables } = report;

  const rawFirmName = firm?.name || '';
  const rawLegalName = firm?.legal_name || '';
  const firmTradeName = (rawFirmName || rawLegalName || 'ENTERPRISE BUSINESS PRO').toUpperCase();
  const hasProprietor = Boolean(
    rawLegalName &&
    rawFirmName &&
    rawLegalName.trim().toUpperCase() !== rawFirmName.trim().toUpperCase()
  );

  const nowTimestamp = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 36, 30, 36],
    defaultStyle: { font: 'DejaVuSans', fontSize: 8, color: C.textDark },
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null;
      return {
        margin: [30, 12, 30, 0],
        columns: [
          { text: `${firmTradeName}  •  FORM GSTR-1: OUTWARD SUPPLIES RETURN`, bold: true, fontSize: 7.5, color: C.textDark },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7.5, color: C.textLight }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [30, 10, 30, 0],
        columns: [
          { text: `Statutory GST Outward Return  •  Generated: ${nowTimestamp}  •  Rule 59 CGST Rules Compliant`, fontSize: 7, color: C.textLight },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7, color: C.textDark }
        ]
      };
    },
    content: [
      // 1. Corporate Header
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: firmTradeName, fontSize: 13, bold: true, color: C.primary },
              ...(hasProprietor ? [{ text: `(Proprietor: ${rawLegalName.trim().toUpperCase()})`, fontSize: 8, italics: true, color: C.textMid }] : []),
              {
                text: [
                  firm?.address,
                  firm?.city,
                  firm?.state ? `${firm.state}${firm.pincode ? ' - ' + firm.pincode : ''}` : ''
                ].filter(Boolean).join(', '),
                fontSize: 7.5,
                color: C.textMid,
                margin: [0, 2, 0, 0]
              },
              {
                text: [
                  `GSTIN: ${summary?.firm_gstin || firm?.gst_number || 'N/A'}`,
                  firm?.pan_number ? `PAN: ${firm.pan_number}` : '',
                  firm?.cin_number ? `CIN: ${firm.cin_number}` : '',
                  firm?.phone_number ? `Phone: ${firm.phone_number}` : ''
                ].filter(Boolean).join('  |  '),
                fontSize: 7,
                color: C.textLight,
                margin: [0, 1, 0, 0]
              }
            ]
          },
          {
            width: 220,
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'FORM GSTR-1', bold: true, fontSize: 10, color: C.navy, alignment: 'center' },
                      { text: 'Statement of Outward Supplies [Rule 59]', fontSize: 6.5, italics: true, color: C.textLight, alignment: 'center' },
                      { text: `Return Period: ${summary?.period_start || ''} to ${summary?.period_end || ''}`, fontSize: 7.5, bold: true, color: C.textDark, alignment: 'center', margin: [0, 2, 0, 0] },
                      { text: 'STATUS: STATUTORY OUTWARD RETURN', fontSize: 6, bold: true, color: C.emerald, alignment: 'center' }
                    ],
                    fillColor: '#F8FAFC',
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          }
        ]
      },

      { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 782, y2: 8, lineWidth: 0.5, lineColor: C.border }], margin: [0, 0, 0, 10] },

      // 2. Executive Outward Supplies KPI Ribbon
      {
        columns: [
          {
            width: '20%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'TOTAL INVOICES', fontSize: 6, bold: true, color: C.textLight },
                      { text: String(summary?.total_invoices || 0), fontSize: 10, bold: true, color: C.navy, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          },
          {
            width: '25%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'TOTAL TAXABLE TURNOVER', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(summary?.total_taxable_value), fontSize: 10, bold: true, color: C.textDark, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          },
          {
            width: '25%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'TOTAL GST COLLECTED', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(summary?.total_gst), fontSize: 10, bold: true, color: C.emerald, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          },
          {
            width: '30%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'TOTAL AGGREGATE INVOICE VALUE', fontSize: 6, bold: true, color: C.textLight },
                      { text: formatCurrency(summary?.total_invoice_value), fontSize: 10, bold: true, color: C.primary, margin: [0, 2, 0, 0] }
                    ],
                    fillColor: C.cardBg,
                    borderColor: [C.border, C.border, C.border, C.border]
                  }
                ]
              ]
            }
          }
        ],
        margin: [0, 0, 0, 10]
      },

      // 3. Table 4A: B2B Supplies
      { text: 'Table 4A: Taxable Outward Supplies Made to Registered Persons (B2B)', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: [70, 65, 110, 110, 110, 110],
          body: [
            [
              { text: 'Invoice No', style: 'tableHeader' },
              { text: 'Invoice Date', style: 'tableHeader', alignment: 'center' },
              { text: 'Customer GSTIN', style: 'tableHeader' },
              { text: 'Taxable Value', style: 'tableHeader', alignment: 'right' },
              { text: 'Total GST', style: 'tableHeader', alignment: 'right' },
              { text: 'Invoice Total', style: 'tableHeader', alignment: 'right' }
            ],
            ...((tables?.table_4a_b2b_supplies || []).slice(0, 40).map((row: any, idx: number) => {
              const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
              return [
                { text: row.invoice_no || '—', fontSize: 7.5, bold: true, fillColor: bg },
                { text: row.invoice_date || '—', alignment: 'center', fontSize: 7.5, fillColor: bg },
                { text: row.customer_gstin || '—', fontSize: 7.5, fillColor: bg },
                { text: formatCurrency(row.taxable_value), alignment: 'right', fontSize: 7.5, fillColor: bg },
                { text: formatCurrency((row.cgst || 0) + (row.sgst || 0) + (row.igst || 0)), alignment: 'right', fontSize: 7.5, fillColor: bg },
                { text: formatCurrency(row.invoice_value), alignment: 'right', bold: true, fontSize: 7.5, fillColor: bg }
              ];
            }))
          ]
        },
        layout: gstTableLayout,
        margin: [0, 4, 0, 10]
      },

      // 4. Table 12: HSN Summary
      { text: 'Table 12: HSN-wise Summary of Outward Supplies', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: [60, '*', 50, 60, 95, 95],
          body: [
            [
              { text: 'HSN / SAC', style: 'tableHeader', alignment: 'center' },
              { text: 'Description of Goods / Services', style: 'tableHeader' },
              { text: 'UQC', style: 'tableHeader', alignment: 'center' },
              { text: 'Total Qty', style: 'tableHeader', alignment: 'right' },
              { text: 'Total Taxable Value', style: 'tableHeader', alignment: 'right' },
              { text: 'Integrated / Total Tax', style: 'tableHeader', alignment: 'right' }
            ],
            ...((tables?.table_12_hsn_b2b || []).slice(0, 20).map((row: any, idx: number) => {
              const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
              return [
                { text: row.hsn || '—', alignment: 'center', fontSize: 7.5, bold: true, fillColor: bg },
                { text: row.description || '—', fontSize: 7.5, fillColor: bg },
                { text: row.uqc || 'PCS', alignment: 'center', fontSize: 7.5, fillColor: bg },
                { text: String(row.total_quantity || 0), alignment: 'right', fontSize: 7.5, fillColor: bg },
                { text: formatCurrency(row.taxable_value), alignment: 'right', fontSize: 7.5, fillColor: bg },
                { text: formatCurrency(row.integrated_tax), alignment: 'right', bold: true, fontSize: 7.5, fillColor: bg }
              ];
            }))
          ]
        },
        layout: gstTableLayout,
        margin: [0, 4, 0, 14]
      },

      // 5. Verification Block
      {
        dontBreakRows: true,
        stack: [
          {
            text: 'STATUTORY DECLARATION: I hereby declare that the outward supplies and tax liability reported in this Form GSTR-1 are completely reconcilable with our books of accounts, e-way bills, and tax invoices issued during the period.',
            fontSize: 6.5,
            italics: true,
            color: C.textLight,
            margin: [0, 0, 0, 8]
          },
          {
            columns: [
              { width: '*', text: '' },
              {
                width: 240,
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          { text: `For ${firmTradeName}`, fontSize: 7.5, bold: true, color: C.textDark, alignment: 'center' },
                          { text: '\n\n', fontSize: 6 },
                          { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: C.borderDark }] },
                          { text: hasProprietor ? 'Authorized Signatory / Proprietor' : 'Authorized Signatory / Director', fontSize: 6.5, color: C.textLight, alignment: 'center', margin: [0, 3, 0, 0] }
                        ],
                        borderColor: [C.border, C.border, C.border, C.border],
                        fillColor: '#FFFFFF'
                      }
                    ]
                  ]
                }
              }
            ]
          }
        ]
      }
    ],
    styles: {
      sectionHeader: { fontSize: 8.5, bold: true, margin: [0, 8, 0, 3], color: C.primary },
      tableHeader: { fontSize: 7.5, bold: true, fillColor: C.tableHdrBg, color: C.primary, margin: [2, 3, 2, 3] }
    }
  };
}
