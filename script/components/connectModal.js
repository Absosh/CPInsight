// Connect Platform Modal Component
class ConnectModalComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.setup();
  }

  setup() {
    stateManager.subscribe(() => this.render());
    this.render();
  }

  render() {
    const { showConnectModal, selectedModalPlatform } = stateManager.getState().ui;

    if (!showConnectModal) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-[#070b17]/60 backdrop-blur-sm transition-opacity duration-500">
        <div class="glass rounded-3xl border border-white/10 p-8 max-w-md w-full mx-4 shadow-2xl transform transition-transform duration-500">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">Connect ${this.getPlatformName(selectedModalPlatform)}</h2>
            <button onclick="window.connectModal.close()" 
                    class="text-2xl text-gray-400 hover:text-white transition">
              ×
            </button>
          </div>

          <p class="text-gray-400 mb-6">
            Enter your ${this.getPlatformName(selectedModalPlatform)} handle to connect your account
          </p>

          <div class="mb-6">
            <label class="block text-sm font-semibold text-gray-400 mb-2">Your Handle</label>
            <input type="text" 
                   id="handleInput" 
                   placeholder="e.g. tourist" 
                   class="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 transition text-white shadow-inner" />
            <p id="errorMessage" class="text-rose-400 text-sm font-bold mt-2 hidden"></p>
          </div>

          <div class="flex gap-3">
            <button onclick="window.connectModal.close()" 
                    class="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-2xl font-semibold transition">
              Cancel
            </button>
            <button onclick="window.connectModal.connect('${selectedModalPlatform}')" 
                    id="connectBtn"
                    class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-gray-900 py-3 rounded-2xl font-semibold transition shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              Connect
            </button>
          </div>
        </div>
      </div>
    `;

    // Focus input
    setTimeout(() => {
      const input = document.getElementById('handleInput');
      if (input) input.focus();
    }, 100);
  }

  getPlatformName(platform) {
    const names = {
      codeforces: 'Codeforces',
      codechef: 'CodeChef',
      leetcode: 'LeetCode',
      atcoder: 'AtCoder'
    };
    return names[platform] || platform;
  }

  async connect(platform) {
    const input = document.getElementById('handleInput');
    const handle = input?.value?.trim();
    const errorMsg = document.getElementById('errorMessage');
    const connectBtn = document.getElementById('connectBtn');

    if (!handle) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter a handle';
        errorMsg.classList.remove('hidden');
      }
      return;
    }

    // Validate handle format (basic)
    if (handle.length < 2) {
      if (errorMsg) {
        errorMsg.textContent = 'Handle must be at least 2 characters';
        errorMsg.classList.remove('hidden');
      }
      return;
    }

    // Disable button and show loading state
    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';
    }

    try {
      await platformService.connectPlatform(platform, handle);
      stateManager.showNotification(
        `Connected ${this.getPlatformName(platform)} account!`,
        'success'
      );

      // Reload platforms and close modal
      await stateManager.loadPlatforms();
      this.close();
    } catch (error) {
      if (errorMsg) {
        errorMsg.textContent = error.message || 'Failed to connect platform';
        errorMsg.classList.remove('hidden');
      }
      stateManager.showNotification(
        `Failed to connect: ${error.message}`,
        'error'
      );
    } finally {
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
      }
    }
  }

  close() {
    stateManager.closeConnectModal();
  }

  openForPlatform(platform) {
    stateManager.openConnectModal(platform);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('connectModalContainer');
    if (container) {
      window.connectModal = new ConnectModalComponent('connectModalContainer');
    }
  });
} else {
  const container = document.getElementById('connectModalContainer');
  if (container) {
    window.connectModal = new ConnectModalComponent('connectModalContainer');
  }
}
