/**
 * Customer QR Ordering Application Controller
 * Hardened for Zero Customer-End Glitches, Cold-Start Resilience & Seamless Mobile UX
 */

class CustomerApp {
  constructor() {
    this.tableId = null;
    this.table = null;
    this.session = null;
    this.cart = [];
    this.activeCategory = 'ALL';
    this.activeTab = 'menu';
    this.isSubmittingOrder = false;
    this.isSubmittingSettlement = false;
    this.isSubmittingRegistration = false;
    this.isTablesLoaded = false;
    this._occupiedPollInterval = null;

    this.init();
  }

  init() {
    const params = new URLSearchParams(window.location.search);
    this.tableId = params.get('table') || 'tbl_01';

    this.showConnectingState("Connecting to Cafe Menu...", "Detecting your table...");
    this.updateBusinessHeader();

    // Check if tables already present in local cache
    const existingTables = window.dbService.getTables();
    if (existingTables && existingTables.length > 0) {
      this.isTablesLoaded = true;
      this.loadTableAndSession();
    }

    // Subscribe to tables to handle cold starts when Firebase loads asynchronously
    window.dbService.subscribe('tables', (tablesData) => {
      const tablesList = Array.isArray(tablesData) ? tablesData : Object.values(tablesData || {});
      if (tablesList.length > 0) {
        this.isTablesLoaded = true;
        this.loadTableAndSession();
      }
    });

    // Fallback timer if network is exceptionally slow or tables are empty
    setTimeout(() => {
      if (!this.table) {
        this.loadTableAndSession(true);
      }
    }, 4500);

    // Subscribe to all real-time events
    window.dbService.subscribe('diningSessions', () => this.onRealtimeUpdate());
    window.dbService.subscribe('orders', () => this.onRealtimeUpdate());
    window.dbService.subscribe('invoices', () => this.onRealtimeUpdate());
    window.dbService.subscribe('products', () => this.onRealtimeUpdate());
    window.dbService.subscribe('businessProfile', () => this.updateBusinessHeader());
  }

