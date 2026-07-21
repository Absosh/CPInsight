import { MessageSource, MessageType } from '../constants/message-types.js';
import { createEnvelope } from '../messaging/envelope.js';
import { createInitialPopupState } from './popup-state.js';
import { PopupView } from './popup-view.js';

class PopupController {
  constructor(root) {
    this.state = createInitialPopupState();
    this.view = new PopupView(root);
  }

  async initialize() {
    this.view.render(this.state);
    const response = await chrome.runtime.sendMessage(createEnvelope({
      type: MessageType.STATE_GET,
      source: MessageSource.POPUP,
      target: MessageSource.BACKGROUND
    }));
    this.state = {
      loading: false,
      extensionState: response?.data || null,
      error: response?.ok === false ? response.error : null
    };
    this.view.render(this.state);
  }
}

const root = document.getElementById('popup-root');
const controller = new PopupController(root);
controller.initialize();
