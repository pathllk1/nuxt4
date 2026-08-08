import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getProvider } from '~~/server/utils/ai-chat/providers';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  try {
    const { tableName, dbType, payload, provider, model, apiKey } = await readBody(event);

    if (!payload || !provider || !apiKey) {
      throw createError({ statusCode: 400, statusMessage: 'Payload, provider, and apiKey are required' });
    }

    const p = getProvider(provider);

    const systemPrompt = `You are a Senior Data Analyst and Database Administrator.
Analyze the following CSV data excerpt from table/collection "${tableName}" (${dbType}).
Provide actionable business insights, identify anomalies, data quality issues, and performance optimizations.
Format output in clean HTML with bullet points and subheadings.`;

    const userPrompt = `Dataset Excerpt (${tableName}):\n\n${payload}\n\nPlease generate diagnostic report.`;

    let assistantResponse = '';

    for await (const chunk of p.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: model || 'default',
      apiKey
    })) {
      if (chunk.content) {
        assistantResponse += chunk.content;
      }
    }

    return {
      success: true,
      analysis: assistantResponse || 'No response generated'
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'AI Data Analysis failed'
    });
  }
});
