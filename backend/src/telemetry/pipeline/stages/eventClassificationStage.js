const { PipelineStage } = require('../stage');

function classify(eventType) {
  if (eventType.startsWith('SESSION_') || eventType === 'CONTEST_DETECTED') return 'session_lifecycle';
  if (eventType.startsWith('PROBLEM_')) return 'problem_navigation';
  if (eventType.startsWith('TAB_') || eventType.startsWith('PAGE_')) return 'browser_lifecycle';
  return 'generic';
}

class EventClassificationStage extends PipelineStage {
  constructor() {
    super('event-classification');
  }

  async process(context) {
    return {
      ...context,
      processableItems: context.processableItems.map((item) => Object.freeze({
        ...item,
        classification: Object.freeze({
          category: classify(item.event.eventType),
          eventType: item.event.eventType
        })
      }))
    };
  }
}

module.exports = { EventClassificationStage };
