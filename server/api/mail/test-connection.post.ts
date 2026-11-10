import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);
    const body = await readBody(event);

    if (!body.imapHost || !body.smtpHost || !body.username || !body.password) {
      throw createError({ statusCode: 400, statusMessage: 'All IMAP and SMTP credentials are required' });
    }

    // 1. Test IMAP connection
    const client = new ImapFlow({
      host: body.imapHost,
      port: Number(body.imapPort) || 993,
      secure: body.imapSecure !== false,
      auth: {
        user: body.username,
        pass: body.password
      },
      logger: false
    });

    try {
      await client.connect();
      await client.logout();
    } catch (imapErr: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `IMAP Connection Failed: ${imapErr.message || imapErr}`
      });
    }

    // 2. Test SMTP connection
    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: Number(body.smtpPort) || 465,
      secure: body.smtpSecure !== false,
      auth: {
        user: body.username,
        pass: body.password
      }
    });

    try {
      await transporter.verify();
    } catch (smtpErr: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `SMTP Connection Failed: ${smtpErr.message || smtpErr}`
      });
    }

    return {
      success: true,
      message: 'Both IMAP (Incoming) and SMTP (Outgoing) connections verified successfully!'
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error testing mail connection'
    });
  }
});

