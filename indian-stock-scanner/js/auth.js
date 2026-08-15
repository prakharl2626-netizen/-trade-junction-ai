/**
 * Trade Junction AI - Authentication & User Session Manager
 * Handles login, registration, demo credentials, persistent sessions, and logout.
 */

class AuthManager {
  constructor() {
    this.sessionKey = 'tradejunction_session';
    this.usersKey = 'tradejunction_registered_users';
    this.currentUser = null;

    // Default Pre-Configured Accounts
    this.defaultUsers = [
      { username: 'admin', password: 'password123', name: 'Admin Trader', role: 'PRO MASTER', plan: 'PRO VIP' },
      { username: 'trader', password: 'trade2026', name: 'Professional Trader', role: 'TRADER', plan: 'PRO' },
      { username: 'demo', password: 'demo123', name: 'Demo User', role: 'GUEST', plan: 'TRIAL' }
    ];

    this.initUsers();
    this.checkExistingSession();
  }

  initUsers() {
    const existing = localStorage.getItem(this.usersKey);
    if (!existing) {
      localStorage.setItem(this.usersKey, JSON.stringify(this.defaultUsers));
    }
  }

  getRegisteredUsers() {
    try {
      return JSON.parse(localStorage.getItem(this.usersKey)) || this.defaultUsers;
    } catch (e) {
      return this.defaultUsers;
    }
  }

  checkExistingSession() {
    try {
      const saved = localStorage.getItem(this.sessionKey) || sessionStorage.getItem(this.sessionKey);
      if (saved) {
        this.currentUser = JSON.parse(saved);
        return true;
      }
    } catch (e) {
      this.currentUser = null;
    }
    return false;
  }

  login(username, password, rememberMe = true) {
    const users = this.getRegisteredUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);

    if (user) {
      this.currentUser = {
        username: user.username,
        name: user.name || user.username,
        role: user.role || 'TRADER',
        plan: user.plan || 'PRO',
        loginTime: new Date().toISOString()
      };

      const sessionStr = JSON.stringify(this.currentUser);
      if (rememberMe) {
        localStorage.setItem(this.sessionKey, sessionStr);
      } else {
        sessionStorage.setItem(this.sessionKey, sessionStr);
      }
      return { success: true, user: this.currentUser };
    }

    return { success: false, message: 'Invalid Username or Password. (Try: admin / password123)' };
  }

  register(username, password, name) {
    const users = this.getRegisteredUsers();
    if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return { success: false, message: 'Username already exists! Choose another.' };
    }

    const newUser = {
      username: username.trim(),
      password: password,
      name: name.trim() || username.trim(),
      role: 'TRADER',
      plan: 'PRO'
    };

    users.push(newUser);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    return this.login(username, password, true);
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.sessionKey);
    sessionStorage.removeItem(this.sessionKey);
    window.location.reload();
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }
}

window.authManager = new AuthManager();
