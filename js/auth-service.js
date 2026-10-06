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
          if (cleanEmail === 'admin@abhijeetcafe.com' && password === 'admin123') {
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
            return reject(new Error("Invalid Admin credentials. Try admin@abhijeetcafe.com / admin123"));
          }
        }

        if (expectedRole === 'cafe_manager') {
          const managers = window.dbService ? window.dbService.getManagers() : [];
          const mgrMatch = managers.find(m => m.email.toLowerCase() === cleanEmail && m.isActive);

          if ((cleanEmail === 'manager@abhijeetcafe.com' && password === 'manager123') || mgrMatch) {
            const user = {
              uid: mgrMatch ? mgrMatch.managerId : 'usr_mgr_01',
              name: mgrMatch ? mgrMatch.name : 'Ramesh Sharma',
              email: cleanEmail,
              role: 'cafe_manager',
              loggedInAt: Date.now()
            };
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
            return resolve(user);
          } else {
            return reject(new Error("Invalid Manager credentials. Try manager@abhijeetcafe.com / manager123"));
          }
        }

        reject(new Error("Invalid user role authentication attempt."));
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
      if (stored) return JSON.parse(stored);
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
      
      // Auto-authenticate default demo session for instant browser testing
      if (requiredRole === 'super_admin') {
        user = {
          uid: 'usr_admin_01',
          name: 'Super Admin',
          email: 'admin@abhijeetcafe.com',
          role: 'super_admin',
          loggedInAt: Date.now()
        };
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      } else if (requiredRole === 'cafe_manager') {
        user = {
          uid: 'usr_mgr_01',
          name: 'Ramesh Sharma',
          email: 'manager@abhijeetcafe.com',
          role: 'cafe_manager',
          loggedInAt: Date.now()
        };
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
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
