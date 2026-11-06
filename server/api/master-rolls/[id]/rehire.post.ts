import { defineEventHandler, getRouterParam, createError, readBody } from 'h3';
import mongoose from 'mongoose';
import MasterRoll, { getEmployeeTenures } from '../../../models/MasterRoll';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);

    const id = getRouterParam(event, 'id');
    if (!id || !mongoose.isValidObjectId(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid employee id' });
    }

    const body = await readBody(event);
    const {
      date_of_joining,
      project,
      site,
      category,
      p_day_wage,
      previous_exit_date,
      previous_exit_reason,
      remarks,
      bank,
      account_no,
      ifsc,
      branch,
      phone_no,
    } = body || {};

    if (!date_of_joining || typeof date_of_joining !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'New Date of Joining is required' });
    }
    if (!project || typeof project !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'New Project is required' });
    }
    if (!site || typeof site !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'New Site is required' });
    }
    if (!category || typeof category !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'New Category is required' });
    }
    if (p_day_wage == null || isNaN(Number(p_day_wage)) || Number(p_day_wage) < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Valid Daily Wage rate is required' });
    }

    const employee = await MasterRoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      firm_id: user.firm_id,
    });

    if (!employee) {
      throw createError({ statusCode: 404, statusMessage: 'Employee not found' });
    }

    // Retrieve or synthesize current tenures list
    const currentTenures = getEmployeeTenures(employee);

    // If the latest tenure was still marked as Active, close it before opening the new one
    if (currentTenures.length > 0) {
      const lastTenure = currentTenures[currentTenures.length - 1];
      if (lastTenure && lastTenure.status !== 'Left') {
        lastTenure.status = 'Left';
        lastTenure.date_of_exit = previous_exit_date || employee.date_of_exit || date_of_joining;
        lastTenure.exit_reason = previous_exit_reason || employee.doe_rem || 'Prior tenure ended';
      }
    }

    const newTenureNo = currentTenures.length + 1;
    const yearStr = date_of_joining.trim().slice(0, 4) || new Date().getFullYear().toString();
    const idHex = String(employee._id).slice(-6).toUpperCase();
    const newRefNo = `APPT/${yearStr}/${idHex}-T${newTenureNo}`;

    // Determine banking & phone details (updated if provided, else inherit current)
    const activeBank = (typeof bank === 'string' && bank.trim()) ? bank.trim() : employee.bank;
    const activeAccountNo = (typeof account_no === 'string' && account_no.trim()) ? account_no.trim() : employee.account_no;
    const activeIfsc = (typeof ifsc === 'string' && ifsc.trim()) ? ifsc.trim().toUpperCase() : employee.ifsc;
    const activeBranch = (typeof branch === 'string' && branch.trim()) ? branch.trim() : employee.branch;
    const activePhone = (typeof phone_no === 'string' && phone_no.trim()) ? phone_no.trim() : employee.phone_no;

    const newTenure = {
      tenure_no: newTenureNo,
      project: project.trim(),
      site: site.trim(),
      category: category.trim().toUpperCase(),
      p_day_wage: Number(p_day_wage),
      date_of_joining: date_of_joining.trim(),
      date_of_exit: undefined,
      exit_reason: undefined,
      appointment_ref_no: newRefNo,
      appointment_date: date_of_joining.trim(),
      status: 'Active',
      bank: activeBank,
      account_no: activeAccountNo,
      ifsc: activeIfsc,
      branch: activeBranch,
      phone_no: activePhone,
      remarks: remarks?.trim() || `Re-hired on Tenure #${newTenureNo}`,
    };

    const updatedTenures = [...currentTenures, newTenure];

    // Update root document to project the active tenure for backward compatibility
    employee.tenures = updatedTenures as any;
    employee.project = project.trim();
    employee.site = site.trim();
    employee.category = category.trim().toUpperCase();
    employee.p_day_wage = Number(p_day_wage);
    employee.date_of_joining = date_of_joining.trim();
    employee.date_of_exit = undefined;
    employee.doe_rem = undefined;
    employee.status = 'Active';
    employee.bank = activeBank;
    employee.account_no = activeAccountNo;
    employee.ifsc = activeIfsc;
    employee.branch = activeBranch;
    employee.phone_no = activePhone;
    employee.updated_by = user._id;

    await employee.save();

    return {
      success: true,
      message: `Employee successfully re-hired under Tenure #${newTenureNo}`,
      data: employee,
      new_tenure: newTenure,
    };
  } catch (error: any) {
    console.error('Re-hire employee error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error processing employee re-hire',
    });
  }
});

