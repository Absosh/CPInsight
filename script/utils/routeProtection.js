// Route Protection
class RouteProtection {
  static checkAuth() {
    if (!authService.isLoggedIn()) {
      window.location.href = '/pages/auth.html';
      return false;
    }
    return true;
  }

  static checkGuest() {
    if (authService.isLoggedIn()) {
      window.location.href = '/pages/dashboard.html';
      return false;
    }
    return true;
  }

  static protectPage() {
    // Run on page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.checkAuth();
      });
    } else {
      this.checkAuth();
    }
  }

  static protectGuestPage() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.checkGuest();
      });
    } else {
      this.checkGuest();
    }
  }
}

// Auto-protect if route protection script is included
// Usage: Add RouteProtection.protectPage() at the start of protected pages
