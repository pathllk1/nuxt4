import { defineEventHandler, createError, getRouterParam, H3Event } from 'h3';

const handler = defineEventHandler(async (event: H3Event): Promise<any> => {
  try {
    const ifsc = getRouterParam(event, 'ifsc');
    
    if (!ifsc || ifsc.length !== 11) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid IFSC code' });
    }

    // Use Razorpay IFSC API
    const res = await $fetch<any>(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
    
    return {
      success: true,
      data: res
    };
  } catch (error: any) {
    console.error('IFSC lookup error:', error);
    throw createError({
      statusCode: error.statusCode || 404,
      statusMessage: error.statusMessage || 'IFSC not found'
    });
  }
});

export default handler;
