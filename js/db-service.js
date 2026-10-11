/**
 * Database Service Layer - Firebase Realtime DB & Robust Local Data Engine
 */

class DBService {
  constructor() {
    this.STORAGE_KEY = 'AG_RESTAURANT_POS_DATA_V1';
    this.listeners = {};
    this.isRemoteUpdate = false;
    this.initLocalStorage();
    this.initFirebaseSync();
  }

  initLocalStorage() {
    let data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      const initialData = {
        businessProfile: window.SEED_DATA.businessProfile,
        landingConfig: window.SEED_DATA.landingConfig,
        categories: window.SEED_DATA.categories,
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
        inventoryRequests: {}
      };

      window.SEED_DATA.tables.forEach(t => initialData.tables[t.tableId] = t);
      (window.SEED_DATA.products || []).forEach(p => initialData.products[p.productId] = p);
      (window.SEED_DATA.inventory || []).forEach(i => initialData.inventory[i.inventoryId] = i);
      (window.SEED_DATA.capital || []).forEach(c => initialData.capital[c.capitalId] = c);
      (window.SEED_DATA.expenses || []).forEach(e => initialData.expenses[e.expenseId] = e);
      (window.SEED_DATA.managers || []).forEach(m => initialData.managers[m.managerId] = m);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
    } else {
      // Purge legacy dummy seed objects if present in existing local storage
      try {
        const parsed = JSON.parse(data);
        if (parsed) {
          let updated = false;

          // Purge demo managers
          if (parsed.managers) {
            Object.keys(parsed.managers).forEach(id => {
              const m = parsed.managers[id];
              if (id === 'mgr_01' || (m && (m.email === 'manager@vanakkamcafe.com' || m.email === 'manager@abhijeetcafe.com' || m.email === 'manager@restaurant.com'))) {
                delete parsed.managers[id];
                updated = true;
              }
            });
          }

          // Purge legacy dummy products
          if (parsed.products) {
            const dummyProdIds = ['prod_01', 'prod_02', 'prod_03', 'prod_04', 'prod_05', 'prod_06', 'prod_07', 'prod_08', 'prod_09'];
            dummyProdIds.forEach(id => {
              if (parsed.products[id]) {
                delete parsed.products[id];
                updated = true;
              }
            });
          }

          // Purge legacy dummy inventory
          if (parsed.inventory) {
            const dummyInvIds = ['inv_paneer', 'inv_chicken', 'inv_rice', 'inv_coffee'];
            dummyInvIds.forEach(id => {
              if (parsed.inventory[id]) {
                delete parsed.inventory[id];
                updated = true;
              }
            });
          }

          // Purge legacy dummy capital & expenses
          if (parsed.capital && parsed.capital['cap_01']) {
            delete parsed.capital['cap_01'];
            updated = true;
          }
          if (parsed.expenses) {
            ['exp_01', 'exp_02', 'exp_03'].forEach(id => {
              if (parsed.expenses[id]) {
                delete parsed.expenses[id];
                updated = true;
              }
            });
          }

          if (updated) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
          }
        }
      } catch (e) {
        console.error("Migration error:", e);
      }
    }
  }

  initFirebaseSync() {
    const setupListeners = async () => {
      if (window.firebaseDB) {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.signInAnonymously(); } catch(e) {}
        }

        // Root database listener
        window.firebaseDB.ref('/').on('value', (snapshot) => {
          const val = snapshot.val();
          if (val) {
            this.isRemoteUpdate = true;
            const current = this.getData();
            const merged = {
              ...current,
              ...val,
              tables: { ...(current.tables || {}), ...(val.tables || {}) },
              diningSessions: { ...(current.diningSessions || {}), ...(val.diningSessions || {}) },
              customers: { ...(current.customers || {}), ...(val.customers || {}) },
              orders: { ...(current.orders || {}), ...(val.orders || {}) },
              kots: { ...(current.kots || {}), ...(val.kots || {}) },
              invoices: { ...(current.invoices || {}), ...(val.invoices || {}) },
              payments: { ...(current.payments || {}), ...(val.payments || {}) },
              products: { ...(current.products || {}), ...(val.products || {}) },
              inventory: { ...(current.inventory || {}), ...(val.inventory || {}) },
              inventoryMovements: { ...(current.inventoryMovements || {}), ...(val.inventoryMovements || {}) },
              expenses: { ...(current.expenses || {}), ...(val.expenses || {}) },
              capital: { ...(current.capital || {}), ...(val.capital || {}) },
              managers: { ...(current.managers || {}), ...(val.managers || {}) }
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          } else {
            // Database is empty, seed initial data to Firebase
            const localData = this.getData();
            window.firebaseDB.ref('/').set(localData).catch(err => {
              console.warn("Initial Firebase seed push note:", err);
            });
          }
        }, (error) => {
          console.warn("Firebase RTDB root sync listener notice:", error);
        });

        // Dedicated Landing Page Config Listener for Public Pages
        window.firebaseDB.ref('/landingConfig').on('value', (snapshot) => {
          const landingData = snapshot.val();
          if (landingData) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.landingConfig = { ...window.SEED_DATA.landingConfig, ...currentData.landingConfig, ...landingData };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB landingConfig listener notice:", error);
        });

        // Dedicated Business Profile Listener
        window.firebaseDB.ref('/businessProfile').on('value', (snapshot) => {
          const bizData = snapshot.val();
          if (bizData) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.businessProfile = { ...window.SEED_DATA.businessProfile, ...currentData.businessProfile, ...bizData };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB businessProfile listener notice:", error);
        });

        // Dedicated Expenses Listener
        window.firebaseDB.ref('/expenses').on('value', (snapshot) => {
          const expData = snapshot.val();
          if (expData !== undefined) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.expenses = expData || {};
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB expenses listener notice:", error);
        });

        // Dedicated Capital Listener
        window.firebaseDB.ref('/capital').on('value', (snapshot) => {
          const capData = snapshot.val();
          if (capData !== undefined) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.capital = capData || {};
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB capital listener notice:", error);
        });

        // Dedicated Inventory Listener
        window.firebaseDB.ref('/inventory').on('value', (snapshot) => {
          const invData = snapshot.val();
          if (invData !== null) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.inventory = invData || {};
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB inventory listener notice:", error);
        });

        // Dedicated Inventory Movements Listener
        window.firebaseDB.ref('/inventoryMovements').on('value', (snapshot) => {
          const movData = snapshot.val();
          if (movData !== null) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.inventoryMovements = movData || {};
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB inventoryMovements listener notice:", error);
        });

        // Dedicated Products Listener
        window.firebaseDB.ref('/products').on('value', (snapshot) => {
          const prodsData = snapshot.val();
          if (prodsData !== undefined) {
            this.isRemoteUpdate = true;
            const currentData = this.getData();
            currentData.products = prodsData || {};
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentData));
            this.notifyListeners();
            this.isRemoteUpdate = false;
          }
        }, (error) => {
          console.warn("Firebase RTDB products listener notice:", error);
        });
      }
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
      
      // Auto-heal: Ensure all standard collections exist to guarantee safe indexed access
      if (!parsed.businessProfile) parsed.businessProfile = (window.SEED_DATA && window.SEED_DATA.businessProfile) ? { ...window.SEED_DATA.businessProfile } : {};
      if (!parsed.landingConfig) parsed.landingConfig = (window.SEED_DATA && window.SEED_DATA.landingConfig) ? { ...window.SEED_DATA.landingConfig } : {};
      if (!parsed.tables) parsed.tables = {};
      if (!parsed.diningSessions) parsed.diningSessions = {};
      if (!parsed.customers) parsed.customers = {};
      if (!parsed.products) parsed.products = {};
      if (!parsed.categories) parsed.categories = (window.SEED_DATA && window.SEED_DATA.categories) ? [ ...window.SEED_DATA.categories ] : [];
      if (!parsed.orders) parsed.orders = {};
      if (!parsed.kots) parsed.kots = {};
      if (!parsed.invoices) parsed.invoices = {};
      if (!parsed.payments) parsed.payments = {};
      if (!parsed.inventory) parsed.inventory = {};
      if (!parsed.inventoryMovements) parsed.inventoryMovements = {};
      if (!parsed.expenses) parsed.expenses = {};
      if (!parsed.capital) parsed.capital = {};
      if (!parsed.managers) parsed.managers = {};
      if (!parsed.inventoryRequests) parsed.inventoryRequests = {};

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
    return this.getData().businessProfile || window.SEED_DATA.businessProfile;
  }

  async updateBusinessProfile(profile) {
    const data = this.getData();
    const updatedProfile = { ...window.SEED_DATA.businessProfile, ...data.businessProfile, ...profile, updatedAt: Date.now() };
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
    const stored = this.getData().landingConfig || {};
    return { ...window.SEED_DATA.landingConfig, ...stored };
  }

  async saveLandingPageConfig(configData) {
    const data = this.getData();
    const updatedConfig = { ...window.SEED_DATA.landingConfig, ...data.landingConfig, ...configData, updatedAt: Date.now() };
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
    return Object.values(tablesObj).sort((a,b) => a.tableNumber.localeCompare(b.tableNumber));
  }

  getTable(tableId) {
    return (this.getData().tables || {})[tableId] || null;
  }

  addTable(tableNumber) {
    const data = this.getData();
    const tableId = 'tbl_' + Date.now().toString(36);
    const newTable = {
      tableId,
      tableNumber,
      status: 'AVAILABLE',
      isActive: true,
      currentSessionId: null
    };
    data.tables[tableId] = newTable;
    this.saveData(data);
    return newTable;
  }

  updateTable(tableId, updates) {
    const data = this.getData();
    if (data.tables[tableId]) {
      data.tables[tableId] = { ...data.tables[tableId], ...updates };
      this.saveData(data);
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
  }

  freeTable(tableId) {
    const data = this.getData();
    const table = data.tables[tableId];
    if (table) {
      if (table.currentSessionId && data.diningSessions[table.currentSessionId]) {
        data.diningSessions[table.currentSessionId].status = 'COMPLETED';
        data.diningSessions[table.currentSessionId].completedAt = Date.now();
      }
      table.status = 'AVAILABLE';
      table.currentSessionId = null;
      this.saveData(data);
    }
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
        if (activeExisting.tableId === tableId) {
          // Reconnect to active session on the same table
          table.status = 'OCCUPIED';
          table.currentSessionId = activeExisting.sessionId;
          this.saveData(data);
          return activeExisting;
        } else {
          throw new Error(`Mobile number ${cleanMobile} already has an active dining session at ${activeExisting.tableNumber}.`);
        }
      }
    }

    const customerId = 'cust_' + cleanMobile;
    const sessionId = 'sess_' + Date.now().toString(36);

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
    return this.getData().categories || window.SEED_DATA.categories;
  }

  addCategory(categoryName) {
    const data = this.getData();
    if (!data.categories.includes(categoryName)) {
      data.categories.push(categoryName);
      this.saveData(data);
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
    return newOrder;
  }

  getOrders(filters = {}) {
    let orders = Object.values(this.getData().orders || {});
    if (filters.sessionId) {
      orders = orders.filter(o => o.sessionId === filters.sessionId);
    }
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    return orders.sort((a,b) => b.createdAt - a.createdAt);
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
    const kotId = 'kot_' + Date.now().toString(36);
    order.kotId = kotId;
    const newKot = {
      kotId,
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
        
        const movId = 'mov_' + Date.now().toString(36);
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
        window.firebaseDB.ref(`/orders/${orderId}`).set(order);
        window.firebaseDB.ref(`/kots/${kotId}`).set(newKot);
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
    return order;
  }

  updateOrderStatus(orderId, status) {
    const data = this.getData();
    if (data.orders[orderId]) {
      data.orders[orderId].status = status;
      this.saveData(data);
    }
  }

  // --- KOT STATUS MANAGEMENT ---
  getKOTs(filters = {}) {
    let kots = Object.values(this.getData().kots || {});
    if (filters.sessionId) {
      kots = kots.filter(k => k.sessionId === filters.sessionId);
    }
    if (filters.status) {
      kots = kots.filter(k => k.status === filters.status);
    }
    return kots.sort((a,b) => b.createdAt - a.createdAt);
  }

  updateKOTStatus(kotId, status) {
    const data = this.getData();
    if (data.kots[kotId]) {
      data.kots[kotId].status = status;
      if (status === 'COMPLETED') data.kots[kotId].completedAt = Date.now();
      this.saveData(data);
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

    const approvedOrders = Object.values(data.orders || {})
      .filter(o => o.sessionId === sessionId && o.status === 'APPROVED');

    if (approvedOrders.length === 0) {
      throw new Error("No approved orders found to settle.");
    }

    const business = this.getBusinessProfile();
    let subtotal = 0;
    const consolidatedItems = [];

    approvedOrders.forEach(ord => {
      ord.items.forEach(it => {
        subtotal += it.subtotal;
        consolidatedItems.push(it);
      });
      ord.status = 'COMPLETED';
    });

    const discountVal = parseFloat(discount || 0);
    const taxableAmount = Math.max(0, subtotal - discountVal);
    const gstVal = Math.round((taxableAmount * (business.gstPercentage / 100)) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + gstVal) * 100) / 100;

    const invoiceId = business.invoicePrefix + Date.now().toString().substring(6);

    const invoice = {
      invoiceId,
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
    Object.values(data.kots || {}).forEach(kot => {
      if (kot.sessionId === sessionId) {
        kot.status = 'COMPLETED';
        kot.completedAt = Date.now();
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
      } catch(e) {
        console.warn("Firebase RTDB settlement sync warning:", e);
      }
    }

    return invoice;
  }

  getInvoices() {
    return Object.values(this.getData().invoices || {}).sort((a,b) => b.createdAt - a.createdAt);
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
    return Object.values(this.getData().expenses || {}).sort((a,b) => b.createdAt - a.createdAt);
  }

  async addExpense(expData) {
    const data = this.getData();
    if (!data.expenses) data.expenses = {};
    const expenseId = 'exp_' + Date.now().toString(36);
    const expense = {
      expenseId,
      ...expData,
      amount: parseFloat(expData.amount || 0),
      createdAt: Date.now()
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
    return mgr;
  }

  deleteManager(managerId) {
    const data = this.getData();
    if (data.managers && data.managers[managerId]) {
      delete data.managers[managerId];
      this.saveData(data);
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
