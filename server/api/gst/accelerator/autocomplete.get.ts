import { GstAcceleratorService } from '../../../utils/gst/gstAcceleratorService';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = (query.q as string) || '';

  const service = new GstAcceleratorService();
  const suggestions = await service.autocomplete(q);

  return {
    success: true,
    data: suggestions
  };
});
