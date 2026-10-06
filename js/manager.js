/**
 * Cafe Manager / POS Operational Dashboard Controller
 */

class ManagerPOSApp {
  constructor() {
    this.selectedTableId = null;
    this.posCart = [];
    this.activeCategory = 'ALL';
    this.activeView = 'pos'; // 'pos', 'tables', 'orders', 'kot', 'settlement', 'invoices', 'inventory'

    this.init();
  }

  init() {
    // 1. Guard check
    if (!window.authService.enforceRoleGuard('cafe_manager')) return;

    const user = window.authService.getCurrentUser();
    const nameDisplay = document.getElementById('manager-name-display');
    if (nameDisplay) nameDisplay.textContent = user ? user.name : 'Cafe Manager';

    // 2. Realtime Listeners
    window.dbService.subscribe('tables', () => this.refreshData());
    window.dbService.subscribe('orders', () => this.refreshData());
    window.dbService.subscribe('diningSessions', () => this.refreshData());
    window.dbService.subscribe('kots', () => this.refreshData());
    window.dbService.subscribe('invoices', () => this.refreshData());

    this.switchView('pos');
  }

  refreshData() {
    this.updateNotificationBadges();
    if (this.activeView === 'pos') this.renderPOSView();
    if (this.activeView === 'tables') this.renderTablesView();
    if (this.activeView === 'orders') this.renderOrdersView();
    if (this.activeView === 'kot') this.renderKOTView();
    if (this.activeView === 'settlement') this.renderSettlementView();
    if (this.activeView === 'invoices') this.renderInvoicesView();
    if (this.activeView === 'inventory') this.renderInventoryView();
  }

  updateNotificationBadges() {
    const orders = window.dbService.getOrders({ status: 'PENDING_MANAGER_APPROVAL' });
    const pendingOrderBadge = document.getElementById('badge-pending-orders');
    if (pendingOrderBadge) {
      pendingOrderBadge.textContent = orders.length;
      pendingOrderBadge.style.display = orders.length > 0 ? 'inline-flex' : 'none';
    }

    const sessions = Object.values(window.dbService.getData().diningSessions || {})
      .filter(s => s.status === 'WAITING_FOR_SETTLEMENT');
    const pendingSettlementBadge = document.getElementById('badge-pending-settlements');
    if (pendingSettlementBadge) {
      pendingSettlementBadge.textContent = sessions.length;
      pendingSettlementBadge.style.display = sessions.length > 0 ? 'inline-flex' : 'none';
    }
  }

