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
    const connectedPlatforms = (accounts || [])
      .map((account) => this.toPlatformItem(account))
      .filter(Boolean);

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
              const encodedPlatform = encodeURIComponent(platform.id);
              return `
                <label class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                  <input type="checkbox" 
                         ${isSelected ? 'checked' : ''} 
                         onchange="window.userMenuComponent.togglePlatform(decodeURIComponent('${encodedPlatform}'))"
                         class="w-4 h-4 rounded accent-emerald-500 cursor-pointer">
                  <span class="text-sm text-gray-300 flex-1">${this.escapeHtml(platform.label)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Actions Section -->
        <div class="p-2 space-y-1">
          <button onclick="window.location.href='/pages/profile.html'"
                  class="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition text-sm text-gray-300 flex items-center gap-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"></path>
            </svg>
            <span>Settings</span>
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

  toPlatformItem(account) {
    const id = (account?.platform || '').toString().trim();
    if (!id) {
      return null;
    }

    const label = account.displayName || account.display_name || account.name || this.formatPlatformLabel(id);
    return {
      id,
      label,
      symbol: account.icon || account.emoji || label.charAt(0).toUpperCase()
    };
  }

  formatPlatformLabel(value) {
    return value
      .toString()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  escapeHtml(value) {
    return (value || '').toString().replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
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
