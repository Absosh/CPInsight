// User Service
class UserService {
  normalizeProfile(data) {
    if (!data) return null;

    if (data.user && data.profile) {
      return {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        created_at: data.user.createdAt,
        updated_at: data.user.updatedAt,
        user_profile: {
          display_name: data.profile.displayName,
          timezone: data.profile.timezone,
          country: data.profile.country,
          avatar_url: data.profile.avatarUrl,
          preferences: data.profile.preferences
        },
        platform_accounts: data.platformAccounts || []
      };
    }

    return {
      ...data,
      user_profile: data.user_profile || {
        display_name: '',
        timezone: 'UTC',
        country: '',
        avatar_url: null,
        preferences: {}
      },
      platform_accounts: data.platform_accounts || []
    };
  }

  async getProfile(options = {}) {
    const { skipCache = false } = options;

    try {
      const data = await httpClient.get('/user/profile');
      const profile = this.normalizeProfile(data);
      localStorage.setItem('userProfile', JSON.stringify(profile));
      return profile;
    } catch (err) {
      console.warn('Backend profile fetch failed:', err.message);
      
      if (skipCache) {
        throw err;
      }

      const cached = localStorage.getItem('userProfile');
      if (cached) {
        console.log('Falling back to cached profile');
        try {
          const profile = this.normalizeProfile(JSON.parse(cached));
          return profile;
        } catch (cacheErr) {
          console.error('Failed to parse cached profile:', cacheErr);
          throw err;
        }
      }

      throw err;
    }
  }

  clearProfileCache() {
    localStorage.removeItem('userProfile');
  }

  async updateProfile(updates) {
    try {
      const data = await httpClient.patch('/user/profile', updates);
      const profile = this.normalizeProfile(data);
      localStorage.setItem('userProfile', JSON.stringify(profile));
      return profile;
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  }

  clearProfileCache() {
    localStorage.removeItem('userProfile');
  }
}

const userService = new UserService();
window.userService = userService;