  switchView(viewName) {
    this.activeView = viewName;
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    
    const link = document.getElementById(`side-${viewName}`);
    if (link) link.classList.add('active');

    document.querySelectorAll('.manager-view-panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`panel-${viewName}`);
    if (target) target.style.display = 'block';

    this.refreshData();
  }

  // --- POS QUICK ORDERING ---
  renderPOSView() {
    const tables = window.dbService.getTables();
    const tableSelect = document.getElementById('pos-table-select');
    if (tableSelect) {
      tableSelect.innerHTML = `<option value="">-- Select Table --</option>` + 
        tables.map(t => `<option value="${t.tableId}" ${t.tableId === this.selectedTableId ? 'selected' : ''}>${t.tableNumber} (${t.status})</option>`).join('');
    }

    this.renderPOSCatalog();
    this.renderPOSPanel();
  }

  onPOSTableSelect(tableId) {
    this.selectedTableId = tableId;
    this.posCart = [];

    const nameInput = document.getElementById('pos-customer-name');
    const mobileInput = document.getElementById('pos-customer-mobile');

    if (tableId) {
      const table = window.dbService.getTable(tableId);
      if (table && table.currentSessionId) {
        const session = window.dbService.getSession(table.currentSessionId);
        if (session) {
          if (nameInput) nameInput.value = session.customerName || '';
          if (mobileInput) mobileInput.value = session.customerMobile || '';
        }
      } else {
        if (nameInput) nameInput.value = '';
        if (mobileInput) mobileInput.value = '';
      }
    } else {
      if (nameInput) nameInput.value = '';
      if (mobileInput) mobileInput.value = '';
    }

    this.renderPOSCatalog();
    this.renderPOSPanel();
  }

  onPOSCustomerDetailsChange() {
    if (!this.selectedTableId) return;
    const table = window.dbService.getTable(this.selectedTableId);
    if (table && table.currentSessionId) {
      const name = document.getElementById('pos-customer-name')?.value || '';
      const mobile = document.getElementById('pos-customer-mobile')?.value || '';
      if (name || mobile) {
        window.dbService.updateSessionCustomer(table.currentSessionId, name, mobile);
      }
    }
  }

  renderPOSCatalog() {
    const categories = ['ALL', ...window.dbService.getCategories()];
    const catContainer = document.getElementById('pos-category-container');
    if (catContainer) {
      catContainer.innerHTML = categories.map(cat => `
        <button class="category-pill ${this.activeCategory === cat ? 'active' : ''}" onclick="managerApp.filterPOSCategory('${cat}')">
          ${cat}
        </button>
      `).join('');
    }

    const products = window.dbService.getProducts();
    const filtered = this.activeCategory === 'ALL' ? products : products.filter(p => p.category === this.activeCategory);
    const container = document.getElementById('pos-products-grid');
    if (!container) return;

    container.innerHTML = filtered.map(prod => {
      const cartItem = this.posCart.find(c => c.productId === prod.productId);
      const qty = cartItem ? cartItem.quantity : 0;

      return `
        <div class="food-card ${!prod.isAvailable ? 'disabled' : ''}">
          <div class="food-card-img-wrapper" onclick="${prod.isAvailable ? `managerApp.updatePOSQty('${prod.productId}', 1)` : ''}" style="cursor: pointer;">
            <img src="${prod.imageUrl}" class="food-card-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
            <span class="badge badge-info food-card-badge">${prod.category}</span>
          </div>
          <div class="food-card-body">
            <div class="food-card-title">${prod.foodName}</div>
            <div class="food-card-footer">
              <div class="food-card-price">${window.formatCurrency(prod.price)}</div>
              ${!prod.isAvailable ? `
                <span class="badge badge-danger">Out of Stock</span>
              ` : `
                <div class="qty-control">
                  <button class="qty-btn" onclick="managerApp.updatePOSQty('${prod.productId}', -1)">-</button>
                  <span class="qty-val">${qty}</span>
                  <button class="qty-btn" onclick="managerApp.updatePOSQty('${prod.productId}', 1)">+</button>
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  filterPOSCategory(category) {
    this.activeCategory = category;
    this.renderPOSCatalog();
  }

  updatePOSQty(productId, delta) {
    if (!this.selectedTableId && delta > 0) {
      window.showToast("Please select a Table first!", "warning");
      const sel = document.getElementById('pos-table-select');
      if (sel) { sel.focus(); sel.style.borderColor = 'var(--accent-primary)'; }
      return;
    }

    const prod = window.dbService.getProducts().find(p => p.productId === productId);
    if (!prod || !prod.isAvailable) return;

    let existing = this.posCart.find(c => c.productId === productId);
    if (existing) {
      existing.quantity += delta;
      if (existing.quantity <= 0) {
        this.posCart = this.posCart.filter(c => c.productId !== productId);
      }
    } else if (delta > 0) {
      this.posCart.push({
        productId: prod.productId,
        foodName: prod.foodName,
        price: prod.price,
        imageUrl: prod.imageUrl,
        quantity: 1
      });
    }

    this.renderPOSCatalog();
    this.renderPOSPanel();
  }

  renderPOSPanel() {
    const container = document.getElementById('pos-cart-items');
    const panelTitle = document.getElementById('pos-panel-title');
    const statusBadge = document.getElementById('pos-table-status-badge');
    const submitKotBtn = document.getElementById('pos-submit-kot-btn');
    const settleBtn = document.getElementById('pos-settle-btn');
    if (!container) return;

    const table = this.selectedTableId ? window.dbService.getTable(this.selectedTableId) : null;
    const session = (table && table.currentSessionId) ? window.dbService.getSession(table.currentSessionId) : null;
    const existingOrders = session ? window.dbService.getOrders({ sessionId: session.sessionId }).filter(o => o.status === 'APPROVED' || o.status === 'COMPLETED') : [];

    if (panelTitle) panelTitle.textContent = table ? `${table.tableNumber} Order & Bill` : "POS Order & Running Bill";
    if (statusBadge) {
      statusBadge.textContent = table ? table.status : 'No Table';
      statusBadge.className = table && table.status === 'AVAILABLE' ? 'badge badge-success' : (table ? 'badge badge-warning' : 'badge badge-secondary');
    }

    if (submitKotBtn) submitKotBtn.disabled = (this.posCart.length === 0);
    if (settleBtn) settleBtn.disabled = (!session || existingOrders.length === 0);

    let html = '';

    // SECTION A: New Draft Items for This Order
    if (this.posCart.length > 0) {
      html += `
        <div style="font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: var(--accent-primary); letter-spacing: 0.05em; padding: 0.4rem 0; border-bottom: 1px solid var(--border-color);">
          ⚡ New Items to Send to Kitchen KOT:
        </div>
      `;
      html += this.posCart.map(it => `
        <div class="cart-item-row" style="background: rgba(99, 102, 241, 0.08); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin: 0.4rem 0;">
          <div>
            <div class="font-semibold text-sm">${it.foodName}</div>
            <div class="text-xs text-muted">${window.formatCurrency(it.price)} × ${it.quantity}</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="font-bold text-accent">${window.formatCurrency(it.price * it.quantity)}</div>
            <button class="btn btn-danger btn-sm" onclick="managerApp.updatePOSQty('${it.productId}', -${it.quantity})" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;">✕</button>
          </div>
        </div>
      `).join('');
    }

    // SECTION B: Previously Punched Active Table Items
    let runningItems = [];
    existingOrders.forEach(o => {
      o.items.forEach(it => {
        let ex = runningItems.find(x => x.foodName === it.foodName);
        if (ex) {
          ex.quantity += it.quantity;
          ex.subtotal += (it.price * it.quantity);
        } else {
          runningItems.push({ foodName: it.foodName, price: it.price, quantity: it.quantity, subtotal: it.price * it.quantity });
        }
      });
    });

    if (runningItems.length > 0) {
      html += `
        <div style="font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: #34d399; letter-spacing: 0.05em; padding: 0.5rem 0 0.25rem 0; border-bottom: 1px solid var(--border-color); margin-top: 0.75rem;">
          ✅ Already Sent to Kitchen (Running Table Bill):
        </div>
      `;
      html += runningItems.map(it => `
        <div class="cart-item-row" style="padding: 0.4rem 0; border-bottom: 1px dashed var(--border-color); opacity: 0.85;">
          <div>
            <div class="font-bold text-sm">${it.foodName}</div>
            <div class="text-xs text-muted">${window.formatCurrency(it.price)} × ${it.quantity}</div>
          </div>
          <div class="font-extrabold text-success">${window.formatCurrency(it.subtotal)}</div>
        </div>
      `).join('');
    }

    if (this.posCart.length === 0 && runningItems.length === 0) {
      if (!this.selectedTableId) {
        html = `
          <div class="text-center text-muted" style="padding: 2.5rem 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🍽️</div>
            <div class="font-semibold text-sm">No Table Selected</div>
            <div class="text-xs text-secondary" style="margin-top: 0.25rem;">Select a table above & use '+' buttons on menu cards to build POS order.</div>
          </div>
        `;
      } else {
        html = `
          <div class="text-center text-muted" style="padding: 2.5rem 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🛒</div>
            <div class="font-semibold text-sm">Cart is empty for ${table ? table.tableNumber : 'Table'}</div>
            <div class="text-xs text-secondary" style="margin-top: 0.25rem;">Click '+' on food cards to select items for this order.</div>
          </div>
        `;
      }
    }

    container.innerHTML = html;

    // Calculate Total (Draft Items + Active Running Items)
    const draftSubtotal = this.posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const runningSubtotal = runningItems.reduce((sum, item) => sum + item.subtotal, 0);
    const subtotal = draftSubtotal + runningSubtotal;

    const business = window.dbService.getBusinessProfile();
    const gst = Math.round((subtotal * (business.gstPercentage / 100)) * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const subEl = document.getElementById('pos-subtotal'); if (subEl) subEl.textContent = window.formatCurrency(subtotal);
    const gstEl = document.getElementById('pos-gst'); if (gstEl) gstEl.textContent = window.formatCurrency(gst);
    const totEl = document.getElementById('pos-total'); if (totEl) totEl.textContent = window.formatCurrency(total);
  }

  submitFullPOSCheckout() {
    if (!this.selectedTableId) {
      window.showToast("Please select a table first!", "warning");
      return;
    }

    const table = window.dbService.getTable(this.selectedTableId);
    const sessionExists = table && table.currentSessionId;

    if (this.posCart.length === 0 && !sessionExists) {
      window.showToast("Please select items using '+' buttons on menu cards first!", "warning");
      return;
    }

    const nameInput = document.getElementById('pos-customer-name')?.value || '';
    const mobileInput = document.getElementById('pos-customer-mobile')?.value || '';
    const paymentMode = document.getElementById('pos-payment-mode')?.value || 'Cash';

    try {
      let session = null;

      if (table.status === 'AVAILABLE') {
        session = window.dbService.createDiningSession(this.selectedTableId, nameInput, mobileInput);
      } else {
        session = window.dbService.getSession(table.currentSessionId);
        if (session && (nameInput || mobileInput)) {
          window.dbService.updateSessionCustomer(session.sessionId, nameInput, mobileInput);
          session = window.dbService.getSession(table.currentSessionId);
        }
      }

      let newKotId = null;

      // 1. Create order & approve to KOT if draft items exist
      if (this.posCart.length > 0) {
        const order = window.dbService.createOrder(session.sessionId, this.posCart);
        const approved = window.dbService.approveOrder(order.orderId, "POS Manager");
        newKotId = approved.kotId;
      }

      // 2. Collect session KOT IDs for printing
      const kots = window.dbService.getKOTs({ sessionId: session.sessionId });
      const sessionKotIds = kots.map(k => k.kotId);
      if (newKotId && !sessionKotIds.includes(newKotId)) {
        sessionKotIds.push(newKotId);
      }

      // 3. Confirm Settlement & Generate Invoice
      const invoice = window.dbService.confirmSettlement(session.sessionId, paymentMode, 0, "Cafe Manager");

      window.showToast(`⚡ Order, KOT & Final Invoice #${invoice.invoiceId} completed for ${session.customerName}!`, "success", 4000);

      // 4. Print BOTH KOT Tickets and Final Invoice Thermal Bill
      if (sessionKotIds.length > 0) {
        this.printCombinedKOTAndInvoice(sessionKotIds, invoice.invoiceId);
      } else {
        this.printFinalInvoice(invoice.invoiceId);
      }

      // 5. Clear draft & free table
      this.posCart = [];
      window.dbService.freeTable(this.selectedTableId);

      this.refreshData();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  submitPOSOrderOnly() {
    if (!this.selectedTableId) {
      window.showToast("Please select a table first!", "warning");
      return;
    }

    if (this.posCart.length === 0) {
      window.showToast("Please select items using '+' buttons on menu cards first!", "warning");
      return;
    }

    const nameInput = document.getElementById('pos-customer-name')?.value || '';
    const mobileInput = document.getElementById('pos-customer-mobile')?.value || '';

    try {
      let table = window.dbService.getTable(this.selectedTableId);
      let session = null;

      if (table.status === 'AVAILABLE') {
        session = window.dbService.createDiningSession(this.selectedTableId, nameInput, mobileInput);
      } else {
        session = window.dbService.getSession(table.currentSessionId);
        if (session && (nameInput || mobileInput)) {
          window.dbService.updateSessionCustomer(session.sessionId, nameInput, mobileInput);
          session = window.dbService.getSession(table.currentSessionId);
        }
      }

      const order = window.dbService.createOrder(session.sessionId, this.posCart);
      const approved = window.dbService.approveOrder(order.orderId, "POS Manager");

      window.showToast(`👨‍🍳 Kitchen KOT dispatched for ${session.customerName} (${table.tableNumber})! Table remains occupied.`, "success", 3500);

      this.posCart = [];

      // Auto open KOT print ticket modal for kitchen print
      if (approved.kotId) {
        this.printKOT(approved.kotId);
      }

      this.refreshData();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  freeSelectedTable() {
    if (!this.selectedTableId) {
      window.showToast("Please select a table first!", "warning");
      return;
    }
    const table = window.dbService.getTable(this.selectedTableId);
    if (!table) return;
    if (confirm(`Are you sure you want to vacate & free ${table.tableNumber}?`)) {
      window.dbService.freeTable(this.selectedTableId);
      window.showToast(`${table.tableNumber} is now Available!`, "success");
      this.posCart = [];
      this.refreshData();
    }
  }

  freeTablePrompt(tableId) {
    const table = window.dbService.getTable(tableId);
    if (!table) return;
    if (confirm(`Are you sure you want to vacate & free ${table.tableNumber}?`)) {
      window.dbService.freeTable(tableId);
      window.showToast(`${table.tableNumber} is now Available!`, "success");
      if (this.selectedTableId === tableId) this.posCart = [];
      this.refreshData();
    }
  }

  openCurrentTableSettlement() {
    if (!this.selectedTableId) {
      window.showToast("Please select a table first!", "warning");
      return;
    }
    const table = window.dbService.getTable(this.selectedTableId);
    if (!table || !table.currentSessionId) {
      window.showToast("No active session found for this table!", "warning");
      return;
    }
    this.openSettlementModal(table.currentSessionId);
  }

  // --- VISUAL TABLE MANAGEMENT ---
  renderTablesView() {
    const tables = window.dbService.getTables();
    const container = document.getElementById('tables-grid-container');
    if (!container) return;

    const counts = {
      total: tables.length,
      available: tables.filter(t => t.status === 'AVAILABLE').length,
      occupied: tables.filter(t => t.status === 'OCCUPIED').length,
      waiting: tables.filter(t => t.status === 'WAITING_FOR_SETTLEMENT').length
    };

    const totTbl = document.getElementById('kpi-total-tables'); if (totTbl) totTbl.textContent = counts.total;
    const availTbl = document.getElementById('kpi-avail-tables'); if (availTbl) availTbl.textContent = counts.available;
    const occTbl = document.getElementById('kpi-occ-tables'); if (occTbl) occTbl.textContent = counts.occupied;
    const waitTbl = document.getElementById('kpi-wait-tables'); if (waitTbl) waitTbl.textContent = counts.waiting;

    container.innerHTML = tables.map(t => {
      let statusClass = 'available';
      let badge = '<span class="badge badge-success">Available</span>';
      if (t.status === 'OCCUPIED') { statusClass = 'occupied'; badge = '<span class="badge badge-danger">Occupied</span>'; }
      if (t.status === 'WAITING_FOR_SETTLEMENT') { statusClass = 'waiting'; badge = '<span class="badge badge-warning">Settlement Requested</span>'; }

      let walkinBtn = t.status === 'AVAILABLE' 
        ? `<button class="btn btn-primary btn-sm" onclick="managerApp.openWalkinBookModal('${t.tableId}')">🛎️ Book Walk-in</button>`
        : `<button class="btn btn-warning btn-sm" onclick="managerApp.freeTablePrompt('${t.tableId}')">🔓 Free Table</button>`;

      return `
        <div class="table-card ${statusClass}">
          <div class="table-number">${t.tableNumber}</div>
          ${badge}
          <div class="flex gap-2" style="margin-top: 0.5rem; flex-wrap: wrap; justify-content: center;">
            ${walkinBtn}
            <button class="btn btn-secondary btn-sm" onclick="managerApp.showTableQRModal('${t.tableId}')">📱 QR Code</button>
            <button class="btn btn-danger btn-sm" onclick="managerApp.deleteTable('${t.tableId}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  openWalkinBookModal(tableId) {
    const table = window.dbService.getTable(tableId);
    if (!table) return;

    document.getElementById('walkin-table-id').value = tableId;
    document.getElementById('walkin-table-name').value = table.tableNumber;
    document.getElementById('walkin-guest-name').value = '';
    document.getElementById('walkin-guest-mobile').value = '';

    const modal = document.getElementById('walkin-book-modal');
    if (modal) modal.classList.add('active');
  }

  confirmWalkinBooking() {
    const tableId = document.getElementById('walkin-table-id').value;
    const name = document.getElementById('walkin-guest-name').value;
    const mobile = document.getElementById('walkin-guest-mobile').value;

    if (!name || !name.trim()) {
      window.showToast("Please enter customer name!", "warning");
      return;
    }

    if (!mobile || mobile.trim().length < 10) {
      window.showToast("Please enter a valid 10-digit mobile number!", "warning");
      return;
    }

    try {
      const session = window.dbService.createDiningSession(tableId, name, mobile);
      document.getElementById('walkin-book-modal').classList.remove('active');
      window.showToast(`✅ Table booked for ${session.customerName} (${session.tableNumber})!`, "success");

      // Switch to POS view with this table pre-selected
      this.selectedTableId = tableId;
      this.switchView('pos');
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  showAddTableModal() {
    const name = prompt("Enter new Table Name/Number (e.g. Table 09):");
    if (name && name.trim()) {
      window.dbService.addTable(name.trim());
      window.showToast("New table added!", "success");
      this.renderTablesView();
    }
  }

  deleteTable(tableId) {
    if (!confirm("Are you sure you want to remove this table?")) return;
    try {
      window.dbService.deleteTable(tableId);
      window.showToast("Table deleted", "info");
      this.renderTablesView();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  showTableQRModal(tableId) {
    const table = window.dbService.getTable(tableId);
    if (!table) return;

    const qrUrl = `${window.location.origin}/customer.html?table=${table.tableId}`;
    
    const nameEl = document.getElementById('qr-modal-table-name'); if (nameEl) nameEl.textContent = table.tableNumber;
    const urlEl = document.getElementById('qr-modal-url'); if (urlEl) urlEl.textContent = qrUrl;

    const container = document.getElementById('qr-canvas-container');
    if (container) {
      container.innerHTML = '';
      new QRCode(container, {
        text: qrUrl,
        width: 200,
        height: 200,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    }

    const modal = document.getElementById('qr-modal'); if (modal) modal.classList.add('active');
  }

  // --- KITCHEN ORDER APPROVAL QUEUE ---
  renderOrdersView() {
    const pendingOrders = window.dbService.getOrders({ status: 'PENDING_MANAGER_APPROVAL' });
    const container = document.getElementById('pending-orders-container');
    if (!container) return;

    if (pendingOrders.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 3rem;">No pending order approval requests.</div>`;
      return;
    }

    container.innerHTML = pendingOrders.map(ord => `
      <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1rem;">
        <div class="flex justify-between items-center" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
          <div>
            <span class="font-bold text-lg">${ord.tableNumber}</span>
            <span class="text-sm text-secondary" style="margin-left: 0.5rem;">Guest: ${ord.customerName}</span>
          </div>
          <span class="text-xs text-muted">${window.formatDateTime(ord.createdAt)}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem;">
          ${ord.items.map(it => `
            <div class="flex justify-between text-sm">
              <span>${it.quantity} × ${it.foodName}</span>
              <span class="font-semibold">${window.formatCurrency(it.subtotal)}</span>
            </div>
          `).join('')}
        </div>

        <div class="flex justify-between items-center" style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
          <div class="font-bold">Total: <span class="text-accent">${window.formatCurrency(ord.total)}</span></div>
          <div class="flex gap-2">
            <button class="btn btn-danger btn-sm" onclick="managerApp.rejectOrder('${ord.orderId}')">Reject</button>
            <button class="btn btn-success btn-sm" onclick="managerApp.approveOrder('${ord.orderId}')">Approve & Send to Kitchen</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  approveOrder(orderId) {
    try {
      const approved = window.dbService.approveOrder(orderId, "Cafe Manager");
      window.showToast(`Order #${approved.orderId.substring(4, 9)} approved & KOT generated!`, "success");
      if (approved.kotId) {
        this.printKOT(approved.kotId);
      }
      this.refreshData();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  rejectOrder(orderId) {
    const reason = prompt("Enter rejection reason (optional):", "Item out of stock");
    if (reason !== null) {
      window.dbService.rejectOrder(orderId, reason, "Cafe Manager");
      window.showToast("Order rejected.", "info");
      this.refreshData();
    }
  }

  // --- KITCHEN ORDER TICKETS (TWO-COLUMN: IN-PROGRESS VS COMPLETED) ---
  renderKOTView() {
    const kots = Object.values(window.dbService.getData().kots || {}).sort((a,b) => b.createdAt - a.createdAt);

    const inProgressKOTs = kots.filter(k => k.status !== 'COMPLETED');
    const completedKOTs = kots.filter(k => k.status === 'COMPLETED');

    const inProgBadge = document.getElementById('kot-inprogress-count'); if (inProgBadge) inProgBadge.textContent = inProgressKOTs.length;
    const compBadge = document.getElementById('kot-completed-count'); if (compBadge) compBadge.textContent = completedKOTs.length;

    // 1. Render In-Progress KOTs Column
    const inProgContainer = document.getElementById('kot-inprogress-container');
    if (inProgContainer) {
      if (inProgressKOTs.length === 0) {
        inProgContainer.innerHTML = `<div class="text-center text-muted text-sm" style="padding: 2rem;">No in-progress kitchen tickets.</div>`;
      } else {
        inProgContainer.innerHTML = inProgressKOTs.map(kot => {
          let statusBadge = '<span class="badge badge-warning">Sent to Kitchen</span>';
          if (kot.status === 'PREPARING') statusBadge = '<span class="badge badge-warning">Cooking...</span>';
          if (kot.status === 'READY') statusBadge = '<span class="badge badge-success">Food Ready</span>';

          return `
            <div class="glass-card" style="padding: 1rem; margin-bottom: 0.875rem;">
              <div class="flex justify-between items-center" style="border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                <div>
                  <span class="font-bold text-base">${kot.tableNumber}</span>
                  <span class="text-xs text-muted" style="margin-left: 0.5rem;">#${kot.kotId.substring(4, 9).toUpperCase()}</span>
                </div>
                ${statusBadge}
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem;">
                ${kot.items.map(it => `
                  <div class="flex justify-between text-sm font-semibold">
                    <span>${it.quantity} × ${it.foodName}</span>
                  </div>
                `).join('')}
              </div>

              <div class="flex justify-between items-center" style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="managerApp.printKOT('${kot.kotId}')">🖨️ KOT</button>
                <div class="flex gap-1">
                  ${kot.status === 'SENT_TO_KITCHEN' ? `<button class="btn btn-warning btn-sm" onclick="managerApp.updateKOTStatus('${kot.kotId}', 'PREPARING')">Preparing</button>` : ''}
                  ${kot.status === 'PREPARING' ? `<button class="btn btn-success btn-sm" onclick="managerApp.updateKOTStatus('${kot.kotId}', 'READY')">Ready</button>` : ''}
                  <button class="btn btn-primary btn-sm" onclick="managerApp.updateKOTStatus('${kot.kotId}', 'COMPLETED')">Complete</button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 2. Render Completed KOTs Column
    const compContainer = document.getElementById('kot-completed-container');
    if (compContainer) {
      if (completedKOTs.length === 0) {
        compContainer.innerHTML = `<div class="text-center text-muted text-sm" style="padding: 2rem;">No completed tickets yet.</div>`;
      } else {
        compContainer.innerHTML = completedKOTs.map(kot => `
          <div class="glass-card" style="padding: 1rem; margin-bottom: 0.875rem; opacity: 0.85;">
            <div class="flex justify-between items-center" style="border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
              <div>
                <span class="font-bold text-base">${kot.tableNumber}</span>
                <span class="text-xs text-muted" style="margin-left: 0.5rem;">#${kot.kotId.substring(4, 9).toUpperCase()}</span>
              </div>
              <span class="badge badge-success">COMPLETED</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.5rem;">
              ${kot.items.map(it => `
                <div class="flex justify-between text-xs text-secondary">
                  <span>${it.quantity} × ${it.foodName}</span>
                </div>
              `).join('')}
            </div>

            <div class="flex justify-between items-center text-xs text-muted">
              <span>Time: ${window.formatDateTime(kot.completedAt || kot.createdAt)}</span>
              <button class="btn btn-secondary btn-sm" onclick="managerApp.printKOT('${kot.kotId}')">🖨️ KOT</button>
            </div>
          </div>
        `).join('');
      }
    }
  }

  updateKOTStatus(kotId, status) {
    window.dbService.updateKOTStatus(kotId, status);
    window.showToast(`KOT status updated to ${status}`, "info");
    this.refreshData();
  }

  printKOT(kotId) {
    const kot = (window.dbService.getData().kots || {})[kotId];
    if (!kot) return;

    const modal = document.getElementById('kot-print-modal');
    const container = document.getElementById('kot-print-area');

    if (container) {
      container.innerHTML = `
        <div class="receipt-paper printable-area">
          <div class="receipt-header">
            <div class="receipt-title">KITCHEN ORDER TICKET</div>
            <div style="font-weight: 800; font-size: 1.2rem; margin-top: 4px;">${kot.tableNumber}</div>
            <div class="receipt-subtext">KOT #: <strong>${kot.kotId}</strong></div>
            <div class="receipt-subtext">Guest: ${kot.customerName} | Time: ${window.formatDateTime(kot.createdAt)}</div>
          </div>

          <div class="receipt-divider"></div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 75%;">ITEM NAME</th>
                <th style="text-align: center; width: 25%;">QTY</th>
              </tr>
            </thead>
            <tbody>
              ${kot.items.map(it => `
                <tr>
                  <td style="text-align: left; font-weight: 700; font-size: 14px;">${it.foodName}</td>
                  <td style="text-align: center; font-weight: 800; font-size: 16px;">${it.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="receipt-divider"></div>
          <div class="receipt-footer" style="font-weight: 800; font-size: 12px;">*** SENT TO KITCHEN ***</div>
        </div>
      `;
    }

    if (modal) modal.classList.add('active');
  }

  // --- FINAL SETTLEMENT & INVOICING ---
  renderSettlementView() {
    const sessions = Object.values(window.dbService.getData().diningSessions || {})
      .filter(s => s.status === 'WAITING_FOR_SETTLEMENT' || s.status === 'ACTIVE');

    const container = document.getElementById('settlements-container');
    if (!container) return;

    if (sessions.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 3rem;">No active dining sessions requiring settlement.</div>`;
      return;
    }

    container.innerHTML = sessions.map(sess => {
      const orders = window.dbService.getOrders({ sessionId: sess.sessionId }).filter(o => o.status === 'APPROVED' || o.status === 'COMPLETED');
      const subtotal = orders.reduce((sum, ord) => sum + ord.subtotal, 0);
      const business = window.dbService.getBusinessProfile();
      const gst = Math.round((subtotal * (business.gstPercentage / 100)) * 100) / 100;
      const total = Math.round((subtotal + gst) * 100) / 100;

      return `
        <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1rem;">
          <div class="flex justify-between items-center" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            <div>
              <span class="font-bold text-lg">${sess.tableNumber}</span>
              <span class="text-sm text-secondary" style="margin-left: 0.5rem;">${sess.customerName} (${sess.customerMobile})</span>
            </div>
            <span class="badge ${sess.status === 'WAITING_FOR_SETTLEMENT' ? 'badge-warning' : 'badge-info'}">
              ${sess.status === 'WAITING_FOR_SETTLEMENT' ? 'Settlement Requested' : 'Active Dining'}
            </span>
          </div>

          <div class="flex justify-between items-center">
            <div>
              <div class="text-xs text-muted">Approved Orders Total</div>
              <div class="font-bold text-accent text-lg">${window.formatCurrency(total)}</div>
            </div>
            <button class="btn btn-success" onclick="managerApp.openSettlementModal('${sess.sessionId}')">
              💳 Confirm Final Settlement
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openSettlementModal(sessionId) {
    const session = window.dbService.getSession(sessionId);
    if (!session) return;

    const orders = window.dbService.getOrders({ sessionId }).filter(o => o.status === 'APPROVED' || o.status === 'COMPLETED');
    const business = window.dbService.getBusinessProfile();

    let subtotal = 0;
    orders.forEach(o => subtotal += o.subtotal);
    const gst = Math.round((subtotal * (business.gstPercentage / 100)) * 100) / 100;

    const sessIdInput = document.getElementById('settle-session-id'); if (sessIdInput) sessIdInput.value = sessionId;
    const tblNameEl = document.getElementById('settle-table-name'); if (tblNameEl) tblNameEl.textContent = session.tableNumber;
    
    const custNameInput = document.getElementById('settle-customer-name-input'); if (custNameInput) custNameInput.value = session.customerName || '';
    const custMobileInput = document.getElementById('settle-customer-mobile-input'); if (custMobileInput) custMobileInput.value = session.customerMobile || '';

    const subEl = document.getElementById('settle-subtotal'); if (subEl) subEl.textContent = window.formatCurrency(subtotal);
    const gstEl = document.getElementById('settle-gst'); if (gstEl) gstEl.textContent = window.formatCurrency(gst);
    const discInput = document.getElementById('settle-discount-input'); if (discInput) discInput.value = 0;
    
    this.recalculateSettlementTotal();

    const modal = document.getElementById('settlement-modal'); if (modal) modal.classList.add('active');
  }

  recalculateSettlementTotal() {
    const sessIdInput = document.getElementById('settle-session-id');
    if (!sessIdInput) return;
    const sessionId = sessIdInput.value;
    const orders = window.dbService.getOrders({ sessionId }).filter(o => o.status === 'APPROVED' || o.status === 'COMPLETED');
    const business = window.dbService.getBusinessProfile();

    let subtotal = 0;
    orders.forEach(o => subtotal += o.subtotal);

    const discInput = document.getElementById('settle-discount-input');
    const discount = parseFloat(discInput ? discInput.value || 0 : 0);
    const taxable = Math.max(0, subtotal - discount);
    const gst = Math.round((taxable * (business.gstPercentage / 100)) * 100) / 100;
    const grandTotal = Math.round((taxable + gst) * 100) / 100;

    const grandEl = document.getElementById('settle-grand-total');
    if (grandEl) grandEl.textContent = window.formatCurrency(grandTotal);
  }

  confirmFinalSettlement() {
    const sessionId = document.getElementById('settle-session-id').value;
    const paymentMode = document.getElementById('settle-payment-mode').value;
    const discount = parseFloat(document.getElementById('settle-discount-input').value || 0);

    const custName = document.getElementById('settle-customer-name-input')?.value || '';
    const custMobile = document.getElementById('settle-customer-mobile-input')?.value || '';

    try {
      if (custName || custMobile) {
        window.dbService.updateSessionCustomer(sessionId, custName, custMobile);
      }

      const kots = window.dbService.getKOTs({ sessionId });
      const kotIds = kots.map(k => k.kotId);

      const invoice = window.dbService.confirmSettlement(sessionId, paymentMode, discount, "Cafe Manager");
      document.getElementById('settlement-modal').classList.remove('active');
      window.showToast(`Final Settlement Completed! Invoice #${invoice.invoiceId}`, "success", 4000);
      
      if (kotIds.length > 0) {
        this.printCombinedKOTAndInvoice(kotIds, invoice.invoiceId);
      } else {
        this.printFinalInvoice(invoice.invoiceId);
      }

      this.refreshData();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  // --- MANAGER TODAY'S INVOICES VIEW & REPRINT ---
  renderInvoicesView() {
    const invoices = window.dbService.getInvoices();
    const searchInput = document.getElementById('manager-invoice-search');
    const query = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    let filtered = invoices.filter(inv => inv.createdAt >= startOfDay.getTime());

    if (query) {
      filtered = invoices.filter(inv => 
        inv.invoiceId.toLowerCase().includes(query) ||
        inv.customerName.toLowerCase().includes(query) ||
        inv.customerMobile.includes(query) ||
        inv.tableNumber.toLowerCase().includes(query)
      );
    }

    const container = document.getElementById('manager-invoices-table');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No billed customer invoices found.</td></tr>`;
      return;
    }

    container.innerHTML = filtered.map(inv => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td class="font-bold" style="padding: 0.75rem;">${inv.invoiceId}</td>
        <td>${window.formatDateTime(inv.createdAt)}</td>
        <td>${inv.customerName} (${inv.customerMobile})</td>
        <td>${inv.tableNumber}</td>
        <td class="font-bold text-accent">${window.formatCurrency(inv.total)}</td>
        <td><span class="badge badge-info">${inv.paymentMode}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="managerApp.printFinalInvoice('${inv.invoiceId}')">
            🖨️ Reprint Bill
          </button>
        </td>
      </tr>
    `).join('');
  }

  printCombinedKOTAndInvoice(kotIdsInput, invoiceId) {
    const invoice = window.dbService.getInvoices().find(i => i.invoiceId === invoiceId);
    if (!invoice) return;

    let kotIds = Array.isArray(kotIdsInput) ? kotIdsInput : [kotIdsInput];
    const allKots = window.dbService.getData().kots || {};
    const kots = kotIds.map(id => allKots[id]).filter(Boolean);

    const modal = document.getElementById('invoice-print-modal');
    const container = document.getElementById('invoice-print-area');
    const headerTitle = modal ? modal.querySelector('.modal-header h3') : null;
    const modalFooter = modal ? modal.querySelector('.modal-footer') : null;

    if (headerTitle) {
      headerTitle.textContent = 'Order Thermal Receipts (KOT + Tax Invoice)';
    }

    let kotsHtml = kots.map(kot => `
      <div class="receipt-paper printable-area" style="margin-bottom: 24px; border-bottom: 2px dashed #000; padding-bottom: 16px;">
        <div class="receipt-header">
          <div class="receipt-title">KITCHEN ORDER TICKET</div>
          <div style="font-weight: 800; font-size: 1.2rem; margin-top: 4px;">${kot.tableNumber}</div>
          <div class="receipt-subtext">KOT #: <strong>${kot.kotId}</strong></div>
          <div class="receipt-subtext">Guest: ${kot.customerName} | Time: ${window.formatDateTime(kot.createdAt)}</div>
        </div>

        <div class="receipt-divider"></div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th style="text-align: left; width: 75%;">ITEM NAME</th>
              <th style="text-align: center; width: 25%;">QTY</th>
            </tr>
          </thead>
          <tbody>
            ${kot.items.map(it => `
              <tr>
                <td style="text-align: left; font-weight: 700; font-size: 14px;">${it.foodName}</td>
                <td style="text-align: center; font-weight: 800; font-size: 16px;">${it.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="receipt-divider"></div>
        <div class="receipt-footer" style="font-weight: 800; font-size: 12px;">*** SENT TO KITCHEN ***</div>
      </div>
      <div style="page-break-before: always; break-before: page; margin-top: 16px;"></div>
    `).join('');

    const invoiceHtml = `
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

    if (container) {
      container.innerHTML = kotsHtml + invoiceHtml;
    }

    const firstKotId = kots.length > 0 ? kots[0].kotId : '';

    if (modalFooter) {
      modalFooter.innerHTML = `
        ${firstKotId ? `<button class="btn btn-secondary btn-sm" onclick="managerApp.printKOT('${firstKotId}')">👨‍🍳 KOT Only</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="managerApp.printFinalInvoice('${invoiceId}')">🧾 Bill Only</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print BOTH (KOT + Bill)</button>
      `;
    }

    if (modal) modal.classList.add('active');
  }

  printFinalInvoice(invoiceId) {
    const invoice = window.dbService.getInvoices().find(i => i.invoiceId === invoiceId);
    if (!invoice) return;

    const modal = document.getElementById('invoice-print-modal');
    const container = document.getElementById('invoice-print-area');
    const headerTitle = modal ? modal.querySelector('.modal-header h3') : null;
    const modalFooter = modal ? modal.querySelector('.modal-footer') : null;

    if (headerTitle) {
      headerTitle.textContent = 'Final Tax Invoice';
    }

    if (modalFooter) {
      modalFooter.innerHTML = `
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Final Tax Invoice</button>
      `;
    }

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

  // --- INVENTORY VIEW & REQUEST ---
  renderInventoryView() {
    const items = window.dbService.getInventory();
    const container = document.getElementById('pos-inventory-table');
    if (!container) return;

    container.innerHTML = items.map(inv => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 0.75rem;">${inv.itemName}</td>
        <td>${inv.category}</td>
        <td class="${inv.currentQuantity <= inv.minimumQuantity ? 'text-danger font-bold' : ''}">
          ${inv.currentQuantity} ${inv.unit}
        </td>
        <td>${inv.minimumQuantity} ${inv.unit}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="managerApp.submitInventoryRequest('${inv.itemName}')">
            📩 Request Stock
          </button>
        </td>
      </tr>
    `).join('');
  }

  submitInventoryRequest(itemName) {
    const qty = prompt(`Enter requested quantity for ${itemName}:`, "10");
    const reason = prompt("Enter request reason:", "Low kitchen stock for upcoming shift");

    if (qty && reason) {
      window.dbService.createInventoryRequest({
        item: itemName,
        requestedQuantity: qty,
        reason,
        requestedBy: "Cafe Manager"
      });
      window.showToast("Stock request sent to Super Admin!", "success");
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.managerApp = new ManagerPOSApp();
});
