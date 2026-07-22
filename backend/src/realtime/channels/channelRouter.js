class ChannelRouter {
  channelsForEvent(event) {
    const channels = new Set(['system']);
    const userId = event.metadata?.userId || event.payload?.userId;
    if (userId) {
      channels.add(`user:${userId}`);
      channels.add(`telemetry:${userId}`);
      channels.add(`analytics:${userId}`);
    }
    const contestId = event.payload?.contestId || event.metadata?.contestId;
    if (contestId) channels.add(`contest:${contestId}`);
    return [...channels];
  }
}

module.exports = { ChannelRouter };
