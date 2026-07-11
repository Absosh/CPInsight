# CPInsight Frontend Architecture

## Overview

CPInsight frontend is a vanilla JavaScript application with a modular, service-based architecture. It integrates with the Node.js/Express backend for authentication, user management, and analytics.

---

## Folder Structure

```
frontend/
├── pages/
│   ├── auth.html              # Login/Register
│   ├── dashboard.html         # Main dashboard
│   ├── analytics.html         # Analytics page
│   ├── platforms.html         # Platform management
│   ├── profile.html           # User profile
│   ├── calendar.html          # Contest calendar
│   └── landing_page.html      # Landing page
├── script/
│   ├── services/              # Business logic
│   │   ├── httpClient.js      # HTTP/JWT handler
│   │   ├── authService.js     # Authentication
│   │   ├── userService.js     # User profile
│   │   ├── platformService.js # Platform management
│   │   ├── analyticsService.js# Analytics
│   │   └── stateManager.js    # Global state
│   ├── components/            # Reusable UI
│   │   ├── userMenu.js        # User dropdown menu
│   │   ├── platformSelector.js# Platform filter
│   │   └── notification.js    # Toast notifications
│   ├── utils/
│   │   └── routeProtection.js # Route guards
│   ├── shared.js              # Shared utilities
│   └── [page-specific].js     # Page logic
├── css/
│   ├── shared.css             # Global styles
│   └── landing_page.css       # Landing styles
├── Assets/                    # Images, icons
└── ARCHITECTURE.md            # This file
```

---

## Core Services

### 1. httpClient.js
**Purpose:** Central HTTP handler with JWT interceptor

**Features:**
- Automatic JWT token injection
- Token refresh on 401
- Request timeout handling
- Error standardization

**Usage:**
```javascript
const data = await httpClient.get('/api/endpoint');
const result = await httpClient.post('/api/endpoint', { body });
```

### 2. authService.js
**Purpose:** Handle authentication flows

**Methods:**
- `register(username, email, password)` - Create account
- `login(email, password)` - Sign in
- `logout()` - Clear session
- `refreshToken()` - Refresh JWT
- `isLoggedIn()` - Check auth status

**Usage:**
```javascript
await authService.login('user@example.com', 'password');
const isAuth = authService.isLoggedIn();
```

### 3. userService.js
**Purpose:** Manage user profile

**Methods:**
- `getProfile()` - Fetch user data (cached)
- `updateProfile(updates)` - Update profile
- `clearProfileCache()` - Invalidate cache

**Usage:**
```javascript
const profile = await userService.getProfile();
await userService.updateProfile({ display_name: 'NewName' });
```

### 4. platformService.js
**Purpose:** Manage connected platforms

**Methods:**
- `getAccounts()` - List connected platforms
- `connectPlatform(platform, handle)` - Add platform
- `disconnectPlatform(platform)` - Remove platform
- `isConnected(platform)` - Check connection status
- `getHandle(platform)` - Get user's handle

**Usage:**
```javascript
const accounts = await platformService.getAccounts();
await platformService.connectPlatform('codeforces', 'tourist');
```

### 5. analyticsService.js
**Purpose:** Fetch analytics from backend

**Methods:**
- `getAnalytics(platform)` - Single platform
- `getCombinedAnalytics()` - All platforms
- `getMultiplePlatforms(platforms)` - Multiple select
- `mergeAnalytics(platforms, data)` - Combine data

**Usage:**
```javascript
const analytics = await analyticsService.getAnalytics('codeforces');
const combined = await analyticsService.getCombinedAnalytics();
```

### 6. stateManager.js
**Purpose:** Centralized application state

**State Structure:**
```javascript
{
  auth: { isLoggedIn, user, loading, error },
  profile: { data, loading, error },
  platforms: { accounts, selectedPlatforms, loading, error },
  analytics: { data, loading, error },
  ui: { showUserMenu, notifications, ... }
}
```

