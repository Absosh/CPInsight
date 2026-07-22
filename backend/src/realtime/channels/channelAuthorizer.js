class ChannelAuthorizer {
  canSubscribe(user, channel) {
    if (!user || !channel || typeof channel !== 'string') return false;
    if (channel === 'system') return true;
    if (channel === `user:${user.id}`) return true;
    if (channel === `telemetry:${user.id}`) return true;
    if (channel === `analytics:${user.id}`) return true;
    if (channel.startsWith('contest:')) return true;
    return false;
  }
}

module.exports = { ChannelAuthorizer };
