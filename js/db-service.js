/**
 * Database Service Layer - Firebase Realtime DB & Robust Local Data Engine
 */

class DBService {
  constructor() {
    this.STORAGE_KEY = 'AG_RESTAURANT_POS_DATA_FIREBASE_V1';
    this.listeners = {};
    this.isRemoteUpdate = false;
    this.initLocalStorage();
    this.initFirebaseSync();
  }

  initLocalStorage() {
    // Purge obsolete legacy storage keys to eliminate stale test/demo data
    try {
      localStorage.removeItem('AG_RESTAURANT_POS_DATA_V1');
      localStorage.removeItem('AG_RESTAURANT_POS_DATA');
      localStorage.removeItem('AG_RESTAURANT_DATA');
    } catch(e) {}

    let data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      const initialData = {
        businessProfile: {},
        landingConfig: {},
        categories: [],
        tables: {},
        products: {},
        inventory: {},
        inventoryMovements: {},
        capital: {},
        expenses: {},
        managers: {},
        diningSessions: {},
        orders: {},
        kots: {},
        invoices: {},
        payments: {},
        customers: {},
        inventoryRequests: {},
        dailyCounters: {}
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
    }
  }

  // Returns the next sequential number for 'kot' or 'bill', resetting to 1 each calendar day.
  _nextDailyCounter(type) {
    const data = this.getData();
    if (!data.dailyCounters) data.dailyCounters = {};
    const todayKey = new Date().toISOString().slice(0, 10); // e.g. '2024-01-15'
    const counterKey = `${type}_${todayKey}`;

    // Reset all old-day keys to keep storage clean
    Object.keys(data.dailyCounters).forEach(k => {
      if (!k.endsWith(todayKey)) delete data.dailyCounters[k];
    });

    const current = data.dailyCounters[counterKey] || 0;
    const next = current + 1;
    data.dailyCounters[counterKey] = next;
    this.saveData(data);

    // Sync counter to Firebase so all devices stay in sync
    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/dailyCounters/${counterKey}`).set(next).catch(e => {});
      } catch(e) {}
    }

    return next;
  }

  initFirebaseSync() {
    const setupListeners = async () => {
      if (!window.firebaseDB) return;

      if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
        try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
      }

      // Root database listener: Pure authoritative 1:1 sync with Firebase RTDB
      window.firebaseDB.ref('/').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          this.isRemoteUpdate = true;
          const freshData = {
            businessProfile: (val.businessProfile && typeof val.businessProfile === 'object') ? val.businessProfile : {},
            landingConfig: (val.landingConfig && typeof val.landingConfig === 'object') ? val.landingConfig : {},
            categories: Array.isArray(val.categories) ? val.categories : (val.categories && typeof val.categories === 'object' ? Object.values(val.categories) : []),
            tables: (val.tables && typeof val.tables === 'object') ? val.tables : {},
            products: (val.products && typeof val.products === 'object') ? val.products : {},
            inventory: (val.inventory && typeof val.inventory === 'object') ? val.inventory : {},
            inventoryMovements: (val.inventoryMovements && typeof val.inventoryMovements === 'object') ? val.inventoryMovements : {},
            capital: (val.capital && typeof val.capital === 'object') ? val.capital : {},
            expenses: (val.expenses && typeof val.expenses === 'object') ? val.expenses : {},
            managers: (val.managers && typeof val.managers === 'object') ? val.managers : {},
            diningSessions: (val.diningSessions && typeof val.diningSessions === 'object') ? val.diningSessions : {},
            orders: (val.orders && typeof val.orders === 'object') ? val.orders : {},
            kots: (val.kots && typeof val.kots === 'object') ? val.kots : {},
            invoices: (val.invoices && typeof val.invoices === 'object') ? val.invoices : {},
            payments: (val.payments && typeof val.payments === 'object') ? val.payments : {},
            customers: (val.customers && typeof val.customers === 'object') ? val.customers : {},
            inventoryRequests: (val.inventoryRequests && typeof val.inventoryRequests === 'object') ? val.inventoryRequests : {}
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(freshData));
          this.notifyListeners();
          this.isRemoteUpdate = false;
        }
      }, (error) => {
        console.warn("Firebase RTDB root sync listener notice:", error);
      });

      // Granular Node Sync Helper for immediate real-time reactivity on individual node updates
      const syncNode = (nodePath, nodeKey, isArray = false) => {
        window.firebaseDB.ref(nodePath).on('value', (snapshot) => {
          const val = snapshot.val();
          this.isRemoteUpdate = true;
          const current = this.getData();
          if (isArray) {
            current[nodeKey] = Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []);
          } else {
            current[nodeKey] = (val && typeof val === 'object') ? val : {};
          }
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
          this.notifyListeners();
          this.isRemoteUpdate = false;
        }, (error) => {
          console.warn(`Firebase RTDB sync listener [${nodePath}] notice:`, error);
        });
      };

      // Dedicated Realtime Listeners for all collections
      syncNode('/businessProfile', 'businessProfile');
      syncNode('/landingConfig', 'landingConfig');
      syncNode('/categories', 'categories', true);
      syncNode('/tables', 'tables');
      syncNode('/products', 'products');
      syncNode('/inventory', 'inventory');
      syncNode('/inventoryMovements', 'inventoryMovements');
      syncNode('/capital', 'capital');
      syncNode('/expenses', 'expenses');
      syncNode('/managers', 'managers');
      syncNode('/diningSessions', 'diningSessions');
      syncNode('/orders', 'orders');
      syncNode('/kots', 'kots');
      syncNode('/invoices', 'invoices');
      syncNode('/payments', 'payments');
      syncNode('/customers', 'customers');
      syncNode('/inventoryRequests', 'inventoryRequests');
    };

    if (window.firebaseDB) {
      setupListeners();
    } else {
      window.addEventListener('load', () => setTimeout(setupListeners, 500));
    }
  }

  getData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
      
      // Auto-heal: Ensure all standard collections exist to guarantee safe indexed access without dummy data
      if (!parsed.businessProfile || typeof parsed.businessProfile !== 'object') parsed.businessProfile = {};
      if (!parsed.landingConfig || typeof parsed.landingConfig !== 'object') parsed.landingConfig = {};
      if (!parsed.tables || typeof parsed.tables !== 'object') parsed.tables = {};
      if (!parsed.diningSessions || typeof parsed.diningSessions !== 'object') parsed.diningSessions = {};
      if (!parsed.customers || typeof parsed.customers !== 'object') parsed.customers = {};
      if (!parsed.products || typeof parsed.products !== 'object') parsed.products = {};
      if (!Array.isArray(parsed.categories)) parsed.categories = (parsed.categories && typeof parsed.categories === 'object') ? Object.values(parsed.categories) : [];
      if (!parsed.orders || typeof parsed.orders !== 'object') parsed.orders = {};
      if (!parsed.kots || typeof parsed.kots !== 'object') parsed.kots = {};
      if (!parsed.invoices || typeof parsed.invoices !== 'object') parsed.invoices = {};
      if (!parsed.payments || typeof parsed.payments !== 'object') parsed.payments = {};
      if (!parsed.inventory || typeof parsed.inventory !== 'object') parsed.inventory = {};
      if (!parsed.inventoryMovements || typeof parsed.inventoryMovements !== 'object') parsed.inventoryMovements = {};
      if (!parsed.expenses || typeof parsed.expenses !== 'object') parsed.expenses = {};
      if (!parsed.capital || typeof parsed.capital !== 'object') parsed.capital = {};
      if (!parsed.managers || typeof parsed.managers !== 'object') parsed.managers = {};
      if (!parsed.inventoryRequests || typeof parsed.inventoryRequests !== 'object') parsed.inventoryRequests = {};

      return parsed;
    } catch(e) {
      console.error("Storage error:", e);
      return {};
    }
  }

  saveData(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    this.notifyListeners();

    if (!this.isRemoteUpdate && window.firebaseDB) {
      try {
        window.firebaseDB.ref('/').set(data).catch(err => {
          console.warn("Firebase RTDB write note:", err);
        });
      } catch(e) {
        console.warn("Firebase RTDB sync write error:", e);
      }
    }
  }

  subscribe(node, callback) {
    if (!this.listeners[node]) this.listeners[node] = [];
    this.listeners[node].push(callback);
    callback(this.getNodeData(node));
  }

  notifyListeners() {
    Object.keys(this.listeners).forEach(node => {
      const nodeData = this.getNodeData(node);
      this.listeners[node].forEach(cb => cb(nodeData));
    });
  }

  getNodeData(node) {
    const data = this.getData();
    return data[node] || {};
  }

  // --- BUSINESS PROFILE ---
  getBusinessProfile() {
    const profile = this.getData().businessProfile;
    if (profile && profile.businessName) return profile;
    return (window.SEED_DATA && window.SEED_DATA.businessProfile) ? window.SEED_DATA.businessProfile : {};
  }

  async updateBusinessProfile(profile) {
    const data = this.getData();
    const updatedProfile = { ...data.businessProfile, ...profile, updatedAt: Date.now() };
    data.businessProfile = updatedProfile;
    this.saveData(data);

    let firebaseSuccess = false;
    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref('/businessProfile').set(updatedProfile);
        firebaseSuccess = true;
      } catch (err) {
        console.error("Firebase RTDB businessProfile push error:", err);
      }
    }

    this.notifyListeners();
    return { profile: updatedProfile, firebaseSuccess };
  }

  // --- LANDING PAGE CONFIG ---
  getLandingPageConfig() {
    const stored = this.getData().landingConfig;
    if (stored && stored.brandName) return stored;
    return (window.SEED_DATA && window.SEED_DATA.landingConfig) ? window.SEED_DATA.landingConfig : {};
  }

  async saveLandingPageConfig(configData) {
    const data = this.getData();
    const updatedConfig = { ...data.landingConfig, ...configData, updatedAt: Date.now() };
    data.landingConfig = updatedConfig;
    this.saveData(data);

    let firebaseSuccess = false;
    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref('/landingConfig').set(updatedConfig);
        firebaseSuccess = true;
      } catch (err) {
        console.error("Firebase RTDB landingConfig push error:", err);
      }
    }

    this.notifyListeners();
    return { config: updatedConfig, firebaseSuccess };
  }

  // --- TABLES ---
  getTables() {
    const tablesObj = this.getData().tables || {};
    return Object.values(tablesObj).sort((a,b) => (a.tableNumber || '').localeCompare(b.tableNumber || ''));
  }

  getTable(tableId) {
    return (this.getData().tables || {})[tableId] || null;
  }

  addTable(tableNumber) {
    const data = this.getData();
    const tableId = 'tbl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newTable = {
      tableId,
      tableNumber,
      status: 'AVAILABLE',
      isActive: true,
      currentSessionId: null
    };
    data.tables[tableId] = newTable;
    this.saveData(data);
    if (window.firebaseDB) {
      window.firebaseDB.ref(`/tables/${tableId}`).set(newTable).catch(e => console.warn(e));
    }
    return newTable;
  }

  updateTable(tableId, updates) {
    const data = this.getData();
    if (data.tables[tableId]) {
      data.tables[tableId] = { ...data.tables[tableId], ...updates };
      this.saveData(data);
      if (window.firebaseDB) {
        window.firebaseDB.ref(`/tables/${tableId}`).set(data.tables[tableId]).catch(e => console.warn(e));
      }
    }
  }

  deleteTable(tableId) {
    const data = this.getData();
    const table = data.tables[tableId];
    if (table && table.status !== 'AVAILABLE') {
      throw new Error("Cannot delete table while it has an active or waiting session.");
    }
    delete data.tables[tableId];
    this.saveData(data);
    if (window.firebaseDB) {
      window.firebaseDB.ref(`/tables/${tableId}`).remove().catch(e => console.warn(e));
    }
  }

  freeTable(tableId) {
    const data = this.getData();
    const table = data.tables[tableId];
    if (table) {
      const sessionId = table.currentSessionId;
      if (sessionId && data.diningSessions[sessionId]) {
        data.diningSessions[sessionId].status = 'COMPLETED';
        data.diningSessions[sessionId].completedAt = Date.now();
      }
      table.status = 'AVAILABLE';
      table.currentSessionId = null;
      this.saveData(data);

      if (window.firebaseDB) {
        try {
          window.firebaseDB.ref(`/tables/${tableId}`).set(table).catch(e => {});
          if (sessionId && data.diningSessions[sessionId]) {
            window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(data.diningSessions[sessionId]).catch(e => {});
          }
        } catch(e) {}
      }

      this.notifyListeners();
    }
  }

  /**
   * Force-free a table by manager override.
   * Marks the active session as FORCE_FREED (not COMPLETED) so the customer app
   * can distinguish between a normal bill settlement and a manager eviction.
   * Cancels any open/pending KOTs for the session, clears the table, and syncs live to Firebase.
   */
  forceFreeTables(tableId) {
    const data = this.getData();
    const table = data.tables[tableId];
    if (!table) return { success: false, message: 'Table not found.' };

    const sessionId = table.currentSessionId;

    if (sessionId && data.diningSessions[sessionId]) {
      const session = data.diningSessions[sessionId];
      session.status = 'FORCE_FREED';
      session.completedAt = Date.now();
      session.forcedFreeAt = Date.now();

      // Cancel any open KOTs for this session so kitchen is not confused
      const orders = Object.values(data.orders || {}).filter(o => o.sessionId === sessionId);
      orders.forEach(order => {
        if (['PENDING', 'APPROVED', 'SENT_TO_KITCHEN', 'PREPARING'].includes(order.status)) {
          data.orders[order.orderId].status = 'CANCELLED';
          data.orders[order.orderId].cancelledAt = Date.now();
          data.orders[order.orderId].cancelReason = 'Table force-freed by manager';
        }
      });
    }

    table.status = 'AVAILABLE';
    table.currentSessionId = null;
    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/tables/${tableId}`).set(table).catch(e => {});
        if (sessionId && data.diningSessions[sessionId]) {
          window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(data.diningSessions[sessionId]).catch(e => {});
        }
        const sessionOrders = Object.values(data.orders || {}).filter(o => o.sessionId === sessionId);
        sessionOrders.forEach(o => {
          window.firebaseDB.ref(`/orders/${o.orderId}`).set(o).catch(e => {});
        });
      } catch(e) {}
    }

    this.notifyListeners();
    return { success: true, sessionId };
  }

  // --- CUSTOMER & DINING SESSIONS ---
  findActiveCustomerSession(mobileNumber) {
    const sessions = Object.values(this.getData().diningSessions || {});
    return sessions.find(s => s.customerMobile === mobileNumber && (s.status === 'ACTIVE' || s.status === 'WAITING_FOR_SETTLEMENT'));
  }

  createDiningSession(tableId, customerName, customerMobile) {
    const data = this.getData();
    const table = data.tables[tableId];

    if (!table || !table.isActive) {
      throw new Error("Table is invalid or inactive.");
    }

    if (table.status !== 'AVAILABLE') {
      throw new Error("This table is currently occupied by another guest.");
    }

    const cleanName = (customerName && customerName.trim()) ? customerName.trim() : "Walk-in Guest";
    const cleanMobile = (customerMobile && customerMobile.trim().length >= 10) 
      ? customerMobile.trim() 
      : ("99999" + Math.floor(10000 + Math.random() * 90000));

    // Only check active duplicate sessions for real non-placeholder mobile numbers
    if (cleanMobile && !cleanMobile.startsWith('99999')) {
      const activeExisting = this.findActiveCustomerSession(cleanMobile);
      if (activeExisting) {
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        const sessionStartTime = activeExisting.startedAt || activeExisting.createdAt || 0;
        const isStale = (Date.now() - sessionStartTime) > SIX_HOURS;

        if (isStale || activeExisting.tableId !== tableId) {
          // Auto-expire stale past session or close previous table session so customer is never locked out
          if (data.diningSessions && data.diningSessions[activeExisting.sessionId]) {
            data.diningSessions[activeExisting.sessionId].status = 'COMPLETED';
            data.diningSessions[activeExisting.sessionId].completedAt = Date.now();
          }
          activeExisting.status = 'COMPLETED';
          activeExisting.completedAt = Date.now();

          if (data.tables[activeExisting.tableId] && data.tables[activeExisting.tableId].currentSessionId === activeExisting.sessionId) {
            data.tables[activeExisting.tableId].status = 'AVAILABLE';
            data.tables[activeExisting.tableId].currentSessionId = null;
            if (window.firebaseDB) {
              window.firebaseDB.ref(`/tables/${activeExisting.tableId}`).set(data.tables[activeExisting.tableId]).catch(e => {});
            }
          }
          if (window.firebaseDB) {
            window.firebaseDB.ref(`/diningSessions/${activeExisting.sessionId}`).set(data.diningSessions[activeExisting.sessionId] || activeExisting).catch(e => {});
          }
        } else if (activeExisting.tableId === tableId) {
          // Reconnect to active session on the same table
          table.status = 'OCCUPIED';
          table.currentSessionId = activeExisting.sessionId;
          this.saveData(data);
          if (window.firebaseDB) {
            window.firebaseDB.ref(`/tables/${tableId}`).set(table).catch(e => {});
          }
          return activeExisting;
        }
      }
    }

    const customerId = 'cust_' + cleanMobile;
    const sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const newSession = {
      sessionId,
      tableId,
      tableNumber: table.tableNumber,
      customerId,
      customerName: cleanName,
      customerMobile: cleanMobile,
      status: 'ACTIVE',
      startedAt: Date.now(),
      completedAt: null
    };

    if (!data.customers) data.customers = {};
    if (!data.diningSessions) data.diningSessions = {};
    if (!data.tables) data.tables = {};

    const existingCust = data.customers[customerId] || {};
    const customerRecord = {
      ...existingCust,
      customerId,
      name: cleanName,
      mobile: cleanMobile,
      createdAt: existingCust.createdAt || Date.now(),
      lastVisit: Date.now()
    };
    data.customers[customerId] = customerRecord;

    data.diningSessions[sessionId] = newSession;
    if (data.tables[tableId]) {
      data.tables[tableId].status = 'OCCUPIED';
      data.tables[tableId].currentSessionId = sessionId;
    }

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(newSession);
        if (data.tables[tableId]) {
          window.firebaseDB.ref(`/tables/${tableId}`).set(data.tables[tableId]);
        }
        window.firebaseDB.ref(`/customers/${customerId}`).set(customerRecord);
      } catch(e) {
        console.warn("Firebase RTDB session push warning:", e);
      }
    }

    return newSession;
  }

  updateSessionCustomer(sessionId, customerName, customerMobile) {
    const data = this.getData();
    if (!data.diningSessions) data.diningSessions = {};
    if (!data.customers) data.customers = {};
    const sess = data.diningSessions[sessionId];
    if (sess) {
      if (customerName && customerName.trim()) sess.customerName = customerName.trim();
      if (customerMobile && customerMobile.trim()) sess.customerMobile = customerMobile.trim();
      
      const custId = sess.customerId;
      if (custId && data.customers[custId]) {
        if (customerName && customerName.trim()) data.customers[custId].name = customerName.trim();
        if (customerMobile && customerMobile.trim()) data.customers[custId].mobile = customerMobile.trim();
      }
      
      this.saveData(data);

      if (window.firebaseDB) {
        try {
          window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(sess);
          if (custId && data.customers[custId]) {
            window.firebaseDB.ref(`/customers/${custId}`).set(data.customers[custId]);
          }
        } catch(e) {}
      }
    }
  }

  getSession(sessionId) {
    return (this.getData().diningSessions || {})[sessionId] || null;
  }

  // --- PRODUCTS ---
  getProducts() {
    return Object.values(this.getData().products || {}).sort((a,b) => a.foodName.localeCompare(b.foodName));
  }

  getCategories() {
    const cats = this.getData().categories;
    if (Array.isArray(cats) && cats.length > 0) return cats;
    return (window.SEED_DATA && window.SEED_DATA.categories) ? window.SEED_DATA.categories : [];
  }

  addCategory(categoryName) {
    const data = this.getData();
    if (!data.categories) data.categories = [];
    if (!data.categories.includes(categoryName)) {
      data.categories.push(categoryName);
      this.saveData(data);
      if (window.firebaseDB) {
        window.firebaseDB.ref('/categories').set(data.categories).catch(e => console.warn(e));
      }
    }
  }

  async saveProduct(prodData) {
    const data = this.getData();
    if (!data.products) data.products = {};
    const productId = prodData.productId || 'prod_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const existing = data.products[productId] || {};
    
    // Normalize image URL: trim, remove accidental consecutive slashes in the path while preserving https://
    let cleanImageUrl = (prodData.imageUrl || '').trim();
    if (cleanImageUrl) {
      cleanImageUrl = cleanImageUrl.replace(/([^:])\/\/+/g, '$1/');
    } else {
      cleanImageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
    }

    const product = {
      ...existing,
      ...prodData,
      productId,
      imageUrl: cleanImageUrl,
      price: parseFloat(prodData.price || 0),
      inventoryQuantity: parseInt(prodData.inventoryQuantity || 0),
      lowStockThreshold: parseInt(prodData.lowStockThreshold || 5),
      updatedAt: Date.now()
    };

    if (!existing.createdAt) product.createdAt = Date.now();

    data.products[productId] = product;
    this.saveData(data);

    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref(`/products/${productId}`).set(product);
      } catch (err) {
        console.warn("Firebase RTDB product push warning:", err);
      }
    }

    this.notifyListeners();
    return product;
  }

  async deleteProduct(productId) {
    if (!productId) return;
    const data = this.getData();
    if (data.products && data.products[productId]) {
      delete data.products[productId];
      this.saveData(data);
    }

    if (window.firebaseDB) {
      try {
        await window.firebaseDB.ref(`/products/${productId}`).remove();
      } catch (err) {
        console.warn("Firebase RTDB product remove warning:", err);
      }
    }

    this.notifyListeners();
  }

  toggleProductAvailability(productId) {
    const data = this.getData();
    if (data.products && data.products[productId]) {
      data.products[productId].isAvailable = !data.products[productId].isAvailable;
      data.products[productId].updatedAt = Date.now();
      this.saveData(data);

      if (window.firebaseDB) {
        try {
          window.firebaseDB.ref(`/products/${productId}`).set(data.products[productId]).catch(err => {
            console.warn("Firebase RTDB product availability sync warning:", err);
          });
        } catch(e) {}
      }

      this.notifyListeners();
      return data.products[productId];
    }
    return null;
  }

  setAllProductsAvailability(isAvailable = true) {
    const data = this.getData();
    if (data.products) {
      Object.keys(data.products).forEach(id => {
        data.products[id].isAvailable = isAvailable;
        data.products[id].updatedAt = Date.now();
        if (window.firebaseDB) {
          try {
            window.firebaseDB.ref(`/products/${id}`).set(data.products[id]).catch(e => {});
          } catch(e) {}
        }
      });
      this.saveData(data);
      this.notifyListeners();
    }
  }

  // --- ORDERS ---
  createOrder(sessionId, items) {
    const data = this.getData();
    const session = data.diningSessions[sessionId];

    if (!session || session.status !== 'ACTIVE') {
      throw new Error("Dining session is not active. Cannot place orders.");
    }

    if (!items || items.length === 0) {
      throw new Error("Cart is empty.");
    }

    // Live out-of-stock guard
    items.forEach(item => {
      const prod = data.products ? data.products[item.productId] : null;
      if (prod && prod.isAvailable === false) {
        throw new Error(`"${item.foodName}" is currently out of stock. Please remove it from your cart.`);
      }
    });

    const business = this.getBusinessProfile();
    const orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    let subtotal = 0;
    const formattedItems = items.map(item => {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        foodName: item.foodName,
        price: item.price,
        quantity: item.quantity,
        subtotal: itemSubtotal
      };
    });

    const gst = Math.round((subtotal * (business.gstPercentage / 100)) * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const newOrder = {
      orderId,
      sessionId,
      tableId: session.tableId,
      tableNumber: session.tableNumber,
      customerId: session.customerId,
      customerName: session.customerName,
      items: formattedItems,
      subtotal,
      gst,
      total,
      status: 'PENDING_MANAGER_APPROVAL',
      createdAt: Date.now()
    };

    data.orders[orderId] = newOrder;
    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/orders/${orderId}`).set(newOrder).catch(e => console.warn(e));
        if (session.tableId && data.tables[session.tableId]) {
          window.firebaseDB.ref(`/tables/${session.tableId}`).set(data.tables[session.tableId]).catch(e => {});
        }
      } catch(e) {}
    }

    return newOrder;
  }

  getOrders(filters = {}) {
    let raw = Object.values(this.getData().orders || {});
    const map = new Map();
    raw.forEach(o => {
      if (!o || !o.orderId) return;
      if (!map.has(o.orderId) || (o.updatedAt || 0) > (map.get(o.orderId).updatedAt || 0)) {
        map.set(o.orderId, o);
      }
    });
    let orders = Array.from(map.values());
    if (filters.sessionId) {
      orders = orders.filter(o => o.sessionId === filters.sessionId);
    }
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    return orders.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  approveOrder(orderId, managerName = 'Cafe Manager') {
    const data = this.getData();
    if (!data.orders) data.orders = {};
    if (!data.kots) data.kots = {};
    if (!data.inventory) data.inventory = {};
    if (!data.inventoryMovements) data.inventoryMovements = {};

    const order = data.orders[orderId];
    if (!order) throw new Error("Order not found.");

    order.status = 'APPROVED';
    order.approvedAt = Date.now();
    order.approvedBy = managerName;

    // Create KOT Ticket automatically
    const kotId = 'kot_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const kotNumber = this._nextDailyCounter('kot'); // e.g. 1, 2, 3 — resets daily
    const kotDisplayNumber = `KOT-${String(kotNumber).padStart(3, '0')}`;
    order.kotId = kotId;
    order.kotNumber = kotNumber;
    const newKot = {
      kotId,
      kotNumber,
      kotDisplayNumber,
      orderId: order.orderId,
      sessionId: order.sessionId,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: order.items,
      status: 'SENT_TO_KITCHEN',
      createdAt: Date.now()
    };
    data.kots[kotId] = newKot;

    // Deduct linked inventory stock if applicable
    order.items.forEach(item => {
      const prod = data.products ? data.products[item.productId] : null;
      if (prod && prod.inventoryLinked && prod.inventoryId && data.inventory && data.inventory[prod.inventoryId]) {
        const inv = data.inventory[prod.inventoryId];
        inv.currentQuantity = Math.max(0, inv.currentQuantity - item.quantity);
        
        const movId = 'mov_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        data.inventoryMovements[movId] = {
          movementId: movId,
          inventoryId: inv.inventoryId,
          type: 'SALE',
          quantity: item.quantity,
          reason: `Auto deduct for Order #${order.orderId.substring(4, 9)}`,
          createdBy: managerName,
          createdAt: Date.now()
        };
      }
    });

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/orders/${orderId}`).set(order).catch(e => {});
        window.firebaseDB.ref(`/kots/${kotId}`).set(newKot).catch(e => {});
      } catch(e) {
        console.warn("Firebase RTDB order approval sync warning:", e);
      }
    }

    return order;
  }

  rejectOrder(orderId, reason = 'Item unavailable', managerName = 'Cafe Manager') {
    const data = this.getData();
    const order = data.orders[orderId];
    if (!order) throw new Error("Order not found.");

    order.status = 'REJECTED';
    order.rejectionReason = reason;
    order.rejectedAt = Date.now();
    order.rejectedBy = managerName;

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/orders/${orderId}`).set(order).catch(e => {});
      } catch(e) {}
    }

    return order;
  }

  updateOrderStatus(orderId, status) {
    const data = this.getData();
    if (data.orders[orderId]) {
      data.orders[orderId].status = status;
      this.saveData(data);

      if (window.firebaseDB) {
        try {
          window.firebaseDB.ref(`/orders/${orderId}`).set(data.orders[orderId]).catch(e => {});
        } catch(e) {}
      }
    }
  }

  // --- KOT STATUS MANAGEMENT ---
  getKOTs(filters = {}) {
    let raw = Object.values(this.getData().kots || {});
    const map = new Map();
    raw.forEach(k => {
      if (!k || !k.kotId) return;
      if (!map.has(k.kotId) || (k.completedAt || 0) > (map.get(k.kotId).completedAt || 0)) {
        map.set(k.kotId, k);
      }
    });
    let kots = Array.from(map.values());
    if (filters.sessionId) {
      kots = kots.filter(k => k.sessionId === filters.sessionId);
    }
    if (filters.status) {
      kots = kots.filter(k => k.status === filters.status);
    }
    return kots.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  updateKOTStatus(kotId, status) {
    const data = this.getData();
    if (data.kots[kotId]) {
      data.kots[kotId].status = status;
      if (status === 'COMPLETED') data.kots[kotId].completedAt = Date.now();
      this.saveData(data);

      if (window.firebaseDB) {
        try {
          window.firebaseDB.ref(`/kots/${kotId}`).set(data.kots[kotId]).catch(e => {});
        } catch(e) {}
      }
    }
  }

  // --- FINAL SETTLEMENT & INVOICING ---
  requestSettlement(sessionId) {
    const data = this.getData();
    const session = data.diningSessions[sessionId];
    if (!session) throw new Error("Session not found.");

    session.status = 'WAITING_FOR_SETTLEMENT';
    if (data.tables[session.tableId]) {
      data.tables[session.tableId].status = 'WAITING_FOR_SETTLEMENT';
    }

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(session).catch(e => {});
        if (session.tableId && data.tables[session.tableId]) {
          window.firebaseDB.ref(`/tables/${session.tableId}`).set(data.tables[session.tableId]).catch(e => {});
        }
      } catch(e) {}
    }

    return session;
  }

  rejectSettlement(sessionId, reason = 'Rejected by manager', managerName = 'Manager') {
    const data = this.getData();
    const session = (data.diningSessions || {})[sessionId];
    if (!session) throw new Error("Session not found.");
    if (session.status !== 'WAITING_FOR_SETTLEMENT') throw new Error("Session is not awaiting settlement.");

    // Revert session back to ACTIVE
    session.status = 'ACTIVE';
    session.settlementRejectedAt = Date.now();
    session.settlementRejectionReason = reason;
    session.settlementRejectedBy = managerName;

    // Revert table back to OCCUPIED
    if (data.tables && data.tables[session.tableId]) {
      data.tables[session.tableId].status = 'OCCUPIED';
    }

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(session).catch(e => {});
        if (session.tableId && data.tables && data.tables[session.tableId]) {
          window.firebaseDB.ref(`/tables/${session.tableId}`).set(data.tables[session.tableId]).catch(e => {});
        }
      } catch(e) {}
    }

    return session;
  }

  confirmSettlement(sessionId, paymentMode = 'Cash', discount = 0, managerName = 'Manager') {
    const data = this.getData();
    if (!data.diningSessions) data.diningSessions = {};
    if (!data.orders) data.orders = {};
    if (!data.kots) data.kots = {};
    if (!data.invoices) data.invoices = {};
    if (!data.payments) data.payments = {};
    if (!data.tables) data.tables = {};

    const session = data.diningSessions[sessionId];
    if (!session) throw new Error("Session not found.");

    // ACID Guard & Idempotency: Check if an invoice was already generated for this session
    const existingInvoice = Object.values(data.invoices || {}).find(i => i.sessionId === sessionId);
    if (existingInvoice) {
      return existingInvoice;
    }

    if (session.status === 'COMPLETED') {
      throw new Error("This dining session has already been settled and closed.");
    }

    const approvedOrders = Object.values(data.orders || {})
      .filter(o => o.sessionId === sessionId && (o.status === 'APPROVED' || o.status === 'PREPARING' || o.status === 'READY' || o.status === 'SERVED'));

    if (approvedOrders.length === 0) {
      throw new Error("No approved orders found to settle.");
    }

    const business = this.getBusinessProfile();
    let subtotal = 0;

    // Consolidate items: group same food+price to avoid duplicate line entries
    const itemMap = {};
    approvedOrders.forEach(ord => {
      ord.items.forEach(it => {
        subtotal += it.subtotal;
        const key = `${it.productId || it.foodName}_${it.price}`;
        if (!itemMap[key]) {
          itemMap[key] = { ...it, quantity: 0, subtotal: 0 };
        }
        itemMap[key].quantity += it.quantity;
        itemMap[key].subtotal += it.subtotal;
      });
      ord.status = 'COMPLETED';
    });
    const consolidatedItems = Object.values(itemMap);

    const discountVal = parseFloat(discount || 0);
    const taxableAmount = Math.max(0, subtotal - discountVal);
    const gstVal = Math.round((taxableAmount * (business.gstPercentage / 100)) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + gstVal) * 100) / 100;

    // Generate human-readable daily bill number (BILL-001, BILL-002 … resets each day)
    const billNumber = this._nextDailyCounter('bill');
    const billDisplayNumber = `${business.invoicePrefix || 'BILL-'}${String(billNumber).padStart(3, '0')}`;
    const invoiceId = 'inv_' + Date.now().toString(36);

    const invoice = {
      invoiceId,
      billNumber,
      billDisplayNumber,
      sessionId,
      customerId: session.customerId,
      customerName: session.customerName,
      customerMobile: session.customerMobile,
      tableNumber: session.tableNumber,
      items: consolidatedItems,
      subtotal,
      discount: discountVal,
      gst: gstVal,
      total: grandTotal,
      paymentStatus: 'PAID',
      paymentMode,
      businessSnapshot: { ...business },
      createdAt: Date.now(),
      processedBy: managerName
    };

    data.invoices[invoiceId] = invoice;

    // Record Payment Entry
    const paymentId = 'pay_' + Date.now().toString(36);
    data.payments[paymentId] = {
      paymentId,
      invoiceId,
      sessionId,
      amount: grandTotal,
      paymentMode,
      status: 'PAID',
      paidAt: Date.now(),
      processedBy: managerName
    };

    // Update ALL linked KOT tickets for this session to COMPLETED
    const linkedKots = [];
    Object.values(data.kots || {}).forEach(kot => {
      if (kot.sessionId === sessionId) {
        kot.status = 'COMPLETED';
        kot.completedAt = Date.now();
        linkedKots.push(kot);
      }
    });

    // Release Table
    session.status = 'COMPLETED';
    session.completedAt = Date.now();

    if (data.tables[session.tableId]) {
      data.tables[session.tableId].status = 'AVAILABLE';
      data.tables[session.tableId].currentSessionId = null;
    }

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        window.firebaseDB.ref(`/invoices/${invoiceId}`).set(invoice);
        window.firebaseDB.ref(`/payments/${paymentId}`).set(data.payments[paymentId]);
        window.firebaseDB.ref(`/diningSessions/${sessionId}`).set(session);
        if (data.tables[session.tableId]) {
          window.firebaseDB.ref(`/tables/${session.tableId}`).set(data.tables[session.tableId]);
        }
        approvedOrders.forEach(ord => {
          window.firebaseDB.ref(`/orders/${ord.orderId}`).set(ord).catch(e => {});
        });
        linkedKots.forEach(kot => {
          window.firebaseDB.ref(`/kots/${kot.kotId}`).set(kot).catch(e => {});
        });
      } catch(e) {
        console.warn("Firebase RTDB settlement sync warning:", e);
      }
    }

    return invoice;
  }

  getInvoices() {
    const raw = Object.values(this.getData().invoices || {});
    // Enterprise Deduplication:
    // Ensure 1 authentic invoice per session, filter out corrupt/incomplete records
    const map = new Map();
    raw.forEach(inv => {
      if (!inv || !inv.invoiceId || typeof inv.total !== 'number' || isNaN(inv.total)) return;
      const key = inv.sessionId || inv.invoiceId;
      if (!map.has(key)) {
        map.set(key, inv);
      } else {
        const existing = map.get(key);
        // Retain the newer or more complete record
        if ((inv.createdAt || 0) > (existing.createdAt || 0)) {
          map.set(key, inv);
        }
      }
    });
    return Array.from(map.values()).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // --- INVENTORY ---
  getInventory() {
    return Object.values(this.getData().inventory || {}).sort((a,b) => a.itemName.localeCompare(b.itemName));
  }

  async saveInventoryItem(itemData) {
    const data = this.getData();
    if (!data.inventory) data.inventory = {};
    const inventoryId = itemData.inventoryId || 'inv_' + Date.now().toString(36);
    const existing = data.inventory[inventoryId] || {};
    const item = {
      ...existing,
      ...itemData,
      inventoryId,
      currentQuantity: parseFloat(itemData.currentQuantity !== undefined ? itemData.currentQuantity : 0),
      minimumQuantity: parseFloat(itemData.minimumQuantity !== undefined ? itemData.minimumQuantity : 5),
      purchasePrice: parseFloat(itemData.purchasePrice !== undefined ? itemData.purchasePrice : 0),
      updatedAt: Date.now()
    };
    data.inventory[inventoryId] = item;
    this.saveData(data);

    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref(`/inventory/${inventoryId}`).set(item);
      } catch (err) {
        console.warn("Firebase RTDB inventory push note:", err);
      }
    }

    this.notifyListeners();
    return item;
  }

  async deleteInventoryItem(inventoryId) {
    const data = this.getData();
    if (data.inventory && data.inventory[inventoryId]) {
      delete data.inventory[inventoryId];
      this.saveData(data);
    }

    if (window.firebaseDB) {
      try {
        await window.firebaseDB.ref(`/inventory/${inventoryId}`).remove();
      } catch (err) {
        console.warn("Firebase RTDB inventory delete note:", err);
      }
    }

    this.notifyListeners();
  }

  async logStockMovement(inventoryId, type, quantity, reason, user = 'Super Admin') {
    const data = this.getData();
    if (!data.inventory) data.inventory = {};
    if (!data.inventoryMovements) data.inventoryMovements = {};

    const inv = data.inventory[inventoryId];
    if (!inv) throw new Error("Inventory item not found.");

    const qty = parseFloat(quantity || 0);
    if (type === 'PURCHASE' || type === 'RETURN' || type === 'ADJUSTMENT') {
      inv.currentQuantity = Math.round((inv.currentQuantity + qty) * 100) / 100;
    } else {
      inv.currentQuantity = Math.max(0, Math.round((inv.currentQuantity - qty) * 100) / 100);
    }
    inv.updatedAt = Date.now();

    const movementId = 'mov_' + Date.now().toString(36);
    const movement = {
      movementId,
      inventoryId,
      itemName: inv.itemName,
      unit: inv.unit || 'units',
      type,
      quantity: qty,
      reason: reason || 'Stock adjustment',
      createdBy: user || 'Super Admin',
      createdAt: Date.now()
    };
    data.inventoryMovements[movementId] = movement;

    this.saveData(data);

    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref(`/inventory/${inventoryId}`).set(inv);
        await window.firebaseDB.ref(`/inventoryMovements/${movementId}`).set(movement);
      } catch (err) {
        console.warn("Firebase RTDB stock movement push note:", err);
      }
    }

    this.notifyListeners();
    return movement;
  }

  getInventoryMovements() {
    return Object.values(this.getData().inventoryMovements || {}).sort((a,b) => b.createdAt - a.createdAt);
  }

  // --- EXPENSES & CAPITAL ---
  getExpenses() {
    const raw = Object.values(this.getData().expenses || {});
    const map = new Map();
    raw.forEach(e => {
      if (!e || !e.expenseId) return;
      if (!map.has(e.expenseId)) {
        map.set(e.expenseId, e);
      }
    });
    return Array.from(map.values()).sort((a,b) => {
      const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
      return timeB - timeA;
    });
  }

  async addExpense(expData) {
    const data = this.getData();
    if (!data.expenses) data.expenses = {};
    const expenseId = 'exp_' + Date.now().toString(36);
    const expenseTime = expData.date ? new Date(expData.date + 'T00:00:00').getTime() : Date.now();
    const expense = {
      expenseId,
      ...expData,
      amount: parseFloat(expData.amount || 0),
      createdAt: expenseTime
    };
    data.expenses[expenseId] = expense;
    this.saveData(data);

    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref(`/expenses/${expenseId}`).set(expense);
      } catch (err) {
        console.warn("Firebase RTDB expense push warning:", err);
      }
    }

    this.notifyListeners();
    return expense;
  }

  async deleteExpense(expenseId) {
    const data = this.getData();
    if (data.expenses && data.expenses[expenseId]) {
      delete data.expenses[expenseId];
      this.saveData(data);
    }

    if (window.firebaseDB) {
      try {
        await window.firebaseDB.ref(`/expenses/${expenseId}`).remove();
      } catch (err) {
        console.warn("Firebase RTDB expense remove warning:", err);
      }
    }

    this.notifyListeners();
  }

  getCapital() {
    return Object.values(this.getData().capital || {}).sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  async saveCapital(capData) {
    const data = this.getData();
    if (!data.capital) data.capital = {};
    const capitalId = capData.capitalId || ('cap_' + Date.now().toString(36));
    const existing = data.capital[capitalId] || {};
    const item = {
      ...existing,
      ...capData,
      capitalId,
      amount: parseFloat(capData.amount || 0),
      updatedAt: Date.now()
    };
    if (!item.createdAt) item.createdAt = Date.now();
    data.capital[capitalId] = item;
    this.saveData(data);

    if (window.firebaseDB) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }
        await window.firebaseDB.ref(`/capital/${capitalId}`).set(item);
      } catch (err) {
        console.warn("Firebase RTDB capital push warning:", err);
      }
    }

    this.notifyListeners();
    return item;
  }

  async addCapital(capData) {
    return this.saveCapital(capData);
  }

  async deleteCapital(capitalId) {
    if (!capitalId) return;
    const data = this.getData();
    if (data.capital && data.capital[capitalId]) {
      delete data.capital[capitalId];
      this.saveData(data);
    }

    if (window.firebaseDB) {
      try {
        await window.firebaseDB.ref(`/capital/${capitalId}`).remove();
      } catch (err) {
        console.warn("Firebase RTDB capital remove warning:", err);
      }
    }

    this.notifyListeners();
  }

  // --- MANAGERS ---
  getManagers() {
    return Object.values(this.getData().managers || {});
  }

  saveManager(mgrData) {
    const data = this.getData();
    if (!data.managers) data.managers = {};
    const managerId = mgrData.managerId || 'mgr_' + Date.now().toString(36);
    const mgr = {
      ...data.managers[managerId],
      ...mgrData,
      managerId,
      role: 'cafe_manager',
      isActive: mgrData.isActive !== undefined ? mgrData.isActive : true,
      createdAt: data.managers[managerId]?.createdAt || Date.now()
    };
    data.managers[managerId] = mgr;
    this.saveData(data);
    if (window.firebaseDB) {
      window.firebaseDB.ref(`/managers/${managerId}`).set(mgr).catch(e => console.warn(e));
    }
    return mgr;
  }

  deleteManager(managerId) {
    const data = this.getData();
    if (data.managers && data.managers[managerId]) {
      delete data.managers[managerId];
      this.saveData(data);
    }
    if (window.firebaseDB) {
      window.firebaseDB.ref(`/managers/${managerId}`).remove().catch(e => console.warn(e));
    }
    return true;
  }

  // --- INVENTORY REQUESTS ---
  getInventoryRequests() {
    return Object.values(this.getData().inventoryRequests || {}).sort((a,b) => b.createdAt - a.createdAt);
  }

  createInventoryRequest(reqData) {
    const data = this.getData();
    const requestId = 'req_' + Date.now().toString(36);
    const req = {
      requestId,
      ...reqData,
      requestedQuantity: parseInt(reqData.requestedQuantity || 1),
      status: 'PENDING',
      createdAt: Date.now()
    };
    data.inventoryRequests[requestId] = req;
    this.saveData(data);
    return req;
  }

  updateInventoryRequestStatus(requestId, status) {
    const data = this.getData();
    if (data.inventoryRequests[requestId]) {
      data.inventoryRequests[requestId].status = status;
      this.saveData(data);
    }
  }
}

window.dbService = new DBService();
