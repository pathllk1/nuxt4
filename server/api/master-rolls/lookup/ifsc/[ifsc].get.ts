import { defineEventHandler, createError, getRouterParam } from 'h3';

export default defineEventHandler(async (event) => {
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
