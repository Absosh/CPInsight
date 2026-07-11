// Global User Menu Component
class UserMenuComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.waitForStateManager();
  }

  waitForStateManager() {
    // Wait for stateManager to be available before setting up
    if (typeof window.stateManager === 'undefined') {
      setTimeout(() => this.waitForStateManager(), 100);
      return;
    }
    this.setup();
  }

  setup() {
    window.stateManager.subscribe(() => this.render());
    this.render();
  }

  async render() {
    // Guard against null container
    if (!this.container) {
      return;
    }

    const { profile } = window.stateManager.getState();
    const user = profile?.data;

    if (!user) {
      this.container.innerHTML = '';
      return;
    }

    const isOpen = window.stateManager.getState().ui.showUserMenu;

    this.container.innerHTML = `
      <div class="relative">
        <button type="button" onclick="window.userMenuComponent.toggleMenu(event); return false;" 
                class="flex items-center gap-2 hover:bg-white/10 rounded-full p-2 transition">
          <div class="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-400 to-indigo-400 flex items-center justify-center text-white font-bold">
            ${user.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span class="text-sm font-semibold hidden md:inline">${user.username}</span>
          <span class="text-gray-400 hidden md:inline">▼</span>
        </button>

        ${isOpen ? this.renderDropdown(user) : ''}
      </div>
    `;
  }

  renderDropdown(user) {
    const state = window.stateManager.getState();
    const { accounts, selectedPlatforms } = state.platforms;
    const normalizedConnected = new Set((accounts || [])
      .map((a) => (a?.platform || '').toString().trim().toLowerCase())
      .filter(Boolean));
    const normalizedSelected = new Set((selectedPlatforms || [])
      .map((p) => (p || '').toString().trim().toLowerCase())
      .filter(Boolean));
    const knownPlatforms = new Set(['codeforces', 'codechef', 'leetcode']);
    const visiblePlatforms = new Set([...normalizedConnected, ...normalizedSelected].filter((p) => knownPlatforms.has(p)));
    
    // Available platforms with their icons and emojis
    const availablePlatforms = [
      { id: 'codeforces', label: 'Codeforces', emoji: '⚙️' },
      { id: 'codechef', label: 'CodeChef', emoji: '👨‍🍳' },
      { id: 'leetcode', label: 'LeetCode', emoji: '💻' }
    ];

    // Filter to only connected platforms
    const connectedPlatforms = availablePlatforms.filter((p) => visiblePlatforms.has(p.id));

    return `
      <div class="absolute right-0 mt-2 w-64 glass rounded-2xl border border-white/10 shadow-2xl z-[999] overflow-hidden">
        <!-- User Info Section -->
        <div class="p-4 border-b border-white/10">
          <p class="font-semibold text-white">${user.username}</p>
          <p class="text-sm text-gray-400">${user.email}</p>
        </div>

        <!-- Platform Selection Section -->
        <div class="p-4 border-b border-white/10">
          <p class="text-xs font-semibold text-gray-400 uppercase mb-3">Platform Analytics</p>
          <div class="space-y-2">
            ${connectedPlatforms.map(platform => {
              const isSelected = selectedPlatforms.includes(platform.id);
              return `
                <label class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                  <input type="checkbox" 
                         ${isSelected ? 'checked' : ''} 
                         onchange="window.userMenuComponent.togglePlatform('${platform.id}')"
                         class="w-4 h-4 rounded accent-emerald-500 cursor-pointer">
                  <span class="text-lg">${platform.emoji}</span>
                  <span class="text-sm text-gray-300 flex-1">${platform.label}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Actions Section -->
        <div class="p-2 space-y-1">
          <button onclick="window.location.href='/pages/profile.html'" 
                  class="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition text-sm text-gray-300">
            👤 Profile
          </button>
          <button onclick="window.location.href='/pages/dashboard.html'" 
                  class="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition text-sm text-gray-300">
            📊 Dashboard
          </button>
          <button onclick="window.location.href='/pages/analytics.html'" 
                  class="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition text-sm text-gray-300">
            🧠 Analytics
          </button>
          <div class="border-t border-white/10 my-2"></div>
          <button onclick="window.userMenuComponent.logout()" 
                  class="w-full text-left px-4 py-2 hover:bg-red-600/20 text-red-400 rounded-lg transition text-sm">
            🚪 Logout
          </button>
        </div>
      </div>
    `;
  }

  togglePlatform(platform) {
    window.stateManager.togglePlatform(platform);
    // Reload analytics when platform selection changes
    if (window.dashboardAnalyticsNeedsRefresh) {
      window.dashboardAnalyticsNeedsRefresh();
    }
    // Re-render to show updated checkboxes
    this.render();
  }

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    window.stateManager.toggleUserMenu();
  }

  async logout() {
    try {
      await authService.logout();
      stateManager.setState({
        auth: { isLoggedIn: false, user: null, loading: false, error: null }
      });
      window.location.href = '/pages/auth.html';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (document.getElementById('userMenuContainer')) {
        window.userMenuComponent = new UserMenuComponent('userMenuContainer');
      }
    }, 500);
  });
} else {
  setTimeout(() => {
    if (document.getElementById('userMenuContainer')) {
      window.userMenuComponent = new UserMenuComponent('userMenuContainer');
    }
  }, 500);
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  const root = document.getElementById('userMenuContainer');
  if (!root || !window.stateManager) {
    return;
  }

  if (!root.contains(e.target)) {
    const current = window.stateManager.getState();
    if (current.ui.showUserMenu) {
      window.stateManager.setState({ ui: { ...current.ui, showUserMenu: false } });
    }
  }
});
