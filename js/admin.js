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
    const invoices = window.dbService.getInvoices();
    const container = document.getElementById('admin-invoices-table');
    if (!container) return;

    if (!invoices || invoices.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Tax Invoices Generated Yet</div>
            <div style="font-size: 0.875rem;">Settled order invoices will automatically appear here.</div>
          </td>
        </tr>
      `;
      return;
    }

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

    if (!inventory || inventory.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Inventory Stock Items</div>
            <div style="font-size: 0.875rem;">Add raw material stock items to track inventory linked to menu products.</div>
          </td>
        </tr>
      `;
      return;
    }

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

    if (!capital || capital.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2.5rem; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Capital Entries Logged Yet</div>
            <div style="font-size: 0.875rem;">Click <strong>+ Add Capital Entry</strong> to record capital investment or withdrawal.</div>
          </td>
        </tr>
      `;
      return;
    }

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
