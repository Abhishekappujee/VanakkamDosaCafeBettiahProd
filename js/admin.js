/**
 * Super Admin Executive Dashboard Controller
 */

class AdminDashboardApp {
  constructor() {
    this.activeFilter = 'today';
    this.activeView = 'dashboard';

    this.init();
  }

  init() {
    // 1. Guard check
    if (!window.authService.enforceRoleGuard('super_admin')) return;

    // 2. Subscriptions
    window.dbService.subscribe('invoices', () => this.refreshData());
    window.dbService.subscribe('orders', () => this.refreshData());
    window.dbService.subscribe('products', () => this.refreshData());
    window.dbService.subscribe('expenses', () => this.refreshData());

    this.switchView('dashboard');
  }

  refreshData() {
    if (this.activeView === 'dashboard') this.renderDashboard();
    if (this.activeView === 'analytics') this.renderAnalytics();
    if (this.activeView === 'products') this.renderProducts();
    if (this.activeView === 'invoices') this.renderInvoices();
    if (this.activeView === 'inventory') this.renderInventory();
    if (this.activeView === 'expenses') this.renderExpenses();
    if (this.activeView === 'capital') this.renderCapital();
    if (this.activeView === 'business') this.renderBusinessProfile();
    if (this.activeView === 'managers') this.renderManagers();
    if (this.activeView === 'requests') this.renderRequests();
  }

  switchView(viewName) {
    this.activeView = viewName;
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    
    const link = document.getElementById(`admin-side-${viewName}`);
    if (link) link.classList.add('active');

    document.querySelectorAll('.admin-view-panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`admin-panel-${viewName}`);
    if (target) target.style.display = 'block';

    this.refreshData();
  }

  setDateFilter(filterType) {
    this.activeFilter = filterType;
    document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`filter-${filterType}`);
    if (btn) btn.classList.add('active');
    
    this.refreshData();
  }

  // --- DASHBOARD OVERVIEW ---
  renderDashboard() {
    const invoices = window.dbService.getInvoices();
    const orders = window.dbService.getOrders();
    const tables = window.dbService.getTables();
    const expenses = window.dbService.getExpenses();

    const filteredInvoices = this.filterByDate(invoices, 'createdAt');
    const filteredOrders = this.filterByDate(orders, 'createdAt');
    const filteredExpenses = this.filterByDate(expenses, 'createdAt');

    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netOperatingSurplus = totalRevenue - totalExpenses;

    const revEl = document.getElementById('admin-kpi-revenue'); if (revEl) revEl.textContent = window.formatCurrency(totalRevenue);
    const ordEl = document.getElementById('admin-kpi-orders'); if (ordEl) ordEl.textContent = filteredOrders.length;
    const billEl = document.getElementById('admin-kpi-bills'); if (billEl) billEl.textContent = filteredInvoices.length;
    const expEl = document.getElementById('admin-kpi-expenses'); if (expEl) expEl.textContent = window.formatCurrency(totalExpenses);
    const netEl = document.getElementById('admin-kpi-net'); if (netEl) netEl.textContent = window.formatCurrency(netOperatingSurplus);

    const availEl = document.getElementById('admin-kpi-avail-tbl'); if (availEl) availEl.textContent = tables.filter(t => t.status === 'AVAILABLE').length;
    const occEl = document.getElementById('admin-kpi-occ-tbl'); if (occEl) occEl.textContent = tables.filter(t => t.status === 'OCCUPIED').length;

    const inventory = window.dbService.getInventory();
    const lowStock = inventory.filter(i => i.currentQuantity <= i.minimumQuantity);
    const lowStockContainer = document.getElementById('admin-low-stock-list');
    if (lowStockContainer) {
      if (lowStock.length === 0) {
        lowStockContainer.innerHTML = `<div class="text-sm text-success">All inventory stock levels are healthy!</div>`;
      } else {
        lowStockContainer.innerHTML = lowStock.map(i => `
          <div class="flex justify-between items-center text-sm" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
            <span class="font-semibold">${i.itemName}</span>
            <span class="badge badge-danger">${i.currentQuantity} ${i.unit} (Min ${i.minimumQuantity})</span>
          </div>
        `).join('');
      }
    }

    this.renderSVGChart('dashboard-sales-chart', filteredInvoices);
  }

