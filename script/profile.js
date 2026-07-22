const AccountSettingsNav = [
  { id: 'profile', label: 'Profile', href: 'profile.html' },
  { id: 'platforms', label: 'Platforms', href: 'platforms.html' },
  { id: 'return', label: 'Return', href: 'dashboard.html', icon: 'return' }
];

const ProfilePage = {
  profile: null,
  originalForm: null,
  selectedAvatarData: null,
  savingProfile: false,
  savingAvatar: false,
  colleges: [],
  collegeSearchTimer: null,

  elements: {},

  init() {
    this.cacheElements();
    this.renderAccountNav();
    this.bindEvents();
    initRevealAnimations();
    this.load();
  },

  cacheElements() {
    [
      'sidebarProfileLoader', 'sidebarProfileImage', 'sidebarFallbackAvatar', 'sidebarUsername',
      'pageError', 'pageErrorMessage', 'retryBtn', 'avatarLoader', 'avatarContent',
      'avatarPreview', 'avatarFallback', 'avatarInput', 'chooseAvatarBtn', 'saveAvatarBtn',
      'deleteAvatarBtn', 'avatarHelp', 'avatarError', 'avatarStatus', 'profileLoader',
      'profileForm', 'formStatus', 'unsavedBadge', 'username', 'email', 'displayName',
      'displayNameError', 'country', 'timezone', 'createdAt', 'collegeSearch', 'collegeId',
      'collegeResults', 'collegeHint', 'saveBtn', 'resetBtn', 'logoutBtn'
    ].forEach((id) => {
      this.elements[id] = document.getElementById(id);
    });
  },

  renderAccountNav() {
    const nav = document.getElementById('accountSettingsNav');
    if (!nav) return;

    nav.innerHTML = AccountSettingsNav.map((item) => {
      const active = item.id === 'profile';
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

  bindEvents() {
    this.elements.retryBtn?.addEventListener('click', () => this.load());
    this.elements.profileForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveProfile();
    });
    this.elements.resetBtn?.addEventListener('click', () => this.resetForm());
    this.elements.chooseAvatarBtn?.addEventListener('click', () => this.elements.avatarInput?.click());
    this.elements.avatarInput?.addEventListener('change', (event) => this.handleAvatarSelection(event));
    this.elements.saveAvatarBtn?.addEventListener('click', () => this.saveAvatar());
    this.elements.deleteAvatarBtn?.addEventListener('click', () => this.deleteAvatar());
    this.elements.logoutBtn?.addEventListener('click', () => this.logout());

    ['displayName', 'country', 'timezone'].forEach((id) => {
      this.elements[id]?.addEventListener('input', () => this.updateUnsavedState());
      this.elements[id]?.addEventListener('change', () => this.updateUnsavedState());
    });

    this.elements.collegeSearch?.addEventListener('input', () => this.handleCollegeSearchInput());
    this.elements.collegeSearch?.addEventListener('focus', () => this.searchColleges(this.elements.collegeSearch.value));
    document.addEventListener('click', (event) => {
      if (!this.elements.collegeResults?.contains(event.target) && event.target !== this.elements.collegeSearch) {
        this.hideCollegeResults();
      }
    });

    window.addEventListener('beforeunload', (event) => {
      if (this.hasUnsavedChanges() || this.selectedAvatarData) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  },

  async load() {
    if (!authService.isLoggedIn()) {
      window.location.href = 'auth.html';
      return;
    }

    this.setPageError(null);
    this.setLoading(true);

    try {
      const profile = await userService.getProfile({ skipCache: true });
      this.applyProfile(profile);
      await this.searchColleges(profile.user_profile?.college?.shortName || '', { keepClosed: true });
      this.setStatus('Profile loaded.');
    } catch (err) {
      this.setPageError(err.message);
    } finally {
      this.setLoading(false);
    }
  },

  setLoading(loading) {
    this.elements.profileLoader?.classList.toggle('hidden', !loading);
    this.elements.avatarLoader?.classList.toggle('hidden', !loading);
    this.elements.profileForm?.classList.toggle('hidden', loading);
    this.elements.avatarContent?.classList.toggle('hidden', loading);

    if (!loading) {
      requestAnimationFrame(() => this.elements.profileForm?.classList.add('show'));
    }
  },

  setPageError(message) {
    this.elements.pageError?.classList.toggle('hidden', !message);
    if (message) {
      this.elements.pageErrorMessage.textContent = message;
    }
  },

  applyProfile(profile) {
    this.profile = profile;
    const details = profile.user_profile || {};
    const college = details.college || null;
    const avatarUrl = details.avatar_thumbnail || details.avatar_url || '';
    const fallbackText = (details.display_name || profile.username || 'U').charAt(0).toUpperCase();

    this.elements.username.value = profile.username || '';
    this.elements.email.value = profile.email || '';
    this.elements.displayName.value = details.display_name || '';
    this.elements.country.value = details.country || '';
    this.elements.timezone.value = details.timezone || 'UTC';
    this.elements.createdAt.value = profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '';
    this.elements.collegeId.value = details.college_id || '';
    this.elements.collegeSearch.value = college ? `${college.shortName} - ${college.officialName}` : '';

    this.originalForm = this.readForm();
    this.selectedAvatarData = null;
    this.elements.saveAvatarBtn?.classList.add('hidden');
    this.renderAvatar(avatarUrl, fallbackText);
    this.renderSidebar(profile, avatarUrl, fallbackText);
    this.updateUnsavedState();
    this.updateAvatarActions(Boolean(details.avatar_url));
  },

  renderSidebar(profile, avatarUrl, fallbackText) {
    this.elements.sidebarUsername.textContent = profile.user_profile?.display_name || profile.username || 'User';
    this.elements.sidebarProfileLoader?.classList.add('hidden');

    if (avatarUrl) {
      this.elements.sidebarProfileImage.src = avatarUrl;
      this.elements.sidebarProfileImage.classList.remove('hidden');
      this.elements.sidebarFallbackAvatar.classList.add('hidden');
      this.elements.sidebarFallbackAvatar.classList.remove('flex');
      return;
    }

    this.elements.sidebarProfileImage.classList.add('hidden');
    this.elements.sidebarFallbackAvatar.textContent = fallbackText;
    this.elements.sidebarFallbackAvatar.classList.remove('hidden');
    this.elements.sidebarFallbackAvatar.classList.add('flex');
  },

  renderAvatar(avatarUrl, fallbackText) {
    this.clearAvatarError();

    if (avatarUrl) {
      this.elements.avatarPreview.src = avatarUrl;
      this.elements.avatarPreview.classList.remove('hidden');
      this.elements.avatarFallback.classList.add('hidden');
      this.elements.avatarFallback.classList.remove('flex');
      return;
    }

    this.elements.avatarPreview.classList.add('hidden');
    this.elements.avatarFallback.textContent = fallbackText;
    this.elements.avatarFallback.classList.remove('hidden');
    this.elements.avatarFallback.classList.add('flex');
  },

  updateAvatarActions(hasAvatar) {
    this.elements.deleteAvatarBtn.disabled = !hasAvatar || this.savingAvatar;
  },

  readForm() {
    return {
      displayName: this.elements.displayName.value.trim(),
      country: this.elements.country.value.trim(),
      timezone: this.elements.timezone.value,
      collegeId: this.elements.collegeId.value || null
    };
  },

  validateForm() {
    const displayName = this.elements.displayName.value.trim();
    if (!displayName || displayName.length > 80) {
      this.showFieldError('displayNameError', 'Display name is required and must be at most 80 characters.');
      return false;
    }

    this.showFieldError('displayNameError', null);
    return true;
  },

  showFieldError(id, message) {
    const element = this.elements[id];
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('hidden', !message);
  },

  hasUnsavedChanges() {
    if (!this.originalForm) return false;
    const current = this.readForm();
    return Object.keys(current).some((key) => current[key] !== this.originalForm[key]);
  },

  updateUnsavedState() {
    const changed = this.hasUnsavedChanges();
    this.elements.unsavedBadge?.classList.toggle('hidden', !changed);
    this.elements.saveBtn.disabled = this.savingProfile || !changed;
    this.elements.resetBtn.disabled = this.savingProfile || !changed;
  },

  setStatus(message) {
    if (this.elements.formStatus) {
      this.elements.formStatus.textContent = message;
    }
  },

  async saveProfile() {
    if (this.savingProfile || !this.validateForm()) return;

    const payload = this.readForm();
    this.savingProfile = true;
    this.elements.saveBtn.textContent = 'Saving...';
    this.updateUnsavedState();

    try {
      const profile = await userService.updateProfile(payload);
      userService.clearProfileCache();
      await stateManager.loadProfile();
      this.applyProfile(profile);
      this.setStatus('Profile changes saved.');
      stateManager.showNotification('Profile updated successfully.', 'success');
    } catch (err) {
      this.setStatus('Profile update failed.');
      stateManager.showNotification(`Failed to update profile: ${err.message}`, 'error');
    } finally {
      this.savingProfile = false;
      this.elements.saveBtn.textContent = 'Save Changes';
      this.updateUnsavedState();
    }
  },

  resetForm() {
    if (!this.profile) return;
    this.applyProfile(this.profile);
    this.setStatus('Changes reset.');
  },

  handleCollegeSearchInput() {
    this.elements.collegeId.value = '';
    this.updateUnsavedState();
    clearTimeout(this.collegeSearchTimer);
    this.collegeSearchTimer = setTimeout(() => {
      this.searchColleges(this.elements.collegeSearch.value);
    }, 200);
  },

  async searchColleges(search, options = {}) {
    try {
      const data = await userService.searchColleges(search || '');
      this.colleges = data.colleges || [];
      if (!options.keepClosed) this.renderCollegeResults();
    } catch {
      this.colleges = [];
      if (!options.keepClosed) this.renderCollegeResults();
    }
  },

  renderCollegeResults() {
    const results = this.elements.collegeResults;
    if (!results) return;

    if (!this.colleges.length) {
      results.innerHTML = '<div class="px-5 py-4 text-sm text-gray-400">No matching colleges found.</div>';
      results.classList.remove('hidden');
      return;
    }

    results.innerHTML = this.colleges.slice(0, 20).map((college) => `
      <button type="button" class="w-full text-left px-5 py-4 hover:bg-white/5 transition border-b border-white/5 last:border-b-0" data-college-id="${this.escapeHtml(college.id)}">
        <span class="block font-semibold text-white">${this.escapeHtml(college.shortName)}</span>
        <span class="block text-sm text-gray-400">${this.escapeHtml(college.officialName)}</span>
        <span class="block text-xs text-emerald-400 mt-1">${this.escapeHtml(college.instituteType)} - ${this.escapeHtml(college.state)}</span>
      </button>
    `).join('');

    results.querySelectorAll('[data-college-id]').forEach((button) => {
      button.addEventListener('click', () => this.selectCollege(button.dataset.collegeId));
    });

    results.classList.remove('hidden');
  },

  selectCollege(collegeId) {
    const college = this.colleges.find((item) => item.id === collegeId);
    if (!college) return;

    this.elements.collegeId.value = college.id;
    this.elements.collegeSearch.value = `${college.shortName} - ${college.officialName}`;
    this.hideCollegeResults();
    this.updateUnsavedState();
  },

  hideCollegeResults() {
    this.elements.collegeResults?.classList.add('hidden');
  },

  async handleAvatarSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.clearAvatarError();

    try {
      await this.validateAvatarFile(file);
      const imageData = await this.readFileAsDataUrl(file);
      this.selectedAvatarData = imageData;
      this.elements.avatarPreview.src = imageData;
      this.elements.avatarPreview.classList.remove('hidden');
      this.elements.avatarFallback.classList.add('hidden');
      this.elements.avatarFallback.classList.remove('flex');
      this.elements.saveAvatarBtn.classList.remove('hidden');
      this.elements.avatarStatus.textContent = 'Preview ready.';
    } catch (err) {
      this.selectedAvatarData = null;
      this.elements.avatarInput.value = '';
      this.showAvatarError(err.message);
    }
  },

  async validateAvatarFile(file) {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      throw new Error('Use a PNG, JPEG, or WEBP image.');
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Avatar must be smaller than 2MB.');
    }

    const dimensions = await this.readImageDimensions(file);
    if (
      dimensions.width < 64 ||
      dimensions.height < 64 ||
      dimensions.width > 2048 ||
      dimensions.height > 2048
    ) {
      throw new Error('Avatar dimensions must be between 64px and 2048px.');
    }
  },

  readImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Avatar image could not be read.'));
      };
      img.src = url;
    });
  },

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Avatar image could not be read.'));
      reader.readAsDataURL(file);
    });
  },

  async saveAvatar() {
    if (this.savingAvatar || !this.selectedAvatarData) return;

    this.savingAvatar = true;
    this.elements.saveAvatarBtn.textContent = 'Saving...';
    this.elements.saveAvatarBtn.disabled = true;

    try {
      const profile = await userService.uploadAvatar(this.selectedAvatarData);
      userService.clearProfileCache();
      await stateManager.loadProfile();
      this.applyProfile(profile);
      this.elements.avatarStatus.textContent = 'Avatar saved.';
      stateManager.showNotification('Avatar updated successfully.', 'success');
    } catch (err) {
      this.showAvatarError(err.message);
      stateManager.showNotification(`Failed to update avatar: ${err.message}`, 'error');
    } finally {
      this.savingAvatar = false;
      this.elements.saveAvatarBtn.textContent = 'Save Avatar';
      this.elements.saveAvatarBtn.disabled = false;
    }
  },

  async deleteAvatar() {
    if (this.savingAvatar || !this.profile?.user_profile?.avatar_url) return;

    this.savingAvatar = true;
    this.elements.deleteAvatarBtn.disabled = true;

    try {
      const profile = await userService.deleteAvatar();
      userService.clearProfileCache();
      await stateManager.loadProfile();
      this.applyProfile(profile);
      this.elements.avatarStatus.textContent = 'Avatar deleted.';
      stateManager.showNotification('Avatar deleted.', 'success');
    } catch (err) {
      this.showAvatarError(err.message);
      stateManager.showNotification(`Failed to delete avatar: ${err.message}`, 'error');
    } finally {
      this.savingAvatar = false;
      this.updateAvatarActions(Boolean(this.profile?.user_profile?.avatar_url));
    }
  },

  clearAvatarError() {
    this.elements.avatarError.textContent = '';
    this.elements.avatarError.classList.add('hidden');
  },

  showAvatarError(message) {
    this.elements.avatarError.textContent = message;
    this.elements.avatarError.classList.remove('hidden');
    this.elements.avatarStatus.textContent = 'Avatar not saved.';
  },

  async logout() {
    if (this.hasUnsavedChanges() && !confirm('Discard unsaved profile changes and logout?')) return;

    try {
      await authService.logout();
      window.location.href = 'auth.html';
    } catch (err) {
      console.error('Logout failed:', err);
    }
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

stateManager.subscribe((state) => {
  if (state.profile.data && ProfilePage.profile) {
    const avatarUrl = state.profile.data.user_profile?.avatar_thumbnail || state.profile.data.user_profile?.avatar_url || '';
    const fallbackText = (state.profile.data.user_profile?.display_name || state.profile.data.username || 'U').charAt(0).toUpperCase();
    ProfilePage.renderSidebar(state.profile.data, avatarUrl, fallbackText);
  }
});

document.addEventListener('DOMContentLoaded', () => ProfilePage.init());
