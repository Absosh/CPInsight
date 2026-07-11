// Global State Management
class StateManager {
  constructor() {
    this.state = {
      auth: {
        isLoggedIn: false,
        user: null,
        loading: false,
        error: null
      },
      profile: {
        data: null,
        loading: false,
        error: null
      },
      platforms: {
        accounts: [],
        selectedPlatforms: [],
        loading: false,
        error: null
      },
      analytics: {
        data: null,
        loading: false,
        error: null
      },
      ui: {
        showUserMenu: false,
        showConnectModal: false,
        selectedModalPlatform: null,
        notifications: []
      }
    };

    this.listeners = new Set();
    this.waitForServicesAndInitialize();
  }

  async waitForServicesAndInitialize() {
    // Wait for authService to be available
    let attempts = 0;
    while (typeof authService === 'undefined' && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (typeof authService !== 'undefined') {
      this.initializeState();
    } else {
      console.error('authService failed to load');
    }
  }

  async initializeState() {
    try {
      if (authService.isLoggedIn()) {
        this.state.auth.isLoggedIn = true;
        await this.loadProfile();
        await this.loadPlatforms();
      }
    } catch (err) {
      console.error('Error initializing state:', err);
    }
  }

  async loadProfile() {
    this.setState({
      profile: { ...this.state.profile, loading: true }
    });

    try {
      const data = await userService.getProfile();
      this.setState({
        profile: { data, loading: false, error: null }
      });
    } catch (err) {
      this.setState({
        profile: { data: null, loading: false, error: err.message }
      });
    }
  }

  async loadPlatforms() {
    this.setState({
      platforms: { ...this.state.platforms, loading: true }
    });

    try {
      const accounts = await platformService.getAccounts();
      const accountPlatforms = accounts.map(a => a.platform);
      
      // Load saved platform selection from localStorage, or default to all accounts
      const saved = localStorage.getItem('selectedPlatforms');
      const selectedPlatforms = saved 
        ? JSON.parse(saved).filter(p => accountPlatforms.includes(p))
        : accountPlatforms;

      this.setState({
        platforms: {
          accounts,
          selectedPlatforms,
          loading: false,
          error: null
        }
      });
    } catch (err) {
      this.setState({
        platforms: { 
          accounts: [], 
          selectedPlatforms: [],
          loading: false, 
          error: err.message 
        }
      });
    }
  }

  async loadAnalytics() {
    this.setState({
      analytics: { ...this.state.analytics, loading: true }
    });

    try {
      let data;
      const { selectedPlatforms } = this.state.platforms;

      if (selectedPlatforms.length === 0) {
        data = await analyticsService.getCombinedAnalytics();
      } else if (selectedPlatforms.length === 1) {
        data = await analyticsService.getAnalytics(selectedPlatforms[0]);
      } else {
        data = await analyticsService.getMultiplePlatforms(selectedPlatforms);
      }

      this.setState({
        analytics: { data, loading: false, error: null }
      });
    } catch (err) {
      this.setState({
        analytics: { data: null, loading: false, error: err.message }
      });
    }
  }

  setState(updates) {
    this.state = {
      ...this.state,
      ...Object.keys(updates).reduce((acc, key) => {
        acc[key] = { ...this.state[key], ...updates[key] };
        return acc;
      }, {})
    };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  getState() {
    return this.state;
  }

  // Auth methods
  setAuth(user, isLoggedIn) {
    this.setState({
      auth: { user, isLoggedIn, loading: false, error: null }
    });
  }

  setAuthLoading(loading) {
    this.setState({
      auth: { ...this.state.auth, loading }
    });
  }

  setAuthError(error) {
    this.setState({
      auth: { ...this.state.auth, error, loading: false }
    });
  }

  // Platform selection methods
  selectPlatforms(platforms) {
    // Persist selected platforms to localStorage
    localStorage.setItem('selectedPlatforms', JSON.stringify(platforms));
    
    this.setState({
      platforms: { ...this.state.platforms, selectedPlatforms: platforms }
    });
  }

  togglePlatform(platform) {
    const { selectedPlatforms } = this.state.platforms;
    const updated = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter(p => p !== platform)
      : [...selectedPlatforms, platform];

    this.selectPlatforms(updated);
  }

  // UI methods
  showNotification(message, type = 'info', duration = 5000) {
    const id = Date.now();
    const notification = { id, message, type };

    this.setState({
      ui: {
        ...this.state.ui,
        notifications: [...this.state.ui.notifications, notification]
      }
    });

    if (duration > 0) {
      setTimeout(() => this.closeNotification(id), duration);
    }

    return id;
  }

  closeNotification(id) {
    this.setState({
      ui: {
        ...this.state.ui,
        notifications: this.state.ui.notifications.filter(n => n.id !== id)
      }
    });
  }

  toggleUserMenu() {
    this.setState({
      ui: {
        ...this.state.ui,
        showUserMenu: !this.state.ui.showUserMenu
      }
    });
  }

  openConnectModal(platform) {
    this.setState({
      ui: {
        ...this.state.ui,
        showConnectModal: true,
        selectedModalPlatform: platform
      }
    });
  }

  closeConnectModal() {
    this.setState({
      ui: {
        ...this.state.ui,
        showConnectModal: false,
        selectedModalPlatform: null
      }
    });
  }
}

const stateManager = new StateManager();
window.stateManager = stateManager;

// Listen for auth logout event
window.addEventListener('auth:logout', () => {
  stateManager.setState({
    auth: { isLoggedIn: false, user: null, loading: false, error: null }
  });
  window.location.href = '/pages/auth.html';
});