**Methods:**
- `getState()` - Get current state
- `setState(updates)` - Update state
- `subscribe(listener)` - Listen for changes
- `loadProfile()` - Fetch profile
- `loadPlatforms()` - Fetch platforms
- `loadAnalytics()` - Fetch analytics
- `selectPlatforms(platforms)` - Multi-select
- `showNotification(message, type, duration)` - Toast

**Usage:**
```javascript
const state = stateManager.getState();
stateManager.subscribe((newState) => {
  console.log('State changed:', newState);
});
stateManager.showNotification('Success!', 'success');
```

---

## Components

### UserMenuComponent
**File:** `script/components/userMenu.js`
**Container:** `<div id="userMenuContainer"></div>`

**Features:**
- Dropdown user menu
- Logout functionality
- Profile/Dashboard/Analytics links

**Auto-initializes** when `userMenuComponent` is included

### PlatformSelectorComponent
**File:** `script/components/platformSelector.js`
**Container:** `<div id="platformSelectorContainer"></div>`

**Features:**
- Multi-select platform toggles
- "All Platforms" option
- Auto-reloads analytics on change

**Usage:**
```html
<script src="script/components/platformSelector.js"></script>
<div id="platformSelectorContainer"></div>
```

### NotificationComponent
**File:** `script/components/notification.js`
**Container:** `<div id="notificationContainer"></div>`

**Types:** success, error, warning, info

**Usage:**
```javascript
stateManager.showNotification('Saved!', 'success', 5000);
```

---

## Authentication Flow

### Login/Register
1. User submits credentials on `/pages/auth.html`
2. Frontend calls `authService.login()` → `POST /api/auth/login`
3. Backend returns `accessToken` + `refreshToken`
4. Frontend stores tokens in localStorage
5. Redirect to dashboard

### Protected Routes
1. Page checks `authService.isLoggedIn()` on load
2. If not authenticated → redirect to `/pages/auth.html`
3. If authenticated → load data

### Token Refresh
1. API call returns 401
2. `httpClient` automatically calls `POST /api/auth/refresh`
3. New token stored
4. Original request retried

---

## Multi-Platform Support

### Platform Selection
```javascript
// Select specific platforms
stateManager.selectPlatforms(['codeforces', 'codechef']);

// Load analytics for selection
await stateManager.loadAnalytics();
```

### Analytics per Platform
```javascript
// Single platform
const cf = await analyticsService.getAnalytics('codeforces');

// Combined
const combined = await analyticsService.getCombinedAnalytics();

// Multiple
const multi = await analyticsService.getMultiplePlatforms(
  ['codeforces', 'codechef']
);
```

---

## Page Structure Template

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Styles -->
  <link rel="stylesheet" href="../css/shared.css">
</head>
<body>
  <!-- Services & State (always include) -->
  <script src="../script/services/httpClient.js"></script>
  <script src="../script/services/authService.js"></script>
  <script src="../script/services/userService.js"></script>
  <script src="../script/services/platformService.js"></script>
  <script src="../script/services/analyticsService.js"></script>
  <script src="../script/services/stateManager.js"></script>
  
  <!-- Components (as needed) -->
  <script src="../script/components/notification.js"></script>
  <script src="../script/components/userMenu.js"></script>
  <script src="../script/components/platformSelector.js"></script>
  
  <!-- Route Protection (for protected pages) -->
  <script src="../script/utils/routeProtection.js"></script>
  <script>RouteProtection.protectPage();</script>

  <!-- Containers -->
  <div id="notificationContainer"></div>
  <div id="userMenuContainer"></div>
  <div id="platformSelectorContainer"></div>

  <!-- Page Content -->
  <main>...</main>

  <!-- Page Logic -->
  <script>
    // Subscribe to state
    stateManager.subscribe((state) => {
      // Update UI
    });

    // Load data
    stateManager.loadProfile();
    stateManager.loadPlatforms();
    stateManager.loadAnalytics();
  </script>
