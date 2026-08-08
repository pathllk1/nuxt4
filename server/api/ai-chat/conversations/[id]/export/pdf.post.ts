import { defineEventHandler, createError, setResponseHeader } from 'h3';
import { exportConversationPdf } from '../../../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }

  const pdfBuffer = await exportConversationPdf(id, userId);
  if (!pdfBuffer) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }

  setResponseHeader(event, 'Content-Type', 'application/pdf');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="chat-export-${id}.pdf"`);
  return pdfBuffer;
});
