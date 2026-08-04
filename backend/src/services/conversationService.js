const repository = require('../repositories/conversationRepository');
const HttpError = require('../utils/httpError');

function generateTitle(text = '') {
  const normalized = String(text).trim();
  const lower = normalized.toLowerCase();
  if (!normalized) return 'New chat';
  if (lower.includes('rating') && lower.includes('drop')) return 'Rating Analysis';
  if (lower.includes('study') && /\b\d{3,4}\b/.test(lower)) return `${lower.match(/\b\d{3,4}\b/)[0]} Study Plan`;
  if (lower.includes('binary search')) return 'Binary Search Discussion';
  if (lower.includes('contest')) return 'Contest Review Discussion';
  if (lower.includes('practice')) return 'Practice Planning';
  return normalized
    .replace(/[?!.]+$/g, '')
    .split(/\s+/)
    .slice(0, 7)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isDefaultTitle(title) {
  return !title || ['New chat', 'New coaching session'].includes(title);
}

class ConversationService {
  constructor({ repo = repository } = {}) {
    this.repo = repo;
  }

  list(userId, query = {}) {
    return this.repo.list(userId, {
      limit: query.limit,
      offset: query.offset,
      includeArchived: query.includeArchived === 'true' || query.includeArchived === true
    });
  }

  async get(userId, conversationId) {
    const conversation = await this.repo.get(userId, conversationId);
    if (!conversation) throw new HttpError(404, 'Conversation not found');
    return conversation;
  }

  create(userId, body = {}) {
    return this.repo.create(userId, {
      title: body.title || 'New chat',
      summary: body.summary || '',
      metadata: body.metadata || {}
    });
  }

  async addMessage(userId, conversationId, body = {}) {
    const conversation = await this.get(userId, conversationId);
    const message = await this.repo.appendMessage(userId, conversationId, body);
    const patch = {};
    if (body.role === 'user' && isDefaultTitle(conversation.title)) {
      patch.title = generateTitle(body.content);
    }
    if (body.role === 'coach') {
      patch.preview = body.content;
    }
    if (Object.keys(patch).length) await this.repo.update(userId, conversationId, patch);
    return message;
  }

  async update(userId, conversationId, body = {}) {
    const updated = await this.repo.update(userId, conversationId, {
      title: body.title,
      summary: body.summary,
      preview: body.preview,
      metadata: body.metadata,
      pinned: body.pinned,
      status: body.status,
      archivedAt: body.archivedAt,
      deletedAt: body.deletedAt
    });
    if (!updated) throw new HttpError(404, 'Conversation not found');
    return updated;
  }

  async rename(userId, conversationId, title) {
    if (!String(title || '').trim()) throw new HttpError(400, 'title is required');
    return this.update(userId, conversationId, { title: String(title).trim() });
  }

  archive(userId, conversationId) {
    return this.update(userId, conversationId, { status: 'archived', archivedAt: new Date().toISOString() });
  }

  pin(userId, conversationId, pinned = true) {
    return this.update(userId, conversationId, { pinned });
  }

  async delete(userId, conversationId) {
    const deleted = await this.repo.softDelete(userId, conversationId);
    if (!deleted) throw new HttpError(404, 'Conversation not found');
    return deleted;
  }

  search(userId, body = {}) {
    return this.repo.search(userId, body.query || '', { limit: body.limit });
  }
}

module.exports = new ConversationService();
module.exports.ConversationService = ConversationService;
module.exports.generateTitle = generateTitle;
