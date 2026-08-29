import AiConversation from '../../models/AiConversation';
import type { IAiConversation } from '../../models/AiConversation';
import AiMessage from '../../models/AiMessage';
import type { IAiMessage } from '../../models/AiMessage';
import { getProvider, listProviders } from './providers';
import type { ChatParams, ChatChunk, ModelInfo } from './providers/base';
import { executeWebSearch, validateTavilyKey } from './webSearch';
import type { SearchMode } from './webSearch';
import { randomUUID } from 'crypto';
import {
  getCachedChatMessages,
  setCachedChatMessages,
  appendCachedChatMessage,
  invalidateConversationCache,
  invalidateManyConversationsCache
} from './chatCache';

export interface ChatRequest {
  conversationId?: string;
  message: string;
  provider: string;
  model: string;
  apiKey: string;
  title?: string;
  tavilyApiKey?: string;
  searchMode?: SearchMode;
}

export function getAvailableProviders() {
  return listProviders();
}

export async function validateApiKey(provider: string, apiKey: string): Promise<boolean> {
  const p = getProvider(provider);
  return p.validateKey(apiKey);
}

export async function getModels(provider: string, apiKey: string): Promise<ModelInfo[]> {
  const p = getProvider(provider);
  return p.listModels(apiKey);
}

export async function validateTavilyApiKey(apiKey: string): Promise<boolean> {
  return validateTavilyKey(apiKey);
}

