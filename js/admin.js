/**
 * Super Admin Executive Dashboard Controller
 */

class AdminDashboardApp {
  constructor() {
    this.activeFilter = 'today'; // Default to Today so admin sees today's revenue on load
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
    window.dbService.subscribe('landingConfig', () => this.refreshData());

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
    if (this.activeView === 'landing') this.renderLandingView();
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
    this.customFrom = null;
    this.customTo = null;

    document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`filter-${filterType}`);
    if (btn) btn.classList.add('active');

    // Hide custom date row unless custom is selected
    const customRow = document.getElementById('custom-date-row');
    if (customRow) customRow.style.display = filterType === 'custom' ? 'flex' : 'none';

    this.refreshData();
  }

  toggleCustomDatePicker() {
    const customRow = document.getElementById('custom-date-row');
    if (!customRow) return;
    const isVisible = customRow.style.display === 'flex';
    if (isVisible) {
      customRow.style.display = 'none';
      // Revert to today if we close without applying
      if (this.activeFilter === 'custom') this.setDateFilter('today');
    } else {
      // Pre-fill with today
      const today = new Date().toISOString().substring(0, 10);
      const fromEl = document.getElementById('custom-date-from');
      const toEl   = document.getElementById('custom-date-to');
      if (fromEl && !fromEl.value) fromEl.value = today;
      if (toEl   && !toEl.value)   toEl.value   = today;
      customRow.style.display = 'flex';
      this.activeFilter = 'custom';
      document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('filter-custom');
      if (btn) btn.classList.add('active');
      this.applyCustomDateFilter();
    }
  }

  applyCustomDateFilter() {
    const fromEl = document.getElementById('custom-date-from');
    const toEl   = document.getElementById('custom-date-to');
    if (!fromEl || !toEl || !fromEl.value || !toEl.value) return;

    const fromDate = new Date(fromEl.value);
    const toDate   = new Date(toEl.value);
    toDate.setHours(23, 59, 59, 999); // include full to-day

    if (fromDate > toDate) {
      window.showToast('Start date must be before end date', 'warning');
      return;
    }

    this.customFrom = fromDate.getTime();
    this.customTo   = toDate.getTime();
    this.activeFilter = 'custom';

    const labelEl = document.getElementById('custom-date-label');
    if (labelEl) labelEl.textContent = `Showing: ${fromEl.value} → ${toEl.value}`;

    this.refreshData();
  }

  /**
   * _getPeriodLabel() — returns a human-readable string for the current filter.
   */
  _getPeriodLabel() {
    const now = new Date();
    const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (this.activeFilter === 'today')     return `Showing data for: Today (${fmt(now)})`;
    if (this.activeFilter === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return `Showing data for: Yesterday (${fmt(y)})`;
    }
    if (this.activeFilter === 'week') {
      const dow = now.getDay(); // 0=Sun
      const monOffset = (dow === 0) ? -6 : 1 - dow;
      const mon = new Date(now); mon.setDate(now.getDate() + monOffset);
      return `Showing data for: This Week (${fmt(mon)} – ${fmt(now)})`;
    }
    if (this.activeFilter === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return `Showing data for: This Month (${fmt(first)} – ${fmt(now)})`;
    }
    if (this.activeFilter === 'all') return 'Showing data for: All Time';
    if (this.activeFilter === 'custom' && this.customFrom && this.customTo) {
      return `Showing data for: ${fmt(new Date(this.customFrom))} → ${fmt(new Date(this.customTo))}`;
    }
    return '';
  }

  /**
   * filterByDate(items, dateField)
   * Supports: today, yesterday, week (Mon–now), month (1st–now), all, custom
   * Also handles expenses whose dateField may be a 'YYYY-MM-DD' string (converts to timestamp).
   */
  filterByDate(items, dateField = 'createdAt') {
    const now     = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const startOfToday = new Date(y, m, d).getTime();
    const startOfYesterday = startOfToday - 86400000;

    // Start of this calendar week (Monday)
    const dow = now.getDay(); // 0=Sun
    const monOffset = (dow === 0) ? -6 : 1 - dow;
    const startOfWeek = new Date(y, m, d + monOffset).getTime();

    // Start of this calendar month
    const startOfMonth = new Date(y, m, 1).getTime();

    return items.filter(item => {
      let raw = item[dateField];
      if (!raw && item.date) raw = item.date;
      if (!raw && item.createdAt) raw = item.createdAt;

      // Handle date strings (e.g. 'YYYY-MM-DD' or ISO)
      if (typeof raw === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
          raw = new Date(raw.trim() + 'T00:00:00').getTime();
        } else {
          raw = new Date(raw).getTime();
        }
      }
      const time = (typeof raw === 'number' && !isNaN(raw)) ? raw : 0;

      if (this.activeFilter === 'today')     return time >= startOfToday;
      if (this.activeFilter === 'yesterday') return time >= startOfYesterday && time < startOfToday;
      if (this.activeFilter === 'week')      return time >= startOfWeek;
      if (this.activeFilter === 'month')     return time >= startOfMonth;
      if (this.activeFilter === 'all')       return true;
      if (this.activeFilter === 'custom')    return this.customFrom != null && time >= this.customFrom && time <= this.customTo;
      return true; // default
    });
  }

  // --- DASHBOARD OVERVIEW ---
  renderDashboard() {
    const allInvoices = window.dbService.getInvoices();
    const allOrders   = window.dbService.getOrders();
    const tables      = window.dbService.getTables();
    const allExpenses = window.dbService.getExpenses();

    const filteredInvoices = this.filterByDate(allInvoices, 'createdAt');
    // Only count fully COMPLETED or SERVED KOTs (not PENDING/CANCELLED)
    const filteredCompletedOrders = this.filterByDate(
      allOrders.filter(o => o.status === 'COMPLETED' || o.status === 'SERVED'),
      'createdAt'
    );
    // Expenses: filter by createdAt timestamp (addExpense stores it), fallback to date string
    const filteredExpenses = this.filterByDate(allExpenses, 'createdAt');

    const totalRevenue  = filteredInvoices.reduce((s, inv) => s + (parseFloat(inv.total) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0);
    const netSurplus    = totalRevenue - totalExpenses;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('admin-kpi-revenue',   window.formatCurrency(totalRevenue));
    set('admin-kpi-bills',     filteredInvoices.length);
    set('admin-kpi-orders',    filteredCompletedOrders.length);
    set('admin-kpi-expenses',  window.formatCurrency(totalExpenses));
    set('admin-kpi-net',       window.formatCurrency(netSurplus));
    set('admin-kpi-avail-tbl', tables.filter(t => t.status === 'AVAILABLE').length);
    set('admin-kpi-occ-tbl',   tables.filter(t => t.status === 'OCCUPIED' || t.status === 'WAITING_FOR_SETTLEMENT').length);

    // Period label
    const periodEl = document.getElementById('dashboard-period-label');
    if (periodEl) periodEl.textContent = this._getPeriodLabel();

    // Inventory alerts
    const inventory = window.dbService.getInventory();
    const lowStock  = inventory.filter(i => i.currentQuantity <= i.minimumQuantity);
    const lowEl = document.getElementById('admin-low-stock-list');
    if (lowEl) {
      if (lowStock.length === 0) {
        lowEl.innerHTML = `<div class="text-sm text-success">✅ All inventory stock levels are healthy!</div>`;
      } else {
        lowEl.innerHTML = lowStock.map(i => `
          <div class="flex justify-between items-center text-sm" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
            <span class="font-semibold">${i.itemName}</span>
            <span class="badge badge-danger">⚠️ ${i.currentQuantity} ${i.unit} (Min ${i.minimumQuantity})</span>
          </div>
        `).join('');
      }
    }

    this.renderSVGChart('dashboard-sales-chart', filteredInvoices);
  }

  // --- REVENUE ANALYTICS ---
  renderAnalytics() {
    const allInvoices = window.dbService.getInvoices();
    const filtered    = this.filterByDate(allInvoices, 'createdAt');

    // totalSales = sum of all invoice grand totals (incl. GST) — this IS the actual revenue collected
    const totalSales     = filtered.reduce((s, i) => s + (i.total || 0), 0);
    const totalGst       = filtered.reduce((s, i) => s + (i.gst || 0), 0);
    const totalDiscounts = filtered.reduce((s, i) => s + (i.discount || 0), 0);

    // Net pre-tax revenue = sum of taxable (subtotal - discount) from each invoice
    // inv.subtotal is the raw food amount before discount; inv.discount is the applied discount
    const netRevenue = filtered.reduce((s, i) => {
      const taxable = Math.max(0, (i.subtotal || 0) - (i.discount || 0));
      return s + taxable;
    }, 0);

    const maxBill        = filtered.length > 0 ? Math.max(...filtered.map(i => i.total || 0)) : 0;
    const avgBill        = filtered.length > 0 ? totalSales / filtered.length : 0;

    // Count total items sold (summing quantities across all invoices)
    let totalItemsSold = 0;
    const itemSalesMap = {}; // foodName -> { qty, revenue }
    filtered.forEach(inv => {
      (inv.items || []).forEach(it => {
        totalItemsSold += (it.quantity || 0);
        const key = it.foodName || 'Unknown';
        if (!itemSalesMap[key]) itemSalesMap[key] = { qty: 0, revenue: 0 };
        itemSalesMap[key].qty     += (it.quantity || 0);
        itemSalesMap[key].revenue += (it.subtotal || (it.price * it.quantity) || 0);
      });
    });

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('analytics-total-sales',  window.formatCurrency(totalSales));
    set('analytics-net-rev',      window.formatCurrency(netRevenue));
    set('analytics-gst',          window.formatCurrency(totalGst));
    set('analytics-discounts',    window.formatCurrency(totalDiscounts));
    set('analytics-avg-bill',     window.formatCurrency(avgBill));
    set('analytics-max-bill',     window.formatCurrency(maxBill));
    set('analytics-items-sold',   totalItemsSold);

    // Period label
    const periodEl = document.getElementById('analytics-period-label');
    if (periodEl) periodEl.textContent = this._getPeriodLabel();

    // Payment mode bar chart
    this.renderSVGChart('analytics-payment-chart', filtered);

    // Top-5 items bar
    const topItems = Object.entries(itemSalesMap)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);
    const topContainer = document.getElementById('analytics-top-items');
    if (topContainer) {
      if (topItems.length === 0) {
        topContainer.innerHTML = `<div class="text-sm text-secondary text-center" style="padding:1rem;">No sales data for this period.</div>`;
      } else {
        const maxQty = topItems[0][1].qty || 1;
        topContainer.innerHTML = topItems.map(([name, stat]) => {
          const pct = Math.max(8, Math.round((stat.qty / maxQty) * 100));
          return `
            <div style="margin-bottom:0.75rem;">
              <div class="flex justify-between text-sm" style="margin-bottom:2px;">
                <span class="font-semibold">${name}</span>
                <span class="text-secondary">${stat.qty} sold · ${window.formatCurrency(stat.revenue)}</span>
              </div>
              <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:8px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:var(--accent-gradient);border-radius:4px;transition:width 0.4s;"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
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




  // --- PRODUCT CATALOG MANAGEMENT ---
  renderProducts() {
    const products = window.dbService.getProducts();
    const container = document.getElementById('admin-products-table');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Menu Products Found</div>
            <div style="font-size: 0.875rem;">Click <strong>+ Add New Product</strong> above to create a menu item.</div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = products.map(p => `
      <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
        <td style="padding: 0.75rem; text-align: left;">
          <div class="flex items-center gap-2" style="justify-content: flex-start; text-align: left;">
            <img src="${p.imageUrl}" style="width: 42px; height: 42px; border-radius: var(--radius-sm); object-fit: cover; flex-shrink: 0;" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
            <div style="text-align: left;">
              <div class="font-semibold text-left" style="text-align: left;">${p.foodName}</div>
              <div class="text-xs text-muted text-left" style="text-align: left;">${p.category}</div>
            </div>
          </div>
        </td>
        <td class="font-bold text-accent" style="text-align: left;">${window.formatCurrency(p.price)}</td>
        <td style="text-align: left;">
          <span class="badge ${p.isAvailable ? 'badge-success' : 'badge-danger'}">
            ${p.isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </td>
        <td style="text-align: left;">${p.inventoryLinked ? `Linked (${p.inventoryQuantity})` : 'Not Linked'}</td>
        <td style="text-align: left;">
          <div class="flex gap-2" style="justify-content: flex-start;">
            <button class="btn btn-secondary btn-sm" onclick="adminApp.openProductModal('${p.productId}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="adminApp.deleteProduct('${p.productId}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  previewProductImage(url) {
    const previewContainer = document.getElementById('prod-modal-img-preview');
    const imgEl = document.getElementById('prod-modal-img-element');
    const statusEl = document.getElementById('prod-modal-img-status');
    if (!previewContainer || !imgEl) return;

    const trimmed = (url || '').trim();
    if (trimmed) {
      const clean = trimmed.replace(/([^:])\/\/+/g, '$1/');
      imgEl.src = clean;
      previewContainer.style.display = 'flex';
      if (statusEl) statusEl.textContent = 'Previewing Image';
    } else {
      previewContainer.style.display = 'none';
      imgEl.src = '';
    }
  }

  openProductModal(productId = null) {
    const prod = productId ? window.dbService.getProducts().find(p => p.productId === productId) : null;
    
    document.getElementById('prod-modal-id').value = prod ? prod.productId : '';
    document.getElementById('prod-modal-name').value = prod ? prod.foodName : '';
    document.getElementById('prod-modal-category').value = prod ? prod.category : 'South Indian / Dosa';
    document.getElementById('prod-modal-price').value = prod ? prod.price : '';
    const imgVal = prod ? prod.imageUrl : '';
    document.getElementById('prod-modal-img').value = imgVal;
    document.getElementById('prod-modal-desc').value = prod ? prod.description : '';
    document.getElementById('prod-modal-available').checked = prod ? prod.isAvailable : true;
    document.getElementById('prod-modal-threshold').value = prod ? prod.lowStockThreshold : 5;

    const titleEl = document.getElementById('prod-modal-title');
    if (titleEl) titleEl.textContent = prod ? '✏️ Edit Product Details' : '🍽️ Add New Menu Product';
    const submitBtn = document.getElementById('prod-modal-submit-btn');
    if (submitBtn) submitBtn.textContent = prod ? '💾 Update Product' : '💾 Save Product';

    this.previewProductImage(imgVal);
    document.getElementById('product-edit-modal').classList.add('active');
  }

  async saveProductFromModal(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const productId = document.getElementById('prod-modal-id').value;
    const foodName = (document.getElementById('prod-modal-name').value || '').trim();
    const category = document.getElementById('prod-modal-category').value;
    const price = parseFloat(document.getElementById('prod-modal-price').value || 0);
    const rawImg = (document.getElementById('prod-modal-img').value || '').trim();
    const imageUrl = rawImg ? rawImg.replace(/([^:])\/\/+/g, '$1/') : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
    const description = (document.getElementById('prod-modal-desc').value || '').trim();
    const isAvailable = document.getElementById('prod-modal-available').checked;
    const lowStockThreshold = parseInt(document.getElementById('prod-modal-threshold').value || 5);

    if (!foodName) {
      window.showToast("Please enter a food name", "danger");
      return;
    }

    if (isNaN(price) || price < 0) {
      window.showToast("Please enter a valid price", "danger");
      return;
    }

    const submitBtn = document.getElementById('prod-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
    }

    try {
      await window.dbService.saveProduct({
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
      window.showToast(`✅ Product "${foodName}" saved successfully!`, "success");
      this.renderProducts();
    } catch(err) {
      console.error("Save product error:", err);
      window.showToast("Error saving product: " + err.message, "danger");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = productId ? '💾 Update Product' : '💾 Save Product';
      }
    }
  }

  async deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await window.dbService.deleteProduct(productId);
      window.showToast("Product deleted successfully.", "info");
      this.renderProducts();
    } catch(err) {
      console.error("Delete product error:", err);
      window.showToast("Error deleting product: " + err.message, "danger");
    }
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

  async saveBusinessProfile(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    let submitBtn = null;
    if (e && e.target) {
      if (e.target.tagName === 'BUTTON') submitBtn = e.target;
      else if (e.target.querySelector) submitBtn = e.target.querySelector('button');
    }
    if (!submitBtn) submitBtn = document.querySelector('#admin-panel-business button');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `⏳ Pushing data to Firebase...`;
    }

    const newProfile = {
      businessName: document.getElementById('biz-name').value,
      logo: document.getElementById('biz-logo').value,
      address: document.getElementById('biz-address').value,
      gstNumber: document.getElementById('biz-gstin').value,
      gstPercentage: parseFloat(document.getElementById('biz-gst-pct').value || 5),
      phone: document.getElementById('biz-phone').value,
      email: document.getElementById('biz-email').value,
      invoicePrefix: document.getElementById('biz-prefix').value,
      invoiceFooter: document.getElementById('biz-footer').value
    };

    try {
      const res = await window.dbService.updateBusinessProfile(newProfile);
      if (res && res.firebaseSuccess) {
        window.showToast("🔥 Business Profile data has been saved & pushed successfully to Firebase!", "success", 4000);
      } else {
        window.showToast("✅ Business Profile data saved successfully!", "success", 4000);
      }
    } catch(err) {
      console.error("Firebase save error:", err);
      window.showToast("❌ Failed to push data: " + err.message, "danger", 4000);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Save Business Profile`;
      }
      this.renderBusinessView();
    }
  }

  // --- MANAGE LANDING PAGE CMS ---
  renderLandingView() {
    const config = window.dbService.getLandingPageConfig();
    if (!config) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    // Brand & Header
    setVal('landing-brand-name', config.brandName);
    setVal('landing-logo-url', config.logoUrl);
    setVal('landing-header-cta-text', config.headerCtaText);
    setVal('landing-header-cta-link', config.headerCtaLink);

    // Hero Section
    setVal('landing-hero-badge', config.heroBadge);
    setVal('landing-hero-title', config.heroTitle);
    setVal('landing-hero-subtitle', config.heroSubtitle);
    setVal('landing-hero-image-url', config.heroImageUrl);
    setVal('landing-hero-cta1-text', config.heroCtaPrimaryText);
    setVal('landing-hero-cta1-link', config.heroCtaPrimaryLink);
    setVal('landing-hero-cta2-text', config.heroCtaSecondaryText);
    setVal('landing-hero-cta2-link', config.heroCtaSecondaryLink);

    // Key Stats
    setVal('landing-stat1-val', config.stat1Val);
    setVal('landing-stat1-lbl', config.stat1Label);
    setVal('landing-stat2-val', config.stat2Val);
    setVal('landing-stat2-lbl', config.stat2Label);
    setVal('landing-stat3-val', config.stat3Val);
    setVal('landing-stat3-lbl', config.stat3Label);
    setVal('landing-stat4-val', config.stat4Val);
    setVal('landing-stat4-lbl', config.stat4Label);

    // Active Offers
    setVal('landing-off1-badge', config.offer1Badge);
    setVal('landing-off1-title', config.offer1Title);
    setVal('landing-off1-price', config.offer1Price);
    setVal('landing-off1-img', config.offer1ImageUrl);
    setVal('landing-off1-desc', config.offer1Desc);

    setVal('landing-off2-badge', config.offer2Badge);
    setVal('landing-off2-title', config.offer2Title);
    setVal('landing-off2-price', config.offer2Price);
    setVal('landing-off2-img', config.offer2ImageUrl);
    setVal('landing-off2-desc', config.offer2Desc);

    setVal('landing-off3-badge', config.offer3Badge);
    setVal('landing-off3-title', config.offer3Title);
    setVal('landing-off3-price', config.offer3Price);
    setVal('landing-off3-img', config.offer3ImageUrl);
    setVal('landing-off3-desc', config.offer3Desc);

    // Feature / Facility Cards
    setVal('landing-feat1-title', config.feature1Title);
    setVal('landing-feat1-img', config.feature1ImageUrl);
    setVal('landing-feat1-desc', config.feature1Desc);

    setVal('landing-feat2-title', config.feature2Title);
    setVal('landing-feat2-img', config.feature2ImageUrl);
    setVal('landing-feat2-desc', config.feature2Desc);

    setVal('landing-feat3-title', config.feature3Title);
    setVal('landing-feat3-img', config.feature3ImageUrl);
    setVal('landing-feat3-desc', config.feature3Desc);

    // Gallery
    setVal('landing-gal-title', config.galleryTitle);
    setVal('landing-gal-sub', config.gallerySubtitle);
    setVal('landing-gal1-title', config.gallery1Title);
    setVal('landing-gal1-tag', config.gallery1Tag);
    setVal('landing-gal1-img', config.gallery1ImageUrl);

    setVal('landing-gal2-title', config.gallery2Title);
    setVal('landing-gal2-tag', config.gallery2Tag);
    setVal('landing-gal2-img', config.gallery2ImageUrl);

    setVal('landing-gal3-title', config.gallery3Title);
    setVal('landing-gal3-tag', config.gallery3Tag);
    setVal('landing-gal3-img', config.gallery3ImageUrl);

    // Reviews
    setVal('landing-test-title', config.testimonialTitle);
    setVal('landing-test-sub', config.testimonialSubtitle);
    setVal('landing-rev1-quote', config.review1Quote);
    setVal('landing-rev1-author', config.review1Author);
    setVal('landing-rev1-role', config.review1Role);
    setVal('landing-rev1-img', config.review1AvatarUrl);

    setVal('landing-rev2-quote', config.review2Quote);
    setVal('landing-rev2-author', config.review2Author);
    setVal('landing-rev2-role', config.review2Role);
    setVal('landing-rev2-img', config.review2AvatarUrl);

    // Footer
    setVal('landing-foot-tagline', config.footerTagline);
    setVal('landing-foot-address', config.footerAddress);
    setVal('landing-foot-phone', config.footerPhone);
    setVal('landing-foot-email', config.footerEmail);
    setVal('landing-foot-copy', config.footerCopyright);

    // Social Media Links
    setVal('landing-soc-instagram', config.socialInstagram);
    setVal('landing-soc-facebook', config.socialFacebook);
    setVal('landing-soc-whatsapp', config.socialWhatsApp);
    setVal('landing-soc-youtube', config.socialYouTube);
    setVal('landing-soc-twitter', config.socialTwitter);
  }

  async saveLandingConfigFromForm(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const newConfig = {
      brandName: getVal('landing-brand-name'),
      logoUrl: getVal('landing-logo-url'),
      headerCtaText: getVal('landing-header-cta-text'),
      headerCtaLink: getVal('landing-header-cta-link'),

      heroBadge: getVal('landing-hero-badge'),
      heroTitle: getVal('landing-hero-title'),
      heroSubtitle: getVal('landing-hero-subtitle'),
      heroImageUrl: getVal('landing-hero-image-url'),
      heroCtaPrimaryText: getVal('landing-hero-cta1-text'),
      heroCtaPrimaryLink: getVal('landing-hero-cta1-link'),
      heroCtaSecondaryText: getVal('landing-hero-cta2-text'),
      heroCtaSecondaryLink: getVal('landing-hero-cta2-link'),

      stat1Val: getVal('landing-stat1-val'),
      stat1Label: getVal('landing-stat1-lbl'),
      stat2Val: getVal('landing-stat2-val'),
      stat2Label: getVal('landing-stat2-lbl'),
      stat3Val: getVal('landing-stat3-val'),
      stat3Label: getVal('landing-stat3-lbl'),
      stat4Val: getVal('landing-stat4-val'),
      stat4Label: getVal('landing-stat4-lbl'),

      offer1Badge: getVal('landing-off1-badge'),
      offer1Title: getVal('landing-off1-title'),
      offer1Price: getVal('landing-off1-price'),
      offer1ImageUrl: getVal('landing-off1-img'),
      offer1Desc: getVal('landing-off1-desc'),

      offer2Badge: getVal('landing-off2-badge'),
      offer2Title: getVal('landing-off2-title'),
      offer2Price: getVal('landing-off2-price'),
      offer2ImageUrl: getVal('landing-off2-img'),
      offer2Desc: getVal('landing-off2-desc'),

      offer3Badge: getVal('landing-off3-badge'),
      offer3Title: getVal('landing-off3-title'),
      offer3Price: getVal('landing-off3-price'),
      offer3ImageUrl: getVal('landing-off3-img'),
      offer3Desc: getVal('landing-off3-desc'),

      feature1Title: getVal('landing-feat1-title'),
      feature1ImageUrl: getVal('landing-feat1-img'),
      feature1Desc: getVal('landing-feat1-desc'),

      feature2Title: getVal('landing-feat2-title'),
      feature2ImageUrl: getVal('landing-feat2-img'),
      feature2Desc: getVal('landing-feat2-desc'),

      feature3Title: getVal('landing-feat3-title'),
      feature3ImageUrl: getVal('landing-feat3-img'),
      feature3Desc: getVal('landing-feat3-desc'),

      galleryTitle: getVal('landing-gal-title'),
      gallerySubtitle: getVal('landing-gal-sub'),
      gallery1Title: getVal('landing-gal1-title'),
      gallery1Tag: getVal('landing-gal1-tag'),
      gallery1ImageUrl: getVal('landing-gal1-img'),

      gallery2Title: getVal('landing-gal2-title'),
      gallery2Tag: getVal('landing-gal2-tag'),
      gallery2ImageUrl: getVal('landing-gal2-img'),

      gallery3Title: getVal('landing-gal3-title'),
      gallery3Tag: getVal('landing-gal3-tag'),
      gallery3ImageUrl: getVal('landing-gal3-img'),

      testimonialTitle: getVal('landing-test-title'),
      testimonialSubtitle: getVal('landing-test-sub'),
      review1Quote: getVal('landing-rev1-quote'),
      review1Author: getVal('landing-rev1-author'),
      review1Role: getVal('landing-rev1-role'),
      review1AvatarUrl: getVal('landing-rev1-img'),

      review2Quote: getVal('landing-rev2-quote'),
      review2Author: getVal('landing-rev2-author'),
      review2Role: getVal('landing-rev2-role'),
      review2AvatarUrl: getVal('landing-rev2-img'),

      footerTagline: getVal('landing-foot-tagline'),
      footerAddress: getVal('landing-foot-address'),
      footerPhone: getVal('landing-foot-phone'),
      footerEmail: getVal('landing-foot-email'),
      footerCopyright: getVal('landing-foot-copy'),

      socialInstagram: getVal('landing-soc-instagram'),
      socialFacebook: getVal('landing-soc-facebook'),
      socialWhatsApp: getVal('landing-soc-whatsapp'),
      socialYouTube: getVal('landing-soc-youtube'),
      socialTwitter: getVal('landing-soc-twitter')
    };

    let submitBtn = null;
    if (e && e.target) {
      if (e.target.tagName === 'BUTTON') submitBtn = e.target;
      else if (e.target.querySelector) submitBtn = e.target.querySelector('button');
    }
    if (!submitBtn) submitBtn = document.querySelector('#admin-panel-landing button');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `⏳ Pushing data to Firebase...`;
    }

    try {
      const res = await window.dbService.saveLandingPageConfig(newConfig);
      if (res && res.firebaseSuccess) {
        window.showToast("🔥 Landing Page data saved & published live to Firebase!", "success", 4000);
      } else {
        window.showToast("✅ Landing Page data saved successfully!", "success", 4000);
      }

      // Show Success Modal
      const modal = document.getElementById('cms-success-modal');
      if (modal) {
        modal.classList.add('active');
      }
    } catch(err) {
      console.error("Firebase save error:", err);
      window.showToast("❌ Failed to push data: " + err.message, "danger", 4000);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `💾 Save & Publish Vanakkam Cafe CMS`;
      }
      this.renderLandingView();
    }
  }

  // --- INVOICES MANAGEMENT ---
  renderInvoices() {
    const allInvoices = window.dbService.getInvoices();
    const invoices = this.filterByDate(allInvoices, 'createdAt');
    const container = document.getElementById('admin-invoices-table');
    if (!container) return;

    const netFoodVal = (inv) => {
      const subtotal = parseFloat(inv.subtotal) || 0;
      const discount = parseFloat(inv.discount) || 0;
      if (subtotal > 0) {
        return Math.max(0, subtotal - discount);
      }
      const total = parseFloat(inv.total) || 0;
      const gst = parseFloat(inv.gst) || 0;
      return Math.max(0, total - gst);
    };

    const totalGross = invoices.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
    const totalGst   = invoices.reduce((s, i) => s + (parseFloat(i.gst) || 0), 0);
    const totalNet   = invoices.reduce((s, i) => s + netFoodVal(i), 0);

    const countEl = document.getElementById('admin-inv-kpi-count');
    const netEl   = document.getElementById('admin-inv-kpi-net');
    const gstEl   = document.getElementById('admin-inv-kpi-gst');
    const totalEl = document.getElementById('admin-inv-kpi-total');
    const periodEl = document.getElementById('admin-inv-period-label');

    if (countEl) countEl.textContent = invoices.length;
    if (netEl)   netEl.textContent   = window.formatCurrency(totalNet);
    if (gstEl)   gstEl.textContent   = window.formatCurrency(totalGst);
    if (totalEl) totalEl.textContent = window.formatCurrency(totalGross);
    if (periodEl) periodEl.textContent = this._getPeriodLabel();

    const searchInput = document.getElementById('admin-invoice-search');
    const query = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

    let displayInvoices = invoices;
    if (query) {
      displayInvoices = invoices.filter(inv =>
        (inv.billDisplayNumber && inv.billDisplayNumber.toLowerCase().includes(query)) ||
        (inv.invoiceId && inv.invoiceId.toLowerCase().includes(query)) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(query)) ||
        (inv.customerMobile && inv.customerMobile.includes(query)) ||
        (inv.tableNumber && inv.tableNumber.toLowerCase().includes(query))
      );
    }

    if (!displayInvoices || displayInvoices.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="9" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Tax Invoices Found</div>
            <div style="font-size: 0.875rem;">Settled order invoices will appear here automatically for the selected date range.</div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = displayInvoices.map(inv => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td class="font-bold" style="padding: 0.75rem;">${inv.billDisplayNumber || inv.invoiceId}</td>
        <td>${window.formatDateTime(inv.createdAt)}</td>
        <td>${inv.customerName} (${inv.customerMobile})</td>
        <td>${inv.tableNumber}</td>
        <td>${window.formatCurrency(netFoodVal(inv))}</td>
        <td class="text-warning font-semibold">${window.formatCurrency(inv.gst || 0)}</td>
        <td class="font-bold text-accent">${window.formatCurrency(inv.total)}</td>
        <td><span class="badge badge-info">${inv.paymentMode}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="adminApp.printAdminInvoice('${inv.invoiceId}')">🖨️ Print</button>
        </td>
      </tr>
    `).join('');
  }

  printAdminInvoice(invoiceId) {
    const invoice = window.dbService.getInvoices().find(i => i.invoiceId === invoiceId);
    if (!invoice) { window.showToast('Invoice not found', 'danger'); return; }
    const w = window.open('', '_blank', 'width=420,height=700');
    const biz = invoice.businessSnapshot || {};
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice.billDisplayNumber || invoice.invoiceId}</title>
    <style>body{font-family:monospace;padding:1rem;max-width:380px;margin:auto;}
    .center{text-align:center;}.bold{font-weight:700;}.divider{border-top:1px dashed #000;margin:0.5rem 0;}
    table{width:100%;border-collapse:collapse;}td{padding:2px 4px;font-size:12px;}
    .right{text-align:right;}.total-row{border-top:1px solid #000;font-weight:700;}
    </style></head><body onload="window.print()">
    <div class="center bold" style="font-size:16px">${biz.businessName || 'Cafe'}</div>
    <div class="center" style="font-size:11px">${biz.address || ''}</div>
    <div class="center" style="font-size:11px">GSTIN: ${biz.gstNumber || '-'} | Ph: ${biz.phone || '-'}</div>
    <div class="divider"></div>
    <table><tr><td>BILL #:</td><td class="right bold">${invoice.billDisplayNumber || invoice.invoiceId}</td></tr>
    <tr><td>Date:</td><td class="right">${new Date(invoice.createdAt).toLocaleString('en-IN')}</td></tr>
    <tr><td>Table:</td><td class="right">${invoice.tableNumber}</td></tr>
    <tr><td>Guest:</td><td class="right">${invoice.customerName}</td></tr>
    <tr><td>Payment:</td><td class="right">${invoice.paymentMode}</td></tr></table>
    <div class="divider"></div>
    <table><tr><td class="bold">Item</td><td class="bold right">Qty</td><td class="bold right">Price</td><td class="bold right">Amt</td></tr>
    ${(invoice.items||[]).map(it=>`<tr><td>${it.foodName}</td><td class="right">${it.quantity}</td><td class="right">₹${it.price}</td><td class="right">₹${(it.subtotal||it.price*it.quantity).toFixed(2)}</td></tr>`).join('')}
    </table>
    <div class="divider"></div>
    <table>
    <tr><td>Subtotal:</td><td class="right">₹${(invoice.subtotal||0).toFixed(2)}</td></tr>
    ${invoice.discount>0?`<tr><td>Discount:</td><td class="right">-₹${invoice.discount.toFixed(2)}</td></tr>`:''}
    <tr><td>GST (${biz.gstPercentage||5}%):</td><td class="right">₹${(invoice.gst||0).toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL:</td><td class="right">₹${(invoice.total||0).toFixed(2)}</td></tr>
    </table>
    <div class="divider"></div>
    <div class="center" style="font-size:11px;font-style:italic">${biz.invoiceFooter||'Thank you! Please visit again.'}</div>
    </body></html>`);
    w.document.close();
  }


  // --- INVENTORY MANAGEMENT ---
  renderInventory() {
    const inventory = window.dbService.getInventory();
    const container = document.getElementById('admin-inventory-table');
    const countBadge = document.getElementById('inv-count-badge');
    if (countBadge) countBadge.textContent = `${inventory.length} Items`;

    if (container) {
      if (!inventory || inventory.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
              <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Inventory Stock Items</div>
              <div style="font-size: 0.875rem;">Click <strong>+ Add Inventory Item</strong> above to start tracking raw materials.</div>
            </td>
          </tr>
        `;
      } else {
        container.innerHTML = inventory.map(inv => {
          const isLow = inv.currentQuantity <= inv.minimumQuantity;
          return `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 0.75rem; text-align: left;">
                <div class="font-semibold text-white">${inv.itemName}</div>
                ${inv.location ? `<div class="text-xs text-secondary">📍 ${inv.location}</div>` : ''}
              </td>
              <td><span class="badge badge-info">${inv.category}</span></td>
              <td>
                <span class="${isLow ? 'text-danger font-bold' : 'font-bold'}" style="${isLow ? 'background: rgba(239, 68, 68, 0.15); padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px solid #EF4444;' : ''}">
                  ${isLow ? '⚠️ ' : ''}${inv.currentQuantity} ${inv.unit}
                </span>
              </td>
              <td class="text-secondary">${inv.minimumQuantity} ${inv.unit}</td>
              <td class="font-semibold text-accent">${window.formatCurrency(inv.purchasePrice)}</td>
              <td class="text-xs text-secondary">${inv.supplier || '—'}</td>
              <td>
                <div class="flex justify-center gap-1">
                  <button class="btn btn-primary btn-sm" onclick="adminApp.openStockMovementModal('${inv.inventoryId}')" title="Adjust Stock">📊 Adjust</button>
                  <button class="btn btn-secondary btn-sm" onclick="adminApp.openInventoryModal('${inv.inventoryId}')" title="Edit Item Details">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="adminApp.deleteInventoryItem('${inv.inventoryId}')" title="Delete Inventory Item">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Stock Movements Ledger
    const movements = window.dbService.getInventoryMovements();
    const movContainer = document.getElementById('admin-inventory-movements-table');
    const movCountBadge = document.getElementById('inv-mov-count-badge');
    if (movCountBadge) movCountBadge.textContent = `${movements.length} Movements`;

    if (movContainer) {
      if (!movements || movements.length === 0) {
        movContainer.innerHTML = `
          <tr>
            <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-secondary);">
              <div style="font-size: 0.95rem;">No stock movement records logged yet.</div>
            </td>
          </tr>
        `;
      } else {
        movContainer.innerHTML = movements.slice(0, 50).map(m => {
          const isInflow = m.type === 'PURCHASE' || m.type === 'RETURN' || m.type === 'ADJUSTMENT';
          const typeBadgeColor = isInflow ? '#10B981' : '#EF4444';
          const typeSign = isInflow ? '+' : '-';
          return `
            <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
              <td style="padding: 0.75rem;">${window.formatDateTime(m.createdAt)}</td>
              <td class="font-semibold text-white">${m.itemName}</td>
              <td>
                <span class="badge" style="background: ${isInflow ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${typeBadgeColor}; border: 1px solid ${typeBadgeColor}; font-weight: 700;">
                  ${m.type}
                </span>
              </td>
              <td class="font-bold" style="color: ${typeBadgeColor};">
                ${typeSign}${m.quantity} ${m.unit || ''}
              </td>
              <td class="text-secondary">${m.reason || '—'}</td>
              <td class="text-xs">${m.createdBy || 'Super Admin'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  openInventoryModal(inventoryId = null) {
    const form = document.getElementById('inventory-edit-form');
    if (form) form.reset();

    const titleEl = document.getElementById('inv-modal-title');
    const idEl = document.getElementById('inv-item-id');
    const nameEl = document.getElementById('inv-item-name');
    const catEl = document.getElementById('inv-item-category');
    const unitEl = document.getElementById('inv-item-unit');
    const curQtyEl = document.getElementById('inv-item-current-qty');
    const minQtyEl = document.getElementById('inv-item-min-qty');
    const costEl = document.getElementById('inv-item-cost');
    const supEl = document.getElementById('inv-item-supplier');
    const locEl = document.getElementById('inv-item-location');

    if (inventoryId) {
      const inv = window.dbService.getInventory().find(i => i.inventoryId === inventoryId);
      if (inv) {
        if (titleEl) titleEl.innerHTML = `<span>✏️</span> Edit Inventory Item: ${inv.itemName}`;
        if (idEl) idEl.value = inv.inventoryId;
        if (nameEl) nameEl.value = inv.itemName;
        if (catEl) catEl.value = inv.category || 'Dairy';
        if (unitEl) unitEl.value = inv.unit || 'kg';
        if (curQtyEl) curQtyEl.value = inv.currentQuantity;
        if (minQtyEl) minQtyEl.value = inv.minimumQuantity;
        if (costEl) costEl.value = inv.purchasePrice;
        if (supEl) supEl.value = inv.supplier || '';
        if (locEl) locEl.value = inv.location || '';
      }
    } else {
      if (titleEl) titleEl.innerHTML = `<span>📦</span> Add New Inventory Item`;
      if (idEl) idEl.value = '';
      if (curQtyEl) curQtyEl.value = '10';
      if (minQtyEl) minQtyEl.value = '5';
      if (costEl) costEl.value = '0';
    }

    const modal = document.getElementById('inventory-edit-modal');
    if (modal) modal.classList.add('active');
  }

  async handleSaveInventoryItem(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const inventoryId = document.getElementById('inv-item-id').value.trim();
    const itemName = document.getElementById('inv-item-name').value.trim();
    const category = document.getElementById('inv-item-category').value;
    const unit = document.getElementById('inv-item-unit').value;
    const currentQuantity = parseFloat(document.getElementById('inv-item-current-qty').value || 0);
    const minimumQuantity = parseFloat(document.getElementById('inv-item-min-qty').value || 0);
    const purchasePrice = parseFloat(document.getElementById('inv-item-cost').value || 0);
    const supplier = (document.getElementById('inv-item-supplier').value || '').trim();
    const location = (document.getElementById('inv-item-location').value || '').trim();

    if (!itemName) {
      window.showToast("Please enter an inventory item name", "danger");
      return;
    }

    const submitBtn = document.getElementById('inv-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
    }

    try {
      await window.dbService.saveInventoryItem({
        inventoryId: inventoryId || undefined,
        itemName,
        category,
        unit,
        currentQuantity,
        minimumQuantity,
        purchasePrice,
        supplier,
        location
      });

      window.showToast(`✅ Inventory item "${itemName}" saved successfully!`, "success");
      const modal = document.getElementById('inventory-edit-modal');
      if (modal) modal.classList.remove('active');
      this.renderInventory();
    } catch(err) {
      console.error("Inventory save error:", err);
      window.showToast("Failed to save inventory item: " + err.message, "danger");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "💾 Save Inventory Item";
      }
    }
  }

  async deleteInventoryItem(inventoryId) {
    const inv = window.dbService.getInventory().find(i => i.inventoryId === inventoryId);
    const name = inv ? inv.itemName : 'this item';
    if (!confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;

    try {
      await window.dbService.deleteInventoryItem(inventoryId);
      window.showToast(`Inventory item "${name}" deleted`, "info");
      this.renderInventory();
    } catch(err) {
      window.showToast("Failed to delete item: " + err.message, "danger");
    }
  }

  openStockMovementModal(inventoryId) {
    const inv = window.dbService.getInventory().find(i => i.inventoryId === inventoryId);
    if (!inv) return;

    const form = document.getElementById('stock-movement-form');
    if (form) form.reset();

    const idEl = document.getElementById('adj-inv-id');
    const nameEl = document.getElementById('adj-inv-item-name');
    const dispEl = document.getElementById('adj-inv-current-display');
    const qtyEl = document.getElementById('adj-quantity');
    const reasonEl = document.getElementById('adj-reason');
    const userEl = document.getElementById('adj-user');

    if (idEl) idEl.value = inv.inventoryId;
    if (nameEl) nameEl.textContent = `${inv.itemName} (${inv.category})`;
    if (dispEl) dispEl.textContent = `Current Stock: ${inv.currentQuantity} ${inv.unit} | Min Alert Level: ${inv.minimumQuantity} ${inv.unit}`;
    if (qtyEl) qtyEl.value = '10';
    if (reasonEl) reasonEl.value = 'Stock replenishment';
    if (userEl) userEl.value = 'Super Admin';

    const modal = document.getElementById('stock-movement-modal');
    if (modal) modal.classList.add('active');
  }

  async handleSaveStockMovement(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const inventoryId = document.getElementById('adj-inv-id').value;
    const type = document.getElementById('adj-type').value;
    const qty = parseFloat(document.getElementById('adj-quantity').value || 0);
    const reason = (document.getElementById('adj-reason').value || '').trim();
    const user = (document.getElementById('adj-user').value || '').trim() || 'Super Admin';

    if (!qty || qty <= 0) {
      window.showToast("Please enter a valid adjustment quantity", "danger");
      return;
    }

    const submitBtn = document.getElementById('adj-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Adjusting...";
    }

    try {
      await window.dbService.logStockMovement(inventoryId, type, qty, reason, user);
      window.showToast(`✅ Stock adjustment of ${qty} applied successfully!`, "success");
      const modal = document.getElementById('stock-movement-modal');
      if (modal) modal.classList.remove('active');
      this.renderInventory();
    } catch(err) {
      console.error("Stock movement error:", err);
      window.showToast("Failed to adjust stock: " + err.message, "danger");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "📊 Apply Adjustment";
      }
    }
  }

  // --- EXPENSES ---
  renderExpenses() {
    const expenses = window.dbService.getExpenses();
    const container = document.getElementById('admin-expenses-table');
    if (!container) return;

    if (!expenses || expenses.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Expenses Logged Yet</div>
            <div style="font-size: 0.875rem;">Click <strong>+ Log New Expense</strong> to record operational expenditure.</div>
          </td>
        </tr>
      `;
      return;
    }

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

  openExpenseModal() {
    const form = document.getElementById('expense-add-form');
    if (form) form.reset();
    const dateEl = document.getElementById('exp-modal-date');
    if (dateEl) dateEl.value = new Date().toISOString().substring(0, 10);
    const byEl = document.getElementById('exp-modal-created-by');
    if (byEl) byEl.value = 'Super Admin';

    const modal = document.getElementById('expense-add-modal');
    if (modal) modal.classList.add('active');
  }

  addExpense() {
    this.openExpenseModal();
  }

  async handleSaveExpense(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const category = document.getElementById('exp-modal-category').value;
    const amountVal = document.getElementById('exp-modal-amount').value;
    const amount = parseFloat(amountVal || 0);
    const description = (document.getElementById('exp-modal-desc').value || '').trim();
    const paymentMode = document.getElementById('exp-modal-payment-mode').value || 'Cash';
    const date = document.getElementById('exp-modal-date').value || new Date().toISOString().substring(0, 10);
    const createdBy = (document.getElementById('exp-modal-created-by').value || '').trim() || 'Super Admin';

    if (!amount || amount <= 0) {
      window.showToast("Please enter a valid expense amount", "danger");
      return;
    }

    if (!description) {
      window.showToast("Please enter an expense description", "danger");
      return;
    }

    const submitBtn = document.getElementById('exp-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Recording...";
    }

    try {
      await window.dbService.addExpense({
        category,
        amount,
        description,
        paymentMode,
        date,
        createdBy
      });
      window.showToast(`✅ Expense of ${window.formatCurrency(amount)} recorded successfully!`, "success");
      const modal = document.getElementById('expense-add-modal');
      if (modal) modal.classList.remove('active');
      this.renderExpenses();
    } catch(err) {
      console.error("Expense save error:", err);
      window.showToast("Failed to save expense: " + err.message, "danger");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "💾 Record Expense";
      }
    }
  }

  deleteExpense(expenseId) {
    if (!confirm("Are you sure you want to delete this expense entry?")) return;
    window.dbService.deleteExpense(expenseId);
    window.showToast("Expense entry deleted", "info");
    this.renderExpenses();
  }

  // --- CAPITAL ---
  renderCapital() {
    const capital = window.dbService.getCapital();
    const container = document.getElementById('admin-capital-table');
    if (!container) return;

    if (!capital || capital.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Capital Entries Logged Yet</div>
            <div style="font-size: 0.875rem;">Click <strong>+ Add Capital Entry</strong> to record capital investment or withdrawal.</div>
          </td>
        </tr>
      `;
      return;
    }

    const typeConfig = {
      'ADDITIONAL_CAPITAL': { label: 'Additional Infusion', badge: 'badge-success', isOutflow: false },
      'INITIAL_CAPITAL': { label: 'Initial Founder Capital', badge: 'badge-info', isOutflow: false },
      'WITHDRAWAL': { label: 'Owner Drawings (Outflow)', badge: 'badge-warning', isOutflow: true }
    };

    container.innerHTML = capital.map(c => {
      const config = typeConfig[c.type] || { label: c.type || 'Capital Entry', badge: 'badge-info', isOutflow: false };
      const amountPrefix = config.isOutflow ? '- ' : '+ ';
      const amountColor = config.isOutflow ? 'var(--warning-color, #f59e0b)' : 'var(--success-color, #10b981)';

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem;">${c.date || '-'}</td>
          <td><span class="badge ${config.badge}">${config.label}</span></td>
          <td style="text-align: left; padding: 0.5rem 0.75rem; max-width: 280px;">${c.description || '-'}</td>
          <td class="font-bold" style="color: ${amountColor};">${amountPrefix}${window.formatCurrency(c.amount)}</td>
          <td>${c.createdBy || 'Super Admin'}</td>
          <td>
            <div style="display: flex; gap: 0.4rem; justify-content: center; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="adminApp.openCapitalModal('${c.capitalId}')" title="Edit Capital Entry" style="padding: 0.3rem 0.55rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                ✏️ Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="adminApp.deleteCapital('${c.capitalId}')" title="Delete Capital Entry" style="padding: 0.3rem 0.55rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  openCapitalModal(capitalId = null) {
    const form = document.getElementById('capital-add-form');
    if (form) form.reset();

    const titleEl = document.getElementById('cap-modal-title');
    const submitBtn = document.getElementById('cap-modal-submit-btn');
    const idEl = document.getElementById('cap-modal-id');

    if (capitalId) {
      const capitalList = window.dbService.getCapital();
      const item = capitalList.find(c => c.capitalId === capitalId);
      if (item) {
        if (idEl) idEl.value = item.capitalId;
        if (titleEl) titleEl.innerHTML = '<span style="font-size: 1.4rem;">✏️</span> Edit Capital Transaction';
        if (submitBtn) submitBtn.innerHTML = '💾 Update Capital Entry';

        const typeEl = document.getElementById('cap-modal-type');
        if (typeEl) typeEl.value = item.type || 'ADDITIONAL_CAPITAL';

        const amountEl = document.getElementById('cap-modal-amount');
        if (amountEl) amountEl.value = item.amount || '';

        const descEl = document.getElementById('cap-modal-desc');
        if (descEl) descEl.value = item.description || '';

        const dateEl = document.getElementById('cap-modal-date');
        if (dateEl) dateEl.value = item.date || new Date().toISOString().substring(0, 10);

        const byEl = document.getElementById('cap-modal-created-by');
        if (byEl) byEl.value = item.createdBy || 'Super Admin';
      }
    } else {
      if (idEl) idEl.value = '';
      if (titleEl) titleEl.innerHTML = '<span style="font-size: 1.4rem;">💰</span> Record Capital Transaction';
      if (submitBtn) submitBtn.innerHTML = '💾 Record Capital Entry';

      const dateEl = document.getElementById('cap-modal-date');
      if (dateEl) dateEl.value = new Date().toISOString().substring(0, 10);
      const byEl = document.getElementById('cap-modal-created-by');
      if (byEl) byEl.value = 'Super Admin';
    }

    const modal = document.getElementById('capital-add-modal');
    if (modal) modal.classList.add('active');
  }

  addCapitalEntry() {
    this.openCapitalModal();
  }

  async handleSaveCapital(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const capitalId = (document.getElementById('cap-modal-id')?.value || '').trim();
    const type = document.getElementById('cap-modal-type').value;
    const amountVal = document.getElementById('cap-modal-amount').value;
    const amount = parseFloat(amountVal || 0);
    const description = (document.getElementById('cap-modal-desc').value || '').trim();
    const date = document.getElementById('cap-modal-date').value || new Date().toISOString().substring(0, 10);
    const createdBy = (document.getElementById('cap-modal-created-by').value || '').trim() || 'Super Admin';

    if (!amount || amount <= 0) {
      window.showToast("Please enter a valid capital amount", "danger");
      return;
    }

    if (!description) {
      window.showToast("Please enter a capital description note", "danger");
      return;
    }

    const submitBtn = document.getElementById('cap-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = capitalId ? "Updating..." : "Recording...";
    }

    try {
      const payload = {
        type,
        amount,
        description,
        date,
        createdBy
      };
      if (capitalId) payload.capitalId = capitalId;

      await window.dbService.saveCapital(payload);
      const actionVerb = capitalId ? "updated" : "recorded";
      window.showToast(`✅ Capital transaction of ${window.formatCurrency(amount)} ${actionVerb} successfully!`, "success");
      const modal = document.getElementById('capital-add-modal');
      if (modal) modal.classList.remove('active');
      this.renderCapital();
    } catch(err) {
      console.error("Capital save error:", err);
      window.showToast("Failed to save capital: " + err.message, "danger");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = capitalId ? "💾 Update Capital Entry" : "💾 Record Capital Entry";
      }
    }
  }

  async deleteCapital(capitalId) {
    if (!capitalId) return;
    const capitalList = window.dbService.getCapital();
    const item = capitalList.find(c => c.capitalId === capitalId);
    const desc = item ? `"${item.description || item.type}" (${window.formatCurrency(item.amount)})` : 'this capital entry';

    if (!confirm(`Are you sure you want to delete ${desc}? This will permanently remove it from the capital ledger and Firebase.`)) {
      return;
    }

    try {
      await window.dbService.deleteCapital(capitalId);
      window.showToast("🗑️ Capital entry deleted successfully", "info");
      this.renderCapital();
    } catch(err) {
      console.error("Error deleting capital:", err);
      window.showToast("Failed to delete capital entry: " + err.message, "danger");
    }
  }

  // --- MANAGERS ---
  renderManagers() {
    const managers = window.dbService.getManagers();
    const container = document.getElementById('admin-managers-table');
    if (!container) return;

    if (!managers || managers.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Manager Accounts Found</div>
            <div style="font-size: 0.875rem;">Click <strong>+ Add Cafe Manager</strong> above to create a new manager login.</div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = managers.map(m => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td class="font-semibold" style="padding: 0.75rem; text-align: left;">${m.name}</td>
        <td style="text-align: left;">${m.email}</td>
        <td style="text-align: left;">${m.mobile || '-'}</td>
        <td style="text-align: left;">
          <code style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; color: var(--accent-gold); font-size: 0.85rem;">${m.password ? '••••••••' : '(Not set)'}</code>
        </td>
        <td><span class="badge ${m.isActive ? 'badge-success' : 'badge-danger'}">${m.isActive ? 'Active' : 'Disabled'}</span></td>
        <td style="padding: 0.75rem;">
          <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="adminApp.toggleManagerStatus('${m.managerId}', ${!m.isActive})">
              ${m.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="adminApp.editManagerPassword('${m.managerId}')" title="Set or reset password">
              🔑 Password
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminApp.deleteManagerAccount('${m.managerId}', '${m.name.replace(/'/g, "\\'")}')" title="Delete Manager Account">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openAddManagerModal() {
    const modal = document.getElementById('manager-add-modal');
    const form = document.getElementById('manager-add-form');
    if (form) form.reset();
    if (modal) modal.classList.add('active');
  }

  handleSaveManager(e) {
    e.preventDefault();
    const name = document.getElementById('mgr-modal-name')?.value.trim();
    const email = document.getElementById('mgr-modal-email')?.value.trim();
    const mobile = document.getElementById('mgr-modal-mobile')?.value.trim();
    const password = document.getElementById('mgr-modal-password')?.value;

    if (!name || !email || !mobile || !password) {
      window.showToast("All fields are required.", "danger");
      return;
    }

    // Check if email already exists
    const existing = window.dbService.getManagers();
    const duplicate = existing.find(m => m.email.toLowerCase() === email.toLowerCase());
    if (duplicate) {
      window.showToast("A manager with this email already exists.", "danger");
      return;
    }

    window.dbService.saveManager({ name, email, mobile, password, isActive: true });
    window.showToast("Manager account created successfully!", "success");

    const modal = document.getElementById('manager-add-modal');
    if (modal) modal.classList.remove('active');
    this.renderManagers();
  }

  editManagerPassword(managerId) {
    const newPassword = prompt("Enter new password for manager:");
    if (newPassword && newPassword.trim().length >= 4) {
      window.dbService.saveManager({ managerId, password: newPassword.trim() });
      window.showToast("Manager password updated successfully!", "success");
      this.renderManagers();
    } else if (newPassword !== null) {
      window.showToast("Password must be at least 4 characters.", "danger");
    }
  }

  deleteManagerAccount(managerId, managerName) {
    if (confirm(`Are you sure you want to delete the account for "${managerName}"?\nThis manager will no longer be able to log in.`)) {
      window.dbService.deleteManager(managerId);
      window.showToast(`Deleted manager account: ${managerName}`, "info");
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

    if (!reqs || reqs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Stock Requisitions</div>
            <div style="font-size: 0.875rem;">Manager stock requests will appear here for Super Admin approval.</div>
          </td>
        </tr>
      `;
      return;
    }

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