  filterByDate(items, dateField = 'createdAt') {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return items.filter(item => {
      const time = item[dateField] || 0;
      if (this.activeFilter === 'today') return time >= startOfDay;
      if (this.activeFilter === 'yesterday') return time >= (startOfDay - 86400000) && time < startOfDay;
      if (this.activeFilter === 'week') return time >= (startOfDay - (7 * 86400000));
      if (this.activeFilter === 'month') return time >= (startOfDay - (30 * 86400000));
      return true;
    });
  }

  renderSVGChart(containerId, invoices) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (invoices.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">No revenue data available for selected date range.</div>`;
      return;
    }

    const paymentModes = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
    invoices.forEach(inv => {
      const mode = inv.paymentMode || 'Cash';
      paymentModes[mode] = (paymentModes[mode] || 0) + inv.total;
    });

    const maxVal = Math.max(...Object.values(paymentModes), 100);

    container.innerHTML = `
      <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 180px; padding-top: 1rem;">
        ${Object.keys(paymentModes).map(mode => {
          const val = paymentModes[mode];
          const heightPct = Math.max(10, Math.round((val / maxVal) * 100));
          return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 60px;">
              <div class="text-xs font-bold text-accent">${window.formatCurrency(val)}</div>
              <div style="width: 100%; height: ${heightPct}%; background: var(--accent-gradient); border-radius: var(--radius-sm); transition: height 0.5s ease;"></div>
              <div class="text-xs font-semibold text-secondary">${mode}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- REVENUE ANALYTICS ---
  renderAnalytics() {
    const invoices = window.dbService.getInvoices();
    const filtered = this.filterByDate(invoices);

    const totalSales = filtered.reduce((s, i) => s + i.total, 0);
    const totalGst = filtered.reduce((s, i) => s + i.gst, 0);
    const totalDiscounts = filtered.reduce((s, i) => s + i.discount, 0);
    const netRevenue = totalSales - totalGst;

    const tsEl = document.getElementById('analytics-total-sales'); if (tsEl) tsEl.textContent = window.formatCurrency(totalSales);
    const nrEl = document.getElementById('analytics-net-rev'); if (nrEl) nrEl.textContent = window.formatCurrency(netRevenue);
    const gstEl = document.getElementById('analytics-gst'); if (gstEl) gstEl.textContent = window.formatCurrency(totalGst);
    const discEl = document.getElementById('analytics-discounts'); if (discEl) discEl.textContent = window.formatCurrency(totalDiscounts);
    const avgEl = document.getElementById('analytics-avg-bill'); if (avgEl) avgEl.textContent = window.formatCurrency(filtered.length > 0 ? totalSales / filtered.length : 0);

    this.renderSVGChart('analytics-payment-chart', filtered);
  }

  // --- PRODUCT CATALOG MANAGEMENT ---
  renderProducts() {
    const products = window.dbService.getProducts();
    const container = document.getElementById('admin-products-table');
    if (!container) return;

    container.innerHTML = products.map(p => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 0.75rem;">
          <div class="flex items-center gap-2">
            <img src="${p.imageUrl}" style="width: 42px; height: 42px; border-radius: var(--radius-sm); object-fit: cover;">
            <div>
              <div class="font-semibold">${p.foodName}</div>
              <div class="text-xs text-muted">${p.category}</div>
            </div>
          </div>
        </td>
        <td class="font-bold text-accent">${window.formatCurrency(p.price)}</td>
        <td>
          <span class="badge ${p.isAvailable ? 'badge-success' : 'badge-danger'}">
            ${p.isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </td>
        <td>${p.inventoryLinked ? `Linked (${p.inventoryQuantity})` : 'Not Linked'}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="adminApp.openProductModal('${p.productId}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="adminApp.deleteProduct('${p.productId}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openProductModal(productId = null) {
    const prod = productId ? window.dbService.getProducts().find(p => p.productId === productId) : null;
    
    document.getElementById('prod-modal-id').value = prod ? prod.productId : '';
    document.getElementById('prod-modal-name').value = prod ? prod.foodName : '';
    document.getElementById('prod-modal-category').value = prod ? prod.category : 'Starters';
    document.getElementById('prod-modal-price').value = prod ? prod.price : '';
    document.getElementById('prod-modal-img').value = prod ? prod.imageUrl : '';
    document.getElementById('prod-modal-desc').value = prod ? prod.description : '';
    document.getElementById('prod-modal-available').checked = prod ? prod.isAvailable : true;
    document.getElementById('prod-modal-threshold').value = prod ? prod.lowStockThreshold : 5;

    document.getElementById('product-edit-modal').classList.add('active');
  }

  saveProductFromModal(e) {
    e.preventDefault();
    const productId = document.getElementById('prod-modal-id').value;
    const foodName = document.getElementById('prod-modal-name').value;
    const category = document.getElementById('prod-modal-category').value;
    const price = parseFloat(document.getElementById('prod-modal-price').value);
    const imageUrl = document.getElementById('prod-modal-img').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
    const description = document.getElementById('prod-modal-desc').value;
    const isAvailable = document.getElementById('prod-modal-available').checked;
    const lowStockThreshold = parseInt(document.getElementById('prod-modal-threshold').value || 5);

    try {
      window.dbService.saveProduct({
        productId: productId || undefined,
        foodName,
        category,
        price,
        imageUrl,
        description,
        isAvailable,
        lowStockThreshold
      });

      document.getElementById('product-edit-modal').classList.remove('active');
      window.showToast("Product saved successfully!", "success");
      this.renderProducts();
    } catch(err) {
      window.showToast(err.message, "danger");
    }
  }

  deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    window.dbService.deleteProduct(productId);
    window.showToast("Product deleted.", "info");
    this.renderProducts();
  }

  // --- BUSINESS PROFILE ---
  renderBusinessProfile() {
    const prof = window.dbService.getBusinessProfile();
    const nameEl = document.getElementById('biz-name'); if (nameEl) nameEl.value = prof.businessName || '';
    const logoEl = document.getElementById('biz-logo'); if (logoEl) logoEl.value = prof.logo || '';
    const addrEl = document.getElementById('biz-address'); if (addrEl) addrEl.value = prof.address || '';
    const gstEl = document.getElementById('biz-gstin'); if (gstEl) gstEl.value = prof.gstNumber || '';
    const pctEl = document.getElementById('biz-gst-pct'); if (pctEl) pctEl.value = prof.gstPercentage || 5;
    const phoneEl = document.getElementById('biz-phone'); if (phoneEl) phoneEl.value = prof.phone || '';
    const emailEl = document.getElementById('biz-email'); if (emailEl) emailEl.value = prof.email || '';
    const prefEl = document.getElementById('biz-prefix'); if (prefEl) prefEl.value = prof.invoicePrefix || 'INV-';
    const footEl = document.getElementById('biz-footer'); if (footEl) footEl.value = prof.invoiceFooter || '';
  }

  saveBusinessProfile(e) {
    e.preventDefault();
    window.dbService.updateBusinessProfile({
      businessName: document.getElementById('biz-name').value,
      logo: document.getElementById('biz-logo').value,
      address: document.getElementById('biz-address').value,
      gstNumber: document.getElementById('biz-gstin').value,
      gstPercentage: parseFloat(document.getElementById('biz-gst-pct').value || 5),
      phone: document.getElementById('biz-phone').value,
      email: document.getElementById('biz-email').value,
      invoicePrefix: document.getElementById('biz-prefix').value,
      invoiceFooter: document.getElementById('biz-footer').value
    });

    window.showToast("Business profile updated! Reflects on future invoices.", "success");
  }

  // --- INVOICES MANAGEMENT ---
  renderInvoices() {
    const invoices = window.dbService.getInvoices();
    const container = document.getElementById('admin-invoices-table');
    if (!container) return;

    container.innerHTML = invoices.map(inv => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td class="font-bold" style="padding: 0.75rem;">${inv.invoiceId}</td>
        <td>${window.formatDateTime(inv.createdAt)}</td>
        <td>${inv.customerName} (${inv.customerMobile})</td>
        <td>${inv.tableNumber}</td>
        <td class="font-bold text-accent">${window.formatCurrency(inv.total)}</td>
        <td><span class="badge badge-info">${inv.paymentMode}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="managerApp.printFinalInvoice('${inv.invoiceId}')">🖨️ Print</button>
        </td>
      </tr>
    `).join('');
  }

  // --- INVENTORY MANAGEMENT ---
  renderInventory() {
    const inventory = window.dbService.getInventory();
    const container = document.getElementById('admin-inventory-table');
    if (!container) return;

    container.innerHTML = inventory.map(inv => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td class="font-semibold" style="padding: 0.75rem;">${inv.itemName}</td>
        <td>${inv.category}</td>
        <td class="${inv.currentQuantity <= inv.minimumQuantity ? 'text-danger font-bold' : ''}">${inv.currentQuantity} ${inv.unit}</td>
        <td>${inv.minimumQuantity} ${inv.unit}</td>
        <td>${window.formatCurrency(inv.purchasePrice)}</td>
        <td>${inv.supplier}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="adminApp.openStockMovementModal('${inv.inventoryId}')">📊 Adjust Stock</button>
        </td>
      </tr>
    `).join('');
  }

  openStockMovementModal(inventoryId) {
    const inv = window.dbService.getInventory().find(i => i.inventoryId === inventoryId);
    if (!inv) return;

    const type = prompt(`Adjust Stock for ${inv.itemName}\nType (PURCHASE, SALE, ADJUSTMENT, WASTAGE, DAMAGE):`, "PURCHASE");
    const qty = prompt("Quantity:", "10");
    const reason = prompt("Reason / Notes:", "Stock replenishment");

    if (type && qty) {
      window.dbService.logStockMovement(inventoryId, type.toUpperCase(), qty, reason, "Super Admin");
      window.showToast("Stock movement logged!", "success");
      this.renderInventory();
    }
  }

  // --- EXPENSES ---
  renderExpenses() {
    const expenses = window.dbService.getExpenses();
    const container = document.getElementById('admin-expenses-table');
    if (!container) return;

    container.innerHTML = expenses.map(exp => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 0.75rem;">${exp.date}</td>
        <td><span class="badge badge-warning">${exp.category}</span></td>
        <td>${exp.description}</td>
        <td class="font-bold text-danger">${window.formatCurrency(exp.amount)}</td>
        <td>${exp.paymentMode}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="adminApp.deleteExpense('${exp.expenseId}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  addExpense() {
    const category = prompt("Expense Category (Rent, Salary, Electricity, Gas, Raw Materials, Maintenance, Marketing, Equipment, Software, Transportation, Miscellaneous):", "Raw Materials");
    const amount = prompt("Amount (₹):", "1000");
    const description = prompt("Description:", "Supplier invoice");

    if (category && amount) {
      window.dbService.addExpense({
        category,
        amount,
        description: description || '',
        paymentMode: 'Cash',
        date: new Date().toISOString().substring(0, 10),
        createdBy: 'Super Admin'
      });
      window.showToast("Expense entry logged", "success");
      this.renderExpenses();
    }
  }

  deleteExpense(expenseId) {
    if (!confirm("Delete expense entry?")) return;
    window.dbService.deleteExpense(expenseId);
    window.showToast("Expense entry deleted", "info");
    this.renderExpenses();
  }

  // --- CAPITAL ---
  renderCapital() {
    const capital = window.dbService.getCapital();
    const container = document.getElementById('admin-capital-table');
    if (!container) return;

    container.innerHTML = capital.map(c => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 0.75rem;">${c.date}</td>
        <td><span class="badge badge-info">${c.type}</span></td>
        <td>${c.description}</td>
        <td class="font-bold text-success">${window.formatCurrency(c.amount)}</td>
        <td>${c.createdBy}</td>
      </tr>
    `).join('');
  }

  addCapitalEntry() {
    const type = prompt("Capital Type (INITIAL_CAPITAL, ADDITIONAL_CAPITAL, WITHDRAWAL):", "ADDITIONAL_CAPITAL");
    const amount = prompt("Amount (₹):", "50000");
    const description = prompt("Description:", "Capital infusion");

    if (type && amount) {
      window.dbService.addCapital({
        type,
        amount,
        description: description || '',
        date: new Date().toISOString().substring(0, 10),
        createdBy: 'Super Admin'
      });
      window.showToast("Capital entry logged", "success");
      this.renderCapital();
    }
  }

  // --- MANAGERS ---
  renderManagers() {
    const managers = window.dbService.getManagers();
    const container = document.getElementById('admin-managers-table');
    if (!container) return;

    container.innerHTML = managers.map(m => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td class="font-semibold" style="padding: 0.75rem;">${m.name}</td>
        <td>${m.email}</td>
        <td>${m.mobile}</td>
        <td><span class="badge ${m.isActive ? 'badge-success' : 'badge-danger'}">${m.isActive ? 'Active' : 'Disabled'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="adminApp.toggleManagerStatus('${m.managerId}', ${!m.isActive})">
            ${m.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  }

  addManager() {
    const name = prompt("Manager Name:");
    const email = prompt("Manager Email:");
    const mobile = prompt("Manager Mobile Number:");

    if (name && email && mobile) {
      window.dbService.saveManager({ name, email, mobile });
      window.showToast("Manager account created", "success");
      this.renderManagers();
    }
  }

  toggleManagerStatus(managerId, isActive) {
    window.dbService.saveManager({ managerId, isActive });
    window.showToast("Manager status updated", "info");
    this.renderManagers();
  }

  // --- INVENTORY REQUESTS ---
  renderRequests() {
    const reqs = window.dbService.getInventoryRequests();
    const container = document.getElementById('admin-requests-table');
    if (!container) return;

    container.innerHTML = reqs.map(r => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 0.75rem;">${r.item}</td>
        <td>${r.requestedQuantity}</td>
        <td>${r.reason}</td>
        <td><span class="badge ${r.status === 'PENDING' ? 'badge-warning' : 'badge-success'}">${r.status}</span></td>
        <td>
          ${r.status === 'PENDING' ? `
            <button class="btn btn-success btn-sm" onclick="adminApp.updateReqStatus('${r.requestId}', 'FULFILLED')">Fulfill Request</button>
          ` : 'Done'}
        </td>
      </tr>
    `).join('');
  }

  updateReqStatus(requestId, status) {
    window.dbService.updateInventoryRequestStatus(requestId, status);
    window.showToast("Request updated", "success");
    this.renderRequests();
  }

  // --- REPORT CSV EXPORT ---
  exportReportCSV(type) {
    let data = [];
    let filename = `Report_${type}_${Date.now()}.csv`;

    if (type === 'sales') data = window.dbService.getInvoices();
    if (type === 'orders') data = window.dbService.getOrders();
    if (type === 'inventory') data = window.dbService.getInventory();
    if (type === 'expenses') data = window.dbService.getExpenses();

    if (data.length === 0) {
      window.showToast("No data available to export!", "warning");
      return;
    }

    const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    let csv = keys.join(',') + '\n';
    
    data.forEach(row => {
      csv += keys.map(k => `"${(row[k] || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    window.showToast(`Exported ${type} report as CSV!`, "success");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminDashboardApp();
});
