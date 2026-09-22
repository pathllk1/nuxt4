import * as docx from 'docx';
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3';
import mongoose from 'mongoose';
import MasterRoll from '../../../models/MasterRoll';
import { requireAuthSession } from '../../../utils/auth';

function normalizeDesignation(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return 'General Worker';

  const key = raw.trim().toLowerCase().replace(/[-_\s]+/g, ' ');

  const MAP: Record<string, string> = {
    /* Labour categories */
    'unskilled':            'Unskilled Worker',
    'unskilled worker':     'Unskilled Worker',
    'unskilled labour':     'Unskilled Worker',
    'unskilled laborer':    'Unskilled Worker',
    'skilled':              'Skilled Worker',
    'skilled worker':       'Skilled Worker',
    'skilled labour':       'Skilled Worker',
    'semi skilled':         'Semi-Skilled Worker',
    'semi-skilled':         'Semi-Skilled Worker',
    'semi skilled worker':  'Semi-Skilled Worker',
    'worker':               'General Worker',
    'general worker':       'General Worker',
    'labour':               'General Labour',
    'laborer':              'General Labour',
    'labourer':             'General Labour',
    'general labour':       'General Labour',
    /* Trade designations */
    'helper':               'Helper',
    'technician':           'Technician',
    'electrician':          'Electrician',
    'plumber':              'Plumber',
    'carpenter':            'Carpenter',
    'mason':                'Mason',
    'bar bender':           'Bar Bender',
    'bar bender helper':    'Bar Bender Helper',
    'welder':               'Welder',
    'fitter':               'Fitter',
    'painter':              'Painter',
    'operator':             'Machine Operator',
    'machine operator':     'Machine Operator',
    'excavator operator':   'Excavator Operator',
    'crane operator':       'Crane Operator',
    'forklift operator':    'Forklift Operator',
    'supervisor':           'Supervisor',
    'site supervisor':      'Site Supervisor',
    'foreman':              'Foreman',
    'driver':               'Driver',
    'hv driver':            'Heavy Vehicle Driver',
    'heavy vehicle driver': 'Heavy Vehicle Driver',
    'security':             'Security Guard',
    'security guard':       'Security Guard',
    'watchman':             'Watchman',
    'cleaner':              'Cleaner / Housekeeping',
    'housekeeping':         'Cleaner / Housekeeping',
    'cook':                 'Cook',
    'store keeper':         'Store Keeper',
    'storekeeper':          'Store Keeper',
    'data entry':           'Data Entry Operator',
    'data entry operator':  'Data Entry Operator',
    'accountant':           'Accountant',
    'engineer':             'Engineer',
    'site engineer':        'Site Engineer',
    'project manager':      'Project Manager',
    'manager':              'Manager',
  };

  if (MAP[key]) return MAP[key];
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);

    const id = getRouterParam(event, 'id');
    if (!id || !mongoose.isValidObjectId(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid employee id' });
    }

    const employee = await MasterRoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      firm_id: user.firm_id,
    }).lean();

    if (!employee) {
      throw createError({ statusCode: 404, statusMessage: 'Employee not found' });
    }

    const FONT = 'Times New Roman';
    const SZ = 22;   /* 11 pt */
    const SZ_SM = 20; /* 10 pt */

    const fmt = (dateStr: any) => {
      if (!dateStr) return '—';
      try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return String(dateStr);
      }
    };

    const designation = normalizeDesignation(employee.category);
    const doj = fmt(employee.date_of_joining);
    const today = fmt(new Date());
    const refNo = `APPT/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`;

    // Helper for creating table cells with no borders
    const noBorderCell = (children: any[], opts: any = {}) =>
      new docx.TableCell({
        children,
        borders: {
          top: { style: docx.BorderStyle.NONE, size: 0 },
          bottom: { style: docx.BorderStyle.NONE, size: 0 },
          left: { style: docx.BorderStyle.NONE, size: 0 },
          right: { style: docx.BorderStyle.NONE, size: 0 },
        },
        verticalAlign: docx.VerticalAlign.CENTER,
        ...opts,
      });

    const doc = new docx.Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: docx.convertInchesToTwip(1.2),
                bottom: docx.convertInchesToTwip(1.0),
                left: docx.convertInchesToTwip(0.75),
                right: docx.convertInchesToTwip(0.75),
              },
            },
          },
          children: [
            /* ── Header Table (Ref No & Date) ── */
            new docx.Table({
              width: { size: 100, type: docx.WidthType.PERCENTAGE },
              rows: [
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({
                        children: [new docx.TextRun({ text: `Ref. No.: ${refNo}`, font: FONT, size: SZ })],
                      }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({
                        children: [new docx.TextRun({ text: `Date: ${today}`, font: FONT, size: SZ })],
                        alignment: docx.AlignmentType.RIGHT,
                      }),
                    ]),
                  ],
                }),
              ],
            }),

            new docx.Paragraph({ children: [new docx.TextRun({ text: '' })], spacing: { after: 150 } }),

            /* ── Address Block ── */
            new docx.Paragraph({ children: [new docx.TextRun({ text: 'To,', font: FONT, size: SZ })], spacing: { after: 60 } }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: employee.employee_name, bold: true, font: FONT, size: SZ })],
              spacing: { after: 30 },
            }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: `S/O: ${employee.father_husband_name || '—'}`, font: FONT, size: SZ })],
              spacing: { after: 30 },
            }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: employee.address || '—', font: FONT, size: SZ })],
              spacing: { after: 200 },
            }),

            /* ── Subject ── */
            new docx.Paragraph({
              children: [
                new docx.TextRun({ text: 'Sub: ', bold: true, font: FONT, size: SZ }),
                new docx.TextRun({
                  text: 'Appointment Letter',
                  bold: true,
                  underline: { type: docx.UnderlineType.SINGLE },
                  font: FONT,
                  size: SZ,
                }),
              ],
              alignment: docx.AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            /* ── Salutation & Opening ── */
            new docx.Paragraph({
              children: [new docx.TextRun({ text: `Dear ${employee.employee_name},`, font: FONT, size: SZ })],
              spacing: { after: 100 },
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: `We are pleased to appoint you as ${designation} with our organisation, with effect from ${doj}. This appointment is offered on the terms and conditions set out below:`,
                  font: FONT,
                  size: SZ,
                }),
              ],
              alignment: docx.AlignmentType.JUSTIFIED,
              spacing: { after: 150 },
            }),

            /* ── Section 1: Terms of Employment ── */
            new docx.Paragraph({
              children: [new docx.TextRun({ text: '1. TERMS OF EMPLOYMENT', bold: true, font: FONT, size: SZ })],
              spacing: { after: 100 },
            }),
            new docx.Table({
              width: { size: 100, type: docx.WidthType.PERCENTAGE },
              rows: [
                new docx.TableRow({
                  children: [
                    noBorderCell(
                      [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Designation:', bold: true, font: FONT, size: SZ_SM })] })],
                      { width: { size: 25, type: docx.WidthType.PERCENTAGE } }
                    ),
                    noBorderCell(
                      [new docx.Paragraph({ children: [new docx.TextRun({ text: designation, font: FONT, size: SZ_SM })] })],
                      { width: { size: 75, type: docx.WidthType.PERCENTAGE } }
                    ),
                  ],
                }),
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'Project / Site:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({
                        children: [new docx.TextRun({ text: `${employee.project || '—'} / ${employee.site || '—'}`, font: FONT, size: SZ_SM })],
                      }),
                    ]),
                  ],
                }),
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'Daily Wage:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({
                        children: [
                          new docx.TextRun({
                            text: `₹ ${employee.p_day_wage != null ? employee.p_day_wage : '—'} per day (Consolidated)`,
                            font: FONT,
                            size: SZ_SM,
                          }),
                        ],
                      }),
                    ]),
                  ],
                }),
              ],
            }),

            new docx.Paragraph({ children: [new docx.TextRun({ text: '' })], spacing: { after: 150 } }),

            /* ── Section 2: STATUTORY & BANKING DETAILS ── */
            new docx.Paragraph({
              children: [new docx.TextRun({ text: '2. STATUTORY & BANKING DETAILS', bold: true, font: FONT, size: SZ })],
              spacing: { after: 100 },
            }),
            new docx.Table({
              width: { size: 100, type: docx.WidthType.PERCENTAGE },
              rows: [
                new docx.TableRow({
                  children: [
                    noBorderCell(
                      [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Aadhar Number:', bold: true, font: FONT, size: SZ_SM })] })],
                      { width: { size: 25, type: docx.WidthType.PERCENTAGE } }
                    ),
                    noBorderCell(
                      [new docx.Paragraph({ children: [new docx.TextRun({ text: employee.aadhar || '—', font: FONT, size: SZ_SM })] })],
                      { width: { size: 25, type: docx.WidthType.PERCENTAGE } }
                    ),
                    noBorderCell(
                      [new docx.Paragraph({ children: [new docx.TextRun({ text: 'PAN Number:', bold: true, font: FONT, size: SZ_SM })] })],
                      { width: { size: 20, type: docx.WidthType.PERCENTAGE } }
                    ),
                    noBorderCell(
                      [new docx.Paragraph({ children: [new docx.TextRun({ text: employee.pan || 'Not Available', font: FONT, size: SZ_SM })] })],
                      { width: { size: 30, type: docx.WidthType.PERCENTAGE } }
                    ),
                  ],
                }),
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'UAN Number:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: employee.uan || 'Not Enrolled', font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'ESIC Number:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: employee.esic_no || 'Not Enrolled', font: FONT, size: SZ_SM })] }),
                    ]),
                  ],
                }),
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'Bank Name:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: employee.bank || '—', font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'Account No:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: employee.account_no || '—', font: FONT, size: SZ_SM })] }),
                    ]),
                  ],
                }),
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'IFSC Code:', bold: true, font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: employee.ifsc || '—', font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([new docx.Paragraph({ children: [new docx.TextRun({ text: '', font: FONT, size: SZ_SM })] })]),
                    noBorderCell([new docx.Paragraph({ children: [new docx.TextRun({ text: '', font: FONT, size: SZ_SM })] })]),
                  ],
                }),
              ],
            }),

            new docx.Paragraph({ children: [new docx.TextRun({ text: '' })], spacing: { after: 150 } }),

            /* ── Section 3: Clauses ── */
            new docx.Paragraph({
              children: [new docx.TextRun({ text: '3. POLICE VERIFICATION', bold: true, font: FONT, size: SZ })],
              spacing: { after: 60 },
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: 'Submission of a valid Police Clearance Certificate (PCC) is mandatory at the time of joining. The certificate must have been issued within six (6) months preceding your date of joining. Any certificate older than six months will not be accepted.',
                  font: FONT,
                  size: SZ_SM,
                }),
              ],
              alignment: docx.AlignmentType.JUSTIFIED,
              spacing: { after: 100 },
            }),

            new docx.Paragraph({
              children: [new docx.TextRun({ text: '4. GENERAL CONDITIONS', bold: true, font: FONT, size: SZ })],
              spacing: { after: 60 },
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: 'You shall comply with all company rules, site regulations, and applicable labour laws throughout your tenure. Either party may terminate this appointment by giving notice as prescribed under the applicable labour laws or by payment in lieu thereof.',
                  font: FONT,
                  size: SZ_SM,
                }),
              ],
              alignment: docx.AlignmentType.JUSTIFIED,
              spacing: { after: 300 },
            }),

            new docx.Paragraph({
              children: [new docx.TextRun({ text: '5. RESIGNATION & NOTICE PERIOD', bold: true, font: FONT, size: SZ })],
              spacing: { after: 60 },
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: `In the event of resignation, you are required to give a written notice of ${employee.resignation_notice_period || 30} days to the organisation. Similarly, the organisation may terminate your employment by giving a written notice of ${employee.resignation_notice_period || 30} days.`,
                  font: FONT,
                  size: SZ_SM,
                }),
              ],
              alignment: docx.AlignmentType.JUSTIFIED,
              spacing: { after: 300 },
            }),

            /* ── Signature Section ── */
            new docx.Paragraph({ children: [new docx.TextRun({ text: 'Yours faithfully,', font: FONT, size: SZ })], spacing: { after: 300 } }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: 'For and on behalf of the Organisation,', font: FONT, size: SZ_SM })],
              spacing: { after: 400 },
            }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: '__________________________', font: FONT, size: SZ })], spacing: { after: 50 } }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: 'Authorised Signatory', bold: true, font: FONT, size: SZ })],
              spacing: { after: 300 },
            }),

            /* ── Acceptance Footer ── */
            new docx.Paragraph({
              children: [new docx.TextRun({ text: 'EMPLOYEE ACCEPTANCE', bold: true, font: FONT, size: SZ_SM })],
              alignment: docx.AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: 'I hereby accept the appointment on the terms and conditions stated above and confirm the accuracy of the statutory details provided.',
                  font: FONT,
                  size: SZ_SM,
                  italics: true,
                }),
              ],
              spacing: { after: 250 },
            }),
            new docx.Table({
              width: { size: 100, type: docx.WidthType.PERCENTAGE },
              rows: [
                new docx.TableRow({
                  children: [
                    noBorderCell([
                      new docx.Paragraph({ children: [new docx.TextRun({ text: 'Signature: ______________________', font: FONT, size: SZ_SM })] }),
                    ]),
                    noBorderCell([
                      new docx.Paragraph({
                        children: [new docx.TextRun({ text: 'Date: ________________', font: FONT, size: SZ_SM })],
                        alignment: docx.AlignmentType.RIGHT,
                      }),
                    ]),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await docx.Packer.toBuffer(doc);

    setResponseHeader(
      event,
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const safeName = (employee.employee_name || 'Employee').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="Appointment_Letter_${safeName}.docx"`
    );

    return buffer;
  } catch (error: any) {
    console.error('Generate appointment letter error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error generating appointment letter',
    });
  }
});
