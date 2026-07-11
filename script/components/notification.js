// Notification System Component
class NotificationComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.setup();
  }

  setup() {
    stateManager.subscribe(() => this.render());
    this.render();
  }

  render() {
    // Guard against null container
    if (!this.container) {
      return;
    }

    const { notifications } = stateManager.getState().ui;

    this.container.innerHTML = notifications.map(notif => `
      <div class="fixed top-4 right-4 glass rounded-2xl px-6 py-4 border backdrop-blur-lg animate-slide-in z-[100] ${this.getClass(notif.type)}"
           id="notif-${notif.id}">
        <div class="flex items-center gap-3">
          <span>${this.getIcon(notif.type)}</span>
          <p>${notif.message}</p>
          <button onclick="stateManager.closeNotification(${notif.id})" class="text-xl">×</button>
        </div>
      </div>
    `).join('');

    // Add slide animation styles
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slide-in {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `;
      document.head.appendChild(style);
    }
  }

  getClass(type) {
    switch (type) {
      case 'success':
        return 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400';
      case 'error':
        return 'bg-red-600/20 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-yellow-600/20 border-yellow-500/30 text-yellow-400';
      default:
        return 'bg-blue-600/20 border-blue-500/30 text-blue-400';
    }
  }

  getIcon(type) {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('notificationContainer');
    if (container) {
      window.notificationComponent = new NotificationComponent('notificationContainer');
    }
  });
} else {
  const container = document.getElementById('notificationContainer');
  if (container) {
    window.notificationComponent = new NotificationComponent('notificationContainer');
  }
}
