// Authentication Service
class AuthService {
  async register(username, email, password) {
    return httpClient.post('/auth/register', {
      username,
      email,
      password
    });
  }

  async login(email, password) {
    return httpClient.post('/auth/login', {
      email,
      password
    });
  }

  async logout() {
    const token = localStorage.getItem('refreshToken');
    if (token) {
      try {
        await httpClient.post('/auth/logout', { refreshToken: token });
      } catch (err) {
        // Logout anyway even if API fails
      }
    }
    this.clearSession();
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    return httpClient.post('/auth/refresh', { refreshToken });
  }

  setSession(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearSession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('platformAccounts');
    localStorage.removeItem('cpinsight:lastCompareHandle');
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  isLoggedIn() {
    return !!this.getAccessToken();
  }
}

const authService = new AuthService();
window.authService = authService;
