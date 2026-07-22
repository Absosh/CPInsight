const AccountSettingsNav = [
  { id: 'profile', label: 'Profile', href: 'profile.html' },
  { id: 'platforms', label: 'Platforms', href: 'platforms.html' },
  { id: 'return', label: 'Return', href: 'dashboard.html', icon: 'return' }
];

const PlatformsPage = {
  accounts: [],
  syncing: new Set(),
  profile: null,

  init() {
    this.renderAccountNav();
    this.bindEvents();
    initRevealAnimations();
    this.load();
  },

  bindEvents() {
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
  },

  renderAccountNav() {
    const nav = document.getElementById('accountSettingsNav');
    if (!nav) return;

    nav.innerHTML = AccountSettingsNav.map((item) => {
      const active = item.id === 'platforms';
      const classes = active
        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
        : 'hover:bg-white/5 border border-transparent text-white';

      return `
        <a href="${item.href}" class="block w-full min-w-0 rounded-2xl p-4 text-left transition truncate font-semibold ${classes}">
          <span class="inline-flex items-center gap-3">
            ${item.icon === 'return' ? this.returnIcon() : ''}
            <span>${this.escapeHtml(item.label)}</span>
          </span>
        </a>
      `;
    }).join('');
  },

  returnIcon() {
    return `
      <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
      </svg>
    `;
  },

  async load() {
    if (!authService.isLoggedIn()) {
      window.location.href = 'auth.html';
      return;
    }

    try {
      const [profile, accounts] = await Promise.all([
        userService.getProfile({ skipCache: true }),
        platformService.getAccounts()
      ]);

      this.profile = profile;
      this.accounts = accounts;
      this.renderSidebar();
      this.renderAccounts();
    } catch (err) {
      stateManager.showNotification(`Failed to load platforms: ${err.message}`, 'error');
      this.renderAccounts(true);
    }
  },

  renderSidebar() {
    const profile = this.profile;
    if (!profile) return;

    const details = profile.user_profile || {};
    const avatarUrl = details.avatar_thumbnail || details.avatar_url || '';
    const fallbackText = (details.display_name || profile.username || 'U').charAt(0).toUpperCase();

    document.getElementById('sidebarUsername').textContent = details.display_name || profile.username || 'User';
    document.getElementById('sidebarProfileLoader')?.classList.add('hidden');

    const image = document.getElementById('sidebarProfileImage');
    const fallback = document.getElementById('sidebarFallbackAvatar');

    if (avatarUrl) {
      image.src = avatarUrl;
      image.classList.remove('hidden');
      fallback.classList.add('hidden');
      fallback.classList.remove('flex');
      return;
    }

    image.classList.add('hidden');
    fallback.textContent = fallbackText;
    fallback.classList.remove('hidden');
    fallback.classList.add('flex');
  },

  renderAccounts(hasError = false) {
    const list = document.getElementById('accountsList');
    if (!list) return;

    if (hasError) {
      list.innerHTML = `
        <div class="md:col-span-2 glass rounded-3xl p-8 text-center border border-red-500/30">
          <h3 class="text-xl font-bold text-white mb-2">Failed to load connected platforms.</h3>
          <button type="button" onclick="PlatformsPage.load()" class="mt-4 bg-red-600 px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-red-500 transition text-white">Retry</button>
        </div>
      `;
      return;
    }

    if (!this.accounts.length) {
      list.innerHTML = `
        <div class="md:col-span-2">
          <div class="glass rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[220px] w-full">
            <div class="text-4xl opacity-70 mb-3">--</div>
            <h3 class="text-xl font-bold text-white mb-2">No connected platforms yet.</h3>
            <p class="text-gray-400 text-sm max-w-md">Connect a platform account to start syncing competitive programming data.</p>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="md:col-span-2">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${this.accounts.map((account) => this.renderAccountCard(account)).join('')}
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      list.querySelectorAll('.content-fade').forEach((el) => el.classList.add('show'));
    });
  },

  renderAccountCard(account) {
    const platform = account.platform || '';
    const isSyncing = this.syncing.has(platform);
    const status = account.sync_status || account.status || 'connected';
    const syncLabel = isSyncing ? 'Syncing' : 'Resync';

    return `
      <div class="glass rounded-3xl p-5 border border-white/10 hover:-translate-y-1 transition content-fade">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-3 min-w-0">
            ${this.platformIcon(platform)}
            <div class="min-w-0">
              <p class="font-semibold text-white truncate">${this.escapeHtml(this.formatPlatformLabel(platform))}</p>
              <p class="text-xs text-emerald-400 mt-1">${this.escapeHtml(this.formatStatus(status))}</p>
            </div>
          </div>
          <button
            type="button"
            onclick="PlatformsPage.resyncPlatform('${encodeURIComponent(platform)}')"
            title="${syncLabel}"
            aria-label="${syncLabel} ${this.escapeHtml(this.formatPlatformLabel(platform))}"
            class="shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/50 text-emerald-400 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            ${isSyncing ? 'disabled' : ''}
          >
            ${this.refreshIcon(isSyncing)}
          </button>
        </div>
        <p class="text-gray-400 text-sm truncate">Handle: <span class="text-emerald-400 font-mono">${this.escapeHtml(account.handle || '--')}</span></p>
        <p class="text-gray-500 text-xs">Rating: ${this.escapeHtml(account.rating || 'N/A')}</p>
        <p class="text-gray-600 text-xs mt-2">Last synced: ${account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : 'Never'}</p>
        <button onclick="PlatformsPage.disconnectAccount('${encodeURIComponent(platform)}')" class="mt-4 w-full bg-red-600/20 text-red-400 border border-red-500/30 py-3 rounded-2xl text-xs font-semibold hover:bg-red-600/30 transition">
          Disconnect
        </button>
      </div>
    `;
  },

  async resyncPlatform(encodedPlatform) {
    const platform = decodeURIComponent(encodedPlatform);
    if (!platform || this.syncing.has(platform)) return;

    this.syncing.add(platform);
    this.renderAccounts();

    try {
      const result = await platformService.syncPlatform(platform);
      const message = result?.message || `${this.formatPlatformLabel(platform)} resync started.`;
      stateManager.showNotification(message, 'success');
      await this.load();
    } catch (err) {
      stateManager.showNotification(`Failed to resync ${this.formatPlatformLabel(platform)}: ${err.message}`, 'error');
    } finally {
      this.syncing.delete(platform);
      this.renderAccounts();
    }
  },

  async disconnectAccount(encodedPlatform) {
    const platform = decodeURIComponent(encodedPlatform);
    if (!confirm(`Disconnect ${this.formatPlatformLabel(platform)}?`)) return;

    try {
      await platformService.disconnectPlatform(platform);
      stateManager.showNotification(`${this.formatPlatformLabel(platform)} disconnected`, 'success');
      await this.load();
    } catch (err) {
      stateManager.showNotification(`Failed to disconnect: ${err.message}`, 'error');
    }
  },

  async logout() {
    try {
      await authService.logout();
      window.location.href = 'auth.html';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  },

  formatPlatformLabel(value) {
    return (value || 'Platform')
      .toString()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  },

  formatStatus(value) {
    return (value || 'connected')
      .toString()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  },

  platformIcon(platform) {
    const icons = {
      codeforces: { src: '../Assets/platforms/codeforces.png', alt: 'Codeforces' },
      codechef: { src: '../Assets/platforms/codechef.jpg', alt: 'CodeChef' },
      leetcode: { src: '../Assets/platforms/leetcode.png', alt: 'LeetCode' }
    };
    const icon = icons[platform];

    if (!icon) {
      return `<div class="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-emerald-400">${this.escapeHtml(this.formatPlatformLabel(platform).slice(0, 2).toUpperCase())}</div>`;
    }

    return `
      <div class="w-11 h-11 rounded-2xl bg-white/90 border border-white/10 flex items-center justify-center p-2 shrink-0">
        <img src="${icon.src}" alt="${icon.alt}" class="w-full h-full object-contain ${platform === 'codechef' ? 'rounded-xl' : ''}" />
      </div>
    `;
  },

  refreshIcon(spinning = false) {
    const spin = spinning ? 'animate-spin' : '';
    return `
      <svg class="w-5 h-5 ${spin}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M5.5 15A7 7 0 0 0 17.7 18.4M18.5 9A7 7 0 0 0 6.3 5.6"></path>
      </svg>
    `;
  },

  escapeHtml(value) {
    return (value || '').toString().replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }
};

window.PlatformsPage = PlatformsPage;
document.addEventListener('DOMContentLoaded', () => PlatformsPage.init());