</body>
</html>
```

---

## Error Handling

### User-Facing Errors
```javascript
try {
  await someAction();
} catch (err) {
  stateManager.showNotification(err.message, 'error');
}
```

### Network Errors
- Handled by `httpClient`
- Auto-retry on 401 (refresh token)
- Throw error if refresh fails

### State Errors
```javascript
const { error } = stateManager.getState().analytics;
if (error) {
  console.error('Analytics error:', error);
}
```

---

## Caching Strategy

**localStorage caching:**
- `accessToken` - JWT token
- `refreshToken` - Refresh token
- `userProfile` - Profile data (cleared on update)
- `platformAccounts` - Connected platforms (cleared on change)

**No cache:**
- Analytics (always fresh)
- Notifications (UI only)

---

## Future Extensions

The architecture supports:

1. **Friend Comparison**
   - New service: `comparisonService.js`
   - GET `/api/users/:id/profile`
   - GET `/api/analytics/compare/:id`

2. **AI Insights**
   - New service: `insightService.js`
   - GET `/api/insights/weaknesses`
   - GET `/api/insights/recommendations`

3. **Rating Prediction**
   - New service: `predictionService.js`
   - GET `/api/predictions/rating`

4. **Contest Replay**
   - New service: `contestService.js`
   - GET `/api/contests/:id`

5. **Training Plans**
   - New service: `trainingService.js`
   - POST `/api/training/generate`

---

## Development Checklist

- [ ] Include all service scripts in page
- [ ] Include state manager
- [ ] Add route protection for protected pages
- [ ] Add notification container
- [ ] Add user menu container
- [ ] Subscribe to state changes
- [ ] Handle errors with notifications
- [ ] Test offline → online transitions
- [ ] Test token refresh flow
- [ ] Validate multi-platform functionality

---

## API Integration Checklist

✅ **Implemented:**
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- POST `/api/auth/logout` - Logout
- POST `/api/auth/refresh` - Token refresh
- GET `/api/user/profile` - Get profile
- PATCH `/api/user/profile` - Update profile
- GET `/api/platforms/accounts` - List accounts
- POST `/api/platforms/connect` - Connect platform
- DELETE `/api/platforms/disconnect` - Disconnect
- GET `/api/analytics/codeforces` - CF analytics
- GET `/api/analytics/codechef` - CC analytics
- GET `/api/analytics/leetcode` - LC analytics
- GET `/api/analytics/combined` - Combined

✅ **Ready for Backend:**
All endpoints are ready. Frontend expects same response format.

---

## Performance Tips

1. **Minimize API calls**
   - Use stateManager for state
   - Cache profile data
   - Lazy load analytics

2. **Optimize re-renders**
   - Subscribe to specific state slices
   - Use `display: none` instead of DOM removal

3. **Handle slow networks**
   - Show loading states
   - Implement retry buttons
   - Timeout after 10s

---

## Debugging

### Check Auth State
```javascript
console.log('Auth:', authService.isLoggedIn());
console.log('Token:', authService.getAccessToken());
```

### Check Global State
```javascript
console.log('State:', stateManager.getState());
```

### Monitor API Calls
```javascript
// All fetch calls go through httpClient
// Check Network tab in DevTools
```

### Reset Session
```javascript
localStorage.clear();
location.reload();
```

---

## Production Considerations

1. **Security**
   - Use HTTPS only in production
   - Set `Secure` flag on cookies
   - Implement CSRF protection

2. **Performance**
   - Minify JavaScript
   - Cache static assets
   - Use CDN for assets

3. **Monitoring**
   - Log errors to Sentry
   - Monitor API latency
   - Track user sessions

4. **Deployment**
   - Build with Vite/Webpack
   - Environment variables for API URL
   - Service worker for offline support

---

## Support

For issues or questions, refer to:
- Backend docs: `backend/docs/ARCHITECTURE.md`
- API spec: `backend/docs/API.md`
- Frontend issues: Check browser console and Network tab
