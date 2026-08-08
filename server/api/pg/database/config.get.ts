import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  try {
    const maskedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      const isSecret = /pass|secret|key|token|db|url|conn|auth/i.test(key);
      if (isSecret && value) {
        maskedEnv[key] = value.substring(0, Math.min(4, value.length)) + '••••••••' + (value.length > 8 ? value.substring(value.length - 4) : '');
      } else {
        maskedEnv[key] = value || '';
      }
    }

    const processStats = {
      pid: process.pid,
      title: process.title,
      version: process.version,
      execPath: process.execPath,
      argv: process.argv,
      execArgv: process.execArgv,
      cwd: process.cwd(),
      env: maskedEnv
    };

    return { success: true, process: processStats };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch process configuration'
    });
  }
});
