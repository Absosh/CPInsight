// Platform Selector Component
class PlatformSelectorComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.platforms = ['codeforces', 'codechef', 'leetcode'];
    this.setup();
  }

  setup() {
    stateManager.subscribe(() => this.render());
    this.render();
  }

  async render() {
    const { selectedPlatforms, accounts } = stateManager.getState().platforms;

    this.container.innerHTML = `
      <div class="flex flex-wrap gap-3">
        ${this.platforms.map(platform => {
          const isConnected = accounts.some(a => a.platform === platform);
          const isSelected = selectedPlatforms.includes(platform);

          if (!isConnected) return '';

          return `
            <button onclick="window.platformSelector.togglePlatform('${platform}')"
                    class="px-4 py-2 rounded-lg font-semibold transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }">
              ${platform.charAt(0).toUpperCase() + platform.slice(1)}
              ${isSelected ? ' ✓' : ''}
            </button>
          `;
        }).join('')}

        <button onclick="window.platformSelector.toggleAllPlatforms()"
                class="px-4 py-2 rounded-lg font-semibold transition ${
                  selectedPlatforms.length === accounts.length
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }">
          All ${selectedPlatforms.length === accounts.length ? '✓' : ''}
        </button>
      </div>
    `;
  }

  togglePlatform(platform) {
    stateManager.togglePlatform(platform);
    stateManager.loadAnalytics();
  }

  toggleAllPlatforms() {
    const { accounts, selectedPlatforms } = stateManager.getState().platforms;
    const allPlatforms = accounts.map(a => a.platform);

    if (selectedPlatforms.length === allPlatforms.length) {
      stateManager.selectPlatforms([]);
    } else {
      stateManager.selectPlatforms(allPlatforms);
    }

    stateManager.loadAnalytics();
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('platformSelectorContainer');
    if (container) {
      window.platformSelector = new PlatformSelectorComponent('platformSelectorContainer');
    }
  });
} else {
  const container = document.getElementById('platformSelectorContainer');
  if (container) {
    window.platformSelector = new PlatformSelectorComponent('platformSelectorContainer');
  }
}
