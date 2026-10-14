/**
 * Role-Based Authentication & Session Guard Module
 */

class AuthService {
  constructor() {
    this.STORAGE_KEY = 'AG_AUTH_USER_SESSION';
  }

  getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(this.STORAGE_KEY)) || null;
    } catch(e) {
      return null;
    }
  }

  login(email, password, expectedRole) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const cleanEmail = (email || '').trim().toLowerCase();
        
        if (!cleanEmail || !password) {
          return reject(new Error("Email and password are required."));
        }

        if (expectedRole === 'super_admin') {
          if ((cleanEmail === 'admin@vanakkamcafe.com' || cleanEmail === 'admin@abhijeetcafe.com' || cleanEmail === 'admin@restaurant.com') && password === 'admin123') {
            const user = {
              uid: 'usr_admin_01',
              name: 'Super Admin',
              email: cleanEmail,
              role: 'super_admin',
              loggedInAt: Date.now()
            };
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
            return resolve(user);
          } else {
            return reject(new Error("Invalid email or password. Please check your credentials."));
          }
        }

        if (expectedRole === 'cafe_manager') {
          const managers = window.dbService ? window.dbService.getManagers() : [];
          const mgrMatch = managers.find(m => m.email && m.email.trim().toLowerCase() === cleanEmail && m.isActive);

          if (mgrMatch && mgrMatch.password && mgrMatch.password === password) {
            const user = {
              uid: mgrMatch.managerId,
              name: mgrMatch.name,
              email: cleanEmail,
              role: 'cafe_manager',
              loggedInAt: Date.now()
            };
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
            return resolve(user);
          } else {
            return reject(new Error("Invalid email or password. Please check your credentials."));
          }
        }

        reject(new Error("Invalid authentication request."));
      }, 300);
    });
  }

  setCustomerSession(customerData) {
    const user = {
      uid: customerData.customerId,
      name: customerData.name,
      mobile: customerData.mobile,
      role: 'customer',
      sessionId: customerData.sessionId,
      tableId: customerData.tableId,
      tableNumber: customerData.tableNumber,
      loggedInAt: Date.now()
    };
    localStorage.setItem('AG_CUSTOMER_USER_SESSION', JSON.stringify(user));
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  getCurrentCustomerUser() {
    try {
      const stored = localStorage.getItem('AG_CUSTOMER_USER_SESSION');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.sessionId && window.dbService) {
          const sess = window.dbService.getSession(parsed.sessionId);
          if (sess && (sess.status === 'COMPLETED' || sess.status === 'FORCE_FREED')) {
            localStorage.removeItem('AG_CUSTOMER_USER_SESSION');
            return null;
          }
        }
        return parsed;
      }
    } catch(e) {}
    const user = this.getCurrentUser();
    if (user && user.role === 'customer') return user;
    return null;
  }

  logoutCustomer() {
    localStorage.removeItem('AG_CUSTOMER_USER_SESSION');
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  logout() {
    localStorage.removeItem('AG_CUSTOMER_USER_SESSION');
    sessionStorage.removeItem(this.STORAGE_KEY);
    window.location.replace('index.html');
  }

  enforceRoleGuard(requiredRole) {
    let user = this.getCurrentUser();
    
    if (!user) {
      if (requiredRole === 'customer') return true;
      
      // Strict security: Redirect unauthenticated access attempt to login
      window.location.replace('index.html');
      return false;
    }

    if (user.role === 'cafe_manager') {
      const managers = window.dbService ? window.dbService.getManagers() : [];
      const cleanUserEmail = (user.email || '').trim().toLowerCase();
      const activeMgr = managers.find(m => (m.managerId === user.uid || (m.email && m.email.trim().toLowerCase() === cleanUserEmail)) && m.isActive);
      
      if (!activeMgr) {
        alert("Your manager account has been deactivated or deleted by Super Admin.");
        sessionStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem('AG_CUSTOMER_USER_SESSION');
        window.location.replace('index.html');
        return false;
      }
    }

    if (requiredRole === 'super_admin' && user.role !== 'super_admin') {
      alert("Unauthorized access. Super Admin permissions required.");
      if (user.role === 'cafe_manager') window.location.replace('manager.html');
      else window.location.replace('index.html');
      return false;
    }

    if (requiredRole === 'cafe_manager' && (user.role !== 'cafe_manager' && user.role !== 'super_admin')) {
      alert("Unauthorized access. Staff permissions required.");
      window.location.replace('index.html');
      return false;
    }

    return true;
  }
}

window.authService = new AuthService();
