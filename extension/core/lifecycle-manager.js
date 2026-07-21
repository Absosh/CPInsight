import { AlarmName } from '../constants/alarm-names.js';

export class LifecycleManager {
  constructor({ logger, providerRegistry, stateStore }) {
    this.logger = logger;
    this.providerRegistry = providerRegistry;
    this.stateStore = stateStore;
  }

  async install() {
    this.logger.info('Extension installed');
    await this.stateStore.initialize();
  }

  async startup() {
    this.logger.info('Extension startup');
    await this.stateStore.initialize();
  }

  registerAlarmHandlers() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === AlarmName.SYNC_RETRY) this.logger.debug('Sync retry alarm fired');
      if (alarm.name === AlarmName.QUEUE_FLUSH) this.logger.debug('Queue flush alarm fired');
      if (alarm.name === AlarmName.HEALTH_CHECK) this.logger.debug('Health check alarm fired');
    });
  }
}
