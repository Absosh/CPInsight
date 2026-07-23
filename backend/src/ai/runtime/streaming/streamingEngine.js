class StreamingEngine {
  constructor({ maxBufferChunks = 1000 } = {}) {
    this.maxBufferChunks = maxBufferChunks;
  }

  async collect({ provider, request, callbacks = {}, signal = null }) {
    const chunks = [];
    let cancelled = false;
    for await (const chunk of provider.stream(request)) {
      if (signal && signal.aborted) {
        cancelled = true;
        break;
      }
      if (chunks.length >= this.maxBufferChunks) throw new Error('Streaming backpressure limit exceeded');
      chunks.push(chunk);
      if (callbacks.onChunk) callbacks.onChunk(chunk);
    }
    if (callbacks.onComplete) callbacks.onComplete({ chunks, cancelled });
    return {
      rawResponse: { chunks },
      text: chunks.map((chunk) => chunk.text || String(chunk)).join(''),
      usage: {},
      streaming: true,
      cancelled
    };
  }
}

module.exports = { StreamingEngine };

