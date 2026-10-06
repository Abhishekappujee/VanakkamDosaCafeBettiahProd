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
      window.SEED_DATA.products.forEach(p => initialData.products[p.productId] = p);
      window.SEED_DATA.inventory.forEach(i => initialData.inventory[i.inventoryId] = i);
      window.SEED_DATA.capital.forEach(c => initialData.capital[c.capitalId] = c);
      window.SEED_DATA.expenses.forEach(e => initialData.expenses[e.expenseId] = e);
      window.SEED_DATA.managers.forEach(m => initialData.managers[m.managerId] = m);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
    }
  }

  initFirebaseSync() {
    const setupListeners = () => {
      if (window.firebaseDB) {
        window.firebaseDB.ref('/').on('value', (snapshot) => {
          const val = snapshot.val();
          if (val) {
            this.isRemoteUpdate = true;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(val));
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
          console.warn("Firebase RTDB sync listener notice:", error);
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
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
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

  updateBusinessProfile(profile) {
    const data = this.getData();
    data.businessProfile = { ...data.businessProfile, ...profile, updatedAt: Date.now() };
    this.saveData(data);
    return data.businessProfile;
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
        throw new Error(`Mobile number ${cleanMobile} already has an active dining session at ${activeExisting.tableNumber}.`);
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

    data.customers[customerId] = {
      customerId,
      name: cleanName,
      mobile: cleanMobile,
      createdAt: data.customers[customerId]?.createdAt || Date.now(),
      lastVisit: Date.now()
    };

    data.diningSessions[sessionId] = newSession;
    data.tables[tableId].status = 'OCCUPIED';
    data.tables[tableId].currentSessionId = sessionId;

    this.saveData(data);
    return newSession;
  }

  updateSessionCustomer(sessionId, customerName, customerMobile) {
    const data = this.getData();
    const sess = data.diningSessions[sessionId];
    if (sess) {
      if (customerName && customerName.trim()) sess.customerName = customerName.trim();
      if (customerMobile && customerMobile.trim()) sess.customerMobile = customerMobile.trim();
      
      const custId = sess.customerId;
      if (data.customers[custId]) {
        if (customerName && customerName.trim()) data.customers[custId].name = customerName.trim();
        if (customerMobile && customerMobile.trim()) data.customers[custId].mobile = customerMobile.trim();
      }
      
      this.saveData(data);
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

  saveProduct(prodData) {
    const data = this.getData();
    const productId = prodData.productId || 'prod_' + Date.now().toString(36);
    const existing = data.products[productId] || {};
    
    const product = {
      ...existing,
      ...prodData,
      productId,
      price: parseFloat(prodData.price || 0),
      inventoryQuantity: parseInt(prodData.inventoryQuantity || 0),
      lowStockThreshold: parseInt(prodData.lowStockThreshold || 5),
      updatedAt: Date.now()
    };

    if (!existing.createdAt) product.createdAt = Date.now();

    data.products[productId] = product;
    this.saveData(data);
    return product;
  }

  deleteProduct(productId) {
    const data = this.getData();
    delete data.products[productId];
    this.saveData(data);
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
    const orderId = 'ord_' + Date.now().toString(36);

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
    const order = data.orders[orderId];
    if (!order) throw new Error("Order not found.");

    order.status = 'APPROVED';
    order.approvedAt = Date.now();
    order.approvedBy = managerName;

    // Create KOT Ticket automatically
    const kotId = 'kot_' + Date.now().toString(36);
    order.kotId = kotId;
    data.kots[kotId] = {
      kotId,
      orderId: order.orderId,
      sessionId: order.sessionId,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: order.items,
      status: 'SENT_TO_KITCHEN',
      createdAt: Date.now()
    };

    // Deduct linked inventory stock if applicable
    order.items.forEach(item => {
      const prod = data.products[item.productId];
      if (prod && prod.inventoryLinked && prod.inventoryId && data.inventory[prod.inventoryId]) {
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
    return invoice;
  }

  getInvoices() {
    return Object.values(this.getData().invoices || {}).sort((a,b) => b.createdAt - a.createdAt);
  }

  // --- INVENTORY ---
  getInventory() {
    return Object.values(this.getData().inventory || {}).sort((a,b) => a.itemName.localeCompare(b.itemName));
  }

  saveInventoryItem(itemData) {
    const data = this.getData();
    const inventoryId = itemData.inventoryId || 'inv_' + Date.now().toString(36);
    const item = {
      ...data.inventory[inventoryId],
      ...itemData,
      inventoryId,
      currentQuantity: parseInt(itemData.currentQuantity || 0),
      minimumQuantity: parseInt(itemData.minimumQuantity || 5),
      purchasePrice: parseFloat(itemData.purchasePrice || 0),
      updatedAt: Date.now()
    };
    data.inventory[inventoryId] = item;
    this.saveData(data);
    return item;
  }

  deleteInventoryItem(inventoryId) {
    const data = this.getData();
    delete data.inventory[inventoryId];
    this.saveData(data);
  }

  logStockMovement(inventoryId, type, quantity, reason, user = 'Admin') {
    const data = this.getData();
    const inv = data.inventory[inventoryId];
    if (!inv) throw new Error("Inventory item not found.");

    const qty = parseInt(quantity);
    if (type === 'PURCHASE' || type === 'RETURN' || type === 'ADJUSTMENT') {
      inv.currentQuantity += qty;
    } else {
      inv.currentQuantity = Math.max(0, inv.currentQuantity - qty);
    }

    const movementId = 'mov_' + Date.now().toString(36);
    data.inventoryMovements[movementId] = {
      movementId,
      inventoryId,
      itemName: inv.itemName,
      type,
      quantity: qty,
      reason,
      createdBy: user,
      createdAt: Date.now()
    };

    this.saveData(data);
  }

  getInventoryMovements() {
    return Object.values(this.getData().inventoryMovements || {}).sort((a,b) => b.createdAt - a.createdAt);
  }

  // --- EXPENSES & CAPITAL ---
  getExpenses() {
    return Object.values(this.getData().expenses || {}).sort((a,b) => b.createdAt - a.createdAt);
  }

  addExpense(expData) {
    const data = this.getData();
    const expenseId = 'exp_' + Date.now().toString(36);
    const expense = {
      expenseId,
      ...expData,
      amount: parseFloat(expData.amount || 0),
      createdAt: Date.now()
    };
    data.expenses[expenseId] = expense;
    this.saveData(data);
    return expense;
  }

  deleteExpense(expenseId) {
    const data = this.getData();
    delete data.expenses[expenseId];
    this.saveData(data);
  }

  getCapital() {
    return Object.values(this.getData().capital || {}).sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  addCapital(capData) {
    const data = this.getData();
    const capitalId = 'cap_' + Date.now().toString(36);
    const item = {
      capitalId,
      ...capData,
      amount: parseFloat(capData.amount || 0),
      createdAt: Date.now()
    };
    data.capital[capitalId] = item;
    this.saveData(data);
    return item;
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