  showConnectingState(title = "Connecting to Cafe Menu...", subtitle = "Detecting your table...") {
    const screen = document.getElementById('customer-connecting-screen');
    if (!screen) return;
    const titleEl = document.getElementById('connecting-title');
    const subEl = document.getElementById('connecting-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    screen.style.display = 'flex';
    screen.style.opacity = '1';
  }

  hideConnectingState() {
    const screen = document.getElementById('customer-connecting-screen');
    if (!screen) return;
    screen.style.opacity = '0';
    setTimeout(() => {
      screen.style.display = 'none';
    }, 350);
  }

  showLoginScreen() {
    if (this._occupiedPollInterval) {
      clearInterval(this._occupiedPollInterval);
      this._occupiedPollInterval = null;
    }
    const loginScreen = document.getElementById('customer-login-screen');
    const mainContent = document.getElementById('customer-main-content');
    const bottomNav = document.getElementById('customer-bottom-nav');
    const occupiedScreen = document.getElementById('customer-occupied-screen');

    if (occupiedScreen) occupiedScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';

    if (loginScreen) {
      loginScreen.style.display = 'flex';
      const tblNameEl = document.getElementById('login-table-name');
      const badgeEl = document.getElementById('login-table-badge');
      if (tblNameEl && this.table) tblNameEl.textContent = this.table.tableNumber;
      if (badgeEl && this.table) {
        badgeEl.textContent = '🟢 Ready & Available';
        badgeEl.className = 'badge badge-success';
      }
      const nameInput = document.getElementById('reg-name');
      const mobileInput = document.getElementById('reg-mobile');
      if (nameInput) nameInput.value = '';
      if (mobileInput) mobileInput.value = '';
    }
  }

  showMainApp() {
    if (this._occupiedPollInterval) {
      clearInterval(this._occupiedPollInterval);
      this._occupiedPollInterval = null;
    }
    const loginScreen = document.getElementById('customer-login-screen');
    const mainContent = document.getElementById('customer-main-content');
    const bottomNav = document.getElementById('customer-bottom-nav');
    const occupiedScreen = document.getElementById('customer-occupied-screen');

    if (occupiedScreen) occupiedScreen.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (bottomNav) bottomNav.style.display = 'flex';
  }

  showOccupiedScreen(table) {
    const loginScreen = document.getElementById('customer-login-screen');
    const mainContent = document.getElementById('customer-main-content');
    const bottomNav = document.getElementById('customer-bottom-nav');
    const occupiedScreen = document.getElementById('customer-occupied-screen');

    if (loginScreen) loginScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';

    if (occupiedScreen) {
      occupiedScreen.style.display = 'flex';
      const nameEl = document.getElementById('occupied-table-name');
      if (nameEl && table) {
        nameEl.textContent = table.tableNumber || 'This table';
      }
    }

    if (this._occupiedPollInterval) clearInterval(this._occupiedPollInterval);
    this._occupiedPollInterval = setInterval(() => {
      this.checkTableAvailability(true);
    }, 8000);
  }

  checkTableAvailability(silent = false) {
    const freshTable = window.dbService.getTable(this.tableId);
    if (!freshTable) return;

    let isNowAvailable = freshTable.status === 'AVAILABLE';
    if (!isNowAvailable && freshTable.currentSessionId) {
      const sess = window.dbService.getSession(freshTable.currentSessionId);
      if (!sess || sess.status === 'COMPLETED' || sess.status === 'FORCE_FREED') {
        window.dbService.updateTable(freshTable.tableId, { status: 'AVAILABLE', currentSessionId: null });
        isNowAvailable = true;
      }
    }

    if (isNowAvailable) {
      if (this._occupiedPollInterval) {
        clearInterval(this._occupiedPollInterval);
        this._occupiedPollInterval = null;
      }
      this.table = window.dbService.getTable(this.tableId);
      window.showToast("Table is now available! Welcome.", "success", 3000);
      this.showLoginScreen();
    } else {
      if (!silent) {
        window.showToast("Table is still occupied by another guest. Please wait a moment.", "info", 3000);
      }
      const txt = document.getElementById('occupied-poll-text');
      if (txt) txt.textContent = `Last checked: ${new Date().toLocaleTimeString()} — Retrying...`;
    }
  }

  updateBusinessHeader() {
    const business = window.dbService.getBusinessProfile();
    const headerName = document.getElementById('header-business-name');
    if (headerName && business.businessName) {
      headerName.textContent = business.businessName;
    }
    const loginBrand = document.getElementById('login-brand-name');
    if (loginBrand && business.businessName) {
      loginBrand.textContent = business.businessName;
    }
    if (business.businessName) {
      document.title = `${business.businessName} | QR Table Menu`;
    }
  }

  updateCustomerProfileUI() {
    const customerUser = window.authService.getCurrentCustomerUser();
    const chip = document.getElementById('customer-profile-chip');
    const chipName = document.getElementById('chip-customer-name');

    if (this.session && customerUser && customerUser.name) {
      if (chip) chip.style.display = 'inline-flex';
      if (chipName) chipName.textContent = `${customerUser.name}`;
    } else {
      if (chip) chip.style.display = 'none';
    }
  }

  loadTableAndSession(isTimeoutFallback = false) {
    if (this.isSubmittingRegistration) {
      return;
    }

    const allTables = window.dbService.getTables().filter(t => t.isActive);

    // If tables haven't arrived yet and timeout has not fired, wait for subscription
    if (allTables.length === 0 && !isTimeoutFallback) {
      return;
    }

    this.table = window.dbService.getTable(this.tableId);

    // If table param was empty or default 'tbl_01' not found, pick first active table
    if (!this.table || !this.table.isActive) {
      const requestedParam = new URLSearchParams(window.location.search).get('table');
      if (allTables.length > 0 && (!requestedParam || this.tableId === 'tbl_01')) {
        this.table = allTables[0];
        this.tableId = this.table.tableId;
      }
    }

    if (!this.table || !this.table.isActive) {
      if (allTables.length > 0) {
        this.table = allTables[0];
        this.tableId = this.table.tableId;
      } else {
        if (isTimeoutFallback) {
          this.hideConnectingState();
          this.renderErrorState("Unable to Connect to Table", "Could not connect to the restaurant table database. Please verify your internet connection or ask restaurant staff.");
        }
        return;
      }
    }

    // Table is identified and ready
    this.hideConnectingState();

    const headerTbl = document.getElementById('header-table-name');
    if (headerTbl) headerTbl.textContent = this.table.tableNumber;

    // If already in an active session (e.g. browsing menu/cart), keep dining
    if (this.session && (this.session.status === 'ACTIVE' || this.session.status === 'WAITING_FOR_SETTLEMENT')) {
      this.showMainApp();
      return;
    }

    const customerUser = window.authService.getCurrentCustomerUser();

    // ── CASE 1: Table is OCCUPIED or WAITING FOR SETTLEMENT ───────────────────
    if (this.table.status === 'OCCUPIED' || this.table.status === 'WAITING_FOR_SETTLEMENT') {
      const existingSession = this.table.currentSessionId
        ? window.dbService.getSession(this.table.currentSessionId)
        : null;

      // Auto-heal orphaned or finished session so new guests are never falsely locked out
      if (!existingSession || existingSession.status === 'COMPLETED' || existingSession.status === 'FORCE_FREED') {
        window.dbService.updateTable(this.table.tableId, { status: 'AVAILABLE', currentSessionId: null });
        this.table.status = 'AVAILABLE';
        this.table.currentSessionId = null;
        this.session = null;
        this.updateCustomerProfileUI();
        this.showLoginScreen();
        return;
      }

      // Check if current browser owns this active session (reconnecting/refreshing page while eating)
      const isCurrentCustomer = customerUser &&
        (customerUser.sessionId === existingSession.sessionId || (customerUser.mobile && customerUser.mobile === existingSession.customerMobile));

      if (isCurrentCustomer) {
        this.session = existingSession;
        this.updateCustomerProfileUI();
        this.showMainApp();
        this.loadCartFromStorage();
        this.renderApp();
        return;
      } else {
        // Table is occupied by another guest — show occupied state without return home button
        this.session = null;
        this.hideConnectingState();
        this.showOccupiedScreen(this.table);
        return;
      }
    }

    // ── CASE 2: Table is AVAILABLE ────────────────────────────────────────────
    // Table is 100% available and unreserved.
    // DO NOT mark table as OCCUPIED on scan!
    // Show the dedicated Guest Sign-In Page for this table.
    // Table is ONLY occupied once user submits their Name & Mobile number.
    this.session = null;
    this.updateCustomerProfileUI();
    this.showLoginScreen();
  }

  logoutCustomer() {
    if (confirm("Are you sure you want to log out? Your saved profile will be closed on this browser.")) {
      window.authService.logoutCustomer();
      this.session = null;
      this.cart = [];
      this.updateCustomerProfileUI();
      this.showLoginScreen();
      window.showToast("Logged out successfully.", "info");
    }
  }

  submitRegistration(e) {
    e.preventDefault();
    if (this.isSubmittingRegistration) return;
    this.isSubmittingRegistration = true;

    const nameInput = document.getElementById('reg-name');
    const mobileInput = document.getElementById('reg-mobile');

    const name = (nameInput ? nameInput.value : '').trim();
    let mobile = (mobileInput ? mobileInput.value : '').trim();

    if (!name) {
      window.showToast("Please enter your full name", "warning");
      this.isSubmittingRegistration = false;
      return;
    }

    // Mobile Number Normalization
    // Strip non-digits (spaces, dashes, parens, country prefix)
    mobile = mobile.replace(/\D/g, '');

    // Strip leading 91 if 12 digits
    if (mobile.length === 12 && mobile.startsWith('91')) {
      mobile = mobile.substring(2);
    }
    // Strip leading 0 if 11 digits
    if (mobile.length === 11 && mobile.startsWith('0')) {
      mobile = mobile.substring(1);
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      window.showToast("Please enter a valid 10-digit Indian mobile number", "warning");
      this.isSubmittingRegistration = false;
      return;
    }

    try {
      // Re-fetch latest table state from DB to prevent race conditions
      this.table = window.dbService.getTable(this.tableId);
      if (!this.table || !this.table.isActive) {
        throw new Error("Table could not be detected. Please reload or select your table.");
      }

      let newSession = null;

      if (this.table.status === 'AVAILABLE') {
        // NOW occupy the table of this QR code and create active session
        newSession = window.dbService.createDiningSession(this.tableId, name, mobile);
      } else if (this.table.status === 'OCCUPIED' || this.table.status === 'WAITING_FOR_SETTLEMENT') {
        // Table is occupied — check if it's this same customer rejoining their own session
        const existingSession = this.table.currentSessionId
          ? window.dbService.getSession(this.table.currentSessionId)
          : null;

        if (existingSession && existingSession.customerMobile === mobile && existingSession.status !== 'COMPLETED' && existingSession.status !== 'FORCE_FREED') {
          newSession = existingSession;
        } else if (!existingSession || existingSession.status === 'COMPLETED' || existingSession.status === 'FORCE_FREED') {
          // Stale past session on table: auto-heal and create fresh session
          window.dbService.updateTable(this.tableId, { status: 'AVAILABLE', currentSessionId: null });
          newSession = window.dbService.createDiningSession(this.tableId, name, mobile);
        } else {
          const tableDisplay = this.table.tableNumber || 'This table';
          window.showToast(`${tableDisplay} was just occupied by another guest. Please wait or contact staff.`, "warning", 6000);
          this.showOccupiedScreen(this.table);
          return;
        }
      } else {
        newSession = window.dbService.createDiningSession(this.tableId, name, mobile);
      }

      this.session = newSession;

      // Save customer session in authService
      window.authService.setCustomerSession({
        customerId: newSession.customerId,
        name,
        mobile,
        sessionId: newSession.sessionId,
        tableId: this.tableId,
        tableNumber: this.table.tableNumber
      });

      this.updateCustomerProfileUI();

      // Transition from login screen to main dining app
      this.showMainApp();

      window.showToast(`Welcome, ${name}! ${this.table.tableNumber} is now reserved for you.`, "success");

      this.loadCartFromStorage();
      this.renderApp();
    } catch(err) {
      window.showToast(err.message, "danger");
    } finally {
      this.isSubmittingRegistration = false;
    }
  }

  renderApp() {
    this.switchTab(this.activeTab);
  }

  loadCartFromStorage() {
    if (!this.session) return;
    try {
      const saved = localStorage.getItem(`AG_CART_${this.session.sessionId}`);
      this.cart = saved ? JSON.parse(saved) : [];
    } catch(e) {
      this.cart = [];
    }
    this.updateCartBadge();
  }

  saveCartToStorage() {
    if (!this.session) return;
    localStorage.setItem(`AG_CART_${this.session.sessionId}`, JSON.stringify(this.cart));
    this.updateCartBadge();
  }

  updateCartBadge() {
    const totalQty = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-badge');
    if (badge) {
      badge.textContent = totalQty;
      badge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    const floatingBtn = document.getElementById('floating-view-cart-btn');
    if (floatingBtn) {
      floatingBtn.style.display = (totalQty > 0 && this.activeTab === 'menu') ? 'flex' : 'none';
      const countEl = document.getElementById('floating-cart-count');
      if (countEl) countEl.textContent = `${totalQty} Items`;
      
      let cartSubtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalEl = document.getElementById('floating-cart-total');
      if (totalEl) totalEl.textContent = window.formatCurrency(cartSubtotal);
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const activeNav = document.getElementById(`nav-${tabName}`);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.tab-view').forEach(view => view.style.display = 'none');
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) targetView.style.display = 'block';

    this.updateCartBadge();

    if (tabName === 'menu') this.renderMenu();
    if (tabName === 'cart') this.renderCart();
    if (tabName === 'orders') this.renderOrders();
    if (tabName === 'bill') this.renderBill();
  }

  renderMenu() {
    const allProducts = window.dbService.getProducts();
    const availableProducts = allProducts.filter(p => p.isAvailable);

    const categories = ['ALL', ...window.dbService.getCategories()];
    const categoryContainer = document.getElementById('category-pill-container');
    
    if (categoryContainer) {
      categoryContainer.innerHTML = categories.map(cat => `
        <button class="category-pill ${this.activeCategory === cat ? 'active' : ''}" 
                onclick="customerApp.filterCategory('${cat}')">
          ${cat}
        </button>
      `).join('');
    }

    const filtered = this.activeCategory === 'ALL' 
      ? availableProducts 
      : availableProducts.filter(p => p.category === this.activeCategory);

    const grid = document.getElementById('food-grid-container');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="text-center text-muted" style="grid-column: 1/-1; padding: 3rem;">No food items currently available in this category.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(prod => {
      const cartItem = this.cart.find(c => c.productId === prod.productId);
      const qty = cartItem ? cartItem.quantity : 0;
      const safeImg = prod.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';

      return `
        <div class="food-card">
          <div class="food-card-img-wrapper">
            <img src="${safeImg}" alt="${prod.foodName}" class="food-card-img" 
                 onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';">
            <span class="badge badge-info food-card-badge">${prod.category}</span>
          </div>
          <div class="food-card-body">
            <div>
              <div class="food-card-title">${prod.foodName}</div>
              <div class="text-xs text-muted" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prod.description || ''}</div>
            </div>
            <div class="food-card-footer">
              <div class="food-card-price">${window.formatCurrency(prod.price)}</div>
              ${qty > 0 ? `
                <div class="qty-control">
                  <button class="qty-btn" onclick="customerApp.updateQuantity('${prod.productId}', -1)">-</button>
                  <span class="qty-val">${qty}</span>
                  <button class="qty-btn" onclick="customerApp.updateQuantity('${prod.productId}', 1)">+</button>
                </div>
              ` : `
                <button class="btn btn-primary btn-sm" onclick="customerApp.addToCart('${prod.productId}')">
                  + Add
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  filterCategory(category) {
    this.activeCategory = category;
    this.renderMenu();
  }

  addToCart(productId) {
    const prod = window.dbService.getProducts().find(p => p.productId === productId);
    if (!prod || !prod.isAvailable) {
      window.showToast("Item is currently out of stock", "warning");
      return;
    }

    const existing = this.cart.find(c => c.productId === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        productId: prod.productId,
        foodName: prod.foodName,
        price: prod.price,
        imageUrl: prod.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
        quantity: 1
      });
    }

    this.saveCartToStorage();
    this.renderMenu();
    window.showToast(`Added ${prod.foodName} to cart`, "success");
  }

  updateQuantity(productId, delta) {
    const index = this.cart.findIndex(c => c.productId === productId);
    if (index > -1) {
      this.cart[index].quantity += delta;
      if (this.cart[index].quantity <= 0) {
        this.cart.splice(index, 1);
      }
    }
    this.saveCartToStorage();
    if (this.activeTab === 'menu') this.renderMenu();
    if (this.activeTab === 'cart') this.renderCart();
  }

  renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    const footer = document.getElementById('cart-summary-footer');

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="text-center" style="padding: 3rem 1rem;">
          <div style="font-size: 3rem;">🛒</div>
          <h3 style="margin-top: 1rem;">Your Cart is Empty</h3>
          <p class="text-muted text-sm">Add delicious items from the menu to start your order.</p>
          <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="customerApp.switchTab('menu')">Browse Menu</button>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';

    const allProducts = window.dbService.getProducts();
    let hasUnavailableItems = false;

    container.innerHTML = this.cart.map(item => {
      const prod = allProducts.find(p => p.productId === item.productId);
      const isUnavailable = !prod || prod.isAvailable === false;
      if (isUnavailable) hasUnavailableItems = true;

      return `
        <div class="cart-item-row" style="${isUnavailable ? 'border: 1px solid var(--color-danger); background: rgba(239, 68, 68, 0.05);' : ''}">
          <div style="display: flex; align-items: center; gap: 0.875rem;">
            <img src="${item.imageUrl}" style="width: 50px; height: 50px; border-radius: var(--radius-sm); object-fit: cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';">
            <div>
              <div class="font-semibold">${item.foodName}</div>
              <div class="text-sm text-accent">${window.formatCurrency(item.price)} each</div>
              ${isUnavailable ? `<div class="badge badge-danger text-xs" style="margin-top: 4px;">Out of Stock</div>` : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="qty-control">
              <button class="qty-btn" onclick="customerApp.updateQuantity('${item.productId}', -1)">-</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" ${isUnavailable ? 'disabled style="opacity:0.5;"' : ''} onclick="customerApp.updateQuantity('${item.productId}', 1)">+</button>
            </div>
            <div class="font-bold" style="min-width: 60px; text-align: right;">
              ${window.formatCurrency(item.price * item.quantity)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const business = window.dbService.getBusinessProfile();
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const gstRate = (business && typeof business.gstPercentage === 'number') ? business.gstPercentage : 5;
    const gst = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const subEl = document.getElementById('cart-subtotal-val'); if (subEl) subEl.textContent = window.formatCurrency(subtotal);
    const gstEl = document.getElementById('cart-gst-val'); if (gstEl) gstEl.textContent = `${window.formatCurrency(gst)} (${gstRate}%)`;
    const totEl = document.getElementById('cart-total-val'); if (totEl) totEl.textContent = window.formatCurrency(total);

    const placeBtn = document.getElementById('place-order-btn');
    if (placeBtn) {
      if (hasUnavailableItems) {
        placeBtn.disabled = true;
        placeBtn.className = "btn btn-secondary w-full btn-lg";
        placeBtn.innerHTML = `⚠️ Remove Out of Stock Items to Order`;
      } else {
        placeBtn.disabled = false;
        placeBtn.className = "btn btn-primary w-full btn-lg";
        placeBtn.textContent = `Place Order • ${window.formatCurrency(total)}`;
      }
    }
  }

  placeOrder() {
    if (this.isSubmittingOrder) return;
    if (this.cart.length === 0) {
      window.showToast("Your cart is empty!", "warning");
      return;
    }

    // Live out-of-stock validation before submitting
    const allProducts = window.dbService.getProducts();
    const unavailable = this.cart.find(it => {
      const p = allProducts.find(prod => prod.productId === it.productId);
      return !p || p.isAvailable === false;
    });
    if (unavailable) {
      window.showToast(`"${unavailable.foodName}" is currently out of stock. Please remove it from your cart.`, "warning", 5000);
      this.renderCart();
      return;
    }

    // Attempt session recovery if table is available and customer is logged in
    const customerUser = window.authService.getCurrentCustomerUser();
    if ((!this.session || this.session.status !== 'ACTIVE') && this.table && this.table.status === 'AVAILABLE' && customerUser) {
      try {
        this.session = window.dbService.createDiningSession(this.tableId, customerUser.name, customerUser.mobile);
      } catch(e) {
        console.warn("Session auto-healing failed:", e);
      }
    }

    if (!this.session || this.session.status !== 'ACTIVE') {
      if (this.session && this.session.status === 'WAITING_FOR_SETTLEMENT') {
        window.showToast("Bill settlement is pending for your table. Additional orders cannot be placed until settlement is finished.", "warning", 5000);
      } else {
        window.showToast("Your dining session has ended. Please register or start a new dining session for your table.", "warning", 5000);
        this.showRegistrationModal();
      }
      return;
    }

    this.isSubmittingOrder = true;
    const btn = document.getElementById('place-order-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending to Cafe Kitchen...";
    }

    try {
      const order = window.dbService.createOrder(this.session.sessionId, this.cart);
      
      this.cart = [];
      this.saveCartToStorage();

      if (window.playNotificationChime) {
        window.playNotificationChime('success');
      }
      
      window.showToast("Order submitted! Sent to cafe manager for approval.", "success", 4000);
      this.switchTab('orders');
    } catch(err) {
      window.showToast(err.message, "danger");
    } finally {
      this.isSubmittingOrder = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Place Order";
      }
    }
  }

  renderOrders() {
    if (!this.session) return;
    const orders = window.dbService.getOrders({ sessionId: this.session.sessionId });
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 3rem;">
          <div style="font-size: 3rem;">📋</div>
          <h3>No Orders Placed Yet</h3>
          <p class="text-sm">Once you place an order, its kitchen approval status will update here live.</p>
        </div>
      `;
      return;
    }

    const getStepState = (stepIndex, status) => {
      const levels = { 'PENDING': 1, 'APPROVED': 2, 'SENT_TO_KITCHEN': 2, 'PREPARING': 2, 'READY': 3, 'SERVED': 4, 'COMPLETED': 4 };
      const current = levels[status] || 1;
      if (stepIndex < current) return 'completed';
      if (stepIndex === current) return 'active';
      return '';
    };

    container.innerHTML = orders.map(ord => {
      let badgeClass = 'badge-warning';
      let statusText = 'Pending Approval';

      if (ord.status === 'APPROVED') { badgeClass = 'badge-info'; statusText = 'Approved by Manager'; }
      if (ord.status === 'SENT_TO_KITCHEN') { badgeClass = 'badge-info'; statusText = 'Sent to Kitchen'; }
      if (ord.status === 'PREPARING') { badgeClass = 'badge-warning'; statusText = 'Cooking in Kitchen'; }
      if (ord.status === 'READY') { badgeClass = 'badge-success'; statusText = 'Food Ready!'; }
      if (ord.status === 'SERVED') { badgeClass = 'badge-success'; statusText = 'Served on Table'; }
      if (ord.status === 'REJECTED') { badgeClass = 'badge-danger'; statusText = 'Rejected'; }

      return `
        <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1rem;">
          <div class="flex justify-between items-center" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <span class="font-bold">Order #${ord.orderId.substring(4, 9).toUpperCase()}</span>
              <span class="text-xs text-muted" style="margin-left: 0.5rem;">${window.formatDateTime(ord.createdAt)}</span>
            </div>
            <span class="badge ${badgeClass}">${statusText}</span>
          </div>

          ${ord.status === 'REJECTED' ? `
            <div class="text-danger text-xs font-semibold" style="margin-bottom: 0.5rem;">
              Reason: ${ord.rejectionReason || 'Item currently out of stock'}
            </div>
          ` : `
            <div class="order-stepper-wrapper">
              <div class="order-stepper">
                <div class="step-node ${getStepState(1, ord.status)}">
                  <div class="step-icon">🕒</div>
                  <div class="step-label">Received</div>
                </div>
                <div class="step-node ${getStepState(2, ord.status)}">
                  <div class="step-icon">👨‍🍳</div>
                  <div class="step-label">Cooking</div>
                </div>
                <div class="step-node ${getStepState(3, ord.status)}">
                  <div class="step-icon">🔔</div>
                  <div class="step-label">Ready</div>
                </div>
                <div class="step-node ${getStepState(4, ord.status)}">
                  <div class="step-icon">🍽️</div>
                  <div class="step-label">Served</div>
                </div>
              </div>
            </div>
          `}

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${ord.items.map(it => `
              <div class="flex justify-between text-sm">
                <span>${it.quantity} × ${it.foodName}</span>
                <span class="font-semibold">${window.formatCurrency(it.subtotal)}</span>
              </div>
            `).join('')}
          </div>

          <div class="flex justify-between items-center" style="border-top: 1px dashed var(--border-color); margin-top: 0.75rem; padding-top: 0.75rem; font-weight: 700;">
            <span>Total Amount</span>
            <span class="text-accent">${window.formatCurrency(ord.total)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderBill() {
    this.renderRunningBill();
    this.renderPastBills();
  }

  renderRunningBill() {
    const container = document.getElementById('running-bill-container');
    if (!container) return;

    if (!this.session) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">Scan a table QR code or register to view running bill.</div>`;
      return;
    }

    const orders = window.dbService.getOrders({ sessionId: this.session.sessionId })
      .filter(o => o.status === 'APPROVED' || o.status === 'SENT_TO_KITCHEN' || o.status === 'PREPARING' || o.status === 'READY' || o.status === 'SERVED' || o.status === 'COMPLETED');

    const invoices = window.dbService.getInvoices().filter(i => i.sessionId === this.session.sessionId);
    const finalInvoice = invoices.length > 0 ? invoices[0] : null;

    if (finalInvoice) {
      container.innerHTML = `
        <div class="glass-card" style="padding: 1.5rem; text-align: center; margin-bottom: 1.5rem; border-color: var(--color-success);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
          <h3 class="font-bold text-xl text-success" style="margin-bottom: 0.25rem;">Final Bill Settled</h3>
          <p class="text-secondary text-sm">Thank you for dining with us! Bill: <strong>${finalInvoice.billDisplayNumber || finalInvoice.invoiceId}</strong></p>
        </div>

        <div class="receipt-paper printable-area" style="background: #ffffff; color: #000000; padding: 1rem; border-radius: var(--radius-md);">
          <div class="receipt-header">
            ${finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.logo ? `
              <div class="receipt-logo-wrapper">
                <img src="${finalInvoice.businessSnapshot.logo}" class="receipt-logo" onerror="this.style.display='none'">
              </div>
            ` : ''}
            <div class="receipt-title">${(finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.businessName) || 'Cafe Restaurant'}</div>
            <div class="receipt-subtext">${(finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.address) || ''}</div>
            <div class="receipt-subtext">GSTIN: <strong>${(finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.gstNumber) || 'N/A'}</strong></div>
            <div class="receipt-subtext">Ph: ${(finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.phone) || ''}</div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-meta-grid">
            <div class="receipt-meta-row"><span>BILL #:</span><strong>${finalInvoice.billDisplayNumber || finalInvoice.invoiceId}</strong></div>
            <div class="receipt-meta-row"><span>DATE & TIME:</span><strong>${window.formatDateTime(finalInvoice.createdAt)}</strong></div>
            <div class="receipt-meta-row"><span>TABLE NUMBER:</span><strong>${finalInvoice.tableNumber}</strong></div>
            <div class="receipt-meta-row"><span>GUEST NAME:</span><strong>${finalInvoice.customerName} (${finalInvoice.customerMobile})</strong></div>
          </div>

          <div class="receipt-divider"></div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 45%;">ITEM</th>
                <th style="text-align: center; width: 15%;">QTY</th>
                <th style="text-align: center; width: 20%;">RATE</th>
                <th style="text-align: right; width: 20%;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${(finalInvoice.items || []).map(it => `
                <tr>
                  <td style="text-align: left; font-weight: 600;">${it.foodName}</td>
                  <td style="text-align: center; font-weight: 700;">${it.quantity}</td>
                  <td style="text-align: center;">${window.formatCurrency(it.price)}</td>
                  <td style="text-align: right; font-weight: 700;">${window.formatCurrency(it.subtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="receipt-divider"></div>

          <div class="receipt-totals-container">
            <div class="receipt-total-row"><span>Subtotal Amount:</span><span>${window.formatCurrency(finalInvoice.subtotal)}</span></div>
            ${finalInvoice.discount > 0 ? `<div class="receipt-total-row" style="color: #dc2626;"><span>Discount Applied:</span><span>-${window.formatCurrency(finalInvoice.discount)}</span></div>` : ''}
            <div class="receipt-total-row"><span>GST (${(finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.gstPercentage) || 5}%):</span><span>${window.formatCurrency(finalInvoice.gst)}</span></div>
            
            <div class="receipt-grand-total">
              <span>GRAND TOTAL</span>
              <span>${window.formatCurrency(finalInvoice.total)}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-footer">
            <div style="font-weight: 700; margin-bottom: 4px;">Payment Mode: ${(finalInvoice.paymentMode || 'CASH').toUpperCase()} (${finalInvoice.paymentStatus || 'PAID'})</div>
            <div style="font-size: 11px; font-style: italic;">${(finalInvoice.businessSnapshot && finalInvoice.businessSnapshot.invoiceFooter) || 'Thank you for dining with us!'}</div>
          </div>
        </div>

        <div class="text-center" style="margin-top: 1.5rem;">
          <button class="btn btn-primary" onclick="customerApp.printInvoiceModal('${finalInvoice.invoiceId}', true)">🖨️ Print / Save Final Tax Invoice</button>
        </div>
      `;
      return;
    }

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 2.5rem 1rem;">
          <div style="font-size: 3rem;">🧾</div>
          <h3>No Running Bill Yet</h3>
          <p class="text-sm">Items from approved orders will accumulate here in your running bill.</p>
        </div>
      `;
      return;
    }

    const business = window.dbService.getBusinessProfile();
    let runningSubtotal = 0;
    const allApprovedItems = [];

    orders.forEach(ord => {
      ord.items.forEach(it => {
        runningSubtotal += it.subtotal;
        allApprovedItems.push(it);
      });
    });

    const gstRate = (business && typeof business.gstPercentage === 'number') ? business.gstPercentage : 5;
    const runningGst = Math.round((runningSubtotal * (gstRate / 100)) * 100) / 100;
    const runningGrandTotal = Math.round((runningSubtotal + runningGst) * 100) / 100;

    const isWaitingSettlement = this.session.status === 'WAITING_FOR_SETTLEMENT';

    container.innerHTML = `
      <div class="glass-card" style="padding: 1.5rem;">
        <h3 class="font-bold text-lg" style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
          Running Bill Summary (${this.session.tableNumber})
        </h3>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem;">
          ${allApprovedItems.map(it => `
            <div class="flex justify-between text-sm">
              <span>${it.quantity} × ${it.foodName}</span>
              <span class="font-semibold">${window.formatCurrency(it.subtotal)}</span>
            </div>
          `).join('')}
        </div>

        <div style="border-top: 1px dashed var(--border-color); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
          <div class="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>${window.formatCurrency(runningSubtotal)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span>GST (${gstRate}%)</span>
            <span>${window.formatCurrency(runningGst)}</span>
          </div>
          <div class="flex justify-between items-center text-lg font-bold" style="border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.35rem;">
            <span>Estimated Total</span>
            <span class="text-accent">${window.formatCurrency(runningGrandTotal)}</span>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          ${isWaitingSettlement ? `
            <div class="badge badge-warning w-full flex justify-center" style="padding: 0.875rem; font-size: 0.95rem;">
              ⏳ Settlement Requested - Waiting for Manager Confirmation
            </div>
          ` : runningGrandTotal <= 0 ? `
            <div class="badge badge-secondary w-full flex justify-center" style="padding: 0.875rem; font-size: 0.875rem;">
              ℹ️ No chargeable items yet — add orders to request settlement
            </div>
          ` : `
            <button class="btn btn-warning w-full btn-lg" onclick="customerApp.requestFinalSettlement()">
              💳 Request Final Settlement
            </button>
          `}
        </div>
      </div>
    `;
  }

  renderPastBills() {
    const pastContainer = document.getElementById('past-bills-container');
    if (!pastContainer) return;

    const customerUser = window.authService.getCurrentCustomerUser();
    if (!customerUser || !customerUser.mobile) {
      pastContainer.innerHTML = `<div class="text-center text-muted" style="padding: 1.5rem;">Please register with your mobile number to view past bill history.</div>`;
      return;
    }

    const allInvoices = window.dbService.getInvoices() || [];
    const pastInvoices = allInvoices.filter(inv => inv.customerMobile === customerUser.mobile)
      .sort((a,b) => b.createdAt - a.createdAt);

    if (pastInvoices.length === 0) {
      pastContainer.innerHTML = `
        <div class="glass-card text-center text-muted" style="padding: 2rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🧾</div>
          <h4>No Past Invoices Found</h4>
          <p class="text-xs text-secondary" style="margin-top: 0.25rem;">Invoices billed for mobile <strong>${customerUser.mobile}</strong> will be saved here.</p>
        </div>
      `;
      return;
    }

    pastContainer.innerHTML = pastInvoices.map(inv => `
      <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1rem;">
        <div class="flex justify-between items-center" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
          <div>
            <span class="font-bold text-accent">${inv.billDisplayNumber || inv.invoiceId}</span>
            <span class="text-xs text-secondary" style="margin-left: 0.5rem;">${window.formatDateTime(inv.createdAt)}</span>
          </div>
          <span class="badge badge-success">PAID (${inv.paymentMode})</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem;">
          ${inv.items.map(it => `
            <div class="flex justify-between text-xs">
              <span>${it.quantity} × ${it.foodName}</span>
              <span class="font-semibold">${window.formatCurrency(it.subtotal)}</span>
            </div>
          `).join('')}
        </div>

        <div class="flex justify-between items-center" style="border-top: 1px dashed var(--border-color); padding-top: 0.5rem;">
          <div class="font-bold text-sm">Total Paid: <span class="text-accent">${window.formatCurrency(inv.total)}</span></div>
          <button class="btn btn-secondary btn-sm" onclick="customerApp.printInvoiceModal('${inv.invoiceId}', true)">
            🖨️ View / Print Thermal Bill
          </button>
        </div>
      </div>
    `).join('');
  }

  printInvoiceModal(invoiceId, autoPrint = false) {
    const invoice = (window.dbService.getInvoices() || []).find(i => i.invoiceId === invoiceId);
    if (!invoice) {
      window.showToast("Invoice details not found.", "warning");
      return;
    }

    const modal = document.getElementById('customer-invoice-modal');
    const container = document.getElementById('customer-invoice-area');

    if (container) {
      container.innerHTML = `
        <div class="receipt-paper printable-area">
          <div class="receipt-header">
            ${invoice.businessSnapshot && invoice.businessSnapshot.logo ? `
              <div class="receipt-logo-wrapper">
                <img src="${invoice.businessSnapshot.logo}" class="receipt-logo" onerror="this.style.display='none'">
              </div>
            ` : ''}
            <div class="receipt-title">${(invoice.businessSnapshot && invoice.businessSnapshot.businessName) || 'Cafe Restaurant'}</div>
            <div class="receipt-subtext">${(invoice.businessSnapshot && invoice.businessSnapshot.address) || ''}</div>
            <div class="receipt-subtext">GSTIN: <strong>${(invoice.businessSnapshot && invoice.businessSnapshot.gstNumber) || 'N/A'}</strong></div>
            <div class="receipt-subtext">Ph: ${(invoice.businessSnapshot && invoice.businessSnapshot.phone) || ''}</div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-meta-grid">
            <div class="receipt-meta-row"><span>TAX INVOICE #:</span><strong>${invoice.invoiceId}</strong></div>
            <div class="receipt-meta-row"><span>DATE & TIME:</span><strong>${window.formatDateTime(invoice.createdAt)}</strong></div>
            <div class="receipt-meta-row"><span>TABLE NUMBER:</span><strong>${invoice.tableNumber}</strong></div>
            <div class="receipt-meta-row"><span>GUEST NAME:</span><strong>${invoice.customerName} (${invoice.customerMobile})</strong></div>
          </div>

          <div class="receipt-divider"></div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 45%;">ITEM</th>
                <th style="text-align: center; width: 15%;">QTY</th>
                <th style="text-align: center; width: 20%;">RATE</th>
                <th style="text-align: right; width: 20%;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map(it => `
                <tr>
                  <td style="text-align: left; font-weight: 600;">${it.foodName}</td>
                  <td style="text-align: center; font-weight: 700;">${it.quantity}</td>
                  <td style="text-align: center;">${window.formatCurrency(it.price)}</td>
                  <td style="text-align: right; font-weight: 700;">${window.formatCurrency(it.subtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="receipt-divider"></div>

          <div class="receipt-totals-container">
            <div class="receipt-total-row"><span>Subtotal Amount:</span><span>${window.formatCurrency(invoice.subtotal)}</span></div>
            ${invoice.discount > 0 ? `<div class="receipt-total-row" style="color: #dc2626;"><span>Discount Applied:</span><span>-${window.formatCurrency(invoice.discount)}</span></div>` : ''}
            <div class="receipt-total-row"><span>GST (${(invoice.businessSnapshot && invoice.businessSnapshot.gstPercentage) || 5}%):</span><span>${window.formatCurrency(invoice.gst)}</span></div>
            
            <div class="receipt-grand-total">
              <span>GRAND TOTAL</span>
              <span>${window.formatCurrency(invoice.total)}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-footer">
            <div style="font-weight: 700; margin-bottom: 4px;">Payment Mode: ${(invoice.paymentMode || 'CASH').toUpperCase()} (${invoice.paymentStatus || 'PAID'})</div>
            <div style="font-size: 11px; font-style: italic;">${(invoice.businessSnapshot && invoice.businessSnapshot.invoiceFooter) || 'Thank you for dining with us!'}</div>
          </div>
        </div>
      `;
    }

    if (modal) {
      modal.classList.add('active');
      if (autoPrint) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    }
  }

  requestFinalSettlement() {
    if (this.isSubmittingSettlement) return;
    if (!this.session) return;

    if (!confirm("Are you sure you want to request final settlement? You will not be able to place additional orders once settlement is initiated.")) {
      return;
    }

    this.isSubmittingSettlement = true;
    try {
      window.dbService.requestSettlement(this.session.sessionId);
      this.session = window.dbService.getSession(this.session.sessionId);
      if (window.playNotificationChime) window.playNotificationChime('info');
      window.showToast("Final settlement requested! Cafe manager has been notified.", "success", 4000);
      this.renderBill();
    } catch(err) {
      window.showToast(err.message, "danger");
    } finally {
      this.isSubmittingSettlement = false;
    }
  }

  onRealtimeUpdate() {
    const previousSessionStatus = this.session ? this.session.status : null;
    const previousSessionId = this.session ? this.session.sessionId : null;

    if (this.session) {
      this.session = window.dbService.getSession(this.session.sessionId);
    }
    this.table = window.dbService.getTable(this.tableId);

    // ── CASE 0: Table FORCE-FREED / VACATED by manager ───────────────────────────
    const sessionForcedFree = this.session && this.session.status === 'FORCE_FREED';
    const tableVacated = previousSessionId && this.table && this.table.status === 'AVAILABLE' && this.table.currentSessionId !== previousSessionId;

    if (sessionForcedFree || tableVacated) {
      this._settlementJustDone = true;

      // Clear local session + cart
      this.session = null;
      this.cart = [];
      this.saveCartToStorage();

      // Log the customer out
      window.authService.logoutCustomer();

      window.showToast('⚠️ This table has been freed by the manager. You have been logged out.', 'warning', 6000);

      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.innerHTML = `
          <div style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; text-align: center;">
            <div class="glass-card" style="max-width: 460px; width: 100%; padding: 2.5rem 1.5rem;">
              <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔓</div>
              <h2 class="font-bold text-xl text-warning" style="margin-bottom: 0.5rem;">Table Freed by Manager</h2>
              <p class="text-secondary text-sm" style="margin-bottom: 1.75rem; line-height: 1.6;">
                The manager has freed this table. Your session has ended.<br>
                Please contact the restaurant staff if you have any questions.
              </p>
              <button class="btn btn-primary" onclick="window.location.reload()">🍽️ Start New Session</button>
            </div>
          </div>
        `;
      }
      return;
    }

    // ── CASE 1: Settlement CONFIRMED by manager (session COMPLETED) ──────────────
    const sessionJustCompleted = previousSessionStatus &&
      previousSessionStatus !== 'COMPLETED' &&
      this.session &&
      this.session.status === 'COMPLETED';

    if (sessionJustCompleted) {
      // Set flag so loadTableAndSession (triggered by 'tables' event shortly after)
      // does NOT auto-create a new session for this customer.
      this._settlementJustDone = true;

      // Clear local session + cart
      this.session = null;
      this.cart = [];
      this.saveCartToStorage();

      // Clear stored customer session (removes stale sessionId from localStorage)
      window.authService.logoutCustomer();

      // Show thank-you screen
      window.showToast('Your bill has been settled. Thank you for dining with us! 🙏', 'success', 5000);

      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.innerHTML = `
          <div style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; text-align: center;">
            <div class="glass-card" style="max-width: 460px; width: 100%; padding: 2.5rem 1.5rem;">
              <div style="font-size: 3.5rem; margin-bottom: 1rem;">🎉</div>
              <h2 class="font-bold text-xl text-success" style="margin-bottom: 0.5rem;">Bill Settled — Thank You!</h2>
              <p class="text-secondary text-sm" style="margin-bottom: 1.75rem; line-height: 1.6;">
                Your bill has been fully settled by the manager. We hope you enjoyed your dining experience.
              </p>
              <button class="btn btn-primary" onclick="window.location.reload()">🍽️ Dine Again</button>
            </div>
          </div>
        `;
      }
      return;
    }

    // ── CASE 2: Settlement REJECTED by manager (session reverted to ACTIVE) ──────
    const settlementRejected = previousSessionStatus === 'WAITING_FOR_SETTLEMENT' &&
      this.session &&
      this.session.status === 'ACTIVE';

    if (settlementRejected) {
      const reason = this.session.settlementRejectionReason || 'No reason given';
      window.showToast(
        `⚠️ Settlement rejected by manager: "${reason}". You may continue ordering.`,
        'warning',
        8000
      );
      // Fall through to normal render below so bill tab updates correctly
    }

    if (this.activeTab === 'orders') this.renderOrders();
    if (this.activeTab === 'bill') this.renderBill();
    if (this.activeTab === 'menu') this.renderMenu();
    if (this.activeTab === 'cart') this.renderCart();
  }

  renderErrorState(title, message) {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.innerHTML = `
        <div style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; text-align: center;">
          <div class="glass-card" style="max-width: 480px; width: 100%; padding: 2.5rem 1.5rem; text-align: center;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🚫</div>
            <h2 class="font-bold text-xl text-danger" style="margin-bottom: 0.75rem;">${title}</h2>
            <p class="text-secondary text-sm" style="line-height: 1.6; margin-bottom: 1.5rem;">${message}</p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="window.location.reload()">🔄 Retry Connection</button>
            </div>
          </div>
        </div>
      `;
    }
  }

  renderTableOccupiedState(table) {
    this.showOccupiedScreen(table);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.customerApp = new CustomerApp();
});
