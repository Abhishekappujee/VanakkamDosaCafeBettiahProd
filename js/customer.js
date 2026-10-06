/**
 * Customer QR Ordering Application Controller
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

    this.init();
  }

  init() {
    const params = new URLSearchParams(window.location.search);
    this.tableId = params.get('table') || 'tbl_01';

    this.updateBusinessHeader();
    this.loadTableAndSession();

    window.dbService.subscribe('diningSessions', () => this.onRealtimeUpdate());
    window.dbService.subscribe('orders', () => this.onRealtimeUpdate());
    window.dbService.subscribe('invoices', () => this.onRealtimeUpdate());
    window.dbService.subscribe('businessProfile', () => this.updateBusinessHeader());
  }

  updateBusinessHeader() {
    const business = window.dbService.getBusinessProfile();
    const headerName = document.getElementById('header-business-name');
    if (headerName && business.businessName) {
      headerName.textContent = business.businessName;
    }
    const regTitle = document.getElementById('reg-modal-title');
    if (regTitle && business.businessName) {
      regTitle.textContent = `Welcome to ${business.businessName}!`;
    }
    if (business.businessName) {
      document.title = `${business.businessName} | QR Table Menu`;
    }
  }

  updateCustomerProfileUI() {
    const customerUser = window.authService.getCurrentCustomerUser();
    const chip = document.getElementById('customer-profile-chip');
    const chipName = document.getElementById('chip-customer-name');

    if (customerUser && customerUser.name) {
      if (chip) chip.style.display = 'inline-flex';
      if (chipName) chipName.textContent = `${customerUser.name}`;
      
      const nameInput = document.getElementById('reg-name');
      const mobileInput = document.getElementById('reg-mobile');
      if (nameInput && !nameInput.value) nameInput.value = customerUser.name;
      if (mobileInput && !mobileInput.value) mobileInput.value = customerUser.mobile;
    } else {
      if (chip) chip.style.display = 'none';
    }
  }

  loadTableAndSession() {
    this.table = window.dbService.getTable(this.tableId);

    if (!this.table || !this.table.isActive) {
      this.renderErrorState("Invalid Table QR Code", "The table QR code scanned is invalid or inactive. Please consult restaurant staff.");
      return;
    }

    const headerTbl = document.getElementById('header-table-name');
    if (headerTbl) headerTbl.textContent = this.table.tableNumber;

    const customerUser = window.authService.getCurrentCustomerUser();
    this.updateCustomerProfileUI();

    if (customerUser && customerUser.mobile) {
      // Customer profile exists for this browser!
      if (this.table.status === 'AVAILABLE') {
        try {
          const newSession = window.dbService.createDiningSession(this.tableId, customerUser.name, customerUser.mobile);
          this.session = newSession;
        } catch(e) {
          this.session = window.dbService.getSession(this.table.currentSessionId);
        }
      } else if (this.table.currentSessionId) {
        this.session = window.dbService.getSession(this.table.currentSessionId);
      }

      if (this.session) {
        window.authService.setCustomerSession({
          customerId: 'cust_' + customerUser.mobile,
          name: customerUser.name,
          mobile: customerUser.mobile,
          sessionId: this.session.sessionId,
          tableId: this.tableId,
          tableNumber: this.table.tableNumber
        });
      }

      const modal = document.getElementById('registration-modal');
      if (modal) modal.classList.remove('active');

      this.loadCartFromStorage();
      this.renderApp();
      return;
    }

    // No logged-in customer profile
    if (this.table.status === 'OCCUPIED' || this.table.status === 'WAITING_FOR_SETTLEMENT') {
      this.session = window.dbService.getSession(this.table.currentSessionId);
    }

    if (!this.session || this.session.status === 'COMPLETED') {
      this.showRegistrationModal();
    } else {
      this.loadCartFromStorage();
      this.renderApp();
    }
  }

  showRegistrationModal() {
    const modal = document.getElementById('registration-modal');
    if (modal) modal.classList.add('active');
  }

  logoutCustomer() {
    if (confirm("Are you sure you want to log out? Your saved profile and past bill history view will be closed on this browser.")) {
      window.authService.logoutCustomer();
      this.session = null;
      this.cart = [];
      this.updateCustomerProfileUI();
      this.showRegistrationModal();
      window.showToast("Logged out successfully.", "info");
    }
  }

  submitRegistration(e) {
    e.preventDefault();
    const nameInput = document.getElementById('reg-name');
    const mobileInput = document.getElementById('reg-mobile');

    const name = (nameInput.value || '').trim();
    const mobile = (mobileInput.value || '').trim();

    if (!name) {
      window.showToast("Please enter your name", "warning");
      return;
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      window.showToast("Please enter a valid 10-digit Indian mobile number", "warning");
      return;
    }

    try {
      let newSession = null;
      if (this.table.status === 'AVAILABLE') {
        newSession = window.dbService.createDiningSession(this.tableId, name, mobile);
      } else if (this.table.currentSessionId) {
        window.dbService.updateSessionCustomer(this.table.currentSessionId, name, mobile);
        newSession = window.dbService.getSession(this.table.currentSessionId);
      } else {
        newSession = window.dbService.createDiningSession(this.tableId, name, mobile);
      }

      this.session = newSession;

      window.authService.setCustomerSession({
        customerId: newSession.customerId,
        name,
        mobile,
        sessionId: newSession.sessionId,
        tableId: this.tableId,
        tableNumber: this.table.tableNumber
      });

      this.updateCustomerProfileUI();

      const modal = document.getElementById('registration-modal');
      if (modal) modal.classList.remove('active');
      window.showToast(`Welcome, ${name}! Your table is ready.`, "success");
      
      this.renderApp();
    } catch(err) {
      window.showToast(err.message, "danger");
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

    const products = window.dbService.getProducts();
    const filtered = this.activeCategory === 'ALL' 
      ? products 
      : products.filter(p => p.category === this.activeCategory);

    const grid = document.getElementById('food-grid-container');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="text-center text-muted" style="grid-column: 1/-1; padding: 3rem;">No food items available in this category.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(prod => {
      const cartItem = this.cart.find(c => c.productId === prod.productId);
      const qty = cartItem ? cartItem.quantity : 0;
      const isAvailable = prod.isAvailable;

      return `
        <div class="food-card ${!isAvailable ? 'disabled' : ''}">
          <div class="food-card-img-wrapper">
            <img src="${prod.imageUrl}" alt="${prod.foodName}" class="food-card-img" 
                 onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
            <span class="badge badge-info food-card-badge">${prod.category}</span>
            ${!isAvailable ? `<div class="food-card-unavailable-overlay">UNAVAILABLE</div>` : ''}
          </div>
          <div class="food-card-body">
            <div>
              <div class="food-card-title">${prod.foodName}</div>
              <div class="text-xs text-muted" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prod.description || ''}</div>
            </div>
            <div class="food-card-footer">
              <div class="food-card-price">${window.formatCurrency(prod.price)}</div>
              ${!isAvailable ? `
                <button class="btn btn-secondary btn-sm" disabled>Unavailable</button>
              ` : qty > 0 ? `
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
      window.showToast("Item is currently unavailable", "warning");
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
        imageUrl: prod.imageUrl,
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

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item-row">
        <div style="display: flex; align-items: center; gap: 0.875rem;">
          <img src="${item.imageUrl}" style="width: 50px; height: 50px; border-radius: var(--radius-sm); object-fit: cover;">
          <div>
            <div class="font-semibold">${item.foodName}</div>
            <div class="text-sm text-accent">${window.formatCurrency(item.price)} each</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="qty-control">
            <button class="qty-btn" onclick="customerApp.updateQuantity('${item.productId}', -1)">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="customerApp.updateQuantity('${item.productId}', 1)">+</button>
          </div>
          <div class="font-bold" style="min-width: 60px; text-align: right;">
            ${window.formatCurrency(item.price * item.quantity)}
          </div>
        </div>
      </div>
    `).join('');

    const business = window.dbService.getBusinessProfile();
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const gst = Math.round((subtotal * (business.gstPercentage / 100)) * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const subEl = document.getElementById('cart-subtotal-val'); if (subEl) subEl.textContent = window.formatCurrency(subtotal);
    const gstEl = document.getElementById('cart-gst-val'); if (gstEl) gstEl.textContent = `${window.formatCurrency(gst)} (${business.gstPercentage}%)`;
    const totEl = document.getElementById('cart-total-val'); if (totEl) totEl.textContent = window.formatCurrency(total);
  }

  placeOrder() {
    if (this.isSubmittingOrder) return;
    if (this.cart.length === 0) {
      window.showToast("Your cart is empty!", "warning");
      return;
    }

    this.isSubmittingOrder = true;
    const btn = document.getElementById('place-order-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending to Cafe Manager...";
    }

    try {
      const order = window.dbService.createOrder(this.session.sessionId, this.cart);
      
      this.cart = [];
      this.saveCartToStorage();
      
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
          ` : ''}

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
          <p class="text-secondary text-sm">Thank you for dining with us! Invoice #${finalInvoice.invoiceId}</p>
        </div>

        <div class="receipt-paper printable-area" style="background: #ffffff; color: #000000; padding: 1rem; border-radius: var(--radius-md);">
          <div class="receipt-header">
            ${finalInvoice.businessSnapshot.logo ? `
              <div class="receipt-logo-wrapper">
                <img src="${finalInvoice.businessSnapshot.logo}" class="receipt-logo" onerror="this.style.display='none'">
              </div>
            ` : ''}
            <div class="receipt-title">${finalInvoice.businessSnapshot.businessName}</div>
            <div class="receipt-subtext">${finalInvoice.businessSnapshot.address}</div>
            <div class="receipt-subtext">GSTIN: <strong>${finalInvoice.businessSnapshot.gstNumber}</strong></div>
            <div class="receipt-subtext">Ph: ${finalInvoice.businessSnapshot.phone}</div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-meta-grid">
            <div class="receipt-meta-row"><span>TAX INVOICE #:</span><strong>${finalInvoice.invoiceId}</strong></div>
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
              ${finalInvoice.items.map(it => `
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
            <div class="receipt-total-row"><span>GST (${finalInvoice.businessSnapshot.gstPercentage}%):</span><span>${window.formatCurrency(finalInvoice.gst)}</span></div>
            
            <div class="receipt-grand-total">
              <span>GRAND TOTAL</span>
              <span>${window.formatCurrency(finalInvoice.total)}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-footer">
            <div style="font-weight: 700; margin-bottom: 4px;">Payment Mode: ${finalInvoice.paymentMode.toUpperCase()} (${finalInvoice.paymentStatus})</div>
            <div style="font-size: 11px; font-style: italic;">${finalInvoice.businessSnapshot.invoiceFooter}</div>
          </div>
        </div>

        <div class="text-center" style="margin-top: 1.5rem;">
          <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save Final Tax Invoice</button>
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

    const runningGst = Math.round((runningSubtotal * (business.gstPercentage / 100)) * 100) / 100;
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
            <span>GST (${business.gstPercentage}%)</span>
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
            <span class="font-bold text-accent">${inv.invoiceId}</span>
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
          <button class="btn btn-secondary btn-sm" onclick="customerApp.printInvoiceModal('${inv.invoiceId}')">
            🖨️ View / Print Thermal Bill
          </button>
        </div>
      </div>
    `).join('');
  }

  printInvoiceModal(invoiceId) {
    const invoice = (window.dbService.getInvoices() || []).find(i => i.invoiceId === invoiceId);
    if (!invoice) return;

    const modal = document.getElementById('customer-invoice-modal');
    const container = document.getElementById('customer-invoice-area');

    if (container) {
      container.innerHTML = `
        <div class="receipt-paper printable-area">
          <div class="receipt-header">
            ${invoice.businessSnapshot.logo ? `
              <div class="receipt-logo-wrapper">
                <img src="${invoice.businessSnapshot.logo}" class="receipt-logo" onerror="this.style.display='none'">
              </div>
            ` : ''}
            <div class="receipt-title">${invoice.businessSnapshot.businessName}</div>
            <div class="receipt-subtext">${invoice.businessSnapshot.address}</div>
            <div class="receipt-subtext">GSTIN: <strong>${invoice.businessSnapshot.gstNumber}</strong></div>
            <div class="receipt-subtext">Ph: ${invoice.businessSnapshot.phone}</div>
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
              ${invoice.items.map(it => `
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
            <div class="receipt-total-row"><span>GST (${invoice.businessSnapshot.gstPercentage}%):</span><span>${window.formatCurrency(invoice.gst)}</span></div>
            
            <div class="receipt-grand-total">
              <span>GRAND TOTAL</span>
              <span>${window.formatCurrency(invoice.total)}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-footer">
            <div style="font-weight: 700; margin-bottom: 4px;">Payment Mode: ${invoice.paymentMode.toUpperCase()} (${invoice.paymentStatus})</div>
            <div style="font-size: 11px; font-style: italic;">${invoice.businessSnapshot.invoiceFooter}</div>
          </div>
        </div>
      `;
    }

    if (modal) modal.classList.add('active');
  }

  requestFinalSettlement() {
    if (!confirm("Are you sure you want to request final settlement? You will not be able to place additional orders once settlement is initiated.")) {
      return;
    }

    try {
      window.dbService.requestSettlement(this.session.sessionId);
      this.session = window.dbService.getSession(this.session.sessionId);
      window.showToast("Final settlement requested! Cafe manager has been notified.", "success", 4000);
      this.renderBill();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  onRealtimeUpdate() {
    if (this.session) {
      this.session = window.dbService.getSession(this.session.sessionId);
    }
    this.table = window.dbService.getTable(this.tableId);
    
    if (this.activeTab === 'orders') this.renderOrders();
    if (this.activeTab === 'bill') this.renderBill();
    if (this.activeTab === 'menu') this.renderMenu();
  }

  renderErrorState(title, message) {
    document.body.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; text-align: text-center;">
        <div class="glass-card" style="max-width: 480px; padding: 2.5rem 1.5rem; text-align: center;">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🚫</div>
          <h2 class="font-bold text-xl text-danger" style="margin-bottom: 0.75rem;">${title}</h2>
          <p class="text-secondary text-sm" style="line-height: 1.6; margin-bottom: 1.5rem;">${message}</p>
          <a href="index.html" class="btn btn-primary">Return to Cafe Home</a>
        </div>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.customerApp = new CustomerApp();
});