export async function createConversation(userId: string, title: string, provider: string, model: string): Promise<any> {
  try {
    const conv: any = await AiConversation.create({
      user_id: userId,
      title: title || 'New Chat',
      provider,
      model,
      is_pinned: false,
      message_count: 0
    });
    return {
      id: conv._id.toString(),
      user_id: conv.user_id,
      title: conv.title,
      provider: conv.provider,
      model: conv.model,
      is_pinned: conv.is_pinned,
      message_count: conv.message_count,
      created_at: conv.created_at ? new Date(conv.created_at).toISOString() : new Date().toISOString(),
      updated_at: conv.updated_at ? new Date(conv.updated_at).toISOString() : new Date().toISOString()
    };
  } catch (err) {
    return {
      id: randomUUID(),
      user_id: userId,
      title: title || 'New Chat',
      provider,
      model,
      is_pinned: false,
      message_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

export async function getConversations(userId: string, search?: string): Promise<any[]> {
  try {
    const query: any = { user_id: userId };
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    const convs: any[] = await AiConversation.find(query).sort({ is_pinned: -1, updated_at: -1 }).lean();
    return convs.map(c => ({
      id: c._id.toString(),
      user_id: c.user_id,
      title: c.title,
      provider: c.provider,
      model: c.model,
      is_pinned: c.is_pinned,
      message_count: c.message_count,
      created_at: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
      updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

export async function getConversation(id: string, userId: string): Promise<{ conversation: any; messages: any[] } | null> {
  try {
    const conv: any = await AiConversation.findOne({ _id: id, user_id: userId }).lean();
    if (!conv) return null;

    // Check Redis Hot Cache first
    let messagesList: any[] = [];
    const cachedMsgs = await getCachedChatMessages(id);
    if (cachedMsgs && cachedMsgs.length > 0) {
      messagesList = cachedMsgs;
    } else {
      const msgs: any[] = await AiMessage.find({ conversation_id: id }).sort({ created_at: 1 }).lean();
      messagesList = msgs.map(m => ({
        id: m._id.toString(),
        conversation_id: m.conversation_id,
        role: m.role,
        content: m.content,
        provider: m.provider,
        model: m.model,
        tokens_used: m.tokens_used,
        created_at: m.created_at ? new Date(m.created_at).toISOString() : undefined
      }));
      // Warm Redis cache
      await setCachedChatMessages(id, messagesList);
    }

    return {
      conversation: {
        id: conv._id.toString(),
        user_id: conv.user_id,
        title: conv.title,
        provider: conv.provider,
        model: conv.model,
        is_pinned: conv.is_pinned,
        message_count: conv.message_count,
        created_at: conv.created_at ? new Date(conv.created_at).toISOString() : undefined,
        updated_at: conv.updated_at ? new Date(conv.updated_at).toISOString() : undefined
      },
      messages: messagesList
    };
  } catch {
    return null;
  }
}

export async function updateConversation(id: string, userId: string, updates: { title?: string; is_pinned?: boolean }): Promise<any | null> {
  try {
    const updateFields: any = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.is_pinned !== undefined) updateFields.is_pinned = updates.is_pinned;

    const conv: any = await AiConversation.findOneAndUpdate(
      { _id: id, user_id: userId },
      { $set: updateFields },
      { returnDocument: 'after' }
    ).lean();

    if (!conv) return null;

    return {
      id: conv._id.toString(),
      user_id: conv.user_id,
      title: conv.title,
      provider: conv.provider,
      model: conv.model,
      is_pinned: conv.is_pinned,
      message_count: conv.message_count,
      created_at: conv.created_at ? new Date(conv.created_at).toISOString() : undefined,
      updated_at: conv.updated_at ? new Date(conv.updated_at).toISOString() : undefined
    };
  } catch {
    return null;
  }
}

export async function deleteConversation(id: string, userId: string): Promise<boolean> {
  try {
    const res = await AiConversation.deleteOne({ _id: id, user_id: userId });
    await AiMessage.deleteMany({ conversation_id: id });
    // Invalidate Redis hot cache
    await invalidateConversationCache(id);
    return (res.deletedCount || 0) > 0;
  } catch {
    return false;
  }
}

export async function clearConversations(userId: string): Promise<number> {
  try {
    const convs: any[] = await AiConversation.find({ user_id: userId }).select('_id').lean();
    const ids = convs.map(c => c._id.toString());
    const res = await AiConversation.deleteMany({ user_id: userId });
    if (ids.length > 0) {
      await AiMessage.deleteMany({ conversation_id: { $in: ids } });
      // Invalidate Redis hot cache for all user conversations
      await invalidateManyConversationsCache(ids);
    }
    return res.deletedCount || 0;
  } catch {
    return 0;
  }
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  provider?: string,
  model?: string,
  tokensUsed?: number
): Promise<any> {
  try {
    const createData: any = {
      conversation_id: conversationId,
      role,
      content,
    };
    if (provider) createData.provider = provider;
    if (model) createData.model = model;
    if (tokensUsed) createData.tokens_used = tokensUsed;

    const msg: any = await AiMessage.create(createData);

    await AiConversation.updateOne(
      { _id: conversationId },
      { $inc: { message_count: 1 }, $set: { updated_at: new Date() } }
    );

    const formattedMsg = {
      id: msg._id ? msg._id.toString() : randomUUID(),
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      provider: msg.provider,
      model: msg.model,
      tokens_used: msg.tokens_used,
      created_at: msg.created_at ? new Date(msg.created_at).toISOString() : new Date().toISOString()
    };

    // Append to Redis hot cache
    await appendCachedChatMessage(conversationId, formattedMsg);

    return formattedMsg;
  } catch {
    const fallbackMsg = {
      id: randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      provider,
      model,
      tokens_used: tokensUsed,
      created_at: new Date().toISOString()
    };
    // Append to Redis hot cache
    await appendCachedChatMessage(conversationId, fallbackMsg);
    return fallbackMsg;
  }
}

const activeStreams = new Map<string, AbortController>();

export function stopGeneration(conversationId: string): boolean {
  const controller = activeStreams.get(conversationId);
  if (controller) {
    controller.abort();
    activeStreams.delete(conversationId);
    return true;
  }
  return false;
}

export async function* streamChat(
  userId: string,
  request: ChatRequest
): AsyncGenerator<ChatChunk & { conversationId?: string }, void, unknown> {
  const provider = getProvider(request.provider);

  let conversationId = request.conversationId;
  if (!conversationId) {
    const conv = await createConversation(
      userId,
      request.title || request.message.substring(0, 100),
      request.provider,
      request.model
    );
    conversationId = conv.id;
    yield { content: '', done: false, conversationId };
  }

  const validConvId: string = conversationId!;

  await addMessage(validConvId, 'user', request.message);

  let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  // Fast context loading: check Redis Hot Cache first, fallback to MongoDB
  try {
    const cachedHistory = await getCachedChatMessages(validConvId);
    if (cachedHistory && cachedHistory.length > 0) {
      messages = cachedHistory.map(m => ({ role: m.role, content: m.content }));
    } else {
      const history: any[] = await AiMessage.find({ conversation_id: validConvId }).sort({ created_at: 1 }).lean();
      const formattedHistory = history.map(m => ({
        id: m._id.toString(),
        conversation_id: m.conversation_id,
        role: m.role,
        content: m.content,
        provider: m.provider,
        model: m.model,
        tokens_used: m.tokens_used,
        created_at: m.created_at ? new Date(m.created_at).toISOString() : undefined
      }));
      await setCachedChatMessages(validConvId, formattedHistory);
      messages = formattedHistory.map(m => ({ role: m.role, content: m.content }));
    }
  } catch {
    messages = [{ role: 'user', content: request.message }];
  }

  const searchMode = request.searchMode || 'auto';
  const searchOutcome = await executeWebSearch(
    request.message,
    searchMode,
    request.tavilyApiKey
  );

  if (searchOutcome.error) {
    yield {
      content: '',
      done: true,
      error: JSON.stringify({
        type: 'SEARCH_ERROR',
        message: searchOutcome.error,
      }),
      conversationId: validConvId,
    };
    return;
  }

  if (searchOutcome.searched && searchOutcome.context) {
    messages.unshift({
      role: 'system',
      content: searchOutcome.context,
    });
  }

  if (searchOutcome.searched) {
    yield {
      content: '',
      done: false,
      conversationId: validConvId,
      webSearchUsed: true,
      searchSources: searchOutcome.sources,
    } as any;
  }

  const chatParams: ChatParams = {
    apiKey: request.apiKey,
    model: request.model,
    messages,
  };

  let fullResponse = '';
  let tokensUsed: number | undefined;

  const abortController = new AbortController();
  chatParams.signal = abortController.signal;

  activeStreams.set(validConvId, abortController);

  try {
    for await (const chunk of provider.chat(chatParams)) {
      if (chunk.content) {
        fullResponse += chunk.content;
      }
      if (chunk.tokensUsed) {
        tokensUsed = chunk.tokensUsed;
      }
      yield { ...chunk, conversationId: validConvId };
    }

    if (fullResponse) {
      await addMessage(validConvId, 'assistant', fullResponse, request.provider, request.model, tokensUsed);
    }

    if (!request.conversationId) {
      const shortTitle = request.message.length > 80
        ? request.message.substring(0, 77) + '...'
        : request.message;
      try {
        await AiConversation.updateOne({ _id: validConvId }, { $set: { title: shortTitle } });
      } catch {}
    }
  } finally {
    activeStreams.delete(validConvId);
  }
}

export async function exportConversationPdf(id: string, userId: string): Promise<Buffer | null> {
  const data = await getConversation(id, userId);
  if (!data) return null;

  const PdfPrinter = require('pdfmake');
  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  };

  const printer = new PdfPrinter(fonts);

  const content: any[] = [
    { text: data.conversation.title, style: 'header' },
    {
      text: `Provider: ${data.conversation.provider} | Model: ${data.conversation.model}`,
      style: 'subheader',
    },
    {
      text: `Exported: ${new Date().toLocaleString()} | Messages: ${data.messages.length}`,
      style: 'subheader',
      margin: [0, 0, 0, 20],
    },
  ];

  for (const msg of data.messages) {
    const roleLabel = msg.role === 'user' ? '👤 You' : '🤖 Assistant';
    const timestamp = new Date(msg.created_at).toLocaleString();

    content.push({
      text: `${roleLabel}  •  ${timestamp}`,
      style: msg.role === 'user' ? 'userLabel' : 'assistantLabel',
      margin: [0, 10, 0, 4],
    });

    content.push({
      text: msg.content,
      style: 'messageContent',
      margin: [0, 0, 0, 10],
    });

    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#E5E7EB' }],
    });
  }

  const docDefinition = {
    defaultStyle: { font: 'Helvetica' },
    content,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      subheader: { fontSize: 10, color: '#6B7280', margin: [0, 0, 0, 4] },
      userLabel: { fontSize: 10, bold: true, color: '#7C3AED' },
      assistantLabel: { fontSize: 10, bold: true, color: '#059669' },
      messageContent: { fontSize: 11, lineHeight: 1.5 },
    },
    pageMargins: [40, 40, 40, 40],
  };

  return new Promise<Buffer>((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
