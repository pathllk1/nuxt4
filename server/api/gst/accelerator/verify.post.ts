import { GstAcceleratorService } from '../../../utils/gst/gstAcceleratorService';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { hsnList = [], gstins = [] } = body || {};

  const service = new GstAcceleratorService();

  // Run HSN verification and GSTIN verification in parallel
  const [hsnResults, gstinResults] = await Promise.all([
    service.verifyHsnBulk(hsnList),
    Promise.all((gstins as string[]).map(g => service.validateGstin(g)))
  ]);

  const hsnMap: Record<string, any> = {};
  hsnResults.forEach(h => {
    hsnMap[h.hsn] = h;
  });

  const gstinMap: Record<string, any> = {};
  gstinResults.forEach(g => {
    gstinMap[g.gstin] = g;
  });

  const verifiedHsns = hsnResults.filter(h => h.isVerified);
  const unverifiedHsns = hsnResults.filter(h => !h.isVerified);
  const mismatches = verifiedHsns.filter(h => !h.isMatched);
  const invalidGstins = gstinResults.filter(g => !g.isValid);

  return {
    success: true,
    data: {
      hsnMap,
      gstinMap,
      hsnResults,
      gstinResults,
      summary: {
        totalHsnsChecked: hsnResults.length,
        hsnVerifiedCount: verifiedHsns.length,
        hsnUnverifiedCount: unverifiedHsns.length,
        hsnMatchedCount: verifiedHsns.length - mismatches.length,
        hsnMismatchCount: mismatches.length,
        totalGstinsChecked: gstinResults.length,
        validGstinsCount: gstinResults.length - invalidGstins.length,
        invalidGstinsCount: invalidGstins.length,
        hasWarnings: mismatches.length > 0 || invalidGstins.length > 0 || unverifiedHsns.length > 0,
        isLiveApiConfigured: service.isLiveApiConfigured()
      }
    }
  };
});
