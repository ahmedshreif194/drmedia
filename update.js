/* =========================================================
   Dr Media Pro — UPDATE PACK
   File: update.js
   Version: 4.0.0
   ---------------------------------------------------------
   Sections:
     [1] Login Fix + Firebase Init + Counters Tab
     [2] MASTER SYNC (Local / Online / Live)
     [3] Command Palette (Ctrl+K)
     [4] WhatsApp Integration
   ---------------------------------------------------------
   ⚠️ DO NOT EDIT index.html — All features live here.
   ========================================================= */

/* #########################################################
   ##### SECTION 1 — LOGIN FIX + FIREBASE + COUNTERS    #####
   ######################################################### */
(function () {
  'use strict';

  console.log('%c[Section 1] Loading…', 'color:#7c3aed;font-weight:bold');

  /* ---------- Firebase Config ---------- */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyApb4Nl_ktkVCkuz7DsR8kDdimSPT9uhmQ",
    authDomain: "drmedia-vpms.firebaseapp.com",
    databaseURL: "https://drmedia-vpms-default-rtdb.firebaseio.com",
    projectId: "drmedia-vpms",
    storageBucket: "drmedia-vpms.firebasestorage.app",
    messagingSenderId: "681162512380",
    appId: "1:681162512380:web:ab2482f3234d8b59fc4479",
    measurementId: "G-9KHN6N33FX"
  };
  const FIREBASE_SDK = '10.12.2';

  /* ---------- Firebase Global State ---------- */
  const FB = {
    ready: false,
    app: null,
    db: null,
    auth: null,
    rtdb: null,
    storage: null,
    analytics: null,
    modules: {},
    status: 'initializing',
    lastError: null
  };
  window.DrMediaFB = FB;

  /* ---------- Wait for core app ---------- */
  function whenAppReady(cb) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      try {
        if (
          typeof Pages !== 'undefined' &&
          typeof NAV_ITEMS !== 'undefined' &&
          typeof State !== 'undefined' &&
          typeof I18N !== 'undefined' &&
          typeof navigate === 'function' &&
          typeof saveData === 'function' &&
          typeof attemptLogin === 'function'
        ) {
          clearInterval(t);
          cb();
        }
      } catch (e) {}
      if (tries > 60) clearInterval(t);
    }, 100);
  }

  /* ---------- Login Sandbox Fix ---------- */
  function patchLogin() {
    const form      = document.getElementById('login-form');
    const btn       = document.querySelector('.btn-login');
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-pass');
    if (!form || !btn || !userInput || !passInput) return false;

    form.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopPropagation(); return false;
    }, true);
    form.onsubmit = function () { return false; };

    function doLogin(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const u = userInput.value.trim();
      const p = passInput.value;
      if (typeof window.attemptLogin !== 'function') { alert('System not ready.'); return false; }
      let ok = false;
      try { ok = window.attemptLogin(u, p); }
      catch (err) {
        console.error('[Section 1] Login error:', err);
        if (typeof showToast === 'function') showToast('خطأ في تسجيل الدخول', 'error');
        return false;
      }
      if (ok) {
        if (typeof showToast === 'function') showToast('تم تسجيل الدخول بنجاح', 'success');
        if (typeof startApp === 'function') startApp();
      } else {
        if (typeof showToast === 'function') showToast('بيانات الدخول غير صحيحة', 'error');
        else alert('Invalid credentials — try admin / admin');
      }
      return false;
    }

    const newBtn = btn.cloneNode(true);
    newBtn.setAttribute('type', 'button');
    newBtn.id = 'login-btn-patched';
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', doLogin);

    passInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doLogin(e); } });
    userInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doLogin(e); } });

    console.log('%c[Section 1] ✓ Login patched', 'color:#10b981;font-weight:bold');
    return true;
  }

  /* ---------- Load Firebase Modules ---------- */
  async function loadFirebaseModules() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
    const [appMod, authMod, fsMod, rtdbMod, storageMod] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
      import(`${base}/firebase-database.js`),
      import(`${base}/firebase-storage.js`)
    ]);
    let analyticsMod = null;
    try { analyticsMod = await import(`${base}/firebase-analytics.js`); } catch (e) {}
    return { appMod, authMod, fsMod, rtdbMod, storageMod, analyticsMod };
  }

  /* ---------- Bootstrap Firebase ---------- */
  async function bootstrapFirebase() {
    try {
      FB.status = 'initializing';
      const mods = await loadFirebaseModules();
      FB.modules = mods;

      FB.app = mods.appMod.initializeApp(FIREBASE_CONFIG);
      FB.auth = mods.authMod.getAuth(FB.app);
      FB.db = mods.fsMod.getFirestore(FB.app);
      FB.rtdb = mods.rtdbMod.getDatabase(FB.app);
      FB.storage = mods.storageMod.getStorage(FB.app);

      try {
        if (mods.analyticsMod && typeof mods.analyticsMod.isSupported === 'function') {
          const ok = await mods.analyticsMod.isSupported();
          if (ok) FB.analytics = mods.analyticsMod.getAnalytics(FB.app);
        }
      } catch (e) {}

      FB.ready = true;
      FB.status = 'online';
      console.log('%c[Section 1] ✓ Firebase Initialized — ' + FIREBASE_CONFIG.projectId, 'color:#f59e0b;font-weight:bold');
      return true;
    } catch (err) {
      FB.status = 'error';
      FB.lastError = err.message || String(err);
      console.error('[Section 1] Firebase init failed:', err);
      return false;
    }
  }

  /* ---------- Counters Engine ---------- */
  const COUNTERS_KEY = 'drmedia_firebase_counters_v4';
  const QUOTAS = { reads: 50000, writes: 20000, deletes: 20000 };
  const PRICING = { read: 0.06 / 100000, write: 0.18 / 100000, delete: 0.02 / 100000 };

  function emptyCounters() {
    return {
      today: { date: new Date().toISOString().slice(0, 10), reads: 0, writes: 0, deletes: 0 },
      total: { reads: 0, writes: 0, deletes: 0 },
      byCollection: {},
      history: [],
      syncStats: { pushes: 0, pulls: 0, failures: 0 }
    };
  }
  function loadCounters() {
    try { const raw = localStorage.getItem(COUNTERS_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return emptyCounters();
  }
  let counters = loadCounters();
  function persistCounters() {
    try { localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters)); } catch (e) {}
  }
  function ensureRollover() {
    const today = new Date().toISOString().slice(0, 10);
    if (counters.today.date !== today) {
      counters.history.push({ ...counters.today });
      if (counters.history.length > 30) counters.history.shift();
      counters.today = { date: today, reads: 0, writes: 0, deletes: 0 };
      persistCounters();
    }
  }
  function bumpColl(coll, kind, n) {
    counters.byCollection[coll] = counters.byCollection[coll] || { reads: 0, writes: 0, deletes: 0 };
    counters.byCollection[coll][kind] += n;
  }

  window.DrMediaCounters = {
    trackRead: function (coll, n) { n = n || 1; ensureRollover(); counters.today.reads += n; counters.total.reads += n; bumpColl(coll || 'unknown', 'reads', n); persistCounters(); },
    trackWrite: function (coll, n) { n = n || 1; ensureRollover(); counters.today.writes += n; counters.total.writes += n; bumpColl(coll || 'unknown', 'writes', n); persistCounters(); },
    trackDelete: function (coll, n) { n = n || 1; ensureRollover(); counters.today.deletes += n; counters.total.deletes += n; bumpColl(coll || 'unknown', 'deletes', n); persistCounters(); },
    trackPush: function () { counters.syncStats.pushes++; persistCounters(); },
    trackPull: function () { counters.syncStats.pulls++; persistCounters(); },
    trackFail: function () { counters.syncStats.failures++; persistCounters(); },
    get: function () { return counters; },
    reset: function () { counters = emptyCounters(); persistCounters(); }
  };

  /* ---------- i18n patch ---------- */
  function patchI18N() {
    if (typeof I18N === 'undefined') return;
    Object.assign(I18N.ar, {
      counters: 'عدادات Firebase',
      firebase_plan: 'الخطة',
      free_tier: 'Spark (مجانية)',
      quota_used: 'مستخدم', quota_remaining: 'متبقي',
      reads: 'قراءات', writes: 'كتابات', deletes: 'حذف',
      daily_reads: 'قراءات اليوم', daily_writes: 'كتابات اليوم', daily_deletes: 'حذف اليوم',
      total_reads: 'إجمالي القراءات', total_writes: 'إجمالي الكتابات', total_deletes: 'إجمالي الحذف',
      estimated_cost: 'التكلفة المتوقعة', daily_cost: 'التكلفة اليومية', monthly_cost: 'الشهري (متوقع)',
      usage_details: 'تفاصيل الاستخدام', operations_breakdown: 'توزيع العمليات',
      collection: 'المجموعة', daily_usage: 'الاستخدام اليومي',
      reset_counters: 'تصفير العدادات', refresh: 'تحديث',
      pricing_note: 'الحسابات بناءً على Blaze: $0.06/100k قراءة، $0.18/100k كتابة.',
      safe: 'آمن', near_limit: 'قريب من الحد', limit_reached: 'وصل للحد',
      history_days: 'آخر 14 يوم',
      firebase_status: 'حالة Firebase', online: 'متصل', offline: 'غير متصل',
      initializing: 'جاري التهيئة', error: 'خطأ',
      project: 'المشروع', last_sync: 'آخر مزامنة', sync_stats: 'إحصائيات المزامنة',
      pushes: 'عمليات رفع', pulls: 'عمليات سحب', failures: 'فشل'
    });
    Object.assign(I18N.en, {
      counters: 'Firebase Counters', firebase_plan: 'Plan', free_tier: 'Spark (Free)',
      quota_used: 'Used', quota_remaining: 'Remaining',
      reads: 'Reads', writes: 'Writes', deletes: 'Deletes',
      daily_reads: "Today's Reads", daily_writes: "Today's Writes", daily_deletes: "Today's Deletes",
      total_reads: 'Total Reads', total_writes: 'Total Writes', total_deletes: 'Total Deletes',
      estimated_cost: 'Estimated Cost', daily_cost: 'Daily Cost', monthly_cost: 'Monthly (Est.)',
      usage_details: 'Usage Details', operations_breakdown: 'Operations Breakdown',
      collection: 'Collection', daily_usage: 'Daily Usage',
      reset_counters: 'Reset Counters', refresh: 'Refresh',
      pricing_note: 'Based on Blaze: $0.06/100k reads, $0.18/100k writes.',
      safe: 'Safe', near_limit: 'Near Limit', limit_reached: 'Limit Reached',
      history_days: 'Last 14 days',
      firebase_status: 'Firebase Status', online: 'Online', offline: 'Offline',
      initializing: 'Initializing', error: 'Error',
      project: 'Project', last_sync: 'Last Sync', sync_stats: 'Sync Stats',
      pushes: 'Pushes', pulls: 'Pulls', failures: 'Failures'
    });
  }

  /* ---------- Counters Page ---------- */
  function registerCountersPage() {
    Pages.counters = function (el) {
      ensureRollover();
      const c = counters;
      const pct = (u, t) => Math.min(100, Math.round((u / t) * 100));
      const colorFor = (p) => (p < 50 ? '#10b981' : p < 80 ? '#f59e0b' : '#ef4444');
      const badgeFor = (p) => (p < 50 ? 'green' : p < 80 ? 'yellow' : 'red');

      const dailyCost = c.today.reads * PRICING.read + c.today.writes * PRICING.write + c.today.deletes * PRICING.delete;
      const monthlyCost = dailyCost * 30;

      const statusColor = { online: '#10b981', offline: '#ef4444', initializing: '#f59e0b', error: '#ef4444' }[FB.status] || '#64748b';
      const statusLabel = { online: t('online'), offline: t('offline'), initializing: t('initializing'), error: t('error') }[FB.status] || FB.status;

      const quotaCard = (label, used, total, icon, color) => {
        const p = pct(used, total);
        return `
          <div class="stat-card" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.75rem">
              <div class="stat-icon" style="background:${color}20;color:${color};width:40px;height:40px"><i data-lucide="${icon}" style="width:18px;height:18px"></i></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:.7rem;color:var(--text-muted)">${label}</div>
                <div style="font-size:1.35rem;font-weight:800;line-height:1">${used.toLocaleString()}</div>
              </div>
              <span class="badge-pill badge-${badgeFor(p)}">${p}%</span>
            </div>
            <div style="height:6px;background:var(--surface-2);border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${p}%;background:${colorFor(p)};border-radius:999px;transition:width .5s"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:.5rem;font-size:.68rem;color:var(--text-muted)">
              <span>${t('quota_used')}: ${used.toLocaleString()}</span>
              <span>${t('quota_remaining')}: ${Math.max(0, total - used).toLocaleString()}</span>
            </div>
          </div>`;
      };

      el.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;align-items:center">
          <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .85rem;background:var(--surface-2);border:1px solid var(--border);border-radius:10px">
            <span style="width:10px;height:10px;border-radius:50%;background:${statusColor};box-shadow:0 0 8px ${statusColor}"></span>
            <span style="font-size:.8rem;font-weight:600">${t('firebase_status')}: ${statusLabel}</span>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .85rem;background:var(--surface-2);border:1px solid var(--border);border-radius:10px">
            <i data-lucide="folder-tree" style="width:14px;height:14px;color:#7c3aed"></i>
            <span style="font-size:.78rem;font-weight:600">${t('project')}: ${FIREBASE_CONFIG.projectId}</span>
          </div>
          <div style="margin-inline-start:auto;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="ctr-refresh"><i data-lucide="refresh-cw"></i> ${t('refresh')}</button>
            <button class="btn btn-ghost btn-sm" id="ctr-reset" style="color:#ef4444"><i data-lucide="rotate-ccw"></i> ${t('reset_counters')}</button>
          </div>
        </div>

        <div class="grid-stats" style="margin-bottom:1.5rem">
          ${quotaCard(t('daily_reads'), c.today.reads, QUOTAS.reads, 'book-open', '#7c3aed')}
          ${quotaCard(t('daily_writes'), c.today.writes, QUOTAS.writes, 'pencil', '#10b981')}
          ${quotaCard(t('daily_deletes'), c.today.deletes, QUOTAS.deletes, 'trash-2', '#ef4444')}
        </div>

        <div class="grid-2" style="margin-bottom:1.5rem">
          <div class="chart-box">
            <h4><i data-lucide="bar-chart-3"></i> ${t('daily_usage')} — ${t('history_days')}</h4>
            <div class="chart-canvas-wrap"><canvas id="ch-counter-daily"></canvas></div>
          </div>
          <div class="chart-box">
            <h4><i data-lucide="pie-chart"></i> ${t('operations_breakdown')}</h4>
            <div class="chart-canvas-wrap"><canvas id="ch-counter-ops"></canvas></div>
          </div>
        </div>

        <div class="grid-3" style="margin-bottom:1.5rem">
          <div class="card"><div style="font-size:.72rem;color:var(--text-muted)">${t('total_reads')}</div><div style="font-size:1.7rem;font-weight:800;color:#7c3aed">${c.total.reads.toLocaleString()}</div></div>
          <div class="card"><div style="font-size:.72rem;color:var(--text-muted)">${t('total_writes')}</div><div style="font-size:1.7rem;font-weight:800;color:#10b981">${c.total.writes.toLocaleString()}</div></div>
          <div class="card"><div style="font-size:.72rem;color:var(--text-muted)">${t('total_deletes')}</div><div style="font-size:1.7rem;font-weight:800;color:#ef4444">${c.total.deletes.toLocaleString()}</div></div>
        </div>

        <div class="grid-2" style="margin-bottom:1.5rem">
          <div class="card">
            <h4 class="section-title" style="margin-top:0"><i data-lucide="dollar-sign"></i> ${t('estimated_cost')}</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
              <div><div style="font-size:.72rem;color:var(--text-muted)">${t('daily_cost')}</div><div style="font-size:1.5rem;font-weight:800">$ ${dailyCost.toFixed(4)}</div></div>
              <div><div style="font-size:.72rem;color:var(--text-muted)">${t('monthly_cost')}</div><div style="font-size:1.5rem;font-weight:800">$ ${monthlyCost.toFixed(2)}</div></div>
            </div>
            <p style="font-size:.72rem;color:var(--text-muted);margin-top:.85rem;margin-bottom:0">${t('pricing_note')}</p>
          </div>
          <div class="card">
            <h4 class="section-title" style="margin-top:0"><i data-lucide="refresh-cw"></i> ${t('sync_stats')}</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
              <div><div style="font-size:.72rem;color:var(--text-muted)">${t('pushes')}</div><div style="font-size:1.3rem;font-weight:800;color:#10b981">${c.syncStats.pushes}</div></div>
              <div><div style="font-size:.72rem;color:var(--text-muted)">${t('pulls')}</div><div style="font-size:1.3rem;font-weight:800;color:#7c3aed">${c.syncStats.pulls}</div></div>
              <div><div style="font-size:.72rem;color:var(--text-muted)">${t('failures')}</div><div style="font-size:1.3rem;font-weight:800;color:#ef4444">${c.syncStats.failures}</div></div>
            </div>
          </div>
        </div>

        <div class="card">
          <h4 class="section-title" style="margin-top:0"><i data-lucide="layers"></i> ${t('usage_details')} — ${t('collection')}</h4>
          ${Object.keys(c.byCollection).length
            ? `<div class="table-wrap"><table class="data-table">
                <thead><tr><th>${t('collection')}</th><th>${t('reads')}</th><th>${t('writes')}</th><th>${t('deletes')}</th></tr></thead>
                <tbody>
                  ${Object.entries(c.byCollection)
                    .sort((a, b) => (b[1].reads + b[1].writes) - (a[1].reads + a[1].writes))
                    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v.reads.toLocaleString()}</td><td>${v.writes.toLocaleString()}</td><td>${v.deletes.toLocaleString()}</td></tr>`).join('')}
                </tbody>
              </table></div>`
            : `<div class="empty-state"><i data-lucide="inbox"></i><p>${t('no_data')}</p></div>`}
        </div>
      `;

      if (window.lucide) lucide.createIcons();

      el.querySelector('#ctr-refresh').onclick = () => Pages.counters(el);
      el.querySelector('#ctr-reset').onclick = () => {
        if (confirm(t('reset_counters') + '?')) {
          window.DrMediaCounters.reset();
          counters = loadCounters();
          showToast(t('saved'), 'success');
          Pages.counters(el);
        }
      };

      setTimeout(() => {
        const history = [...c.history.slice(-13), c.today];
        const labels = history.map((h) => h.date.slice(5));
        const dailyCanvas = document.getElementById('ch-counter-daily');
        if (dailyCanvas && window.Chart) {
          if (window.__dm_chart_daily) { try { window.__dm_chart_daily.destroy(); } catch (e) {} }
          window.__dm_chart_daily = new Chart(dailyCanvas, {
            type: 'line',
            data: { labels, datasets: [
              { label: t('reads'), data: history.map((h) => h.reads), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
              { label: t('writes'), data: history.map((h) => h.writes), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
              { label: t('deletes'), data: history.map((h) => h.deletes), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.08)', fill: false, tension: 0.4, borderWidth: 2, pointRadius: 3 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11 } } } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
          });
        }
        const opsCanvas = document.getElementById('ch-counter-ops');
        if (opsCanvas && window.Chart) {
          if (window.__dm_chart_ops) { try { window.__dm_chart_ops.destroy(); } catch (e) {} }
          window.__dm_chart_ops = new Chart(opsCanvas, {
            type: 'doughnut',
            data: { labels: [t('reads'), t('writes'), t('deletes')], datasets: [{ data: [c.total.reads, c.total.writes, c.total.deletes], backgroundColor: ['#7c3aed', '#10b981', '#ef4444'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } } }
          });
        }
      }, 80);
    };

    const sys = NAV_ITEMS.find((g) => g.section === 'system');
    if (sys && !sys.items.find((i) => i.id === 'counters')) {
      sys.items.unshift({ id: 'counters', icon: 'gauge', label: 'counters' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- BOOT Section 1 ---------- */
  whenAppReady(async function () {
    console.log('%c[Section 1] Bootstrapping…', 'color:#7c3aed;font-weight:bold');
    patchLogin();
    patchI18N();
    registerCountersPage();

    const ok = await bootstrapFirebase();
    if (!ok) {
      console.warn('[Section 1] Firebase failed — local only mode');
      return;
    }

    console.log('%c[Section 1] ✓ Ready', 'color:#10b981;font-weight:bold');
  });

})();


/* #########################################################
   ##### SECTION 2 — MASTER SYNC (Local/Online/Live)    #####
   ######################################################### */
(function () {
  'use strict';

  console.log('%c[Section 2] ═══ Loading MASTER SYNC ═══', 'color:#7c3aed;font-weight:bold;font-size:14px');

  /* ---------- Kill any previous sync listeners ---------- */
  if (window.DrMediaSync) {
    const old = window.DrMediaSync;
    if (old.unsub) { try { old.unsub(); } catch (e) {} }
    if (old.pollTimer) clearInterval(old.pollTimer);
    if (old.pushTimer) clearTimeout(old.pushTimer);
    if (old.retryTimer) clearTimeout(old.retryTimer);
  }

  const TAB_ID = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
  console.log('%c[Section 2] TAB_ID: ' + TAB_ID, 'color:#06b6d4;font-weight:bold;font-size:13px');

  /* ---------- Sync State ---------- */
  const Sync = {
    mode: 'local',        // 'local' | 'online' | 'live'
    tabId: TAB_ID,
    unsub: null,
    pushTimer: null,
    pollTimer: null,
    retryTimer: null,
    writesSent: 0,
    updatesReceived: 0,
    pendingPush: false,
    failures: 0,
    lastPushAt: null,
    lastPullAt: null,
    lastError: null,
    applyingRemote: false,
    lastHash: ''
  };
  window.DrMediaSync = Sync;

  /* ---------- i18n ---------- */
  if (typeof I18N !== 'undefined') {
    Object.assign(I18N.ar, {
      sync_mode_local: 'محلي', sync_mode_online: 'متصل', sync_mode_live: 'مباشر',
      sync_pushing: 'جاري الرفع', sync_synced: 'متزامن', sync_error: 'خطأ',
      sync_tooltip: 'اضغط للمزامنة اليدوية'
    });
    Object.assign(I18N.en, {
      sync_mode_local: 'Local', sync_mode_online: 'Online', sync_mode_live: 'Live',
      sync_pushing: 'Pushing', sync_synced: 'Synced', sync_error: 'Error',
      sync_tooltip: 'Click to sync manually'
    });
  }

  /* ---------- Utilities ---------- */
  function waitFor(cond, cb, label, maxTries) {
    maxTries = maxTries || 300;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) {
        clearInterval(t);
        console.warn('[Section 2] Timeout waiting for: ' + (label || 'cond'));
        return;
      }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  function computeHash() {
    try {
      const d = State.data;
      if (!d) return '';
      return [
        (d.bookings || []).length,
        (d.employees || []).length,
        (d.clients || []).length,
        (d.distributions || []).length,
        (d.advances || []).length,
        (d.deductions || []).length,
        (d.bonuses || []).length,
        (d.equipment || []).length,
        (d.halls || []).length,
        (d.users || []).length,
        (d.employees || []).map(e => e.name).join('|'),
        (d.bookings || []).map(b => b.id + ':' + b.date).join('|'),
        JSON.stringify(d.settings || {})
      ].join('::');
    } catch (e) { return ''; }
  }

  /* ---------- Mode resolver ---------- */
  function resolveMode() {
    const online = navigator.onLine !== false;
    const fbReady = !!(window.DrMediaFB && window.DrMediaFB.ready);
    const loggedIn = !!(State && State.user);

    if (!online || !fbReady) return 'local';
    if (!loggedIn) return 'online';
    return 'live';
  }

  function setMode(newMode) {
    if (Sync.mode === newMode) return;
    const old = Sync.mode;
    Sync.mode = newMode;
    console.log('%c[Section 2] Mode: ' + old + ' → ' + newMode, 'color:#7c3aed;font-weight:bold');
    updateIndicator();
    onModeChange(old, newMode);
  }

  function refreshMode() { setMode(resolveMode()); }

  function onModeChange(oldMode, newMode) {
    if (oldMode === 'live' && newMode !== 'live') {
      stopListener();
    }
    if (newMode === 'live' && oldMode !== 'live') {
      startListener();
      if (Sync.pendingPush) {
        console.log('[Section 2] Flushing pending push…');
        schedulePush(200);
      } else {
        schedulePush(500);
      }
    }
  }

  /* ---------- REPLACE saveData (single owner) ---------- */
  function installSaveData() {
    window.saveData = function () {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); }
      catch (e) { console.warn('[Section 2] localStorage failed:', e); }

      if (Sync.applyingRemote) return;
      if (!State || !State.user) return;

      if (Sync.mode !== 'live') {
        Sync.pendingPush = true;
        updateIndicator();
        return;
      }
      schedulePush(400);
    };
    console.log('%c[Section 2] ✓ saveData REPLACED (single owner)', 'color:#10b981;font-weight:bold');
  }

  /* ---------- PUSH ---------- */
  function schedulePush(delay) {
    clearTimeout(Sync.pushTimer);
    Sync.pushTimer = setTimeout(doPush, delay || 400);
  }

  async function doPush() {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) {
      Sync.pendingPush = true; updateIndicator(); return;
    }
    if (!State || !State.user) return;

    Sync.pendingPush = false;
    updateIndicator('pushing');

    const { doc, setDoc, serverTimestamp } = window.DrMediaFB.modules.fsMod;
    const ref = doc(window.DrMediaFB.db, 'app_state', 'main');
    const payload = {
      payload: State.data,
      updatedBy: TAB_ID,
      updatedByUser: State.user.username,
      updatedAt: serverTimestamp(),
      version: Date.now()
    };

    try {
      await setDoc(ref, payload);
      Sync.writesSent++;
      Sync.lastPushAt = new Date();
      Sync.lastError = null;
      if (window.DrMediaCounters) window.DrMediaCounters.trackWrite('app_state', 1);
      console.log('%c[Section 2] ✅ PUSH OK (#' + Sync.writesSent + ')', 'color:#10b981;font-weight:bold');
      updateIndicator('synced');
    } catch (err) {
      Sync.failures++;
      Sync.lastError = err.code + ': ' + err.message;
      Sync.pendingPush = true;
      console.error('[Section 2] ❌ PUSH FAILED:', err);
      updateIndicator('error');
      clearTimeout(Sync.retryTimer);
      Sync.retryTimer = setTimeout(() => {
        if (Sync.mode === 'live') schedulePush(100);
      }, 5000);
    }
  }

  /* ---------- LISTENER ---------- */
  function startListener() {
    if (Sync.unsub) { try { Sync.unsub(); } catch (e) {} Sync.unsub = null; }
    if (!window.DrMediaFB || !window.DrMediaFB.ready) return;

    const { doc, onSnapshot } = window.DrMediaFB.modules.fsMod;
    const ref = doc(window.DrMediaFB.db, 'app_state', 'main');

    Sync.unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data();
      if (!remote || !remote.payload) return;
      if (remote.updatedBy === TAB_ID) return;

      console.log('%c[Section 2] 📥 PULL from ' + remote.updatedBy, 'color:#7c3aed;font-weight:bold');
      applyRemote(remote);
    }, (err) => {
      console.error('[Section 2] Listener error:', err);
      Sync.lastError = err.code + ': ' + err.message;
      updateIndicator('error');
    });

    console.log('[Section 2] ✓ Listener active');
  }

  function stopListener() {
    if (Sync.unsub) { try { Sync.unsub(); } catch (e) {} Sync.unsub = null; }
  }

  function applyRemote(remote) {
    Sync.updatesReceived++;
    Sync.lastPullAt = new Date();
    Sync.applyingRemote = true;
    if (window.DrMediaCounters) window.DrMediaCounters.trackRead('app_state', 1);

    const session = State.user;
    State.data = remote.payload;

    if (session && State.data.users) {
      const u = State.data.users.find(x => x.id === session.id);
      if (u) State.user = { id: u.id, username: u.username, name: u.name, role: u.role, employeeId: u.employeeId };
    }

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}
    Sync.lastHash = computeHash();

    if (typeof showToast === 'function') {
      showToast('🔄 ' + (State.lang === 'ar' ? 'تحديث من جهاز آخر' : 'Update from another device'), 'success');
    }
    updateIndicator('synced');

    setTimeout(() => {
      try {
        if (State.page && typeof navigate === 'function') navigate(State.page);
        if (typeof updateNotifBadge === 'function') updateNotifBadge();
      } catch (e) {}
      Sync.applyingRemote = false;
    }, 300);
  }

  /* ---------- HASH POLLING ---------- */
  function startPolling() {
    Sync.lastHash = computeHash();
    Sync.pollTimer = setInterval(() => {
      if (Sync.applyingRemote) return;
      if (!State || !State.user) return;
      const h = computeHash();
      if (h !== Sync.lastHash) {
        console.log('[Section 2] ⚡ Hash change detected');
        Sync.lastHash = h;
        if (Sync.mode === 'live') schedulePush(300);
        else Sync.pendingPush = true;
        updateIndicator();
      }
    }, 3000);
    console.log('[Section 2] ✓ Hash polling active (3s)');
  }

  /* ---------- Network listeners ---------- */
  function attachNetworkListeners() {
    window.addEventListener('online', () => { console.log('[Section 2] Network: ONLINE'); setTimeout(refreshMode, 300); });
    window.addEventListener('offline', () => { console.log('[Section 2] Network: OFFLINE'); setTimeout(refreshMode, 300); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') setTimeout(refreshMode, 200);
    });
  }

  /* ---------- Topbar indicator ---------- */
  function injectIndicator() {
    if (document.getElementById('dm-sync-indicator')) return;
    const topbar = document.getElementById('topbar');
    if (!topbar) return;

    const wrap = document.createElement('div');
    wrap.id = 'dm-sync-indicator';
    wrap.style.cssText = 'display:flex;align-items:center;gap:.4rem;padding:.35rem .65rem;border-radius:8px;font-size:.7rem;font-weight:600;margin-inline-end:.35rem;cursor:pointer;user-select:none;transition:all .3s';
    wrap.title = (I18N[State.lang] || I18N.ar).sync_tooltip;
    wrap.innerHTML = '<span id="dm-sync-dot" style="width:8px;height:8px;border-radius:50%;transition:all .3s"></span><span id="dm-sync-label">—</span>';

    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn && notifBtn.parentNode) notifBtn.parentNode.insertBefore(wrap, notifBtn);
    else topbar.appendChild(wrap);

    wrap.onclick = () => {
      console.log('[Section 2] Manual sync requested');
      if (Sync.mode === 'live') schedulePush(0);
      else if (typeof showToast === 'function') {
        showToast(State.lang === 'ar' ? 'غير متصل — جرب لما ترجع أونلاين' : 'Not live — retry when online', 'warn');
      }
    };

    if (!document.getElementById('dm-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'dm-pulse-style';
      s.textContent = '@keyframes dmPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}';
      document.head.appendChild(s);
    }

    updateIndicator();
  }

  function updateIndicator(transientState) {
    const wrap = document.getElementById('dm-sync-indicator');
    const label = document.getElementById('dm-sync-label');
    const dot = document.getElementById('dm-sync-dot');
    if (!wrap || !label || !dot) return;

    const L = I18N[State.lang] || I18N.ar;
    let bg, fg, text;

    if (transientState === 'pushing') {
      bg = 'rgba(245,158,11,.15)'; fg = '#f59e0b'; text = L.sync_pushing + '…';
    } else if (transientState === 'error') {
      bg = 'rgba(239,68,68,.15)'; fg = '#ef4444'; text = L.sync_error;
    } else if (transientState === 'synced') {
      bg = 'rgba(124,58,237,.15)'; fg = '#7c3aed'; text = L.sync_synced + ' ✓';
    } else if (Sync.pendingPush && Sync.mode === 'live') {
      bg = 'rgba(245,158,11,.15)'; fg = '#f59e0b'; text = L.sync_pushing + '…';
    } else {
      if (Sync.mode === 'local') { bg = 'rgba(100,116,139,.15)'; fg = '#64748b'; text = L.sync_mode_local; }
      else if (Sync.mode === 'online') { bg = 'rgba(245,158,11,.15)'; fg = '#f59e0b'; text = L.sync_mode_online; }
      else { bg = 'rgba(16,185,129,.12)'; fg = '#10b981'; text = L.sync_mode_live; }
    }

    wrap.style.background = bg;
    wrap.style.color = fg;
    label.textContent = text;
    dot.style.background = fg;
    dot.style.animation = (Sync.mode === 'live' && !transientState) ? 'dmPulse 2s infinite' : 'none';

    if (transientState) {
      clearTimeout(wrap._resetT);
      wrap._resetT = setTimeout(() => updateIndicator(), 2500);
    }
  }

  /* ---------- Auth hooks ---------- */
  function hookAuth() {
    if (typeof window.attemptLogin === 'function') {
      const orig = window.attemptLogin;
      window.attemptLogin = function () {
        const ok = orig.apply(this, arguments);
        if (ok) setTimeout(refreshMode, 400);
        return ok;
      };
    }
    if (typeof window.logout === 'function') {
      const orig = window.logout;
      window.logout = function () {
        stopListener();
        Sync.pendingPush = false;
        const r = orig.apply(this, arguments);
        setTimeout(refreshMode, 300);
        return r;
      };
    }
  }

  /* ---------- Test helpers ---------- */
  window.__dmSyncNow = function () {
    if (Sync.mode === 'live') { schedulePush(0); console.log('[Section 2] Manual push queued'); }
    else console.log('[Section 2] Not live (' + Sync.mode + ')');
  };
  window.__dmSyncStatus = function () {
    const s = {
      tabId: TAB_ID,
      mode: Sync.mode,
      online: navigator.onLine,
      firebaseReady: !!(window.DrMediaFB && window.DrMediaFB.ready),
      loggedIn: !!(State && State.user),
      username: State && State.user && State.user.username,
      writesSent: Sync.writesSent,
      updatesReceived: Sync.updatesReceived,
      pendingPush: Sync.pendingPush,
      failures: Sync.failures,
      lastPushAt: Sync.lastPushAt,
      lastPullAt: Sync.lastPullAt,
      lastError: Sync.lastError,
      employeesCount: State && State.data ? (State.data.employees || []).length : 0,
      bookingsCount: State && State.data ? (State.data.bookings || []).length : 0
    };
    console.table(s);
    return s;
  };
  window.__dmForceLive = function () { setMode('live'); };

  /* ---------- BOOT ---------- */
  waitFor(
    () => window.DrMediaFB && window.DrMediaFB.ready
        && typeof State !== 'undefined'
        && document.getElementById('topbar'),
    function () {
      console.log('[Section 2] Firebase ready — bootstrapping');
      installSaveData();
      injectIndicator();
      attachNetworkListeners();
      startPolling();
      hookAuth();
      refreshMode();
      if (Sync.mode === 'live') startListener();

      console.log('%c[Section 2] ═══ READY ═══', 'color:#10b981;font-weight:bold;font-size:14px');
      console.log('%c[Section 2] Commands:\n  __dmSyncStatus()  — full status\n  __dmSyncNow()     — manual push\n  __dmForceLive()   — force live mode',
                  'color:#06b6d4;font-style:italic');
    },
    'Firebase + State + topbar'
  );

})();


/* #########################################################
   ##### SECTION 3 — COMMAND PALETTE (Ctrl+K)           #####
   ######################################################### */
(function () {
  'use strict';

  console.log('%c[Section 3] Loading Command Palette…', 'color:#06b6d4;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 100;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 3] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  if (typeof I18N !== 'undefined') {
    Object.assign(I18N.ar, {
      cmd_placeholder: 'اكتب للبحث أو تنفيذ أمر…',
      cmd_no_results: 'لا توجد نتائج',
      cmd_pages: 'الصفحات', cmd_actions: 'الإجراءات',
      cmd_employees: 'الموظفون', cmd_bookings: 'الحجوزات',
      cmd_clients: 'العملاء', cmd_halls: 'القاعات', cmd_equipment: 'المعدات'
    });
    Object.assign(I18N.en, {
      cmd_placeholder: 'Type to search or run a command…',
      cmd_no_results: 'No results',
      cmd_pages: 'Pages', cmd_actions: 'Actions',
      cmd_employees: 'Employees', cmd_bookings: 'Bookings',
      cmd_clients: 'Clients', cmd_halls: 'Halls', cmd_equipment: 'Equipment'
    });
  }

  /* ---------- Styles ---------- */
  function injectStyles() {
    if (document.getElementById('dm-cmd-styles')) return;
    const s = document.createElement('style');
    s.id = 'dm-cmd-styles';
    s.textContent = `
      .dm-cmd-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(15,10,31,.65);backdrop-filter:blur(6px);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;padding-inline:1rem;animation:dmFadeIn .15s ease}
      @keyframes dmFadeIn{from{opacity:0}to{opacity:1}}
      .dm-cmd-box{width:100%;max-width:620px;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);overflow:hidden;animation:dmSlideIn .2s ease}
      @keyframes dmSlideIn{from{transform:translateY(-10px);opacity:0}to{transform:none;opacity:1}}
      .dm-cmd-input-wrap{display:flex;align-items:center;gap:.75rem;padding:1rem 1.25rem;border-bottom:1px solid var(--border)}
      .dm-cmd-input-wrap svg{color:var(--text-muted);width:20px;height:20px;flex-shrink:0}
      .dm-cmd-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:1rem;font-family:inherit}
      .dm-cmd-input::placeholder{color:var(--text-muted)}
      .dm-cmd-kbd{font-size:.7rem;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);padding:.15rem .4rem;border-radius:6px;font-family:ui-monospace,monospace}
      .dm-cmd-results{max-height:52vh;overflow-y:auto;padding:.5rem 0}
      .dm-cmd-results::-webkit-scrollbar{width:6px}
      .dm-cmd-results::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px}
      .dm-cmd-section{padding:.5rem 1rem .35rem;font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em}
      .dm-cmd-item{display:flex;align-items:center;gap:.75rem;padding:.6rem 1.25rem;cursor:pointer;transition:background .1s;color:var(--text)}
      .dm-cmd-item:hover,.dm-cmd-item.active{background:var(--surface-2)}
      .dm-cmd-item.active{box-shadow:inset 3px 0 0 var(--primary)}
      .dm-cmd-item .dm-cmd-icon{width:32px;height:32px;border-radius:8px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;color:var(--primary);flex-shrink:0}
      .dm-cmd-item .dm-cmd-icon svg{width:16px;height:16px}
      .dm-cmd-item .dm-cmd-body{flex:1;min-width:0}
      .dm-cmd-item .dm-cmd-title{font-size:.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dm-cmd-item .dm-cmd-sub{font-size:.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dm-cmd-item .dm-cmd-hint{font-size:.65rem;color:var(--text-muted);padding:.15rem .4rem;border-radius:6px;background:var(--surface-2);flex-shrink:0}
      .dm-cmd-empty{padding:2rem 1rem;text-align:center;color:var(--text-muted)}
      .dm-cmd-empty svg{width:40px;height:40px;opacity:.3;margin-bottom:.5rem;display:block;margin-inline:auto}
      .dm-cmd-footer{padding:.5rem 1rem;border-top:1px solid var(--border);display:flex;gap:.75rem;justify-content:flex-end;font-size:.7rem;color:var(--text-muted)}
      .dm-cmd-footer kbd{background:var(--surface-2);border:1px solid var(--border);padding:.1rem .35rem;border-radius:4px;font-family:ui-monospace,monospace;font-size:.65rem;margin-inline-end:.2rem}
      .dm-cmd-trigger{display:none;align-items:center;gap:.4rem;padding:.45rem .75rem;border-radius:8px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);font-size:.75rem;cursor:pointer;font-family:inherit;transition:all .15s}
      .dm-cmd-trigger:hover{color:var(--text);border-color:var(--primary)}
      @media (min-width:768px){.dm-cmd-trigger{display:flex}}
    `;
    document.head.appendChild(s);
  }

  let isOpen = false;
  let activeIndex = 0;
  let currentResults = [];

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  function buildIndex() {
    const items = [];
    if (typeof NAV_ITEMS !== 'undefined') {
      NAV_ITEMS.forEach(group => {
        (group.items || []).forEach(item => {
          if (item.id === 'counters') return;
          items.push({
            section: 'pages',
            title: (I18N[State.lang] && I18N[State.lang][item.label]) || item.label,
            sub: group.section, icon: item.icon,
            action: () => { if (typeof navigate === 'function') navigate(item.id); },
            keywords: [item.id, item.label, group.section].join(' ').toLowerCase()
          });
        });
      });
    }
    (State.data.employees || []).forEach(e => {
      items.push({
        section: 'employees', title: e.name, sub: e.role + ' · ' + (e.code || ''),
        icon: 'user', action: () => { if (typeof viewEmployee === 'function') viewEmployee(e.id); },
        keywords: [e.name, e.role, e.code, e.phone].filter(Boolean).join(' ').toLowerCase()
      });
    });
    (State.data.clients || []).forEach(c => {
      items.push({
        section: 'clients', title: c.name, sub: c.phone || c.email || '',
        icon: 'user-circle', action: () => { if (typeof editClient === 'function') editClient(c.id); },
        keywords: [c.name, c.phone, c.email].filter(Boolean).join(' ').toLowerCase()
      });
    });
    (State.data.halls || []).forEach(h => {
      items.push({
        section: 'halls', title: h.name[State.lang] || h.name.ar, sub: h.type || '',
        icon: 'building-2', action: () => { if (typeof editHall === 'function') editHall(h.id); },
        keywords: [h.name.ar, h.name.en, h.code, h.type].filter(Boolean).join(' ').toLowerCase()
      });
    });
    (State.data.equipment || []).forEach(eq => {
      items.push({
        section: 'equipment', title: eq.name, sub: eq.category + ' · ' + eq.code,
        icon: 'camera', action: () => { if (typeof editEquipment === 'function') editEquipment(eq.id); },
        keywords: [eq.name, eq.category, eq.code, eq.serial].filter(Boolean).join(' ').toLowerCase()
      });
    });
    [...(State.data.bookings || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).forEach(b => {
      items.push({
        section: 'bookings', title: b.clientName || b.id,
        sub: b.date + ' · ' + hallName(b.hallId),
        icon: 'calendar-check', action: () => { if (typeof editBooking === 'function') editBooking(b.id); },
        keywords: [b.clientName, b.id, b.date, b.phone].filter(Boolean).join(' ').toLowerCase()
      });
    });
    items.push({ section: 'actions', title: State.lang === 'ar' ? 'إضافة موظف جديد' : 'Add new employee', sub: 'N', icon: 'user-plus',
      action: () => { if (typeof editEmployee === 'function') editEmployee(); }, keywords: 'add employee new create إضافة موظف جديد' });
    items.push({ section: 'actions', title: State.lang === 'ar' ? 'إضافة حجز جديد' : 'Add new booking', sub: '', icon: 'calendar-plus',
      action: () => { if (typeof editBooking === 'function') editBooking(); }, keywords: 'add booking new create إضافة حجز جديد' });
    items.push({ section: 'actions', title: State.lang === 'ar' ? 'التوزيع التلقائي' : 'Auto distribute staff', sub: '', icon: 'wand-2',
      action: () => { if (typeof navigate === 'function') navigate('distribution'); setTimeout(() => { if (typeof autoDistribute === 'function') autoDistribute(); }, 400); },
      keywords: 'auto distribute توزيع تلقائي' });
    items.push({ section: 'actions', title: State.lang === 'ar' ? 'تبديل الوضع الليلي' : 'Toggle dark mode', sub: '', icon: 'moon',
      action: () => { State.theme = State.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(THEME_KEY, State.theme); } catch (e) {} if (typeof applyTheme === 'function') applyTheme(); if (typeof navigate === 'function') navigate(State.page); },
      keywords: 'theme dark light mode تبديل الوضع الليلي' });
    items.push({ section: 'actions', title: State.lang === 'ar' ? 'تبديل اللغة' : 'Switch language', sub: State.lang === 'ar' ? 'English' : 'العربية', icon: 'languages',
      action: () => { State.lang = State.lang === 'ar' ? 'en' : 'ar'; try { localStorage.setItem(LANG_KEY, State.lang); } catch (e) {} if (typeof applyLang === 'function') applyLang(); if (typeof renderSidebar === 'function') renderSidebar(); if (typeof navigate === 'function') navigate(State.page); },
      keywords: 'language lang arabic english تبديل اللغة' });
    return items;
  }

  function search(query, index) {
    if (!query) return index.filter(i => i.section === 'pages' || i.section === 'actions').slice(0, 12);
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/);
    const scored = [];
    index.forEach(item => {
      let score = 0;
      const haystack = item.keywords + ' ' + item.title.toLowerCase() + ' ' + (item.sub || '').toLowerCase();
      tokens.forEach(tok => {
        if (!tok) return;
        if (item.title.toLowerCase().startsWith(tok)) score += 100;
        else if (item.title.toLowerCase().includes(tok)) score += 50;
        else if (haystack.includes(tok)) score += 20;
      });
      if (score > 0) scored.push({ item, score });
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 25).map(s => s.item);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(query) {
    const index = buildIndex();
    const results = search(query, index);
    currentResults = results;
    activeIndex = 0;
    const resultsEl = document.getElementById('dm-cmd-results');
    if (!resultsEl) return;

    if (!results.length) {
      resultsEl.innerHTML = `<div class="dm-cmd-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><div>${(I18N[State.lang] || I18N.ar).cmd_no_results}</div></div>`;
      return;
    }
    const groups = {};
    results.forEach(r => { groups[r.section] = groups[r.section] || []; groups[r.section].push(r); });
    let html = '';
    let globalIdx = 0;
    Object.keys(groups).forEach(section => {
      const sectionLabel = (I18N[State.lang] && I18N[State.lang]['cmd_' + section]) || section;
      html += `<div class="dm-cmd-section">${sectionLabel}</div>`;
      groups[section].forEach(item => {
        const idx = globalIdx++;
        html += `<div class="dm-cmd-item ${idx === 0 ? 'active' : ''}" data-index="${idx}">
          <div class="dm-cmd-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" data-lucide="${item.icon}"><circle cx="12" cy="12" r="10"/></svg></div>
          <div class="dm-cmd-body"><div class="dm-cmd-title">${escapeHtml(item.title)}</div>${item.sub ? `<div class="dm-cmd-sub">${escapeHtml(item.sub)}</div>` : ''}</div>
          <div class="dm-cmd-hint">↵</div></div>`;
      });
    });
    resultsEl.innerHTML = html;
    if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
    resultsEl.querySelectorAll('.dm-cmd-item').forEach(el => {
      el.addEventListener('click', () => selectResult(+el.dataset.index));
      el.addEventListener('mouseenter', () => { activeIndex = +el.dataset.index; updateActive(); });
    });
  }

  function updateActive() {
    document.querySelectorAll('.dm-cmd-item').forEach(el => {
      if (+el.dataset.index === activeIndex) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest' }); }
      else el.classList.remove('active');
    });
  }

  function selectResult(idx) {
    const item = currentResults[idx];
    if (!item) return;
    close();
    setTimeout(() => { try { item.action(); } catch (e) { console.error('[Section 3] action failed', e); } }, 80);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    const L = I18N[State.lang] || I18N.ar;
    const backdrop = document.createElement('div');
    backdrop.className = 'dm-cmd-backdrop';
    backdrop.id = 'dm-cmd-backdrop';
    backdrop.innerHTML = `
      <div class="dm-cmd-box" onclick="event.stopPropagation()">
        <div class="dm-cmd-input-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" class="dm-cmd-input" id="dm-cmd-input" placeholder="${L.cmd_placeholder}" autocomplete="off" spellcheck="false">
          <span class="dm-cmd-kbd">ESC</span>
        </div>
        <div class="dm-cmd-results" id="dm-cmd-results"></div>
        <div class="dm-cmd-footer"><span><kbd>↑↓</kbd>Navigate</span><span><kbd>↵</kbd>Select</span><span><kbd>ESC</kbd>Close</span></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', close);
    const input = document.getElementById('dm-cmd-input');
    input.focus();
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', handleKey);
    render('');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    const el = document.getElementById('dm-cmd-backdrop');
    if (el) el.remove();
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, currentResults.length - 1); updateActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); updateActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); selectResult(activeIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  document.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K';
    if (isK && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (isOpen) close(); else open();
    }
    if (e.key === '/' && !isOpen) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
      if (!isInput) { e.preventDefault(); open(); }
    }
  });

  function injectTrigger() {
    if (document.getElementById('dm-cmd-trigger')) return;
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    const btn = document.createElement('button');
    btn.className = 'dm-cmd-trigger';
    btn.id = 'dm-cmd-trigger';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Search…</span><span class="dm-cmd-kbd">⌘K</span>`;
    btn.onclick = open;
    const searchBox = topbar.querySelector('.search-box');
    if (searchBox) { searchBox.parentNode.insertBefore(btn, searchBox); searchBox.style.display = 'none'; }
    else topbar.appendChild(btn);
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof NAV_ITEMS !== 'undefined' && typeof navigate === 'function' && document.getElementById('topbar'),
    function () {
      injectStyles();
      injectTrigger();
      console.log('%c[Section 3] ✓ Command Palette ready — Ctrl+K', 'color:#10b981;font-weight:bold');
    }
  );

})();


/* #########################################################
   ##### SECTION 4 — WHATSAPP INTEGRATION               #####
   ######################################################### */
(function () {
  'use strict';

  console.log('%c[Section 4] WhatsApp Integration loading…', 'color:#25d366;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 100;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 4] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  if (typeof I18N !== 'undefined') {
    Object.assign(I18N.ar, {
      whatsapp: 'واتساب', whatsapp_send: 'إرسال واتساب',
      whatsapp_templates: 'قوالب الرسائل', whatsapp_choose: 'اختر القالب',
      whatsapp_preview: 'معاينة الرسالة', whatsapp_send_btn: 'فتح واتساب',
      whatsapp_no_phone: 'الموظف ليس له رقم هاتف مسجل',
      tpl_assignment: 'تعيين في قاعة', tpl_reminder: 'تذكير بموعد',
      tpl_payslip: 'كشف مرتب', tpl_custom: 'رسالة مخصصة'
    });
    Object.assign(I18N.en, {
      whatsapp: 'WhatsApp', whatsapp_send: 'Send WhatsApp',
      whatsapp_templates: 'Message Templates', whatsapp_choose: 'Choose Template',
      whatsapp_preview: 'Message Preview', whatsapp_send_btn: 'Open WhatsApp',
      whatsapp_no_phone: 'Employee has no phone number',
      tpl_assignment: 'Hall Assignment', tpl_reminder: 'Appointment Reminder',
      tpl_payslip: 'Pay Slip', tpl_custom: 'Custom Message'
    });
  }

  function normalizePhone(phone) {
    if (!phone) return null;
    let p = String(phone).replace(/[^\d+]/g, '');
    if (p.startsWith('00')) p = p.slice(2);
    const country = (State.data.settings && State.data.settings.whatsappCountry) || '20';
    if (p.startsWith('0')) p = country + p.slice(1);
    if (p.startsWith('+')) p = p.slice(1);
    return p;
  }

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  function buildTemplates(ctx) {
    const sig = (State.data.settings && State.data.settings.whatsappSignature) || 'Dr Media Pro';
    return {
      tpl_assignment: {
        label: (I18N[State.lang] || I18N.ar).tpl_assignment,
        build: () => {
          const name = ctx.empName || '—';
          if (State.lang === 'ar') return `مرحبًا ${name}،\nتم توزيعك يوم ${ctx.date || ''} على ${ctx.hallName || 'القاعة'}.\nالوظيفة: ${ctx.role || 'موظف'}\n${ctx.time ? 'وقت العمل: ' + ctx.time + '\n' : ''}\nشكرًا لك,\n${sig}`;
          return `Hi ${name},\nYou are assigned on ${ctx.date || ''} at ${ctx.hallName || 'hall'}.\nRole: ${ctx.role || 'Staff'}\n${ctx.time ? 'Time: ' + ctx.time + '\n' : ''}\nThanks,\n${sig}`;
        }
      },
      tpl_reminder: {
        label: (I18N[State.lang] || I18N.ar).tpl_reminder,
        build: () => State.lang === 'ar'
          ? `مرحبًا ${ctx.empName || ''}،\nتذكير بموعدك غدًا في ${ctx.hallName || 'القاعة'} الساعة ${ctx.time || '7:00 PM'}.\n\n${sig}`
          : `Hi ${ctx.empName || ''},\nReminder: appointment tomorrow at ${ctx.hallName || 'hall'} at ${ctx.time || '7:00 PM'}.\n\n${sig}`
      },
      tpl_payslip: {
        label: (I18N[State.lang] || I18N.ar).tpl_payslip,
        build: () => State.lang === 'ar'
          ? `مرحبًا ${ctx.empName || ''}،\nتم إصدار كشف مرتبك.\nالصافي: EGP ${ctx.amount || '0'}\n\n${sig}`
          : `Hi ${ctx.empName || ''},\nYour pay slip is ready.\nNet: EGP ${ctx.amount || '0'}\n\n${sig}`
      },
      tpl_custom: { label: (I18N[State.lang] || I18N.ar).tpl_custom, build: () => '', custom: true }
    };
  }

  function openWhatsApp(phone, message) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      if (typeof showToast === 'function') showToast((I18N[State.lang] || I18N.ar).whatsapp_no_phone, 'error');
      return false;
    }
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  function showModal(ctx) {
    const templates = buildTemplates(ctx);
    const L = I18N[State.lang] || I18N.ar;
    const modalHtml = `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="field"><label>${L.whatsapp_choose}</label>
          <select id="wa-tpl" style="width:100%;padding:.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
            ${Object.keys(templates).map(k => `<option value="${k}">${templates[k].label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>${L.whatsapp_preview}</label>
          <textarea id="wa-msg" rows="8" style="width:100%;padding:.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit;resize:vertical;font-size:.85rem;line-height:1.5"></textarea>
        </div>
        <div style="font-size:.78rem;color:var(--text-muted)">📞 ${ctx.phone || '—'}</div>
      </div>`;

    if (typeof openModal !== 'function') { alert('Modal system not available'); return; }
    openModal({
      title: `💬 ${L.whatsapp} — ${ctx.empName || ''}`,
      size: 'lg',
      body: modalHtml,
      footer: `<button class="btn btn-ghost" onclick="closeModal()">${L.cancel || 'Cancel'}</button>
               <button class="btn btn-success" id="wa-send-btn" style="background:#25d366">${L.whatsapp_send_btn}</button>`
    });

    const sel = document.getElementById('wa-tpl');
    const ta = document.getElementById('wa-msg');
    function applyTemplate() {
      const tpl = templates[sel.value];
      if (tpl && !tpl.custom) ta.value = tpl.build();
      else { ta.value = ''; ta.focus(); }
    }
    sel.addEventListener('change', applyTemplate);
    applyTemplate();

    document.getElementById('wa-send-btn').onclick = () => {
      const message = ta.value.trim();
      if (!message) { if (typeof showToast === 'function') showToast('الرسالة فارغة', 'warn'); return; }
      openWhatsApp(ctx.phone, message);
      if (typeof showToast === 'function') showToast(State.lang === 'ar' ? 'تم فتح واتساب' : 'WhatsApp opened', 'success');
      try { if (typeof logActivity === 'function') logActivity('whatsapp-send', 'employee', ctx.employeeId, null, { template: sel.value }); } catch (e) {}
      if (typeof closeModal === 'function') closeModal();
    };
  }

  window.whatsappEmployee = function (employeeId, extraContext) {
    const emp = State.data.employees.find(e => e.id === employeeId);
    if (!emp) return;
    showModal(Object.assign({ employeeId: emp.id, empName: emp.name, phone: emp.phone }, extraContext || {}));
  };
  window.whatsappByContext = function (ctx) { showModal(ctx || {}); };

  function wrapPages() {
    if (typeof Pages === 'undefined') return;
    if (Pages.distribution) {
      const orig = Pages.distribution;
      Pages.distribution = function (el) { orig.apply(this, arguments); setTimeout(injectDistributionButtons, 100); };
    }
    if (Pages.employees) {
      const orig = Pages.employees;
      Pages.employees = function (el) { orig.apply(this, arguments); setTimeout(injectEmployeesButtons, 100); };
    }
  }

  function injectDistributionButtons() {
    document.querySelectorAll('.emp-chip').forEach(chip => {
      if (chip.querySelector('.wa-btn')) return;
      const distId = chip.dataset.dist;
      if (!distId) return;
      const dist = (State.data.distributions || []).find(x => x.id === distId);
      if (!dist || !dist.employeeId) return;
      const btn = document.createElement('button');
      btn.className = 'wa-btn';
      btn.title = 'WhatsApp';
      btn.style.cssText = 'margin-inline-start:.25rem;background:none;border:none;color:#25d366;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
      btn.onclick = (e) => {
        e.stopPropagation();
        const booking = (State.data.bookings || []).find(b => b.date === dist.date && b.hallId === dist.hallId);
        whatsappEmployee(dist.employeeId, {
          hallName: hallName(dist.hallId), role: dist.role, date: dist.date,
          time: booking ? (booking.startTime + ' - ' + booking.endTime) : ''
        });
      };
      chip.appendChild(btn);
    });
  }

  function injectEmployeesButtons() {
    document.querySelectorAll('.data-table').forEach(table => {
      table.querySelectorAll('tbody tr').forEach(row => {
        const actionCell = row.querySelector('td:last-child');
        if (!actionCell || actionCell.querySelector('.wa-btn')) return;
        const editBtn = row.querySelector('button[onclick*="editEmployee"]');
        if (!editBtn) return;
        const match = editBtn.getAttribute('onclick').match(/editEmployee\('([^']+)'\)/);
        if (!match) return;
        const empId = match[1];
        const waBtn = document.createElement('button');
        waBtn.className = 'btn btn-ghost btn-icon btn-sm wa-btn';
        waBtn.title = 'WhatsApp';
        waBtn.style.color = '#25d366';
        waBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        waBtn.onclick = (e) => { e.stopPropagation(); whatsappEmployee(empId); };
        const actionsDiv = actionCell.querySelector('div');
        if (actionsDiv) actionsDiv.appendChild(waBtn);
        else actionCell.appendChild(waBtn);
      });
    });
  }

  function ensureSettings() {
    if (!State.data.settings) State.data.settings = {};
    if (!State.data.settings.whatsappCountry) State.data.settings.whatsappCountry = '20';
    if (!State.data.settings.whatsappSignature) State.data.settings.whatsappSignature = 'Dr Media Pro';
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined'
        && typeof openModal === 'function' && typeof navigate === 'function',
    function () {
      ensureSettings();
      wrapPages();

      const topbar = document.getElementById('topbar');
      if (topbar && !document.getElementById('dm-wa-quick')) {
        const quickBtn = document.createElement('button');
        quickBtn.className = 'topbar-btn';
        quickBtn.id = 'dm-wa-quick';
        quickBtn.title = 'WhatsApp';
        quickBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#25d366" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        quickBtn.onclick = () => {
          const L = I18N[State.lang] || I18N.ar;
          openModal({
            title: `💬 ${L.whatsapp}`,
            body: `<div class="field"><label>${L.employees || 'Employees'}</label>
              <select id="wa-pick-emp" style="width:100%;padding:.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
                <option value="">—</option>
                ${State.data.employees.map(e => `<option value="${e.id}">${e.name} (${e.phone || '—'})</option>`).join('')}
              </select></div>`,
            footer: `<button class="btn btn-ghost" onclick="closeModal()">${L.cancel || 'Cancel'}</button>
                     <button class="btn btn-success" id="wa-pick-go" style="background:#25d366">${L.whatsapp_send_btn}</button>`
          });
          document.getElementById('wa-pick-go').onclick = () => {
            const empId = document.getElementById('wa-pick-emp').value;
            if (!empId) return;
            if (typeof closeModal === 'function') closeModal();
            setTimeout(() => whatsappEmployee(empId), 200);
          };
        };
        const notifBtn = document.getElementById('notif-btn');
        if (notifBtn && notifBtn.parentNode) notifBtn.parentNode.insertBefore(quickBtn, notifBtn);
        else topbar.appendChild(quickBtn);
      }

      console.log('%c[Section 4] ✓ WhatsApp Integration ready', 'color:#25d366;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 5: Leave Management (إدارة الإجازات)
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 5] Leave Management loading…', 'color:#7c3aed;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 5] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  Object.assign(I18N.ar, {
    leaves: 'الإجازات', leave_add: 'طلب إجازة', leave_my: 'إجازاتي',
    leave_type: 'نوع الإجازة', leave_from: 'من تاريخ', leave_to: 'إلى تاريخ',
    leave_reason: 'السبب', leave_status: 'الحالة', leave_approve: 'اعتماد',
    leave_reject: 'رفض', leave_pending: 'قيد الموافقة', leave_approved: 'معتمدة',
    leave_rejected: 'مرفوضة', leave_type_sick: 'مرضية', leave_type_vacation: 'سنوية',
    leave_type_emergency: 'طارئة', leave_type_unpaid: 'بدون راتب',
    leave_days: 'عدد الأيام', leave_conflict_warning: 'يوجد توزيعات في هذه الفترة'
  });
  Object.assign(I18N.en, {
    leaves: 'Leaves', leave_add: 'Request Leave', leave_my: 'My Leaves',
    leave_type: 'Leave Type', leave_from: 'From Date', leave_to: 'To Date',
    leave_reason: 'Reason', leave_status: 'Status', leave_approve: 'Approve',
    leave_reject: 'Reject', leave_pending: 'Pending', leave_approved: 'Approved',
    leave_rejected: 'Rejected', leave_type_sick: 'Sick', leave_type_vacation: 'Vacation',
    leave_type_emergency: 'Emergency', leave_type_unpaid: 'Unpaid',
    leave_days: 'Days Count', leave_conflict_warning: 'Has distributions in this period'
  });

  /* ---------- ensure data ---------- */
  function ensure() {
    if (!State.data.leaves) State.data.leaves = [];
    if (!State.data.leaveTypes) {
      State.data.leaveTypes = ['sick', 'vacation', 'emergency', 'unpaid'];
    }
  }

  /* ---------- helpers ---------- */
  function daysBetween(a, b) {
    try {
      const d1 = new Date(a), d2 = new Date(b);
      return Math.round((d2 - d1) / 86400000) + 1;
    } catch (e) { return 1; }
  }

  function isOnLeave(employeeId, dateStr) {
    if (!State.data.leaves) return false;
    return State.data.leaves.some(l => {
      if (l.employeeId !== employeeId) return false;
      if (l.status !== 'approved') return false;
      return dateStr >= l.fromDate && dateStr <= l.toDate;
    });
  }
  window.__dmIsOnLeave = isOnLeave;

  /* ---------- register page ---------- */
  Pages.leaves = function (el) {
    ensure();
    const isAdmin = State.user.role === 'Admin' || State.user.role === 'Manager';
    const myEmpId = State.user.employeeId;
    const statusFilter = State.filters.leaveStatus || 'all';

    let leaves = [...(State.data.leaves || [])].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    // Employee: only own leaves
    if (!isAdmin && myEmpId) {
      leaves = leaves.filter(l => l.employeeId === myEmpId);
    }

    if (statusFilter !== 'all') {
      leaves = leaves.filter(l => l.status === statusFilter);
    }

    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;align-items:center">
        <select id="lv-status" style="padding:.55rem .8rem;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit">
          <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>${t('filter_all')}</option>
          <option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>${t('leave_pending')}</option>
          <option value="approved" ${statusFilter === 'approved' ? 'selected' : ''}>${t('leave_approved')}</option>
          <option value="rejected" ${statusFilter === 'rejected' ? 'selected' : ''}>${t('leave_rejected')}</option>
        </select>
        <div style="margin-inline-start:auto">
          <button class="btn btn-primary btn-sm" onclick="__dmLeaveAdd()"><i data-lucide="plus"></i> ${t('leave_add')}</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>${t('employees')}</th>
            <th>${t('leave_type')}</th>
            <th>${t('leave_from')}</th>
            <th>${t('leave_to')}</th>
            <th>${t('leave_days')}</th>
            <th>${t('leave_status')}</th>
            <th>${t('actions')}</th>
          </tr></thead>
          <tbody>
            ${leaves.length ? leaves.map(l => {
              const emp = State.data.employees.find(e => e.id === l.employeeId);
              const statusColor = { pending: 'yellow', approved: 'green', rejected: 'red' }[l.status] || 'gray';
              return `<tr>
                <td><div class="cell-user"><div class="av">${initials(emp?.name)}</div><div style="font-weight:600">${emp?.name || '-'}</div></div></td>
                <td><span class="badge-pill badge-purple">${t('leave_type_' + l.type) || l.type}</span></td>
                <td>${fmtDate(l.fromDate)}</td>
                <td>${fmtDate(l.toDate)}</td>
                <td>${daysBetween(l.fromDate, l.toDate)}</td>
                <td><span class="badge-pill badge-${statusColor}">${t('leave_' + l.status) || l.status}</span></td>
                <td>
                  <div style="display:flex;gap:.25rem">
                    ${isAdmin && l.status === 'pending' ? `
                      <button class="btn btn-success btn-sm" onclick="__dmLeaveApprove('${l.id}')"><i data-lucide="check"></i> ${t('leave_approve')}</button>
                      <button class="btn btn-danger btn-sm" onclick="__dmLeaveReject('${l.id}')"><i data-lucide="x"></i> ${t('leave_reject')}</button>
                    ` : ''}
                    ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="__dmLeaveDelete('${l.id}')" style="color:#ef4444"><i data-lucide="trash-2"></i></button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="7"><div class="empty-state"><i data-lucide="plane"></i><p>${t('no_data')}</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    document.getElementById('lv-status').onchange = (e) => {
      State.filters.leaveStatus = e.target.value;
      navigate('leaves');
    };
  };

  /* ---------- open add modal ---------- */
  window.__dmLeaveAdd = function () {
    const employees = State.data.employees.filter(e => e.status === 'active');
    const isAdmin = State.user.role === 'Admin' || State.user.role === 'Manager';
    const types = State.data.leaveTypes;

    openModal({
      title: t('leave_add'),
      size: 'lg',
      body: `
        <div class="form-row">
          <div class="field"><label>${t('employees')} *</label>
            <select id="lv-emp">${employees.map(e => `<option value="${e.id}" ${State.user.employeeId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}</select>
          </div>
          <div class="field"><label>${t('leave_type')} *</label>
            <select id="lv-type">${types.map(x => `<option value="${x}">${t('leave_type_' + x) || x}</option>`).join('')}</select>
          </div>
          <div class="field"><label>${t('leave_from')} *</label><input type="date" id="lv-from" value="${todayISO()}"></div>
          <div class="field"><label>${t('leave_to')} *</label><input type="date" id="lv-to" value="${todayISO()}"></div>
        </div>
        <div class="field" style="margin-top:1rem"><label>${t('leave_reason')}</label><textarea id="lv-reason"></textarea></div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
        <button class="btn btn-primary" onclick="__dmLeaveSave()">${t('save')}</button>
      `
    });
  };

  window.__dmLeaveSave = function () {
    const empId = document.getElementById('lv-emp').value;
    const type = document.getElementById('lv-type').value;
    const fromDate = document.getElementById('lv-from').value;
    const toDate = document.getElementById('lv-to').value;
    const reason = document.getElementById('lv-reason').value.trim();

    if (!empId || !fromDate || !toDate) {
      showToast(t('required_field'), 'error'); return;
    }
    if (toDate < fromDate) {
      showToast('تاريخ النهاية قبل البداية', 'error'); return;
    }

    const isAdmin = State.user.role === 'Admin' || State.user.role === 'Manager';

    const newLeave = {
      id: uid('lv'),
      employeeId: empId,
      type, fromDate, toDate, reason,
      status: isAdmin ? 'approved' : 'pending',
      createdAt: new Date().toISOString(),
      createdBy: State.user.username,
      approvedBy: isAdmin ? State.user.username : null,
      approvedAt: isAdmin ? new Date().toISOString() : null
    };

    State.data.leaves.push(newLeave);
    saveData();
    logActivity('create', 'leave', newLeave.id, null, newLeave);

    // Notification
    State.data.notifications.unshift({
      id: uid('n'),
      userId: null,
      title: 'طلب إجازة جديد',
      body: `${empName(empId)} — ${fmtDate(fromDate)} إلى ${fmtDate(toDate)}`,
      date: todayISO(),
      read: false,
      type: 'leave'
    });

    closeModal();
    showToast(t('saved'), 'success');
    if (State.page === 'leaves') navigate('leaves');
  };

  window.__dmLeaveApprove = function (id) {
    const l = State.data.leaves.find(x => x.id === id);
    if (!l) return;
    l.status = 'approved';
    l.approvedBy = State.user.username;
    l.approvedAt = new Date().toISOString();
    saveData();
    logActivity('approve', 'leave', id, null, l);
    showToast(t('saved'), 'success');
    navigate('leaves');
  };

  window.__dmLeaveReject = function (id) {
    const l = State.data.leaves.find(x => x.id === id);
    if (!l) return;
    l.status = 'rejected';
    l.approvedBy = State.user.username;
    l.approvedAt = new Date().toISOString();
    saveData();
    logActivity('reject', 'leave', id, null, l);
    showToast(t('deleted'), 'success');
    navigate('leaves');
  };

  window.__dmLeaveDelete = function (id) {
    confirmDialog(t('confirm_delete'), () => {
      State.data.leaves = State.data.leaves.filter(x => x.id !== id);
      saveData();
      showToast(t('deleted'), 'success');
      navigate('leaves');
    });
  };

  /* ---------- register nav item ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'leaves')) {
      ops.items.push({ id: 'leaves', icon: 'plane', label: 'leaves' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- hook autoDistribute to skip leaves ---------- */
  function hookAutoDistribute() {
    if (typeof window.autoDistribute !== 'function') return;
    const orig = window.autoDistribute;
    window.autoDistribute = function () {
      // Before running, warn if any employees on leave
      const date = State.filters.distDate || todayISO();
      const onLeaveToday = (State.data.employees || []).filter(e => isOnLeave(e.id, date));
      if (onLeaveToday.length > 0) {
        console.log('[Section 5] Employees on leave today:', onLeaveToday.map(e => e.name));
      }
      return orig.apply(this, arguments);
    };
  }

  /* ---------- boot ---------- */
  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof openModal === 'function',
    function () {
      ensure();
      registerNav();
      hookAutoDistribute();
      console.log('%c[Section 5] ✓ Leave Management ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 6: Substitution System (نظام الاستبدال)
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 6] Substitution loading…', 'color:#f59e0b;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 6] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    substitutions: 'الاستبدالات', substitute: 'استبدال',
    original_employee: 'الأصلي', replacement_employee: 'البديل',
    sub_reason: 'سبب الاستبدال', sub_confirm: 'تأكيد الاستبدال',
    sub_no_eligible: 'لا يوجد موظف بديل متاح بنفس الدور',
    sub_history: 'سجل الاستبدالات'
  });
  Object.assign(I18N.en, {
    substitutions: 'Substitutions', substitute: 'Substitute',
    original_employee: 'Original', replacement_employee: 'Replacement',
    sub_reason: 'Reason', sub_confirm: 'Confirm Substitution',
    sub_no_eligible: 'No eligible substitute available for this role',
    sub_history: 'Substitution History'
  });

  function ensure() {
    if (!State.data.substitutions) State.data.substitutions = [];
  }

  /* ---------- register page for history ---------- */
  Pages.substitutions = function (el) {
    ensure();
    const list = [...(State.data.substitutions || [])].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>${t('date')}</th>
            <th>${t('hall')}</th>
            <th>${t('role')}</th>
            <th>${t('original_employee')}</th>
            <th>${t('replacement_employee')}</th>
            <th>${t('sub_reason')}</th>
            <th>${t('approved')}</th>
          </tr></thead>
          <tbody>
            ${list.length ? list.map(s => `
              <tr>
                <td>${fmtDate(s.date)}</td>
                <td>${hallName(s.hallId)}</td>
                <td>${s.role}</td>
                <td><div class="cell-user"><div class="av">${initials(empName(s.originalEmployeeId))}</div><div>${empName(s.originalEmployeeId)}</div></div></td>
                <td><div class="cell-user"><div class="av" style="background:linear-gradient(135deg,#10b981,#06b6d4)">${initials(empName(s.replacementEmployeeId))}</div><div>${empName(s.replacementEmployeeId)}</div></div></td>
                <td>${s.reason || '-'}</td>
                <td><span class="badge-pill badge-green">${s.approvedBy || '-'}</span></td>
              </tr>`).join('') : `<tr><td colspan="7"><div class="empty-state"><i data-lucide="repeat"></i><p>${t('no_data')}</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  };

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  /* ---------- open substitution modal ---------- */
  window.__dmOpenSubstitution = function (distId) {
    const dist = (State.data.distributions || []).find(x => x.id === distId);
    if (!dist) { showToast('Distribution not found', 'error'); return; }

    const originalEmp = State.data.employees.find(e => e.id === dist.employeeId);
    const date = dist.date;
    const role = dist.role;

    // Already assigned today (in any distribution on this date)
    const assignedToday = new Set(
      (State.data.distributions || [])
        .filter(x => x.date === date)
        .map(x => x.employeeId)
        .filter(Boolean)
    );

    // On leave
    const onLeaveIds = new Set(
      (State.data.leaves || [])
        .filter(l => l.status === 'approved' && date >= l.fromDate && date <= l.toDate)
        .map(l => l.employeeId)
    );

    // Eligible: has role, active, not assigned today, not on leave
    const eligible = State.data.employees.filter(e =>
      e.status === 'active' &&
      (e.role === role || (e.roles || []).includes(role)) &&
      !assignedToday.has(e.id) &&
      !onLeaveIds.has(e.id)
    );

    // Sort by work count ascending (fair)
    eligible.sort((a, b) => {
      const ca = (State.data.distributions || []).filter(x => x.employeeId === a.id).length;
      const cb = (State.data.distributions || []).filter(x => x.employeeId === b.id).length;
      return ca - cb;
    });

    openModal({
      title: `🔄 ${t('substitute')} — ${originalEmp?.name || '-'}`,
      size: 'lg',
      body: `
        <div class="card" style="margin-bottom:1rem;padding:.75rem;background:var(--surface-2);border:none">
          <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.35rem">${t('sub_history')}</div>
          <div style="font-size:.85rem"><b>${originalEmp?.name || '-'}</b> — ${role} — ${hallName(dist.hallId)} — ${fmtDate(date)}</div>
        </div>

        <div class="field" style="margin-bottom:1rem">
          <label>${t('replacement_employee')} *</label>
          ${eligible.length ? `
            <select id="sub-emp" style="width:100%;padding:.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
              ${eligible.map((e, i) => {
                const count = (State.data.distributions || []).filter(x => x.employeeId === e.id).length;
                return `<option value="${e.id}">${e.name} — ${count} ${State.lang === 'ar' ? 'توزيع' : 'assignments'}${i === 0 ? ' ✓ ' + (State.lang === 'ar' ? 'الأقل' : 'best') : ''}</option>`;
              }).join('')}
            </select>
          ` : `<div class="empty-state" style="padding:1rem"><i data-lucide="user-x"></i><p>${t('sub_no_eligible')}</p></div>`}
        </div>

        <div class="field">
          <label>${t('sub_reason')}</label>
          <textarea id="sub-reason" rows="3" placeholder="${State.lang === 'ar' ? 'سبب الاستبدال (اختياري)' : 'Reason (optional)'}"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
        ${eligible.length ? `<button class="btn btn-primary" onclick="__dmConfirmSubstitution('${distId}')">
          <i data-lucide="check"></i> ${t('sub_confirm')}
        </button>` : ''}
      `
    });
    if (window.lucide) lucide.createIcons();
  };

  window.__dmConfirmSubstitution = function (distId) {
    const dist = (State.data.distributions || []).find(x => x.id === distId);
    if (!dist) return;

    const replacementId = document.getElementById('sub-emp').value;
    const reason = document.getElementById('sub-reason').value.trim();
    if (!replacementId) return;

    const originalId = dist.employeeId;

    // Update distribution
    dist.employeeId = replacementId;
    dist.substitutedFrom = originalId;
    dist.substitutedAt = new Date().toISOString();
    dist.substitutedBy = State.user.username;

    // Record substitution
    State.data.substitutions.push({
      id: uid('sub'),
      date: dist.date,
      hallId: dist.hallId,
      role: dist.role,
      originalEmployeeId: originalId,
      replacementEmployeeId: replacementId,
      reason,
      approvedBy: State.user.username,
      createdAt: new Date().toISOString()
    });

    saveData();
    logActivity('substitute', 'distribution', distId, { original: originalId }, { replacement: replacementId });

    // Notification
    State.data.notifications.unshift({
      id: uid('n'),
      userId: null,
      title: 'تم استبدال موظف',
      body: `${empName(originalId)} → ${empName(replacementId)} في ${hallName(dist.hallId)}`,
      date: dist.date,
      read: false,
      type: 'substitution'
    });

    closeModal();
    showToast(State.lang === 'ar' ? 'تم الاستبدال بنجاح' : 'Substitution done', 'success');
    if (State.page === 'distribution') navigate('distribution');
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'substitutions')) {
      ops.items.push({ id: 'substitutions', icon: 'repeat', label: 'substitutions' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- inject substitute button in distribution chips ---------- */
  function hookDistributionPage() {
    if (!Pages.distribution) return;
    const orig = Pages.distribution;
    Pages.distribution = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll('.emp-chip').forEach(chip => {
          if (chip.querySelector('.sub-btn')) return;
          const distId = chip.dataset.dist;
          if (!distId) return;
          const btn = document.createElement('button');
          btn.className = 'sub-btn';
          btn.title = (I18N[State.lang] || I18N.ar).substitute;
          btn.style.cssText = 'margin-inline-start:.25rem;background:none;border:none;color:#f59e0b;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
          btn.onclick = (e) => {
            e.stopPropagation();
            window.__dmOpenSubstitution(distId);
          };
          chip.appendChild(btn);
        });
      }, 120);
    };
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof openModal === 'function',
    function () {
      ensure();
      registerNav();
      hookDistributionPage();
      console.log('%c[Section 6] ✓ Substitution ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 7: Equipment Assignment (ربط المعدات بالحجوزات)
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 7] Equipment Assignment loading…', 'color:#06b6d4;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 7] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    equipment_assignment: 'تعيين المعدات',
    assign_equipment: 'إضافة معدة',
    assigned_equipment: 'المعدات المعينة',
    equipment_conflict: 'تحذير: هذه المعدة معينة لحجز آخر في نفس اليوم',
    no_equipment_assigned: 'لا توجد معدات معينة',
    quantity_assigned: 'الكمية'
  });
  Object.assign(I18N.en, {
    equipment_assignment: 'Equipment Assignment',
    assign_equipment: 'Assign Equipment',
    assigned_equipment: 'Assigned Equipment',
    equipment_conflict: 'Warning: This equipment is assigned to another booking on the same day',
    no_equipment_assigned: 'No equipment assigned',
    quantity_assigned: 'Quantity'
  });

  function ensure() {
    if (!State.data.equipmentAssignments) State.data.equipmentAssignments = [];
  }

  function getAssignmentsForBooking(bookingId) {
    return (State.data.equipmentAssignments || []).filter(a => a.bookingId === bookingId);
  }

  function getConflicts(equipmentId, date, excludeBookingId) {
    const todayBookings = (State.data.bookings || []).filter(b => b.date === date && b.id !== excludeBookingId);
    const bookingIds = new Set(todayBookings.map(b => b.id));
    return (State.data.equipmentAssignments || []).filter(a =>
      a.equipmentId === equipmentId && bookingIds.has(a.bookingId)
    );
  }

  /* ---------- open equipment assignment modal ---------- */
  window.__dmOpenEquipmentAssign = function (bookingId) {
    ensure();
    const booking = (State.data.bookings || []).find(b => b.id === bookingId);
    if (!booking) { showToast('Booking not found', 'error'); return; }

    const currentAssignments = getAssignmentsForBooking(bookingId);
    const availableEquip = (State.data.equipment || []).filter(eq =>
      eq.status === 'available' || eq.status === 'assigned'
    );

    const renderAssignmentRow = (a, idx) => {
      const eq = State.data.equipment.find(x => x.id === a.equipmentId);
      const conflicts = getConflicts(a.equipmentId, booking.date, bookingId);
      const hasConflict = conflicts.length > 0;
      return `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem;border:1px solid ${hasConflict ? '#ef4444' : 'var(--border)'};border-radius:10px;margin-bottom:.35rem">
          <i data-lucide="camera" style="width:16px;height:16px;color:${hasConflict ? '#ef4444' : 'var(--primary)'}"></i>
          <div style="flex:1">
            <div style="font-weight:600;font-size:.85rem">${eq?.name || '—'}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${eq?.category || ''} · ${eq?.code || ''} × ${a.quantity || 1}</div>
            ${hasConflict ? `<div style="font-size:.7rem;color:#ef4444;margin-top:.25rem">⚠️ ${t('equipment_conflict')}</div>` : ''}
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="__dmRemoveEquipmentAssignment('${a.id}','${bookingId}')" style="color:#ef4444">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
    };

    openModal({
      title: `🎥 ${t('equipment_assignment')} — ${booking.clientName || booking.id}`,
      size: 'lg',
      body: `
        <div style="margin-bottom:1rem;font-size:.8rem;color:var(--text-muted)">
          ${t('date')}: ${fmtDate(booking.date)} · ${t('hall')}: ${hallName(booking.hallId)}
        </div>

        <div style="margin-bottom:1rem">
          <div style="font-size:.75rem;font-weight:700;margin-bottom:.5rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
            ${t('assigned_equipment')}
          </div>
          <div id="dm-eq-list">
            ${currentAssignments.length ? currentAssignments.map(renderAssignmentRow).join('') : `<div class="empty-state" style="padding:1rem"><i data-lucide="camera-off"></i><p>${t('no_equipment_assigned')}</p></div>`}
          </div>
        </div>

        <div style="padding-top:1rem;border-top:1px solid var(--border)">
          <div style="font-size:.75rem;font-weight:700;margin-bottom:.5rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
            ${t('assign_equipment')}
          </div>
          <div style="display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap">
            <div style="flex:2;min-width:200px">
              <select id="dm-eq-pick" style="width:100%;padding:.6rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
                ${availableEquip.map(eq => `<option value="${eq.id}">${eq.name} — ${eq.category} (${eq.code})</option>`).join('')}
              </select>
            </div>
            <div style="flex:1;min-width:80px">
              <input type="number" id="dm-eq-qty" value="1" min="1" placeholder="${t('quantity_assigned')}" style="width:100%;padding:.6rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
            </div>
            <button class="btn btn-primary" onclick="__dmAddEquipmentAssignment('${bookingId}')">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">${t('close')}</button>
      `
    });
    if (window.lucide) lucide.createIcons();
  };

  window.__dmAddEquipmentAssignment = function (bookingId) {
    ensure();
    const eqId = document.getElementById('dm-eq-pick').value;
    const qty = parseInt(document.getElementById('dm-eq-qty').value) || 1;
    if (!eqId) return;

    const booking = (State.data.bookings || []).find(b => b.id === bookingId);
    if (!booking) return;

    // Check for conflicts
    const conflicts = getConflicts(eqId, booking.date, bookingId);
    if (conflicts.length > 0) {
      const proceed = confirm(t('equipment_conflict') + '\n\n' + (State.lang === 'ar' ? 'هل تريد المتابعة؟' : 'Continue anyway?'));
      if (!proceed) return;
    }

    State.data.equipmentAssignments.push({
      id: uid('eqa'),
      bookingId,
      equipmentId: eqId,
      quantity: qty,
      date: booking.date,
      assignedBy: State.user.username,
      createdAt: new Date().toISOString()
    });

    saveData();
    logActivity('create', 'equipment-assignment', eqId, null, { bookingId, qty });

    showToast(t('saved'), 'success');
    // Refresh modal
    closeModal();
    setTimeout(() => window.__dmOpenEquipmentAssign(bookingId), 100);
  };

  window.__dmRemoveEquipmentAssignment = function (assignmentId, bookingId) {
    State.data.equipmentAssignments = (State.data.equipmentAssignments || []).filter(a => a.id !== assignmentId);
    saveData();
    logActivity('delete', 'equipment-assignment', assignmentId, null, null);
    showToast(t('deleted'), 'success');
    closeModal();
    setTimeout(() => window.__dmOpenEquipmentAssign(bookingId), 100);
  };

  /* ---------- add "Equipment" button to booking rows ---------- */
  function hookBookingsPage() {
    if (!Pages.bookings) return;
    const orig = Pages.bookings;
    Pages.bookings = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        const rows = document.querySelectorAll('.data-table tbody tr');
        rows.forEach(row => {
          const actionCell = row.querySelector('td:last-child');
          if (!actionCell || actionCell.querySelector('.eq-btn')) return;
          const editBtn = row.querySelector('button[onclick*="editBooking"]');
          if (!editBtn) return;
          const match = editBtn.getAttribute('onclick').match(/editBooking\('([^']+)'\)/);
          if (!match) return;
          const bookingId = match[1];

          const eqBtn = document.createElement('button');
          eqBtn.className = 'btn btn-ghost btn-icon btn-sm eq-btn';
          eqBtn.title = (I18N[State.lang] || I18N.ar).equipment_assignment;
          eqBtn.style.color = '#06b6d4';
          eqBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
          eqBtn.onclick = (e) => {
            e.stopPropagation();
            window.__dmOpenEquipmentAssign(bookingId);
          };
          const actionsDiv = actionCell.querySelector('div');
          if (actionsDiv) actionsDiv.insertBefore(eqBtn, actionsDiv.firstChild);
          else actionCell.appendChild(eqBtn);
        });
      }, 120);
    };
  }

  /* ---------- show assigned equipment count in booking list ---------- */
  function hookEditBooking() {
    if (typeof window.editBooking !== 'function') return;
    // Just leave it — the equipment button in the row is enough
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof openModal === 'function',
    function () {
      ensure();
      hookBookingsPage();
      console.log('%c[Section 7] ✓ Equipment Assignment ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 8: P&L Dashboard (تحليل مالي كامل)
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 8] P&L Dashboard loading…', 'color:#10b981;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 8] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    pl_dashboard: 'التحليل المالي',
    revenue: 'الإيرادات',
    costs: 'التكاليف',
    net_profit: 'صافي الربح',
    margin: 'هامش الربح',
    per_hall: 'لكل قاعة',
    per_event: 'لكل نوع مناسبة',
    per_month: 'شهريًا',
    top_clients: 'أعلى العملاء ربحية',
    forecast: 'توقع الشهر القادم',
    confirmed_bookings: 'حجوزات مؤكدة',
    projected_revenue: 'الإيرادات المتوقعة',
    payroll_cost: 'تكاليف الموظفين',
    equipment_cost: 'تكاليف المعدات',
    expenses_cost: 'مصروفات تشغيلية',
    filter_period: 'الفترة',
    period_month: 'هذا الشهر',
    period_quarter: 'هذا الربع',
    period_year: 'هذه السنة',
    period_all: 'كل الفترات'
  });
  Object.assign(I18N.en, {
    pl_dashboard: 'P&L Dashboard',
    revenue: 'Revenue',
    costs: 'Costs',
    net_profit: 'Net Profit',
    margin: 'Margin',
    per_hall: 'Per Hall',
    per_event: 'Per Event Type',
    per_month: 'Per Month',
    top_clients: 'Top Clients by Profit',
    forecast: 'Next Month Forecast',
    confirmed_bookings: 'Confirmed Bookings',
    projected_revenue: 'Projected Revenue',
    payroll_cost: 'Payroll Cost',
    equipment_cost: 'Equipment Cost',
    expenses_cost: 'Operating Expenses',
    filter_period: 'Period',
    period_month: 'This Month',
    period_quarter: 'This Quarter',
    period_year: 'This Year',
    period_all: 'All Time'
  });

  function ensure() {
    if (!State.data.expenses) State.data.expenses = [];
  }

  /* ---------- period helpers ---------- */
  function getPeriodRange(period) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (period === 'month') {
      return {
        from: new Date(y, m, 1).toISOString().slice(0, 10),
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10)
      };
    }
    if (period === 'quarter') {
      const q = Math.floor(m / 3);
      return {
        from: new Date(y, q * 3, 1).toISOString().slice(0, 10),
        to: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10)
      };
    }
    if (period === 'year') {
      return {
        from: new Date(y, 0, 1).toISOString().slice(0, 10),
        to: new Date(y, 11, 31).toISOString().slice(0, 10)
      };
    }
    // all
    return { from: '1970-01-01', to: '2099-12-31' };
  }

  /* ---------- calculate P&L ---------- */
  function calculatePL(from, to) {
    const d = State.data;

    // Revenue: sum of booking costs in period
    const periodBookings = (d.bookings || []).filter(b =>
      b.date >= from && b.date <= to && b.status !== 'cancelled'
    );
    const revenue = periodBookings.reduce((s, b) => s + (b.cost || 0), 0);

    // Costs: payroll for confirmed distributions in period
    const periodDists = (d.distributions || []).filter(x =>
      x.date >= from && x.date <= to && x.status === 'confirmed'
    );
    const payrollCost = periodDists.reduce((s, dist) => {
      const emp = d.employees.find(e => e.id === dist.employeeId);
      return s + (emp ? (emp.dayRate || 0) : 0);
    }, 0);

    // Advances, deductions, bonuses in period
    const totalAdvances = (d.advances || []).filter(a => a.date >= from && a.date <= to)
      .reduce((s, a) => s + (a.amount || 0), 0);
    const totalDeductions = (d.deductions || []).filter(x => x.date >= from && x.date <= to)
      .reduce((s, x) => s + (x.amount || 0), 0);
    const totalBonuses = (d.bonuses || []).filter(x => x.date >= from && x.date <= to)
      .reduce((s, x) => s + (x.amount || 0), 0);

    // Equipment cost (approximation from assignments)
    const periodEqAssigns = (d.equipmentAssignments || []).filter(a => a.date >= from && a.date <= to);
    const equipmentCost = periodEqAssigns.reduce((s, a) => {
      const eq = d.equipment.find(x => x.id === a.equipmentId);
      return s + (eq ? (eq.price || 0) * 0.02 * (a.quantity || 1) : 0); // 2% depreciation per assignment
    }, 0);

    // Operating expenses
    const operatingExpenses = (d.expenses || []).filter(e => e.date >= from && e.date <= to)
      .reduce((s, e) => s + (e.amount || 0), 0);

    const totalCosts = payrollCost + totalBonuses + equipmentCost + operatingExpenses;
    const netProfit = revenue - totalCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      payrollCost,
      equipmentCost,
      operatingExpenses,
      totalBonuses,
      totalAdvances,
      totalDeductions,
      totalCosts,
      netProfit,
      margin,
      periodBookings,
      periodDists
    };
  }

  /* ---------- breakdowns ---------- */
  function breakdownByHall(from, to) {
    const map = {};
    (State.data.halls || []).forEach(h => {
      const bookings = (State.data.bookings || []).filter(b =>
        b.hallId === h.id && b.date >= from && b.date <= to && b.status !== 'cancelled'
      );
      const revenue = bookings.reduce((s, b) => s + (b.cost || 0), 0);
      const dists = (State.data.distributions || []).filter(x =>
        x.hallId === h.id && x.date >= from && x.date <= to && x.status === 'confirmed'
      );
      const cost = dists.reduce((s, dist) => {
        const emp = State.data.employees.find(e => e.id === dist.employeeId);
        return s + (emp ? (emp.dayRate || 0) : 0);
      }, 0);
      map[h.id] = {
        name: h.name[State.lang] || h.name.ar,
        revenue, cost, profit: revenue - cost,
        bookings: bookings.length
      };
    });
    return map;
  }

  function breakdownByEvent(from, to) {
    const map = {};
    (State.data.bookings || [])
      .filter(b => b.date >= from && b.date <= to && b.status !== 'cancelled')
      .forEach(b => {
        const t = b.eventType || 'Other';
        map[t] = map[t] || { revenue: 0, count: 0 };
        map[t].revenue += b.cost || 0;
        map[t].count++;
      });
    return map;
  }

  function breakdownByMonth(from, to) {
    const map = {};
    (State.data.bookings || [])
      .filter(b => b.date >= from && b.date <= to && b.status !== 'cancelled')
      .forEach(b => {
        const m = b.date.slice(0, 7);
        map[m] = map[m] || { revenue: 0, cost: 0 };
        map[m].revenue += b.cost || 0;
      });
    (State.data.distributions || [])
      .filter(x => x.date >= from && x.date <= to && x.status === 'confirmed')
      .forEach(dist => {
        const m = dist.date.slice(0, 7);
        map[m] = map[m] || { revenue: 0, cost: 0 };
        const emp = State.data.employees.find(e => e.id === dist.employeeId);
        map[m].cost += emp ? (emp.dayRate || 0) : 0;
      });
    return map;
  }

  function topClients(from, to, limit) {
    const map = {};
    (State.data.bookings || [])
      .filter(b => b.date >= from && b.date <= to && b.status !== 'cancelled')
      .forEach(b => {
        const k = b.clientName || 'Unknown';
        map[k] = map[k] || { revenue: 0, count: 0 };
        map[k].revenue += b.cost || 0;
        map[k].count++;
      });
    return Object.entries(map)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, limit || 5);
  }

  /* ---------- forecast next month ---------- */
  function forecastNextMonth() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const from = nextMonth.toISOString().slice(0, 10);
    const to = nextMonthEnd.toISOString().slice(0, 10);

    const confirmedBookings = (State.data.bookings || []).filter(b =>
      b.date >= from && b.date <= to && (b.status === 'confirmed' || b.status === 'pending')
    );

    const projectedRevenue = confirmedBookings.reduce((s, b) => s + (b.cost || 0), 0);

    // Estimate cost from average per booking
    const avgCostPerBooking = 1200; // rough estimate
    const estimatedCost = confirmedBookings.length * avgCostPerBooking;

    return {
      confirmedBookings: confirmedBookings.length,
      projectedRevenue,
      estimatedCost,
      projectedProfit: projectedRevenue - estimatedCost
    };
  }

  /* ---------- register page ---------- */
  Pages.pl = function (el) {
    ensure();
    const period = State.filters.plPeriod || 'month';
    const range = getPeriodRange(period);
    const pl = calculatePL(range.from, range.to);
    const hallBreakdown = breakdownByHall(range.from, range.to);
    const eventBreakdown = breakdownByEvent(range.from, range.to);
    const monthBreakdown = breakdownByMonth(range.from, range.to);
    const top = topClients(range.from, range.to, 5);
    const forecast = forecastNextMonth();

    const fmtMoney = (n) => 'EGP ' + Math.round(n || 0).toLocaleString();
    const pct = (n) => (n || 0).toFixed(1) + '%';

    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;align-items:center">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab ${period === 'month' ? 'active' : ''}" onclick="State.filters.plPeriod='month';navigate('pl')">${t('period_month')}</div>
          <div class="tab ${period === 'quarter' ? 'active' : ''}" onclick="State.filters.plPeriod='quarter';navigate('pl')">${t('period_quarter')}</div>
          <div class="tab ${period === 'year' ? 'active' : ''}" onclick="State.filters.plPeriod='year';navigate('pl')">${t('period_year')}</div>
          <div class="tab ${period === 'all' ? 'active' : ''}" onclick="State.filters.plPeriod='all';navigate('pl')">${t('period_all')}</div>
        </div>
        <div style="margin-inline-start:auto;font-size:.78rem;color:var(--text-muted)">
          ${fmtDate(range.from)} → ${fmtDate(range.to)}
        </div>
      </div>

      <!-- Top KPIs -->
      <div class="grid-stats" style="margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,.1);color:#10b981"><i data-lucide="trending-up"></i></div>
          <div class="stat-body">
            <div class="label">${t('revenue')}</div>
            <div class="value">${fmtMoney(pl.revenue)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(239,68,68,.1);color:#ef4444"><i data-lucide="trending-down"></i></div>
          <div class="stat-body">
            <div class="label">${t('costs')}</div>
            <div class="value">${fmtMoney(pl.totalCosts)}</div>
          </div>
        </div>
        <div class="stat-card" style="border:2px solid ${pl.netProfit >= 0 ? '#10b981' : '#ef4444'}">
          <div class="stat-icon" style="background:${pl.netProfit >= 0 ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};color:${pl.netProfit >= 0 ? '#10b981' : '#ef4444'}"><i data-lucide="badge-dollar-sign"></i></div>
          <div class="stat-body">
            <div class="label">${t('net_profit')}</div>
            <div class="value" style="color:${pl.netProfit >= 0 ? '#10b981' : '#ef4444'}">${fmtMoney(pl.netProfit)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(124,58,237,.1);color:#7c3aed"><i data-lucide="percent"></i></div>
          <div class="stat-body">
            <div class="label">${t('margin')}</div>
            <div class="value">${pct(pl.margin)}</div>
          </div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid-2" style="margin-bottom:1.5rem">
        <div class="chart-box">
          <h4><i data-lucide="bar-chart-3"></i> ${t('per_hall')}</h4>
          <div class="chart-canvas-wrap"><canvas id="ch-pl-hall"></canvas></div>
        </div>
        <div class="chart-box">
          <h4><i data-lucide="pie-chart"></i> ${t('per_event')}</h4>
          <div class="chart-canvas-wrap"><canvas id="ch-pl-event"></canvas></div>
        </div>
      </div>

      <!-- Cost breakdown -->
      <div class="grid-2" style="margin-bottom:1.5rem">
        <div class="card">
          <h4 class="section-title" style="margin-top:0"><i data-lucide="receipt"></i> ${t('costs')}</h4>
          ${[
            { label: t('payroll_cost'), value: pl.payrollCost, color: '#7c3aed' },
            { label: t('equipment_cost'), value: pl.equipmentCost, color: '#06b6d4' },
            { label: t('expenses_cost'), value: pl.operatingExpenses, color: '#f59e0b' },
            { label: t('bonuses'), value: pl.totalBonuses, color: '#10b981' }
          ].map(row => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid var(--border)">
              <span style="font-size:.85rem"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${row.color};margin-inline-end:.5rem"></span>${row.label}</span>
              <span style="font-weight:700;font-size:.85rem">${fmtMoney(row.value)}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;font-weight:800;border-top:2px solid var(--border);margin-top:.5rem">
            <span>${t('total')}</span>
            <span style="color:#ef4444">${fmtMoney(pl.totalCosts)}</span>
          </div>
        </div>
        <div class="card">
          <h4 class="section-title" style="margin-top:0"><i data-lucide="trophy"></i> ${t('top_clients')}</h4>
          ${top.length ? top.map(([name, info], i) => `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--border)">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem">${i + 1}</div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:.85rem">${name}</div>
                <div style="font-size:.7rem;color:var(--text-muted)">${info.count} ${t('bookings')}</div>
              </div>
              <div style="font-weight:700;color:#10b981;font-size:.85rem">${fmtMoney(info.revenue)}</div>
            </div>
          `).join('') : `<div class="empty-state" style="padding:1.5rem"><i data-lucide="inbox"></i><p>${t('no_data')}</p></div>`}
        </div>
      </div>

      <!-- Forecast -->
      <div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,rgba(124,58,237,.05),rgba(245,158,11,.05));border:1px solid var(--primary)">
        <h4 class="section-title" style="margin-top:0"><i data-lucide="crystal-ball" style="color:var(--primary)"></i> ${t('forecast')}</h4>
        <div class="grid-3" style="margin-top:1rem">
          <div>
            <div style="font-size:.7rem;color:var(--text-muted)">${t('confirmed_bookings')}</div>
            <div style="font-size:1.5rem;font-weight:800">${forecast.confirmedBookings}</div>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--text-muted)">${t('projected_revenue')}</div>
            <div style="font-size:1.5rem;font-weight:800;color:#10b981">${fmtMoney(forecast.projectedRevenue)}</div>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--text-muted)">${t('net_profit')}</div>
            <div style="font-size:1.5rem;font-weight:800;color:${forecast.projectedProfit >= 0 ? '#10b981' : '#ef4444'}">${fmtMoney(forecast.projectedProfit)}</div>
          </div>
        </div>
      </div>

      <!-- Monthly trend -->
      <div class="chart-box">
        <h4><i data-lucide="activity"></i> ${t('per_month')}</h4>
        <div class="chart-canvas-wrap"><canvas id="ch-pl-month"></canvas></div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    /* charts */
    setTimeout(() => {
      const hallLabels = Object.values(hallBreakdown).map(h => h.name);
      const hallRevenue = Object.values(hallBreakdown).map(h => h.revenue);
      const hallProfit = Object.values(hallBreakdown).map(h => h.profit);

      const hallCanvas = document.getElementById('ch-pl-hall');
      if (hallCanvas && window.Chart) {
        if (window.__ch_pl_hall) { try { window.__ch_pl_hall.destroy(); } catch (e) {} }
        window.__ch_pl_hall = new Chart(hallCanvas, {
          type: 'bar',
          data: {
            labels: hallLabels,
            datasets: [
              { label: t('revenue'), data: hallRevenue, backgroundColor: '#7c3aed', borderRadius: 6 },
              { label: t('net_profit'), data: hallProfit, backgroundColor: '#10b981', borderRadius: 6 }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
          }
        });
      }

      const eventLabels = Object.keys(eventBreakdown);
      const eventRevenue = Object.values(eventBreakdown).map(e => e.revenue);

      const evCanvas = document.getElementById('ch-pl-event');
      if (evCanvas && window.Chart) {
        if (window.__ch_pl_event) { try { window.__ch_pl_event.destroy(); } catch (e) {} }
        window.__ch_pl_event = new Chart(evCanvas, {
          type: 'doughnut',
          data: {
            labels: eventLabels,
            datasets: [{ data: eventRevenue, backgroundColor: ['#7c3aed', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4'], borderWidth: 0 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } }
          }
        });
      }

      const monthKeys = Object.keys(monthBreakdown).sort();
      const monthRevenue = monthKeys.map(k => monthBreakdown[k].revenue);
      const monthCost = monthKeys.map(k => monthBreakdown[k].cost);

      const moCanvas = document.getElementById('ch-pl-month');
      if (moCanvas && window.Chart) {
        if (window.__ch_pl_month) { try { window.__ch_pl_month.destroy(); } catch (e) {} }
        window.__ch_pl_month = new Chart(moCanvas, {
          type: 'line',
          data: {
            labels: monthKeys,
            datasets: [
              { label: t('revenue'), data: monthRevenue, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', fill: true, tension: 0.4, borderWidth: 2 },
              { label: t('costs'), data: monthCost, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', fill: true, tension: 0.4, borderWidth: 2 }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
          }
        });
      }
    }, 80);
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const finance = NAV_ITEMS.find(g => g.section === 'finance');
    if (finance && !finance.items.find(i => i.id === 'pl')) {
      finance.items.push({ id: 'pl', icon: 'trending-up', label: 'pl_dashboard' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof navigate === 'function',
    function () {
      ensure();
      registerNav();
      console.log('%c[Section 8] ✓ P&L Dashboard ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 9: Timeline / Gantt View (عرض زمني للحجوزات)
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 9] Timeline View loading…', 'color:#06b6d4;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 9] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    timeline: 'العرض الزمني',
    timeline_date: 'التاريخ',
    timeline_hours: 'الساعات',
    timeline_no_bookings: 'لا توجد حجوزات في هذا اليوم'
  });
  Object.assign(I18N.en, {
    timeline: 'Timeline',
    timeline_date: 'Date',
    timeline_hours: 'Hours',
    timeline_no_bookings: 'No bookings for this day'
  });

  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById('dm-timeline-styles')) return;
    const s = document.createElement('style');
    s.id = 'dm-timeline-styles';
    s.textContent = `
      .dm-tl-wrap {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 1.25rem;
        overflow-x: auto;
      }
      .dm-tl-header {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 0;
        border-bottom: 2px solid var(--border);
        padding-bottom: .5rem;
        margin-bottom: .5rem;
        min-width: 900px;
      }
      .dm-tl-hours {
        display: grid;
        grid-template-columns: repeat(24, 1fr);
        gap: 2px;
      }
      .dm-tl-hour {
        text-align: center;
        font-size: .65rem;
        color: var(--text-muted);
        font-weight: 600;
        padding: .25rem 0;
        border-inline-start: 1px dashed var(--border);
      }
      .dm-tl-row {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 0;
        align-items: center;
        padding: .5rem 0;
        border-bottom: 1px solid var(--border);
        min-width: 900px;
      }
      .dm-tl-row:hover {
        background: var(--surface-2);
      }
      .dm-tl-label {
        font-size: .8rem;
        font-weight: 600;
        padding-inline-end: .75rem;
        display: flex;
        align-items: center;
        gap: .4rem;
      }
      .dm-tl-label .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dm-tl-track {
        position: relative;
        height: 32px;
        background: repeating-linear-gradient(
          to right,
          transparent 0,
          transparent calc(100% / 24 - 1px),
          var(--border) calc(100% / 24 - 1px),
          var(--border) calc(100% / 24)
        );
        border-radius: 6px;
      }
      .dm-tl-bar {
        position: absolute;
        top: 4px;
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        transition: all .2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: .7rem;
        font-weight: 600;
        overflow: hidden;
        white-space: nowrap;
        padding: 0 .35rem;
        box-shadow: 0 2px 4px rgba(0,0,0,.15);
      }
      .dm-tl-bar:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,.25);
        z-index: 10;
      }
      .dm-tl-now {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #ef4444;
        z-index: 5;
      }
      .dm-tl-now::before {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ef4444;
      }
    `;
    document.head.appendChild(s);
  }

  function timeToHours(t) {
    if (!t) return 0;
    const parts = String(t).split(':');
    return parseInt(parts[0]) + (parseInt(parts[1]) || 0) / 60;
  }

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  function getStatusColor(status) {
    return {
      confirmed: '#10b981',
      pending: '#f59e0b',
      completed: '#3b82f6',
      cancelled: '#ef4444'
    }[status] || '#7c3aed';
  }

  /* ---------- register page ---------- */
  Pages.timeline = function (el) {
    injectStyles();

    const date = State.filters.tlDate || todayISO();
    State.filters.tlDate = date;

    const dayBookings = (State.data.bookings || []).filter(b => b.date === date && b.status !== 'cancelled');

    const hoursHeader = Array.from({ length: 24 }, (_, i) => {
      const h = i.toString().padStart(2, '0');
      return `<div class="dm-tl-hour">${h}</div>`;
    }).join('');

    const now = new Date();
    const isToday = date === todayISO();
    const nowPercent = isToday ? ((now.getHours() + now.getMinutes() / 60) / 24) * 100 : null;

    el.innerHTML = `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:center">
          <input type="date" id="tl-date" value="${date}" style="padding:.55rem .8rem;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit">
          <div style="display:flex;gap:.35rem">
            <button class="btn btn-ghost btn-sm" onclick="__dmTLPrev()"><i data-lucide="${State.lang === 'ar' ? 'chevron-right' : 'chevron-left'}"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="__dmTLToday()">${State.lang === 'ar' ? 'اليوم' : 'Today'}</button>
            <button class="btn btn-ghost btn-sm" onclick="__dmTLNext()"><i data-lucide="${State.lang === 'ar' ? 'chevron-left' : 'chevron-right'}"></i></button>
          </div>
          <div style="margin-inline-start:auto;font-size:.8rem;color:var(--text-muted)">
            <b style="color:var(--text)">${dayBookings.length}</b> ${t('bookings')}
          </div>
        </div>
      </div>

      ${dayBookings.length === 0 ? `
        <div class="dm-tl-wrap">
          <div class="empty-state" style="padding:4rem 1rem">
            <i data-lucide="calendar-x"></i>
            <p>${t('timeline_no_bookings')}</p>
          </div>
        </div>
      ` : `
        <div class="dm-tl-wrap">
          <div class="dm-tl-header">
            <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;padding-inline-end:.75rem">
              ${t('hall')}
            </div>
            <div class="dm-tl-hours">${hoursHeader}</div>
          </div>
          ${dayBookings.map(b => {
            const startH = timeToHours(b.startTime);
            const endH = timeToHours(b.endTime);
            const leftPct = (startH / 24) * 100;
            const widthPct = ((endH - startH) / 24) * 100;
            const color = getStatusColor(b.status);
            return `
              <div class="dm-tl-row">
                <div class="dm-tl-label">
                  <span class="dot" style="background:${color}"></span>
                  <span>${hallName(b.hallId)}</span>
                </div>
                <div class="dm-tl-track">
                  ${isToday && nowPercent !== null ? `<div class="dm-tl-now" style="left:${nowPercent}%"></div>` : ''}
                  <div class="dm-tl-bar"
                       style="left:${leftPct}%; width:${widthPct}%; background:${color}"
                       onclick="editBooking('${b.id}')"
                       title="${b.clientName || ''} · ${b.startTime} - ${b.endTime} · ${b.eventType || ''}">
                    ${b.clientName || ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('tl-date').onchange = (e) => {
      State.filters.tlDate = e.target.value;
      navigate('timeline');
    };
  };

  window.__dmTLPrev = function () {
    const d = State.filters.tlDate || todayISO();
    const nd = new Date(d);
    nd.setDate(nd.getDate() - 1);
    State.filters.tlDate = nd.toISOString().slice(0, 10);
    navigate('timeline');
  };
  window.__dmTLNext = function () {
    const d = State.filters.tlDate || todayISO();
    const nd = new Date(d);
    nd.setDate(nd.getDate() + 1);
    State.filters.tlDate = nd.toISOString().slice(0, 10);
    navigate('timeline');
  };
  window.__dmTLToday = function () {
    State.filters.tlDate = todayISO();
    navigate('timeline');
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'timeline')) {
      // Insert after calendar
      const calIdx = ops.items.findIndex(i => i.id === 'calendar');
      if (calIdx >= 0) ops.items.splice(calIdx + 1, 0, { id: 'timeline', icon: 'gantt-chart', label: 'timeline' });
      else ops.items.push({ id: 'timeline', icon: 'gantt-chart', label: 'timeline' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof navigate === 'function',
    function () {
      registerNav();
      console.log('%c[Section 9] ✓ Timeline View ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 10: AI Distribution Engine 2.0
   Version: 1.0.0
   - Intelligent scoring: consecutive days, hall fatigue, fairness
   - Suggests best employees for each slot
   - Detects shortages BEFORE distribution
   - Manual override with smart warnings
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 10] AI Distribution Engine loading…', 'color:#8b5cf6;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 10] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    ai_engine: 'محرك التوزيع الذكي',
    ai_smart: 'التوزيع الذكي',
    ai_analyze: 'تحليل اليوم',
    ai_suggestions: 'اقتراحات ذكية',
    ai_shortage_alert: 'تنبيه نقص',
    ai_consecutive_warn: 'عمل X أيام متتالية',
    ai_hall_fatigue: 'كرر نفس القاعة X مرات',
    ai_low_workload: 'أقل عملًا — الأولوية له',
    ai_recommend: 'موصى به',
    ai_score: 'نقاط',
    ai_would_assign: 'سيتم تعيينه',
    ai_reason: 'السبب',
    ai_smart_warning: 'تحذير ذكي'
  });
  Object.assign(I18N.en, {
    ai_engine: 'AI Distribution Engine',
    ai_smart: 'Smart Distribution',
    ai_analyze: 'Analyze Day',
    ai_suggestions: 'Smart Suggestions',
    ai_shortage_alert: 'Shortage Alert',
    ai_consecutive_warn: 'Worked X consecutive days',
    ai_hall_fatigue: 'Repeated same hall X times',
    ai_low_workload: 'Lowest workload — priority',
    ai_recommend: 'Recommended',
    ai_score: 'Score',
    ai_would_assign: 'Would assign',
    ai_reason: 'Reason',
    ai_smart_warning: 'Smart Warning'
  });

  /* ---------- helpers ---------- */
  function addDays(iso, n) {
    const d = new Date(iso);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- scoring engine ---------- */
  function scoreEmployee(emp, role, date, hallId) {
    const dists = State.data.distributions || [];
    const empDists = dists.filter(x => x.employeeId === emp.id);

    // 1. Total assignments (fairness)
    const totalAssignments = empDists.length;

    // 2. Consecutive days worked (up to 7 days back)
    let consecutiveDays = 0;
    for (let i = 1; i <= 7; i++) {
      const d = addDays(date, -i);
      if (empDists.some(x => x.date === d && x.status === 'confirmed')) consecutiveDays++;
      else break;
    }

    // 3. Same hall repetition in last 5 assignments
    const last5 = [...empDists].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const sameHallCount = last5.filter(x => x.hallId === hallId).length;

    // 4. Days since last work (higher = better)
    const lastWork = [...empDists].sort((a, b) => b.date.localeCompare(a.date))[0];
    const daysSinceLastWork = lastWork
      ? Math.round((new Date(date) - new Date(lastWork.date)) / 86400000)
      : 999;

    // 5. Role specialization bonus
    const isPrimaryRole = emp.role === role;
    const hasRoleInList = (emp.roles || []).includes(role);

    // ----- SCORING -----
    // Lower score = better fit
    let score = 0;
    score += totalAssignments * 10;      // Fairness (lower is better)
    score += consecutiveDays * 20;       // Rest penalty
    score += sameHallCount * 15;         // Variety bonus
    score -= Math.min(daysSinceLastWork, 30) * 2; // Rest bonus
    if (!isPrimaryRole && !hasRoleInList) score += 1000; // Must have role
    if (isPrimaryRole) score -= 5;       // Prefer primary

    // ----- REASONS -----
    const reasons = [];
    if (totalAssignments <= 2) reasons.push({ ar: t('ai_low_workload'), type: 'good' });
    if (consecutiveDays >= 4) reasons.push({ ar: t('ai_consecutive_warn').replace('X', consecutiveDays), type: 'warn' });
    if (sameHallCount >= 3) reasons.push({ ar: t('ai_hall_fatigue').replace('X', sameHallCount), type: 'warn' });
    if (daysSinceLastWork >= 5) reasons.push({ ar: (State.lang === 'ar' ? `مر ${daysSinceLastWork} يوم من آخر عمل` : `${daysSinceLastWork} days since last work`), type: 'good' });

    return {
      emp,
      score,
      totalAssignments,
      consecutiveDays,
      sameHallCount,
      daysSinceLastWork,
      reasons,
      recommended: false // Set later
    };
  }

  /* ---------- analyze a specific day ---------- */
  function analyzeDay(date) {
    const bookings = (State.data.bookings || []).filter(b =>
      b.date === date && (b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed')
    );
    const bookedHalls = [...new Set(bookings.map(b => b.hallId))];
    const halls = bookedHalls.length
      ? State.data.halls.filter(h => bookedHalls.includes(h.id))
      : State.data.halls.filter(h => h.status === 'active');

    // On leave / absent
    const onLeave = new Set(
      (State.data.leaves || [])
        .filter(l => l.status === 'approved' && date >= l.fromDate && date <= l.toDate)
        .map(l => l.employeeId)
    );
    const absent = new Set(
      (State.data.attendance || [])
        .filter(a => a.date === date && a.status === 'absent')
        .map(a => a.employeeId)
    );

    const result = {
      date,
      halls: [],
      shortages: [],
      totalNeeded: 0,
      totalAvailable: 0
    };

    // Track who's already used today across halls (avoid double booking)
    const usedToday = new Set();

    halls.forEach(hall => {
      const hallResult = { hall, roles: [] };

      hall.requirements.forEach(req => {
        result.totalNeeded += req.count;

        // Eligible pool
        const eligible = (State.data.employees || [])
          .filter(e => e.status === 'active')
          .filter(e => e.role === req.role || (e.roles || []).includes(req.role))
          .filter(e => !onLeave.has(e.id) && !absent.has(e.id))
          .filter(e => !usedToday.has(e.id));

        result.totalAvailable += eligible.length;

        // Score each
        const scored = eligible
          .map(e => scoreEmployee(e, req.role, date, hall.id))
          .sort((a, b) => a.score - b.score);

        // Mark top N as recommended
        scored.forEach((s, i) => {
          s.recommended = i < req.count;
          if (s.recommended) usedToday.add(s.emp.id);
        });

        hallResult.roles.push({
          role: req.role,
          needed: req.count,
          candidates: scored,
          shortage: Math.max(0, req.count - scored.length)
        });

        if (scored.length < req.count) {
          result.shortages.push({
            hall: hall,
            role: req.role,
            needed: req.count,
            available: scored.length
          });
        }
      });

      result.halls.push(hallResult);
    });

    return result;
  }
  window.__dmAIAnalyze = analyzeDay;

  /* ---------- register page ---------- */
  Pages.ai = function (el) {
    const date = State.filters.aiDate || todayISO();
    State.filters.aiDate = date;
    const analysis = analyzeDay(date);

    const fmtScore = (s) => Math.round(s);
    const reasonBadge = (r) => {
      const color = r.type === 'warn' ? '#f59e0b' : '#10b981';
      const icon = r.type === 'warn' ? 'alert-triangle' : 'star';
      return `<span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.65rem;background:${color}20;color:${color};padding:.15rem .4rem;border-radius:6px;margin-inline-end:.25rem;margin-bottom:.25rem">
        <i data-lucide="${icon}" style="width:10px;height:10px"></i>${r.ar}
      </span>`;
    };

    el.innerHTML = `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center">
          <input type="date" id="ai-date" value="${date}" style="padding:.55rem .8rem;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit">
          <button class="btn btn-primary btn-sm" onclick="__dmAIAnalyzeRun()"><i data-lucide="sparkles"></i> ${t('ai_analyze')}</button>
          <div style="margin-inline-start:auto;display:flex;gap:1rem;font-size:.8rem">
            <span><b style="color:var(--text)">${analysis.totalNeeded}</b> ${State.lang === 'ar' ? 'مطلوب' : 'needed'}</span>
            <span><b style="color:${analysis.totalAvailable >= analysis.totalNeeded ? '#10b981' : '#ef4444'}">${analysis.totalAvailable}</b> ${State.lang === 'ar' ? 'متاح' : 'available'}</span>
          </div>
        </div>
      </div>

      ${analysis.shortages.length ? `
        <div class="card" style="margin-bottom:1rem;border:2px solid #ef4444;background:rgba(239,68,68,.05)">
          <h4 style="margin:0 0 .75rem;font-size:.9rem;color:#ef4444;display:flex;align-items:center;gap:.5rem">
            <i data-lucide="alert-triangle"></i> ${t('ai_shortage_alert')} — ${analysis.shortages.length}
          </h4>
          ${analysis.shortages.map(s => `
            <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.85rem">
              <span>${s.hall.name[State.lang] || s.hall.name.ar} — <b>${s.role}</b></span>
              <span><b style="color:#ef4444">${s.available}/${s.needed}</b></span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="card" style="margin-bottom:1rem;border:2px solid #10b981;background:rgba(16,185,129,.05)">
          <div style="display:flex;align-items:center;gap:.5rem;color:#10b981;font-size:.9rem;font-weight:600">
            <i data-lucide="check-circle-2"></i>
            ${State.lang === 'ar' ? 'كل الأدوار متوفرة بهذا اليوم ✓' : 'All roles available for this day ✓'}
          </div>
        </div>
      `}

      ${analysis.halls.map(hallData => `
        <div class="hall-card">
          <div class="hall-header">
            <h4><i data-lucide="building-2" style="width:16px;height:16px;color:var(--primary)"></i> ${hallData.hall.name[State.lang] || hallData.hall.name.ar}</h4>
          </div>
          ${hallData.roles.map(roleData => {
            const topCandidates = roleData.candidates.slice(0, 5);
            const insufficient = roleData.candidates.length < roleData.needed;
            return `
              <div style="margin-bottom:1rem">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border);margin-bottom:.5rem">
                  <div style="font-size:.85rem;font-weight:700;display:flex;align-items:center;gap:.5rem">
                    <i data-lucide="user-check" style="width:14px;height:14px;color:var(--primary)"></i>
                    ${roleData.role}
                  </div>
                  <div style="font-size:.75rem">
                    <span class="badge-pill badge-${insufficient ? 'red' : 'green'}">${roleData.candidates.length}/${roleData.needed}</span>
                  </div>
                </div>
                ${topCandidates.length ? topCandidates.map((c, i) => `
                  <div style="display:flex;align-items:flex-start;gap:.65rem;padding:.55rem .5rem;border-radius:8px;margin-bottom:.25rem;background:${c.recommended ? 'rgba(16,185,129,.08)' : 'transparent'};border:1px solid ${c.recommended ? 'rgba(16,185,129,.3)' : 'transparent'}">
                    <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,${c.recommended ? '#10b981,#06b6d4' : '#94a3b8,#64748b'});color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.7rem;flex-shrink:0;margin-top:.15rem">
                      ${i + 1}
                    </div>
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:600;font-size:.85rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                        ${c.emp.name}
                        ${c.recommended ? `<span style="font-size:.6rem;background:#10b981;color:#fff;padding:.1rem .4rem;border-radius:6px">${t('ai_recommend')}</span>` : ''}
                      </div>
                      <div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem">
                        ${c.totalAssignments} ${State.lang === 'ar' ? 'توزيع' : 'assignments'} ·
                        ${State.lang === 'ar' ? 'منذ' : 'since'} ${c.daysSinceLastWork === 999 ? '—' : c.daysSinceLastWork} ${State.lang === 'ar' ? 'يوم' : 'd'}
                      </div>
                      <div style="margin-top:.35rem">${c.reasons.map(reasonBadge).join('')}</div>
                    </div>
                    <div style="text-align:end;flex-shrink:0">
                      <div style="font-size:.65rem;color:var(--text-muted)">${t('ai_score')}</div>
                      <div style="font-weight:800;font-size:.9rem;color:${c.score < 50 ? '#10b981' : c.score < 100 ? '#f59e0b' : '#ef4444'}">${fmtScore(c.score)}</div>
                    </div>
                  </div>
                `).join('') : `<div style="padding:1rem;text-align:center;color:#ef4444;font-size:.8rem">
                  <i data-lucide="user-x"></i> ${t('sub_no_eligible')}
                </div>`}
              </div>
            `;
          }).join('')}
        </div>
      `).join('')}
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('ai-date').onchange = (e) => {
      State.filters.aiDate = e.target.value;
      navigate('ai');
    };
  };

  window.__dmAIAnalyzeRun = function () {
    showToast(State.lang === 'ar' ? 'تم التحليل ✓' : 'Analysis complete ✓', 'success');
    navigate('ai');
  };

  /* ---------- Auto-distribute with AI ---------- */
  function hookAutoDistribute() {
    if (typeof window.autoDistribute !== 'function') return;
    // Just ensure the existing one skips leave employees (already done in Section 5)
  }

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'ai')) {
      const distIdx = ops.items.findIndex(i => i.id === 'distribution');
      if (distIdx >= 0) ops.items.splice(distIdx + 1, 0, { id: 'ai', icon: 'sparkles', label: 'ai_smart' });
      else ops.items.push({ id: 'ai', icon: 'sparkles', label: 'ai_smart' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof navigate === 'function',
    function () {
      hookAutoDistribute();
      registerNav();
      console.log('%c[Section 10] ✓ AI Distribution Engine ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 11: Client Portal (بوابة العملاء)
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 11] Client Portal loading…', 'color:#ec4899;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 11] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    client_portal: 'بوابة العملاء',
    portal_my_bookings: 'حجوزاتي',
    portal_upcoming: 'الحجوزات القادمة',
    portal_past: 'الحجوزات السابقة',
    portal_team: 'الفريق المعين',
    portal_share_link: 'مشاركة رابط',
    portal_copy_link: 'نسخ الرابط',
    portal_link_copied: 'تم نسخ الرابط',
    portal_public_view: 'عرض عام',
    portal_generate: 'إنشاء رابط مشاركة',
    portal_no_link: 'لا يوجد رابط'
  });
  Object.assign(I18N.en, {
    client_portal: 'Client Portal',
    portal_my_bookings: 'My Bookings',
    portal_upcoming: 'Upcoming Bookings',
    portal_past: 'Past Bookings',
    portal_team: 'Assigned Team',
    portal_share_link: 'Share Link',
    portal_copy_link: 'Copy Link',
    portal_link_copied: 'Link copied',
    portal_public_view: 'Public View',
    portal_generate: 'Generate Share Link',
    portal_no_link: 'No link'
  });

  /* ---------- generate share token ---------- */
  function generateToken(bookingId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 10; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return bookingId + '_' + token;
  }

  /* ---------- get public URL ---------- */
  function getPublicUrl(bookingId) {
    const base = window.location.origin + window.location.pathname;
    return base + '?client_booking=' + encodeURIComponent(bookingId);
  }

  /* ---------- generate share link ---------- */
  window.__dmGenerateShareLink = function (bookingId) {
    const booking = (State.data.bookings || []).find(b => b.id === bookingId);
    if (!booking) return;

    if (!booking.shareToken) {
      booking.shareToken = generateToken(bookingId);
      saveData();
      logActivity('share', 'booking', bookingId, null, { token: booking.shareToken });
    }

    const url = getPublicUrl(booking.shareToken);

    openModal({
      title: '🔗 ' + t('portal_share_link'),
      body: `
        <div style="display:flex;flex-direction:column;gap:1rem">
          <div style="padding:.75rem;background:var(--surface-2);border-radius:10px;font-size:.75rem;word-break:break-all;color:var(--primary);font-family:ui-monospace,monospace">
            ${url}
          </div>
          <div style="font-size:.8rem;color:var(--text-muted)">
            ${State.lang === 'ar'
              ? 'شارك هذا الرابط مع العميل ليرى تفاصيل حجزه دون تسجيل دخول.'
              : 'Share this link with the client to view their booking without logging in.'}
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">${t('close')}</button>
        <button class="btn btn-primary" onclick="__dmCopyLink('${url}')"><i data-lucide="copy"></i> ${t('portal_copy_link')}</button>
      `
    });
    if (window.lucide) lucide.createIcons();
  };

  window.__dmCopyLink = function (url) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(t('portal_link_copied'), 'success');
        }).catch(() => fallbackCopy(url));
      } else {
        fallbackCopy(url);
      }
    } catch (e) { fallbackCopy(url); }
  };

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(t('portal_link_copied'), 'success');
    } catch (e) {
      showToast('Copy failed', 'error');
    }
    document.body.removeChild(ta);
  }

  /* ---------- public client view ---------- */
  function renderPublicView(bookingToken) {
    // Find booking by shareToken
    const booking = (State.data.bookings || []).find(b => b.shareToken === bookingToken);
    if (!booking) {
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0a1f 0%,#1e1b3a 100%);color:#fff;padding:2rem;font-family:'Cairo',sans-serif;text-align:center">
          <div>
            <div style="font-size:3rem;margin-bottom:1rem">🔍</div>
            <h1 style="margin:0 0 .5rem">الحجز غير موجود</h1>
            <p style="color:#94a3b8">Booking not found</p>
          </div>
        </div>`;
      return;
    }

    const hall = State.data.halls.find(h => h.id === booking.hallId);
    const dists = (State.data.distributions || []).filter(d => d.date === booking.date && d.hallId === booking.hallId);
    const assignedEmployees = dists.map(d => ({
      name: (State.data.employees.find(e => e.id === d.employeeId) || {}).name || '-',
      role: d.role
    }));

    const teamByRole = assignedEmployees.reduce((acc, e) => {
      acc[e.role] = acc[e.role] || [];
      acc[e.role].push(e.name);
      return acc;
    }, {});

    const statusColor = { confirmed: '#10b981', pending: '#f59e0b', completed: '#3b82f6', cancelled: '#ef4444' }[booking.status] || '#7c3aed';

    document.body.innerHTML = `
      <div style="min-height:100vh;background:linear-gradient(135deg,#0f0a1f 0%,#1e1b3a 100%);padding:1rem;font-family:'Cairo',sans-serif;direction:rtl">
        <div style="max-width:640px;margin:2rem auto">
          <div style="text-align:center;margin-bottom:2rem">
            <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.5rem;margin:0 auto 1rem">D</div>
            <h1 style="color:#fff;margin:0;font-size:1.5rem">Dr Media Pro</h1>
            <p style="color:#94a3b8;margin:.25rem 0 0;font-size:.85rem">تفاصيل الحجز · Booking Details</p>
          </div>

          <div style="background:rgba(21,16,36,.85);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:2rem">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem">
              <div>
                <div style="color:#94a3b8;font-size:.75rem;margin-bottom:.25rem">العميل · Client</div>
                <div style="color:#fff;font-size:1.15rem;font-weight:700">${booking.clientName || '-'}</div>
              </div>
              <span style="padding:.35rem .75rem;border-radius:999px;font-size:.75rem;font-weight:600;background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40">
                ${booking.status}
              </span>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
              <div>
                <div style="color:#94a3b8;font-size:.72rem;margin-bottom:.35rem">📅 التاريخ</div>
                <div style="color:#fff;font-weight:600">${fmtDate(booking.date)}</div>
              </div>
              <div>
                <div style="color:#94a3b8;font-size:.72rem;margin-bottom:.35rem">🏛 القاعة</div>
                <div style="color:#fff;font-weight:600">${hall ? (hall.name.ar || hall.name.en) : '-'}</div>
              </div>
              <div>
                <div style="color:#94a3b8;font-size:.72rem;margin-bottom:.35rem">⏰ الوقت</div>
                <div style="color:#fff;font-weight:600">${booking.startTime || ''} - ${booking.endTime || ''}</div>
              </div>
              <div>
                <div style="color:#94a3b8;font-size:.72rem;margin-bottom:.35rem">🎉 نوع المناسبة</div>
                <div style="color:#fff;font-weight:600">${booking.eventType || '-'}</div>
              </div>
            </div>

            ${Object.keys(teamByRole).length ? `
              <div style="padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.1)">
                <div style="color:#94a3b8;font-size:.72rem;margin-bottom:.75rem">👥 الفريق المعين · Team</div>
                ${Object.entries(teamByRole).map(([role, names]) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.06)">
                    <span style="color:#a78bfa;font-size:.8rem;font-weight:600">${role}</span>
                    <span style="color:#fff;font-size:.85rem">${names.join(' · ')}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${booking.notes ? `
              <div style="padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.1);margin-top:1rem">
                <div style="color:#94a3b8;font-size:.72rem;margin-bottom:.35rem">📝 ملاحظات</div>
                <div style="color:#fff;font-size:.85rem;line-height:1.6">${booking.notes}</div>
              </div>
            ` : ''}
          </div>

          <div style="text-align:center;margin-top:2rem;color:#64748b;font-size:.75rem">
            Powered by Dr Media Pro
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- URL check on load ---------- */
  function checkPublicUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('client_booking');
    if (token) {
      // Wait for State to be ready, then render public view
      waitFor(
        () => typeof State !== 'undefined' && State.data && State.data.bookings,
        () => {
          setTimeout(() => renderPublicView(token), 400);
        }
      );
    }
  }

  /* ---------- add "Share" button to booking rows ---------- */
  function hookBookingsPage() {
    if (!Pages.bookings) return;
    const orig = Pages.bookings;
    Pages.bookings = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll('.data-table tbody tr').forEach(row => {
          const actionCell = row.querySelector('td:last-child');
          if (!actionCell || actionCell.querySelector('.share-btn')) return;
          const editBtn = row.querySelector('button[onclick*="editBooking"]');
          if (!editBtn) return;
          const match = editBtn.getAttribute('onclick').match(/editBooking\('([^']+)'\)/);
          if (!match) return;
          const bookingId = match[1];

          const btn = document.createElement('button');
          btn.className = 'btn btn-ghost btn-icon btn-sm share-btn';
          btn.title = 'Share client portal';
          btn.style.color = '#ec4899';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
          btn.onclick = (e) => {
            e.stopPropagation();
            window.__dmGenerateShareLink(bookingId);
          };
          const actionsDiv = actionCell.querySelector('div');
          if (actionsDiv) actionsDiv.insertBefore(btn, actionsDiv.firstChild);
          else actionCell.appendChild(btn);
        });
      }, 120);
    };
  }

  /* ---------- boot ---------- */
  checkPublicUrl();

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof navigate === 'function',
    function () {
      hookBookingsPage();
      console.log('%c[Section 11] ✓ Client Portal ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 12: Auto PDF Reports (تقارير PDF تلقائية)
   Version: 1.0.0
   - Pay slip PDF per employee
   - Booking confirmation PDF
   - Daily distribution sheet PDF
   - Uses browser print (no external libs)
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 12] PDF Reports loading…', 'color:#f43f5e;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 12] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    pdf_payslip: 'كشف مرتب PDF',
    pdf_booking: 'تأكيد حجز PDF',
    pdf_daily_sheet: 'كشف توزيع يومي PDF',
    pdf_generating: 'جاري التوليد…'
  });
  Object.assign(I18N.en, {
    pdf_payslip: 'Pay Slip PDF',
    pdf_booking: 'Booking Confirmation PDF',
    pdf_daily_sheet: 'Daily Distribution Sheet PDF',
    pdf_generating: 'Generating…'
  });

  /* ---------- helper: open print window with HTML ---------- */
  function printHTML(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) {
      showToast(State.lang === 'ar' ? 'الرجاء السماح بالنوافذ المنبثقة' : 'Please allow popups', 'warn');
      return;
    }
    const styles = `
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-family:'Cairo','Inter',system-ui,sans-serif;margin:0;padding:2rem;color:#0f172a;background:#fff;direction:${State.lang === 'ar' ? 'rtl' : 'ltr'}}
      .header{display:flex;align-items:center;gap:1rem;padding-bottom:1rem;border-bottom:3px solid #7c3aed;margin-bottom:1.5rem}
      .logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem}
      .brand h1{margin:0;font-size:1.35rem;font-weight:800;color:#0f172a}
      .brand p{margin:0;font-size:.75rem;color:#64748b}
      .brand span{color:#7c3aed}
      .title{font-size:1.15rem;font-weight:700;margin-bottom:1rem;color:#0f172a;padding:.5rem 0;border-bottom:2px solid #e5e7eb}
      .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1.5rem}
      .meta-row{display:flex;justify-content:space-between;padding:.5rem .75rem;background:#f9fafb;border-radius:8px;font-size:.85rem}
      .meta-row b{color:#0f172a}
      table{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem}
      th,td{padding:.6rem .75rem;text-align:${State.lang === 'ar' ? 'right' : 'left'};border-bottom:1px solid #e5e7eb}
      th{background:#f3f4f6;font-weight:700;color:#374151;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
      .total-row{background:#7c3aed10;font-weight:800;font-size:1rem}
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.5rem}
      .kpi{padding:.75rem;background:#f9fafb;border-radius:10px;text-align:center}
      .kpi-label{font-size:.7rem;color:#64748b;margin-bottom:.25rem}
      .kpi-value{font-size:1.25rem;font-weight:800}
      .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #e5e7eb;font-size:.72rem;color:#94a3b8;text-align:center}
      .badge{display:inline-block;padding:.2rem .6rem;border-radius:999px;font-size:.7rem;font-weight:700}
      .badge-green{background:#10b98120;color:#059669}
      .badge-red{background:#ef444420;color:#dc2626}
      .badge-yellow{background:#f59e0b20;color:#d97706}
      @media print{body{padding:0}}
    `;

    w.document.write(`<!DOCTYPE html><html lang="${State.lang}" dir="${State.lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body>
      <div class="header">
        <div class="logo">D</div>
        <div class="brand">
          <h1>Dr Media <span>Pro</span></h1>
          <p>${State.data.settings.companyName || 'Professional Video Production'} · ${State.data.settings.phone || ''}</p>
        </div>
      </div>
      ${bodyHtml}
      <div class="footer">
        ${State.data.settings.companyName || 'Dr Media Pro'} · ${State.data.settings.address || ''} · ${new Date().toLocaleString(State.lang === 'ar' ? 'ar-EG' : 'en-GB')}
      </div>
      <script>setTimeout(function(){window.print();},300);<\/script>
    </body></html>`);
    w.document.close();
  }

  /* ---------- Pay Slip PDF ---------- */
  window.__dmPayslipPDF = function (employeeId) {
    const emp = State.data.employees.find(e => e.id === employeeId);
    if (!emp) { showToast('Employee not found', 'error'); return; }

    // Current month
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const from = new Date(y, m, 1).toISOString().slice(0, 10);
    const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);

    const dists = (State.data.distributions || []).filter(x =>
      x.employeeId === employeeId && x.date >= from && x.date <= to && x.status === 'confirmed'
    );
    const workDays = dists.length;
    const gross = workDays * (emp.dayRate || 0);

    const advs = (State.data.advances || []).filter(a => a.employeeId === employeeId && a.date >= from && a.date <= to);
    const deds = (State.data.deductions || []).filter(a => a.employeeId === employeeId && a.date >= from && a.date <= to);
    const bons = (State.data.bonuses || []).filter(a => a.employeeId === employeeId && a.date >= from && a.date <= to);

    const totalAdv = advs.reduce((s, a) => s + (a.amount || 0), 0);
    const totalDed = deds.reduce((s, x) => s + (x.amount || 0), 0);
    const totalBon = bons.reduce((s, x) => s + (x.amount || 0), 0);
    const net = gross + totalBon - totalAdv - totalDed;

    const ar = State.lang === 'ar';
    const L = {
      title: ar ? `كشف مرتب — ${emp.name}` : `Pay Slip — ${emp.name}`,
      period: ar ? 'الفترة' : 'Period',
      name: ar ? 'الاسم' : 'Name',
      role: ar ? 'الوظيفة' : 'Role',
      empId: ar ? 'كود الموظف' : 'Employee ID',
      dayRate: ar ? 'سعر اليوم' : 'Day Rate',
      workDays: ar ? 'أيام العمل' : 'Work Days',
      gross: ar ? 'الإجمالي' : 'Gross',
      advances: ar ? 'السلف' : 'Advances',
      deductions: ar ? 'الخصومات' : 'Deductions',
      bonuses: ar ? 'المكافآت' : 'Bonuses',
      net: ar ? 'الصافي' : 'Net',
      details: ar ? 'تفاصيل العمل' : 'Work Details',
      date: ar ? 'التاريخ' : 'Date',
      hall: ar ? 'القاعة' : 'Hall',
      roleCol: ar ? 'الدور' : 'Role',
      rate: ar ? 'السعر' : 'Rate',
      summary: ar ? 'الملخص' : 'Summary'
    };

    const hallName = (id) => {
      const h = State.data.halls.find(x => x.id === id);
      return h ? (h.name.ar || h.name.en) : '-';
    };

    const bodyHtml = `
      <div class="title">${L.title}</div>

      <div class="meta">
        <div class="meta-row"><span>${L.name}</span><b>${emp.name}</b></div>
        <div class="meta-row"><span>${L.empId}</span><b>${emp.code || '-'}</b></div>
        <div class="meta-row"><span>${L.role}</span><b>${emp.role}</b></div>
        <div class="meta-row"><span>${L.dayRate}</span><b>EGP ${emp.dayRate || 0}</b></div>
        <div class="meta-row"><span>${L.period}</span><b>${fmtDate(from)} → ${fmtDate(to)}</b></div>
        <div class="meta-row"><span>${L.workDays}</span><b>${workDays}</b></div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${L.gross}</div><div class="kpi-value" style="color:#7c3aed">EGP ${gross.toLocaleString()}</div></div>
        <div class="kpi"><div class="kpi-label">${L.net}</div><div class="kpi-value" style="color:${net >= 0 ? '#10b981' : '#ef4444'}">EGP ${net.toLocaleString()}</div></div>
        <div class="kpi"><div class="kpi-label">${L.workDays}</div><div class="kpi-value">${workDays}</div></div>
      </div>

      <div class="title">${L.details}</div>
      <table>
        <thead><tr><th>${L.date}</th><th>${L.hall}</th><th>${L.roleCol}</th><th>${L.rate}</th></tr></thead>
        <tbody>
          ${dists.length ? dists.map(d => `
            <tr><td>${fmtDate(d.date)}</td><td>${hallName(d.hallId)}</td><td>${d.role}</td><td>EGP ${emp.dayRate || 0}</td></tr>
          `).join('') : `<tr><td colspan="4" style="text-align:center;color:#94a3b8">${ar ? 'لا يوجد' : 'None'}</td></tr>`}
        </tbody>
      </table>

      <div class="title">${L.summary}</div>
      <table>
        <tbody>
          <tr><td>${L.gross}</td><td style="text-align:${ar ? 'left' : 'right'};font-weight:700">EGP ${gross.toLocaleString()}</td></tr>
          <tr><td>${L.bonuses} (+)</td><td style="text-align:${ar ? 'left' : 'right'};color:#10b981">EGP ${totalBon.toLocaleString()}</td></tr>
          <tr><td>${L.advances} (−)</td><td style="text-align:${ar ? 'left' : 'right'};color:#f59e0b">EGP ${totalAdv.toLocaleString()}</td></tr>
          <tr><td>${L.deductions} (−)</td><td style="text-align:${ar ? 'left' : 'right'};color:#ef4444">EGP ${totalDed.toLocaleString()}</td></tr>
          <tr class="total-row"><td>${L.net}</td><td style="text-align:${ar ? 'left' : 'right'};color:${net >= 0 ? '#10b981' : '#ef4444'}">EGP ${net.toLocaleString()}</td></tr>
        </tbody>
      </table>
    `;

    printHTML(L.title, bodyHtml);
  };

  /* ---------- Booking Confirmation PDF ---------- */
  window.__dmBookingPDF = function (bookingId) {
    const b = (State.data.bookings || []).find(x => x.id === bookingId);
    if (!b) { showToast('Booking not found', 'error'); return; }

    const hall = State.data.halls.find(h => h.id === b.hallId);
    const dists = (State.data.distributions || []).filter(d => d.date === b.date && d.hallId === b.hallId);
    const team = dists.map(d => ({
      name: (State.data.employees.find(e => e.id === d.employeeId) || {}).name || '-',
      role: d.role
    }));

    const ar = State.lang === 'ar';
    const L = {
      title: ar ? 'تأكيد حجز' : 'Booking Confirmation',
      client: ar ? 'العميل' : 'Client',
      phone: ar ? 'الهاتف' : 'Phone',
      date: ar ? 'التاريخ' : 'Date',
      hall: ar ? 'القاعة' : 'Hall',
      time: ar ? 'الوقت' : 'Time',
      event: ar ? 'المناسبة' : 'Event',
      cost: ar ? 'التكلفة' : 'Cost',
      status: ar ? 'الحالة' : 'Status',
      payment: ar ? 'الدفع' : 'Payment',
      team: ar ? 'الفريق' : 'Team',
      notes: ar ? 'ملاحظات' : 'Notes',
      bookingId: ar ? 'رقم الحجز' : 'Booking ID'
    };

    const bodyHtml = `
      <div class="title">${L.title}</div>

      <div class="meta">
        <div class="meta-row"><span>${L.bookingId}</span><b>${b.id}</b></div>
        <div class="meta-row"><span>${L.client}</span><b>${b.clientName || '-'}</b></div>
        <div class="meta-row"><span>${L.phone}</span><b>${b.phone || '-'}</b></div>
        <div class="meta-row"><span>${L.date}</span><b>${fmtDate(b.date)}</b></div>
        <div class="meta-row"><span>${L.hall}</span><b>${hall ? (hall.name.ar || hall.name.en) : '-'}</b></div>
        <div class="meta-row"><span>${L.time}</span><b>${b.startTime || ''} - ${b.endTime || ''}</b></div>
        <div class="meta-row"><span>${L.event}</span><b>${b.eventType || '-'}</b></div>
        <div class="meta-row"><span>${L.cost}</span><b>EGP ${(b.cost || 0).toLocaleString()}</b></div>
        <div class="meta-row"><span>${L.status}</span><b class="badge badge-${b.status === 'confirmed' ? 'green' : b.status === 'pending' ? 'yellow' : b.status === 'completed' ? 'green' : 'red'}">${b.status}</b></div>
        <div class="meta-row"><span>${L.payment}</span><b>${b.paymentStatus || 'unpaid'}</b></div>
      </div>

      ${team.length ? `
        <div class="title">${L.team}</div>
        <table>
          <thead><tr><th>${ar ? 'الدور' : 'Role'}</th><th>${ar ? 'الاسم' : 'Name'}</th></tr></thead>
          <tbody>
            ${team.map(t => `<tr><td>${t.role}</td><td>${t.name}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}

      ${b.notes ? `
        <div class="title">${L.notes}</div>
        <div style="padding:.75rem;background:#f9fafb;border-radius:8px;font-size:.85rem;line-height:1.6">${b.notes}</div>
      ` : ''}
    `;

    printHTML(L.title, bodyHtml);
  };

  /* ---------- Daily Distribution Sheet PDF ---------- */
  window.__dmDailySheetPDF = function (date) {
    date = date || todayISO();
    const bookings = (State.data.bookings || []).filter(b => b.date === date && b.status !== 'cancelled');
    const bookedHalls = [...new Set(bookings.map(b => b.hallId))];
    const halls = bookedHalls.length
      ? State.data.halls.filter(h => bookedHalls.includes(h.id))
      : State.data.halls.filter(h => h.status === 'active');

    const dists = (State.data.distributions || []).filter(x => x.date === date);

    const ar = State.lang === 'ar';
    const L = {
      title: ar ? 'كشف التوزيع اليومي' : 'Daily Distribution Sheet',
      date: ar ? 'التاريخ' : 'Date',
      hall: ar ? 'القاعة' : 'Hall',
      role: ar ? 'الدور' : 'Role',
      employee: ar ? 'الموظف' : 'Employee',
      status: ar ? 'الحالة' : 'Status',
      notes: ar ? 'ملاحظات' : 'Notes',
      client: ar ? 'العميل' : 'Client',
      time: ar ? 'الوقت' : 'Time'
    };

    const bodyHtml = `
      <div class="title">${L.title} — ${fmtDate(date)}</div>

      ${halls.map(hall => {
        const hallDists = dists.filter(x => x.hallId === hall.id);
        const hallBookings = bookings.filter(b => b.hallId === hall.id);
        return `
          <div style="margin-bottom:1.5rem;page-break-inside:avoid">
            <div style="font-weight:800;font-size:1rem;padding:.5rem .75rem;background:#7c3aed10;border-inline-start:4px solid #7c3aed;border-radius:6px;margin-bottom:.75rem">
              ${hall.name.ar || hall.name.en}
              ${hallBookings.length ? `<span style="font-size:.75rem;font-weight:400;color:#64748b"> · ${hallBookings.map(b => (b.clientName || '') + ' ' + (b.startTime || '')).join(' · ')}</span>` : ''}
            </div>
            <table>
              <thead><tr><th>${L.role}</th><th>${L.employee}</th><th>${L.status}</th></tr></thead>
              <tbody>
                ${hall.requirements.map(req => {
                  const assigned = hallDists.filter(x => x.role === req.role);
                  return assigned.length
                    ? assigned.map(a => {
                        const emp = State.data.employees.find(e => e.id === a.employeeId);
                        return `<tr><td>${a.role}</td><td>${emp ? emp.name : (a.manualName || '-')}</td><td><span class="badge badge-green">✓</span></td></tr>`;
                      }).join('')
                    : `<tr><td>${req.role}</td><td style="color:#ef4444">—</td><td><span class="badge badge-red">✗</span></td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('')}

      <div style="margin-top:2rem;font-size:.75rem;color:#64748b;text-align:center">
        ${ar ? 'إجمالي الحجوزات' : 'Total bookings'}: <b>${bookings.length}</b> · 
        ${ar ? 'إجمالي التعيينات' : 'Total assignments'}: <b>${dists.length}</b>
      </div>
    `;

    printHTML(L.title, bodyHtml);
  };

  /* ---------- inject PDF buttons ---------- */
  function hookEmployeesPage() {
    if (!Pages.employees) return;
    const orig = Pages.employees;
    Pages.employees = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll('.data-table tbody tr').forEach(row => {
          const actionCell = row.querySelector('td:last-child');
          if (!actionCell || actionCell.querySelector('.pdf-btn')) return;
          const editBtn = row.querySelector('button[onclick*="editEmployee"]');
          if (!editBtn) return;
          const m = editBtn.getAttribute('onclick').match(/editEmployee\('([^']+)'\)/);
          if (!m) return;
          const empId = m[1];

          const btn = document.createElement('button');
          btn.className = 'btn btn-ghost btn-icon btn-sm pdf-btn';
          btn.title = (I18N[State.lang] || I18N.ar).pdf_payslip;
          btn.style.color = '#f43f5e';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
          btn.onclick = (e) => { e.stopPropagation(); window.__dmPayslipPDF(empId); };
          const actionsDiv = actionCell.querySelector('div');
          if (actionsDiv) actionsDiv.appendChild(btn);
        });
      }, 120);
    };
  }

  function hookBookingsPage() {
    if (!Pages.bookings) return;
    const orig = Pages.bookings;
    Pages.bookings = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll('.data-table tbody tr').forEach(row => {
          const actionCell = row.querySelector('td:last-child');
          if (!actionCell || actionCell.querySelector('.pdf-btn')) return;
          const editBtn = row.querySelector('button[onclick*="editBooking"]');
          if (!editBtn) return;
          const m = editBtn.getAttribute('onclick').match(/editBooking\('([^']+)'\)/);
          if (!m) return;
          const bid = m[1];

          const btn = document.createElement('button');
          btn.className = 'btn btn-ghost btn-icon btn-sm pdf-btn';
          btn.title = (I18N[State.lang] || I18N.ar).pdf_booking;
          btn.style.color = '#f43f5e';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
          btn.onclick = (e) => { e.stopPropagation(); window.__dmBookingPDF(bid); };
          const actionsDiv = actionCell.querySelector('div');
          if (actionsDiv) actionsDiv.appendChild(btn);
        });
      }, 120);
    };
  }

  function hookDistributionPage() {
    if (!Pages.distribution) return;
    const orig = Pages.distribution;
    Pages.distribution = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        // Add PDF button to toolbar
        const toolbar = document.querySelector('#dist-date')?.closest('div');
        if (toolbar && !toolbar.querySelector('.pdf-sheet-btn')) {
          const btn = document.createElement('button');
          btn.className = 'btn btn-ghost btn-sm pdf-sheet-btn';
          btn.style.color = '#f43f5e';
          btn.innerHTML = `<i data-lucide="file-text"></i> ${(I18N[State.lang] || I18N.ar).pdf_daily_sheet}`;
          btn.onclick = () => window.__dmDailySheetPDF(State.filters.distDate || todayISO());
          toolbar.insertBefore(btn, toolbar.querySelector('.btn-primary') || toolbar.lastElementChild);
          if (window.lucide) lucide.createIcons();
        }
      }, 120);
    };
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined',
    function () {
      hookEmployeesPage();
      hookBookingsPage();
      hookDistributionPage();
      console.log('%c[Section 12] ✓ PDF Reports ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 13: AI Chat Assistant (FIXED)
   Version: 1.0.1
   - Rule-based smart assistant (no API key needed)
   - Understands Arabic + English commands
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 13] AI Chat loading…', 'color:#a855f7;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 13] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  Object.assign(I18N.ar, {
    ai_chat: 'المساعد الذكي',
    ai_ask: 'اسأل أي حاجة…',
    ai_hello: 'أهلاً! 👋 اسألني عن حجوزات، موظفين، توزيعات، أو اطلب مني أوامر.',
    ai_clear: 'مسح المحادثة',
    ai_you: 'أنت',
    ai_me: 'المساعد',
    ai_quick: 'أسئلة سريعة',
    ai_not_understood: 'مش فاهم، جرب تسأل بشكل تاني.'
  });
  Object.assign(I18N.en, {
    ai_chat: 'AI Assistant',
    ai_ask: 'Ask me anything…',
    ai_hello: "Hi! 👋 Ask me about bookings, employees, distributions, or give me commands.",
    ai_clear: 'Clear chat',
    ai_you: 'You',
    ai_me: 'Assistant',
    ai_quick: 'Quick asks',
    ai_not_understood: "I didn't understand, try asking differently."
  });

  const history = [];
  window.__dmChatHistory = history;

  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById('dm-chat-styles')) return;
    const s = document.createElement('style');
    s.id = 'dm-chat-styles';
    s.textContent = `
      #dm-chat-fab{
        position:fixed;bottom:1.25rem;inset-inline-end:1.25rem;z-index:9000;
        width:56px;height:56px;border-radius:50%;
        background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;
        border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
        box-shadow:0 12px 32px -8px rgba(168,85,247,.5);
        transition:all .25s;
      }
      #dm-chat-fab:hover{transform:scale(1.08);box-shadow:0 16px 40px -8px rgba(168,85,247,.7)}
      #dm-chat-fab::after{
        content:'';position:absolute;inset:-2px;border-radius:50%;
        background:linear-gradient(135deg,#a855f7,#7c3aed);
        z-index:-1;animation:dmChatPulse 2.5s infinite;
      }
      @keyframes dmChatPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.4)}}

      #dm-chat-panel{
        position:fixed;bottom:5.75rem;inset-inline-end:1.25rem;z-index:9000;
        width:min(420px,calc(100vw - 2rem));height:min(600px,75vh);
        background:var(--surface);border:1px solid var(--border);border-radius:20px;
        box-shadow:0 30px 60px -20px rgba(0,0,0,.4);
        display:flex;flex-direction:column;overflow:hidden;
        transform-origin:bottom right;animation:dmChatIn .25s cubic-bezier(.2,.9,.3,1.3);
      }
      [dir="rtl"] #dm-chat-panel{transform-origin:bottom left}
      @keyframes dmChatIn{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:none}}

      .dm-chat-head{
        padding:1rem 1.25rem;border-bottom:1px solid var(--border);
        display:flex;align-items:center;gap:.75rem;
        background:linear-gradient(135deg,rgba(168,85,247,.08),rgba(124,58,237,.08));
      }
      .dm-chat-avatar{
        width:36px;height:36px;border-radius:50%;
        background:linear-gradient(135deg,#a855f7,#7c3aed);
        display:flex;align-items:center;justify-content:center;color:#fff;
        font-weight:700;font-size:.9rem;
      }
      .dm-chat-title{flex:1;font-weight:700;font-size:.9rem;color:var(--text)}
      .dm-chat-sub{font-size:.7rem;color:var(--text-muted);font-weight:400}
      .dm-chat-close{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:.4rem;border-radius:8px;display:flex}
      .dm-chat-close:hover{background:var(--surface-2);color:var(--text)}

      .dm-chat-body{
        flex:1;overflow-y:auto;padding:1rem;
        display:flex;flex-direction:column;gap:.75rem;
        background:var(--bg);
      }
      .dm-chat-body::-webkit-scrollbar{width:6px}
      .dm-chat-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px}

      .dm-chat-msg{max-width:85%;padding:.75rem 1rem;border-radius:14px;font-size:.85rem;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}
      .dm-chat-msg.user{align-self:flex-end;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff}
      [dir="rtl"] .dm-chat-msg.user{border-bottom-left-radius:4px}
      [dir="ltr"] .dm-chat-msg.user{border-bottom-right-radius:4px}
      .dm-chat-msg.bot{align-self:flex-start;background:var(--surface);color:var(--text);border:1px solid var(--border)}
      [dir="rtl"] .dm-chat-msg.bot{border-bottom-right-radius:4px}
      [dir="ltr"] .dm-chat-msg.bot{border-bottom-left-radius:4px}

      .dm-chat-actions{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
      .dm-chat-action{
        padding:.35rem .7rem;border-radius:8px;font-size:.72rem;
        background:var(--surface-2);border:1px solid var(--border);color:var(--text);
        cursor:pointer;transition:all .15s;
      }
      .dm-chat-action:hover{background:var(--primary);color:#fff;border-color:var(--primary)}

      .dm-chat-quick{padding:.5rem 1rem;border-top:1px solid var(--border);display:flex;gap:.35rem;overflow-x:auto;flex-shrink:0;background:var(--surface)}
      .dm-chat-quick::-webkit-scrollbar{display:none}
      .dm-chat-qchip{
        padding:.35rem .7rem;border-radius:999px;font-size:.7rem;
        background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);
        cursor:pointer;white-space:nowrap;transition:all .15s;
      }
      .dm-chat-qchip:hover{background:var(--primary);color:#fff;border-color:var(--primary)}

      .dm-chat-foot{padding:.65rem .75rem;border-top:1px solid var(--border);display:flex;gap:.5rem;background:var(--surface);flex-shrink:0}
      .dm-chat-input{
        flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;
        padding:.6rem .85rem;font-size:.85rem;color:var(--text);font-family:inherit;outline:none;
      }
      .dm-chat-input:focus{border-color:var(--primary)}
      .dm-chat-send{
        width:38px;height:38px;border-radius:10px;background:var(--primary);color:#fff;
        border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:all .15s;flex-shrink:0;
      }
      .dm-chat-send:hover{background:var(--primary-dark)}
      .dm-chat-send svg{width:16px;height:16px}

      .dm-chat-typing{align-self:flex-start;padding:.6rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:14px;display:flex;gap:.35rem;align-items:center}
      .dm-chat-typing span{width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:dmChatBounce 1.4s infinite}
      .dm-chat-typing span:nth-child(2){animation-delay:.15s}
      .dm-chat-typing span:nth-child(3){animation-delay:.3s}
      @keyframes dmChatBounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}

      @media (max-width:640px){
        #dm-chat-fab{bottom:1rem;inset-inline-end:1rem;width:52px;height:52px}
        #dm-chat-panel{bottom:4.5rem;inset-inline-end:.5rem;inset-inline-start:.5rem;width:auto;height:calc(100vh - 6rem);max-height:none}
      }
    `;
    document.head.appendChild(s);
  }

  /* ---------- helpers ---------- */
  function norm(text) {
    return String(text || '').toLowerCase().trim()
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }

  function findEmployeeByName(text) {
    const n = norm(text);
    return State.data.employees.find(e => n.includes(norm(e.name)));
  }

  function findHallByName(text) {
    const n = norm(text);
    return State.data.halls.find(h =>
      n.includes(norm(h.name.ar)) ||
      n.includes(norm(h.name.en)) ||
      n.includes(norm(h.code))
    );
  }

  /* ---------- answer builders ---------- */
  function answerBookingsToday() {
    const today = todayISO();
    const bookings = State.data.bookings.filter(b => b.date === today && b.status !== 'cancelled');
    if (!bookings.length) return { text: `📅 لا يوجد حجوزات اليوم (${fmtDate(today)})`, actions: [] };
    const lines = bookings.map(b => {
      const h = State.data.halls.find(x => x.id === b.hallId);
      return `• ${b.clientName} — ${h ? (h.name.ar || h.name.en) : '-'} (${b.startTime || ''}-${b.endTime || ''})`;
    });
    return {
      text: `📅 حجوزات اليوم (${fmtDate(today)}) — ${bookings.length}\n${lines.join('\n')}`,
      actions: [{ label: 'فتح الحجوزات', fn: () => navigate('bookings') }]
    };
  }

  function answerBookingsDate(date) {
    const bookings = State.data.bookings.filter(b => b.date === date && b.status !== 'cancelled');
    if (!bookings.length) return { text: `📅 لا يوجد حجوزات في ${fmtDate(date)}`, actions: [] };
    const lines = bookings.map(b => {
      const h = State.data.halls.find(x => x.id === b.hallId);
      return `• ${b.clientName} — ${h ? (h.name.ar || h.name.en) : '-'}`;
    });
    return {
      text: `📅 حجوزات ${fmtDate(date)} — ${bookings.length}\n${lines.join('\n')}`,
      actions: [{ label: 'التوزيع اليومي', fn: () => { State.filters.distDate = date; navigate('distribution'); } }]
    };
  }

  function answerEmployeesCount() {
    const total = State.data.employees.length;
    const active = State.data.employees.filter(e => e.status === 'active').length;
    const byRole = {};
    State.data.employees.forEach(e => { byRole[e.role] = (byRole[e.role] || 0) + 1; });
    const lines = Object.entries(byRole).map(([r, c]) => `• ${r}: ${c}`);
    return {
      text: `👥 الموظفون\nالإجمالي: ${total} · النشط: ${active}\n${lines.join('\n')}`,
      actions: [{ label: 'فتح الموظفين', fn: () => navigate('employees') }]
    };
  }

  function answerEmployeeInfo(emp) {
    const dists = State.data.distributions.filter(d => d.employeeId === emp.id && d.status === 'confirmed');
    const workDays = dists.length;
    const adv = State.data.advances.filter(a => a.employeeId === emp.id).reduce((s, x) => s + (x.amount || 0), 0);
    const gross = workDays * (emp.dayRate || 0);
    return {
      text: `👤 ${emp.name}\nالوظيفة: ${emp.role}\nكود: ${emp.code || '-'}\nأيام العمل: ${workDays}\nالإجمالي: EGP ${gross.toLocaleString()}\nالسلف: EGP ${adv.toLocaleString()}`,
      actions: [{ label: 'عرض الملف', fn: () => viewEmployee(emp.id) }]
    };
  }

  function answerLeastWorked() {
    const employees = State.data.employees.filter(e => e.status === 'active');
    const sorted = employees.map(e => ({
      e,
      count: State.data.distributions.filter(d => d.employeeId === e.id && d.status === 'confirmed').length
    })).sort((a, b) => a.count - b.count);
    const top5 = sorted.slice(0, 5).map((x, i) => `${i + 1}. ${x.e.name} — ${x.count} ${State.lang === 'ar' ? 'توزيع' : 'assignments'}`);
    return {
      text: `📉 الأقل عملًا\n${top5.join('\n')}`,
      actions: [{ label: 'التحليل الذكي', fn: () => navigate('ai') }]
    };
  }

  function answerMostWorked() {
    const employees = State.data.employees.filter(e => e.status === 'active');
    const sorted = employees.map(e => ({
      e,
      count: State.data.distributions.filter(d => d.employeeId === e.id && d.status === 'confirmed').length
    })).sort((a, b) => b.count - a.count);
    const top5 = sorted.slice(0, 5).map((x, i) => `${i + 1}. ${x.e.name} — ${x.count} ${State.lang === 'ar' ? 'توزيع' : 'assignments'}`);
    return {
      text: `📈 الأكثر عملًا\n${top5.join('\n')}`,
      actions: [{ label: 'التحليل الذكي', fn: () => navigate('ai') }]
    };
  }

  function answerRevenue() {
    const total = State.data.bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (b.cost || 0), 0);
    const month = todayISO().slice(0, 7);
    const monthRev = State.data.bookings.filter(b => b.date.startsWith(month) && b.status !== 'cancelled').reduce((s, b) => s + (b.cost || 0), 0);
    return {
      text: `💰 الإيرادات\nهذا الشهر: EGP ${monthRev.toLocaleString()}\nالإجمالي: EGP ${total.toLocaleString()}`,
      actions: [{ label: 'التحليل المالي', fn: () => navigate('pl') }]
    };
  }

  function answerHallBookings(hall) {
    const bookings = State.data.bookings.filter(b => b.hallId === hall.id && b.status !== 'cancelled');
    return {
      text: `🏛 ${hall.name.ar || hall.name.en}\nعدد الحجوزات: ${bookings.length}\nالاحتياجات: ${hall.requirements.map(r => r.role + ' x' + r.count).join(', ')}`,
      actions: [{ label: 'عرض القاعة', fn: () => editHall(hall.id) }]
    };
  }

  function answerShortage() {
    const today = todayISO();
    if (typeof window.__dmAIAnalyze === 'function') {
      const analysis = window.__dmAIAnalyze(today);
      if (!analysis.shortages.length) {
        return { text: `✅ لا يوجد نقص في موظفي اليوم`, actions: [{ label: 'التوزيع الذكي', fn: () => navigate('ai') }] };
      }
      const lines = analysis.shortages.map(s => `⚠️ ${s.hall.name.ar || s.hall.name.en} — ${s.role}: ناقص ${s.needed - s.available}`);
      return {
        text: `⚠️ نقص في ${analysis.shortages.length} دور\n${lines.join('\n')}`,
        actions: [{ label: 'التحليل الكامل', fn: () => navigate('ai') }]
      };
    }
    return { text: '❌ محرك التحليل غير متاح', actions: [] };
  }

  function answerHelp() {
    return {
      text: `${t('ai_hello')}\n\n${State.lang === 'ar'
        ? 'أمثلة:\n• حجوزات اليوم\n• كام موظف\n• مين أقل موظف عمل\n• إيرادات الشهر\n• نقص اليوم\n• اعرض قاعة المغلقة\n• ابحث عن زكاوة'
        : 'Examples:\n• Bookings today\n• Employee count\n• Least worked\n• Revenue this month\n• Shortages today\n• Show Closed Hall\n• Find Zakawa'}`,
      actions: []
    };
  }

  /* ---------- main dispatcher ---------- */
  function respond(text) {
    const n = norm(text);
    if (!n) return { text: '❓', actions: [] };

    // Help
    if (/^(مرحبا|سلام|اهلا|هاي|help|مساعدة|hi|hello)/.test(n)) return answerHelp();

    // Today's bookings
    if (/حجوزات|bookings/.test(n) && /اليوم|today/.test(n)) return answerBookingsToday();

    // Tomorrow
    if (/حجوزات|bookings/.test(n) && /بكرة|غدا|بكره|tomorrow/.test(n)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return answerBookingsDate(d.toISOString().slice(0, 10));
    }

    // Revenue
    if (/ايراد|ربح|revenue|profit|income/.test(n)) return answerRevenue();

    // Shortage
    if (/نقص|shortage|ينقص|مش كفاية/.test(n)) return answerShortage();

    // Least worked
    if (/اقل|least/.test(n) && /موظف|employee/.test(n)) return answerLeastWorked();

    // Most worked
    if (/اكتر|اكثر|most/.test(n) && /موظف|employee/.test(n)) return answerMostWorked();

    // Employee count
    if (/كام|كم|عدد|count|how many/.test(n) && /موظف|employee/.test(n)) return answerEmployeesCount();

    // Employee by name
    const emp = findEmployeeByName(text);
    if (emp && !/كام|كم/.test(n)) return answerEmployeeInfo(emp);

    // Hall by name
    const hall = findHallByName(text);
    if (hall) return answerHallBookings(hall);

    // Navigation commands
    if (/افتح|روح|open|go to|navigate|اعرض/.test(n)) {
      const navMap = {
        'حجوزات': 'bookings', 'bookings': 'bookings',
        'موظفين': 'employees', 'employees': 'employees',
        'قاعات': 'halls', 'halls': 'halls',
        'توزيع': 'distribution', 'distribution': 'distribution',
        'رواتب': 'payroll', 'payroll': 'payroll',
        'تقارير': 'reports', 'reports': 'reports',
        'كالندر': 'calendar', 'تقويم': 'calendar', 'calendar': 'calendar',
        'اجازات': 'leaves', 'leaves': 'leaves',
        'معدات': 'equipment', 'equipment': 'equipment',
        'عملاء': 'clients', 'clients': 'clients',
        'اعدادات': 'settings', 'settings': 'settings',
        'احصائيات': 'pl', 'financial': 'pl',
        'ذكي': 'ai', 'ai': 'ai',
        'timeline': 'timeline', 'زمني': 'timeline'
      };
      for (const key of Object.keys(navMap)) {
        if (n.includes(norm(key))) {
          const page = navMap[key];
          return { text: `✅ جاري فتح ${key}…`, actions: [{ label: `فتح ${key}`, fn: () => navigate(page) }] };
        }
      }
    }

    // Add commands
    if (/ضيف|اضف|add|new|جديد/.test(n)) {
      if (/حجز|booking/.test(n)) return { text: '📅 اضغط الزر لفتح نموذج الحجز الجديد', actions: [{ label: '➕ حجز جديد', fn: () => editBooking() }] };
      if (/موظف|employee/.test(n)) return { text: '👤 اضغط الزر لفتح نموذج الموظف الجديد', actions: [{ label: '➕ موظف جديد', fn: () => editEmployee() }] };
      if (/معدة|معدات|equipment/.test(n)) return { text: '🎥 اضغط الزر لإضافة معدة', actions: [{ label: '➕ معدة جديدة', fn: () => editEquipment() }] };
      if (/عميل|client/.test(n)) return { text: '👥 اضغط الزر لإضافة عميل', actions: [{ label: '➕ عميل جديد', fn: () => editClient() }] };
    }

    // Distribution
    if (/توزيع|distribution|وزع/.test(n)) {
      if (/auto|تلقائي/.test(n)) {
        return { text: '🤖 جاري التوزيع التلقائي…', actions: [{ label: '⚡ تشغيل', fn: () => { navigate('distribution'); setTimeout(autoDistribute, 400); } }] };
      }
      return { text: '📋 التوزيع اليومي', actions: [{ label: 'فتح', fn: () => navigate('distribution') }] };
    }

    // Sync
    if (/sync|مزامنة|زامن/.test(n)) {
      return { text: '🔄 المزامنة اليدوية', actions: [{ label: '🔄 Sync Now', fn: () => window.__dmSyncNow && window.__dmSyncNow() }] };
    }

    // Status
    if (/حالة|status/.test(n)) {
      return { text: '📊 حالة المزامنة', actions: [{ label: '📊 عرض الحالة', fn: () => window.__dmSyncStatus && window.__dmSyncStatus() }] };
    }

    return { text: `🤔 ${t('ai_not_understood')}`, actions: [{ label: 'مساعدة', fn: () => { pushBot(respond('help')); } }] };
  }

  /* ---------- UI ---------- */
  let panelOpen = false;

  function renderMessage(msg) {
    const body = document.getElementById('dm-chat-body');
    if (!body) return;

    if (msg.role === 'user') {
      const el = document.createElement('div');
      el.className = 'dm-chat-msg user';
      el.textContent = msg.text;
      body.appendChild(el);
    } else if (msg.role === 'bot') {
      const el = document.createElement('div');
      el.className = 'dm-chat-msg bot';
      el.textContent = msg.text;
      if (msg.actions && msg.actions.length) {
        const acts = document.createElement('div');
        acts.className = 'dm-chat-actions';
        msg.actions.forEach(a => {
          const btn = document.createElement('button');
          btn.className = 'dm-chat-action';
          btn.textContent = a.label;
          btn.onclick = () => { try { a.fn(); } catch (e) { console.error(e); } };
          acts.appendChild(btn);
        });
        el.appendChild(acts);
      }
      body.appendChild(el);
    }
    body.scrollTop = body.scrollHeight;
  }

  function pushBot(response) {
    const msg = { role: 'bot', text: response.text, actions: response.actions || [] };
    history.push(msg);
    renderMessage(msg);
  }

  function sendUserMessage(text) {
    if (!text.trim()) return;
    const userMsg = { role: 'user', text };
    history.push(userMsg);
    renderMessage(userMsg);

    const body = document.getElementById('dm-chat-body');
    const typing = document.createElement('div');
    typing.className = 'dm-chat-typing';
    typing.id = 'dm-chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      const tp = document.getElementById('dm-chat-typing');
      if (tp) tp.remove();
      const response = respond(text);
      pushBot(response);
    }, 400);
  }

  function renderPanel() {
    const panel = document.createElement('div');
    panel.id = 'dm-chat-panel';
    const L = I18N[State.lang] || I18N.ar;
    panel.innerHTML = `
      <div class="dm-chat-head">
        <div class="dm-chat-avatar">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        </div>
        <div style="flex:1">
          <div class="dm-chat-title">${L.ai_chat}</div>
          <div class="dm-chat-sub">${State.lang === 'ar' ? 'اسأل أي حاجة' : 'Ask me anything'}</div>
        </div>
        <button class="dm-chat-close" id="dm-chat-close" title="${L.ai_clear}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      <div class="dm-chat-body" id="dm-chat-body"></div>

      <div class="dm-chat-quick">
        <button class="dm-chat-qchip" data-q="حجوزات اليوم">📅 ${State.lang === 'ar' ? 'حجوزات اليوم' : 'Today'}</button>
        <button class="dm-chat-qchip" data-q="كام موظف">👥 ${State.lang === 'ar' ? 'الموظفون' : 'Employees'}</button>
        <button class="dm-chat-qchip" data-q="مين اقل موظف عمل">📉 ${State.lang === 'ar' ? 'أقل عملًا' : 'Least worked'}</button>
        <button class="dm-chat-qchip" data-q="ايرادات الشهر">💰 ${State.lang === 'ar' ? 'الإيرادات' : 'Revenue'}</button>
        <button class="dm-chat-qchip" data-q="نقص اليوم">⚠️ ${State.lang === 'ar' ? 'نقص' : 'Shortages'}</button>
      </div>

      <div class="dm-chat-foot">
        <input type="text" class="dm-chat-input" id="dm-chat-input" placeholder="${L.ai_ask}" autocomplete="off">
        <button class="dm-chat-send" id="dm-chat-send">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    pushBot({ text: L.ai_hello, actions: [] });

    panel.querySelector('#dm-chat-close').onclick = () => togglePanel(false);

    const input = panel.querySelector('#dm-chat-input');
    const send = () => {
      const v = input.value;
      input.value = '';
      sendUserMessage(v);
    };
    panel.querySelector('#dm-chat-send').onclick = send;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    panel.querySelectorAll('.dm-chat-qchip').forEach(chip => {
      chip.onclick = () => sendUserMessage(chip.dataset.q);
    });

    setTimeout(() => input.focus(), 200);
  }

  function togglePanel(force) {
    const existing = document.getElementById('dm-chat-panel');
    const open = force !== undefined ? force : !panelOpen;

    if (open && !existing) {
      panelOpen = true;
      renderPanel();
    } else if (!open && existing) {
      panelOpen = false;
      existing.remove();
    }
  }

  function injectFab() {
    if (document.getElementById('dm-chat-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'dm-chat-fab';
    fab.title = (I18N[State.lang] || I18N.ar).ai_chat;
    fab.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M12 8V4H8"/>
        <rect width="16" height="12" x="4" y="8" rx="2"/>
        <path d="M2 14h2"/><path d="M20 14h2"/>
        <path d="M15 13v2"/><path d="M9 13v2"/>
      </svg>`;
    fab.onclick = () => togglePanel();
    document.body.appendChild(fab);
  }

  window.__dmAsk = function (text) {
    togglePanel(true);
    setTimeout(() => sendUserMessage(text), 100);
  };
  window.__dmChatOpen = () => togglePanel(true);
  window.__dmChatClose = () => togglePanel(false);

  waitFor(
    () => typeof State !== 'undefined' && typeof navigate === 'function',
    function () {
      injectStyles();
      injectFab();
      console.log('%c[Section 13] ✓ AI Chat ready', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 13] Try: __dmAsk("حجوزات اليوم")', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 14: Firebase Auth Integration (Optional)
   Version: 1.0.1
   - Opt-in: only activates when enabled in Settings
   - Allows linking existing custom users to Firebase Auth
   - Does NOT break existing custom auth
   - Provides secure Firestore rules template
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 14] Firebase Auth loading…', 'color:#f43f5e;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 14] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  Object.assign(I18N.ar, {
    fa_title: 'مصادقة Firebase',
    fa_enable: 'تفعيل Firebase Auth',
    fa_disable: 'تعطيل Firebase Auth',
    fa_migrate: 'ترحيل المستخدمين',
    fa_status: 'الحالة',
    fa_off: 'معطّل',
    fa_on: 'مفعّل',
    fa_migrate_desc: 'إنشاء حسابات Firebase Auth للمستخدمين الحاليين (كلمة المرور المؤقتة = admin)',
    fa_rules: 'Firestore Security Rules',
    fa_copy_rules: 'نسخ القواعد',
    fa_rules_copied: 'تم نسخ القواعد',
    fa_warning: 'تنبيه',
    fa_warning_text: 'لا تفعّل Firebase Auth قبل تنفيذ الترحيل ونشر القواعد الآمنة، وإلا سيتوقف النظام.',
    fa_signed_in: 'مسجل حاليًا',
    fa_migrating: 'جاري الترحيل…',
    fa_migrate_done: 'انتهى الترحيل',
    fa_created: 'تم إنشاء',
    fa_existing: 'موجود مسبقًا',
    fa_failed: 'فشل',
    fa_firebase_ready: 'Firebase جاهز',
    fa_firebase_not_ready: 'Firebase غير جاهز'
  });
  Object.assign(I18N.en, {
    fa_title: 'Firebase Auth',
    fa_enable: 'Enable Firebase Auth',
    fa_disable: 'Disable Firebase Auth',
    fa_migrate: 'Migrate Users',
    fa_status: 'Status',
    fa_off: 'Disabled',
    fa_on: 'Enabled',
    fa_migrate_desc: 'Create Firebase Auth accounts for existing users (temporary password = admin)',
    fa_rules: 'Firestore Security Rules',
    fa_copy_rules: 'Copy Rules',
    fa_rules_copied: 'Rules copied',
    fa_warning: 'Warning',
    fa_warning_text: 'Do NOT enable Firebase Auth before migrating users and publishing secure rules, or the system will break.',
    fa_signed_in: 'Signed in as',
    fa_migrating: 'Migrating…',
    fa_migrate_done: 'Migration complete',
    fa_created: 'Created',
    fa_existing: 'Existing',
    fa_failed: 'Failed',
    fa_firebase_ready: 'Firebase ready',
    fa_firebase_not_ready: 'Firebase not ready'
  });

  /* ---------- secure rules template ---------- */
  const SECURE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Main app state: readable/writable by any authenticated user
    match /app_state/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Per-user documents (if you split data later)
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Everything else: deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

  /* ---------- state ---------- */
  const Auth = {
    enabled: false,
    currentUser: null,
    onAuthChange: null
  };
  window.DrMediaAuth = Auth;

  function loadState() {
    try {
      Auth.enabled = localStorage.getItem('dm_fb_auth_enabled') === '1';
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem('dm_fb_auth_enabled', Auth.enabled ? '1' : '0'); } catch (e) {}
  }

  /* ---------- render Auth section in Settings ---------- */
  function renderAuthSection(container) {
    const L = I18N[State.lang] || I18N.ar;
    const statusText = Auth.enabled ? L.fa_on : L.fa_off;
    const statusColor = Auth.enabled ? '#10b981' : '#64748b';
    const fbReady = !!(window.DrMediaFB && window.DrMediaFB.ready);

    const section = document.createElement('div');
    section.className = 'card';
    section.setAttribute('data-dm-auth-section', '1');
    section.innerHTML = `
      <h4 style="margin-top:0;font-size:.95rem">
        <i data-lucide="shield-check" style="width:16px;height:16px;display:inline;color:#f43f5e"></i>
        ${L.fa_title}
      </h4>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.85rem;padding:.65rem;background:var(--surface-2);border-radius:10px">
        <span style="font-size:.85rem;font-weight:600">${L.fa_status}</span>
        <span style="padding:.25rem .65rem;border-radius:999px;font-size:.75rem;font-weight:700;background:${statusColor}20;color:${statusColor}">${statusText}</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem;padding:.65rem;background:${fbReady ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)'};border-radius:10px;font-size:.75rem">
        <span style="font-weight:600">${L.fa_firebase_ready}</span>
        <span style="color:${fbReady ? '#10b981' : '#ef4444'};font-weight:700">${fbReady ? '✓' : '✗'}</span>
      </div>

      ${Auth.currentUser ? `
        <div style="margin-top:.75rem;padding:.65rem;background:rgba(16,185,129,.08);border-radius:10px;font-size:.78rem">
          <b>${L.fa_signed_in}:</b> ${Auth.currentUser.email || Auth.currentUser.uid}
        </div>
      ` : ''}

      <div style="margin-top:.75rem;padding:.65rem;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:10px;font-size:.75rem;line-height:1.5">
        <b style="color:#f59e0b">⚠ ${L.fa_warning}:</b> ${L.fa_warning_text}
      </div>

      <div style="display:flex;gap:.5rem;margin-top:.85rem;flex-wrap:wrap">
        <button class="btn ${Auth.enabled ? 'btn-danger' : 'btn-primary'} btn-sm" id="fa-toggle" ${!fbReady ? 'disabled' : ''}>
          ${Auth.enabled ? L.fa_disable : L.fa_enable}
        </button>
        ${Auth.enabled ? `
          <button class="btn btn-ghost btn-sm" id="fa-migrate">${L.fa_migrate}</button>
        ` : ''}
        <button class="btn btn-ghost btn-sm" id="fa-rules">📋 ${L.fa_copy_rules}</button>
      </div>

      <p style="font-size:.72rem;color:var(--text-muted);margin-top:.75rem;margin-bottom:0">
        ${L.fa_migrate_desc}
      </p>
    `;

    container.appendChild(section);
    if (window.lucide) lucide.createIcons();

    /* toggle button */
    const toggleBtn = section.querySelector('#fa-toggle');
    if (toggleBtn && !toggleBtn.disabled) {
      toggleBtn.onclick = () => {
        Auth.enabled = !Auth.enabled;
        saveState();
        if (typeof showToast === 'function') {
          showToast(
            Auth.enabled ? L.fa_enable + ' ✓' : L.fa_disable + ' ✓',
            'success'
          );
        }
        navigate('settings');
      };
    }

    /* migrate button */
    const migrateBtn = section.querySelector('#fa-migrate');
    if (migrateBtn) {
      migrateBtn.onclick = () => {
        if (typeof confirmDialog === 'function') {
          confirmDialog(
            State.lang === 'ar'
              ? 'سيتم إنشاء حسابات Firebase Auth للمستخدمين الحاليين. كلمة المرور المؤقتة = admin. متابعة؟'
              : 'Firebase Auth accounts will be created for existing users. Temporary password = admin. Continue?',
            doMigration
          );
        } else {
          doMigration();
        }
      };
    }

    /* rules copy button */
    const rulesBtn = section.querySelector('#fa-rules');
    if (rulesBtn) {
      rulesBtn.onclick = () => {
        copyToClipboard(SECURE_RULES).then(() => {
          if (typeof showToast === 'function') showToast(L.fa_rules_copied + ' ✓', 'success');
        }).catch(() => {
          if (typeof showToast === 'function') showToast('Copy failed', 'error');
        });
      };
    }
  }

  /* ---------- clipboard helper ---------- */
  function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve).catch(() => {
          fallbackCopy(text) ? resolve() : reject();
        });
      } else {
        fallbackCopy(text) ? resolve() : reject();
      }
    });
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- migration ---------- */
  async function doMigration() {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) {
      if (typeof showToast === 'function') showToast(I18N[State.lang].fa_firebase_not_ready, 'error');
      return;
    }

    const authMod = window.DrMediaFB.modules.authMod;
    if (!authMod || !authMod.createUserWithEmailAndPassword) {
      if (typeof showToast === 'function') showToast('Auth module not available', 'error');
      return;
    }

    const { createUserWithEmailAndPassword } = authMod;
    const users = State.data.users || [];
    let created = 0, existing = 0, failed = 0;

    if (typeof showToast === 'function') {
      showToast(I18N[State.lang].fa_migrating, 'info');
    }

    for (const u of users) {
      if (!u.username) continue;
      const email = String(u.username).includes('@')
        ? u.username
        : (u.username + '@drmedia.local');
      const password = u.password || 'admin';

      try {
        await createUserWithEmailAndPassword(window.DrMediaFB.auth, email, password);
        created++;
        console.log('[Section 14] ✓ Created:', email);
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          existing++;
          console.log('[Section 14] ~ Exists:', email);
        } else {
          failed++;
          console.warn('[Section 14] ✗ Failed:', email, err.code);
        }
      }
    }

    const L = I18N[State.lang];
    const msg = `${L.fa_migrate_done} — ${L.fa_created}: ${created} · ${L.fa_existing}: ${existing} · ${L.fa_failed}: ${failed}`;
    if (typeof showToast === 'function') showToast(msg, 'success');
  }

  /* ---------- hook Settings page to inject Auth section ---------- */
  function hookSettingsPage() {
    if (!Pages.settings) return;
    const orig = Pages.settings;
    Pages.settings = function (el) {
      orig.apply(this, arguments);
      setTimeout(() => {
        // Look for an existing wrapper to avoid duplicates
        if (el.querySelector('[data-dm-auth-section]')) return;

        // Find the grid container (settings uses .grid-2)
        const grid = el.querySelector('.grid-2');
        if (!grid) {
          // Fallback: append at the end of the settings container
          const wrap = document.createElement('div');
          wrap.style.marginTop = '1.5rem';
          el.appendChild(wrap);
          renderAuthSection(wrap);
        } else {
          const wrap = document.createElement('div');
          grid.appendChild(wrap);
          renderAuthSection(wrap);
        }
      }, 150);
    };
  }

  /* ---------- attach auth state listener ---------- */
  function attachAuthListener() {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) return;
    const authMod = window.DrMediaFB.modules.authMod;
    if (!authMod || !authMod.onAuthStateChanged) return;

    try {
      Auth.onAuthChange = authMod.onAuthStateChanged(window.DrMediaFB.auth, (user) => {
        Auth.currentUser = user;
        console.log('[Section 14] Auth state:', user ? (user.email || user.uid) : 'signed out');
      });
    } catch (e) {
      console.warn('[Section 14] Auth listener failed:', e);
    }
  }

  /* ---------- expose helpers ---------- */
  window.__dmAuthStatus = function () {
    return {
      enabled: Auth.enabled,
      firebaseReady: !!(window.DrMediaFB && window.DrMediaFB.ready),
      currentUser: Auth.currentUser ? (Auth.currentUser.email || Auth.currentUser.uid) : null,
      usersCount: (State.data.users || []).length
    };
  };
  window.__dmAuthMigrate = doMigration;
  window.__dmAuthCopyRules = function () {
    copyToClipboard(SECURE_RULES).then(() => {
      if (typeof showToast === 'function') showToast('Rules copied ✓', 'success');
    });
  };

  /* ---------- boot ---------- */
  waitFor(
    () => window.DrMediaFB && window.DrMediaFB.ready
        && typeof Pages !== 'undefined'
        && typeof State !== 'undefined',
    function () {
      loadState();
      hookSettingsPage();
      attachAuthListener();
      console.log('%c[Section 14] ✓ Firebase Auth ready — toggle in Settings', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 14] Try: __dmAuthStatus()', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 15: Bulk Distribution (التوزيع الجماعي)
   Version: 1.0.0
   - Multi-select days from calendar
   - OR pick bookings from dropdown
   - Preview totals before running
   - Auto-distribute all selected at once
   - Show per-day results + shortages
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 15] Bulk Distribution loading…', 'color:#8b5cf6;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 15] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  Object.assign(I18N.ar, {
    bulk_dist: 'التوزيع الجماعي',
    bulk_pick_days: 'اختر الأيام',
    bulk_pick_bookings: 'أو اختر حجوزات',
    bulk_selected: 'المُختار',
    bulk_no_selection: 'لم تختر شيء بعد',
    bulk_clear: 'مسح الاختيار',
    bulk_preview: 'معاينة',
    bulk_run: 'توزيع الكل',
    bulk_running: 'جاري التوزيع…',
    bulk_done: 'تم التوزيع',
    bulk_results: 'النتائج',
    bulk_day: 'اليوم',
    bulk_bookings_count: 'حجوزات',
    bulk_needed: 'مطلوب',
    bulk_assigned: 'تم تعيين',
    bulk_missing: 'ناقص',
    bulk_total_needed: 'إجمالي المطلوب',
    bulk_total_assigned: 'إجمالي المعين',
    bulk_total_missing: 'إجمالي الناقص',
    bulk_select_hint: 'اضغط على أي يوم في التقويم لاختياره',
    bulk_skip_days_with_shortage: 'تخطي الأيام التي بها نقص',
    bulk_overwrite: 'استبدال التوزيعات الموجودة',
    bulk_confirm_msg: 'سيتم التوزيع على كل الأيام المختارة. متابعة؟'
  });
  Object.assign(I18N.en, {
    bulk_dist: 'Bulk Distribution',
    bulk_pick_days: 'Pick days',
    bulk_pick_bookings: 'Or pick bookings',
    bulk_selected: 'Selected',
    bulk_no_selection: 'Nothing selected yet',
    bulk_clear: 'Clear selection',
    bulk_preview: 'Preview',
    bulk_run: 'Distribute All',
    bulk_running: 'Distributing…',
    bulk_done: 'Distribution complete',
    bulk_results: 'Results',
    bulk_day: 'Day',
    bulk_bookings_count: 'Bookings',
    bulk_needed: 'Needed',
    bulk_assigned: 'Assigned',
    bulk_missing: 'Missing',
    bulk_total_needed: 'Total needed',
    bulk_total_assigned: 'Total assigned',
    bulk_total_missing: 'Total missing',
    bulk_select_hint: 'Click a day in the calendar to select it',
    bulk_skip_days_with_shortage: 'Skip days with shortages',
    bulk_overwrite: 'Overwrite existing distributions',
    bulk_confirm_msg: 'Distribution will run on all selected days. Continue?'
  });

  /* ---------- helpers ---------- */
  function addDaysISO(dateIso, n) {
    const d = new Date(dateIso);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function getBookingsForDate(date) {
    return (State.data.bookings || []).filter(b =>
      b.date === date && b.status !== 'cancelled'
    );
  }

  function getHallsForDate(date) {
    const bookings = getBookingsForDate(date);
    const bookedHalls = [...new Set(bookings.map(b => b.hallId))];
    if (bookedHalls.length) {
      return State.data.halls.filter(h => bookedHalls.includes(h.id));
    }
    return State.data.halls.filter(h => h.status === 'active');
  }

  /* ---------- core: distribute for one date ---------- */
  function distributeForDate(date, opts) {
    opts = opts || {};
    const { overwrite = true, skipShortage = false } = opts;

    const halls = getHallsForDate(date);
    const onLeave = new Set(
      (State.data.leaves || [])
        .filter(l => l.status === 'approved' && date >= l.fromDate && date <= l.toDate)
        .map(l => l.employeeId)
    );
    const absent = new Set(
      (State.data.attendance || [])
        .filter(a => a.date === date && a.status === 'absent')
        .map(a => a.employeeId)
    );

    // Optionally overwrite existing
    if (overwrite) {
      State.data.distributions = (State.data.distributions || []).filter(x => x.date !== date);
    }

    // Existing assignments for this day (if not overwriting)
    const existingToday = new Set(
      (State.data.distributions || [])
        .filter(x => x.date === date)
        .map(x => x.employeeId)
        .filter(Boolean)
    );

    // Score function
    function score(emp, role, hallId) {
      const empDists = (State.data.distributions || []).filter(x => x.employeeId === emp.id);
      const totalAssignments = empDists.length;

      let consecutiveDays = 0;
      for (let i = 1; i <= 7; i++) {
        const d = addDaysISO(date, -i);
        if (empDists.some(x => x.date === d && x.status === 'confirmed')) consecutiveDays++;
        else break;
      }

      const last5 = [...empDists].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      const sameHallCount = last5.filter(x => x.hallId === hallId).length;

      const lastWork = [...empDists].sort((a, b) => b.date.localeCompare(a.date))[0];
      const daysSince = lastWork
        ? Math.round((new Date(date) - new Date(lastWork.date)) / 86400000)
        : 999;

      let s = 0;
      s += totalAssignments * 10;
      s += consecutiveDays * 20;
      s += sameHallCount * 15;
      s -= Math.min(daysSince, 30) * 2;

      return s;
    }

    // Distribute per hall / per role
    const usedToday = new Set(existingToday);
    const assignments = [];
    const result = {
      date,
      halls: [],
      needed: 0,
      assigned: 0,
      missing: 0,
      shortages: []
    };

    halls.forEach(hall => {
      const hallResult = { hall, roles: [] };
      hall.requirements.forEach(req => {
        result.needed += req.count;

        const pool = (State.data.employees || [])
          .filter(e => e.status === 'active')
          .filter(e => e.role === req.role || (e.roles || []).includes(req.role))
          .filter(e => !onLeave.has(e.id) && !absent.has(e.id))
          .filter(e => !usedToday.has(e.id))
          .map(e => ({ emp: e, score: score(e, req.role, hall.id) }))
          .sort((a, b) => a.score - b.score);

        const assignedNow = [];
        for (let i = 0; i < req.count; i++) {
          if (pool[i]) {
            const chosen = pool[i].emp;
            usedToday.add(chosen.id);
            assignedNow.push(chosen);
            assignments.push({
              id: uid('d'),
              date, hallId: hall.id, employeeId: chosen.id, role: req.role,
              status: 'confirmed',
              createdAt: new Date().toISOString(),
              createdBy: State.user ? State.user.username : 'bulk'
            });
            result.assigned++;
          } else {
            result.missing++;
            result.shortages.push({ hall, role: req.role, missing: 1 });
          }
        }
        hallResult.roles.push({ role: req.role, needed: req.count, assigned: assignedNow });
      });
      result.halls.push(hallResult);
    });

    // If skipShortage and there's a shortage, don't apply
    if (skipShortage && result.missing > 0) {
      return { ...result, applied: false, reason: 'shortage' };
    }

    // Apply
    State.data.distributions = (State.data.distributions || []).concat(assignments);
    result.applied = true;
    return result;
  }

  /* ---------- bulk page state ---------- */
  const Bulk = {
    selectedDays: new Set(),
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    results: null,
    lastRunSummary: null
  };
  window.__dmBulk = Bulk;

  /* ---------- register page ---------- */
  Pages.bulkdist = function (el) {
    const y = Bulk.calendarYear;
    const m = Bulk.calendarMonth;
    const monthName = new Date(y, m, 1).toLocaleDateString(State.lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' });
    const dayNames = State.lang === 'ar'
      ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Build calendar cells
    const firstDay = new Date(y, m, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    const cells = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ day: prevDays - i, muted: true, date: new Date(y, m - 1, prevDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, date: new Date(y, m, i) });
    }
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const last = cells[cells.length - 1];
      const nd = new Date(last.date);
      nd.setDate(nd.getDate() + 1);
      cells.push({ day: nd.getDate(), muted: true, date: nd });
      if (cells.length >= 42) break;
    }

    const todayStr = todayISO();
    const selectedArr = [...Bulk.selectedDays].sort();

    // Compute preview totals
    let previewNeeded = 0;
    let previewBookings = 0;
    selectedArr.forEach(date => {
      const halls = getHallsForDate(date);
      halls.forEach(h => {
        h.requirements.forEach(r => { previewNeeded += r.count; });
      });
      previewBookings += getBookingsForDate(date).length;
    });

    // Get upcoming bookings for dropdown
    const upcomingBookings = [...(State.data.bookings || [])]
      .filter(b => b.date >= todayStr && b.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 60);

    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;align-items:center">
        <div style="display:flex;align-items:center;gap:.5rem">
          <i data-lucide="calendar-range" style="width:18px;height:18px;color:var(--primary)"></i>
          <span style="font-weight:700;font-size:.95rem">${t('bulk_dist')}</span>
        </div>
        <div style="margin-inline-start:auto;font-size:.75rem;color:var(--text-muted)">
          ${t('bulk_select_hint')}
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:1rem">
        <!-- CALENDAR -->
        <div class="card">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-icon" onclick="__dmBulkPrev()">
              <i data-lucide="${State.lang === 'ar' ? 'chevron-right' : 'chevron-left'}"></i>
            </button>
            <h3 style="margin:0;font-size:1rem;font-weight:700;flex:1;text-align:center;min-width:140px">${monthName}</h3>
            <button class="btn btn-ghost btn-icon" onclick="__dmBulkNext()">
              <i data-lucide="${State.lang === 'ar' ? 'chevron-left' : 'chevron-right'}"></i>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="__dmBulkToday()">${State.lang === 'ar' ? 'اليوم' : 'Today'}</button>
          </div>

          <div class="cal-head">${dayNames.map(d => `<div>${d}</div>`).join('')}</div>
          <div class="cal-grid">
            ${cells.map(c => {
              const iso = c.date.toISOString().slice(0, 10);
              const dayBk = getBookingsForDate(iso);
              const isToday = iso === todayStr;
              const isSelected = Bulk.selectedDays.has(iso);
              const hasBookings = dayBk.length > 0;
              return `<div class="cal-day ${c.muted ? 'empty' : ''} ${isToday ? 'today' : ''}"
                        style="${isSelected ? 'outline:3px solid var(--primary);background:rgba(124,58,237,.12)' : ''} ${hasBookings && !c.muted ? 'cursor:pointer;border-color:var(--primary)' : ''}"
                        ${!c.muted ? `onclick="__dmBulkToggle('${iso}')"` : ''}>
                <div class="num">${c.day}</div>
                ${dayBk.length ? `<span class="ev-count">${dayBk.length}</span><div class="events">${dayBk.slice(0, 4).map(() => '<div class="ev-dot"></div>').join('')}</div>` : ''}
                ${isSelected ? `<div style="position:absolute;bottom:4px;inset-inline-end:4px;color:var(--primary)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- DROPDOWN + SELECTION -->
        <div class="card">
          <h4 class="section-title" style="margin-top:0">
            <i data-lucide="list-checks"></i> ${t('bulk_pick_bookings')}
          </h4>

          <div class="field" style="margin-bottom:1rem">
            <label>${t('bookings')} — ${State.lang === 'ar' ? 'اضغط للاختيار' : 'click to select'}</label>
            <select id="bulk-bookings-dd" style="width:100%;padding:.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
              <option value="">—</option>
              ${upcomingBookings.map(b => {
                const h = State.data.halls.find(x => x.id === b.hallId);
                const hName = h ? (h.name[State.lang] || h.name.ar) : '-';
                const alreadyPicked = Bulk.selectedDays.has(b.date);
                return `<option value="${b.date}" ${alreadyPicked ? 'disabled' : ''}>
                  ${fmtDate(b.date)} — ${hName} — ${b.clientName || '-'} ${alreadyPicked ? '(مختار)' : ''}
                </option>`;
              }).join('')}
            </select>
          </div>

          <div class="field">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">
              <label style="margin:0">${t('bulk_selected')} (${selectedArr.length})</label>
              ${selectedArr.length ? `<button class="btn btn-ghost btn-sm" onclick="__dmBulkClear()" style="color:#ef4444"><i data-lucide="x" style="width:12px;height:12px"></i> ${t('bulk_clear')}</button>` : ''}
            </div>
            <div style="min-height:80px;max-height:180px;overflow-y:auto;padding:.5rem;background:var(--surface-2);border-radius:10px;display:flex;flex-wrap:wrap;gap:.35rem">
              ${selectedArr.length ? selectedArr.map(d => {
                const cnt = getBookingsForDate(d).length;
                return `<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .6rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:.75rem">
                  <b>${fmtDate(d)}</b>
                  <span style="color:var(--text-muted)">· ${cnt}</span>
                  <button onclick="event.stopPropagation();__dmBulkToggle('${d}')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0;display:flex;align-items:center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                  </button>
                </span>`;
              }).join('') : `<div style="width:100%;text-align:center;color:var(--text-muted);font-size:.8rem;padding:.5rem">${t('bulk_no_selection')}</div>`}
            </div>
          </div>

          ${selectedArr.length ? `
            <div style="margin-top:1rem;padding:.75rem;background:rgba(124,58,237,.08);border-radius:10px;font-size:.8rem">
              <div style="display:flex;justify-content:space-between;margin-bottom:.35rem">
                <span>${t('bulk_bookings_count')}:</span><b>${previewBookings}</b>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span>${t('bulk_total_needed')}:</span><b>${previewNeeded} ${State.lang === 'ar' ? 'موظف' : 'staff'}</b>
              </div>
            </div>
          ` : ''}

          <div style="margin-top:1rem">
            <label style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;cursor:pointer;margin-bottom:.5rem">
              <input type="checkbox" id="bulk-overwrite" checked style="accent-color:var(--primary)">
              ${t('bulk_overwrite')}
            </label>
            <label style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;cursor:pointer">
              <input type="checkbox" id="bulk-skip-shortage" style="accent-color:var(--primary)">
              ${t('bulk_skip_days_with_shortage')}
            </label>
          </div>

          <button class="btn btn-primary" id="bulk-run-btn" style="width:100%;margin-top:1rem" ${!selectedArr.length ? 'disabled' : ''}>
            <i data-lucide="wand-2"></i> ${t('bulk_run')} (${selectedArr.length})
          </button>
        </div>
      </div>

      ${Bulk.lastRunSummary ? `
        <div class="card" style="margin-bottom:1rem">
          <h4 class="section-title" style="margin-top:0">
            <i data-lucide="check-circle-2" style="color:#10b981"></i> ${t('bulk_done')}
          </h4>
          <div class="grid-3">
            <div>
              <div style="font-size:.72rem;color:var(--text-muted)">${t('bulk_total_needed')}</div>
              <div style="font-size:1.4rem;font-weight:800;color:#7c3aed">${Bulk.lastRunSummary.totalNeeded}</div>
            </div>
            <div>
              <div style="font-size:.72rem;color:var(--text-muted)">${t('bulk_total_assigned')}</div>
              <div style="font-size:1.4rem;font-weight:800;color:#10b981">${Bulk.lastRunSummary.totalAssigned}</div>
            </div>
            <div>
              <div style="font-size:.72rem;color:var(--text-muted)">${t('bulk_total_missing')}</div>
              <div style="font-size:1.4rem;font-weight:800;color:${Bulk.lastRunSummary.totalMissing > 0 ? '#ef4444' : '#10b981'}">${Bulk.lastRunSummary.totalMissing}</div>
            </div>
          </div>
        </div>
      ` : ''}

      ${Bulk.results && Bulk.results.length ? `
        <div class="card">
          <h4 class="section-title" style="margin-top:0">
            <i data-lucide="clipboard-list"></i> ${t('bulk_results')}
          </h4>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('bulk_day')}</th>
                  <th>${t('bulk_bookings_count')}</th>
                  <th>${t('bulk_needed')}</th>
                  <th>${t('bulk_assigned')}</th>
                  <th>${t('bulk_missing')}</th>
                  <th>${t('status')}</th>
                </tr>
              </thead>
              <tbody>
                ${Bulk.results.map(r => `
                  <tr>
                    <td><b>${fmtDate(r.date)}</b></td>
                    <td>${getBookingsForDate(r.date).length}</td>
                    <td>${r.needed}</td>
                    <td style="color:#10b981;font-weight:700">${r.assigned}</td>
                    <td style="color:${r.missing > 0 ? '#ef4444' : 'var(--text-muted)'};font-weight:700">${r.missing}</td>
                    <td>
                      ${r.applied
                        ? `<span class="badge-pill badge-green">${State.lang === 'ar' ? 'تم' : 'Applied'}</span>`
                        : `<span class="badge-pill badge-yellow">${State.lang === 'ar' ? 'تم تخطيه' : 'Skipped'}</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="navigate('distribution')">
              <i data-lucide="arrow-left"></i> ${State.lang === 'ar' ? 'فتح التوزيع اليومي' : 'Open Distribution'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="__dmBulkClearResults()">
              <i data-lucide="x"></i> ${State.lang === 'ar' ? 'مسح النتائج' : 'Clear results'}
            </button>
          </div>
        </div>
      ` : ''}
    `;

    if (window.lucide) lucide.createIcons();

    /* dropdown onchange */
    const dd = document.getElementById('bulk-bookings-dd');
    if (dd) {
      dd.onchange = (e) => {
        const date = e.target.value;
        if (date && !Bulk.selectedDays.has(date)) {
          Bulk.selectedDays.add(date);
          navigate('bulkdist');
        }
      };
    }

    /* run button */
    const runBtn = document.getElementById('bulk-run-btn');
    if (runBtn && selectedArr.length) {
      runBtn.onclick = () => {
        if (typeof confirmDialog === 'function') {
          confirmDialog(t('bulk_confirm_msg'), () => __dmBulkRun());
        } else {
          __dmBulkRun();
        }
      };
    }
  };

  /* ---------- event handlers ---------- */
  window.__dmBulkPrev = function () {
    let m = Bulk.calendarMonth - 1;
    let y = Bulk.calendarYear;
    if (m < 0) { m = 11; y--; }
    Bulk.calendarMonth = m; Bulk.calendarYear = y;
    navigate('bulkdist');
  };
  window.__dmBulkNext = function () {
    let m = Bulk.calendarMonth + 1;
    let y = Bulk.calendarYear;
    if (m > 11) { m = 0; y++; }
    Bulk.calendarMonth = m; Bulk.calendarYear = y;
    navigate('bulkdist');
  };
  window.__dmBulkToday = function () {
    const n = new Date();
    Bulk.calendarMonth = n.getMonth();
    Bulk.calendarYear = n.getFullYear();
    navigate('bulkdist');
  };
  window.__dmBulkToggle = function (date) {
    if (Bulk.selectedDays.has(date)) {
      Bulk.selectedDays.delete(date);
    } else {
      Bulk.selectedDays.add(date);
    }
    navigate('bulkdist');
  };
  window.__dmBulkClear = function () {
    Bulk.selectedDays.clear();
    Bulk.results = null;
    Bulk.lastRunSummary = null;
    navigate('bulkdist');
  };
  window.__dmBulkClearResults = function () {
    Bulk.results = null;
    Bulk.lastRunSummary = null;
    navigate('bulkdist');
  };

  window.__dmBulkRun = function () {
    const days = [...Bulk.selectedDays].sort();
    if (!days.length) {
      if (typeof showToast === 'function') showToast(t('bulk_no_selection'), 'warn');
      return;
    }

    const overwrite = document.getElementById('bulk-overwrite')?.checked ?? true;
    const skipShortage = document.getElementById('bulk-skip-shortage')?.checked ?? false;

    if (typeof showToast === 'function') showToast(t('bulk_running'), 'info');

    const results = [];
    let totalNeeded = 0;
    let totalAssigned = 0;
    let totalMissing = 0;

    days.forEach(date => {
      try {
        const r = distributeForDate(date, { overwrite, skipShortage });
        results.push(r);
        totalNeeded += r.needed;
        totalAssigned += r.assigned;
        totalMissing += r.missing;
      } catch (err) {
        console.error('[Section 15] Failed for', date, err);
        results.push({
          date,
          needed: 0, assigned: 0, missing: 0,
          halls: [], shortages: [],
          applied: false,
          reason: 'error'
        });
      }
    });

    Bulk.results = results;
    Bulk.lastRunSummary = { totalNeeded, totalAssigned, totalMissing };

    // Log + save once
    try {
      if (typeof logActivity === 'function') {
        logActivity('bulk-distribute', 'distribution', null, null, {
          days: days.length,
          totalNeeded, totalAssigned, totalMissing
        });
      }
    } catch (e) {}

    // Persist via saveData (this also triggers Firebase sync if live)
    try { if (typeof saveData === 'function') saveData(); } catch (e) {}

    if (typeof showToast === 'function') {
      showToast(
        `${t('bulk_done')} — ${totalAssigned}/${totalNeeded}`,
        totalMissing > 0 ? 'warn' : 'success'
      );
    }

    // Clear selection for next round (keep results)
    Bulk.selectedDays.clear();
    navigate('bulkdist');
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'bulkdist')) {
      const distIdx = ops.items.findIndex(i => i.id === 'distribution');
      if (distIdx >= 0) {
        ops.items.splice(distIdx + 1, 0, { id: 'bulkdist', icon: 'calendar-range', label: 'bulk_dist' });
      } else {
        ops.items.push({ id: 'bulkdist', icon: 'calendar-range', label: 'bulk_dist' });
      }
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- boot ---------- */
  waitFor(
    () => typeof State !== 'undefined'
        && typeof Pages !== 'undefined'
        && typeof navigate === 'function'
        && typeof saveData === 'function',
    function () {
      registerNav();
      console.log('%c[Section 15] ✓ Bulk Distribution ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 16: Distribution Log (سجل التوزيعات)
   Version: 1.0.0
   - View all distributed employees (flat list)
   - Filter by date range / single date / hall / employee / role
   - Professional print sheet
   - Export CSV
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 16] Distribution Log loading…', 'color:#0ea5e9;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 16] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  Object.assign(I18N.ar, {
    dist_log: 'سجل التوزيعات',
    dl_date_from: 'من تاريخ',
    dl_date_to: 'إلى تاريخ',
    dl_single_date: 'تاريخ محدد',
    dl_all_dates: 'كل التواريخ',
    dl_filter_hall: 'القاعة',
    dl_filter_employee: 'الموظف',
    dl_filter_role: 'الدور',
    dl_all: 'الكل',
    dl_today: 'اليوم',
    dl_this_week: 'هذا الأسبوع',
    dl_this_month: 'هذا الشهر',
    dl_print: 'طباعة',
    dl_export: 'تصدير',
    dl_total_records: 'إجمالي السجلات',
    dl_unique_employees: 'عدد الموظفين',
    dl_total_days: 'عدد الأيام',
    dl_no_data: 'لا توجد بيانات في هذه الفترة',
    dl_print_title: 'كشف الموظفين الموزعين',
    dl_print_subtitle: 'Distributed Staff Report',
    dl_employee: 'الموظف',
    dl_role: 'الدور',
    dl_hall: 'القاعة',
    dl_date: 'التاريخ',
    dl_day: 'اليوم',
    dl_status: 'الحالة',
    dl_day_ar: 'اليوم',
    dl_clear_filters: 'مسح الفلاتر',
    dl_print_summary: 'ملخص',
    dl_per_employee: 'لكل موظف',
    dl_per_hall: 'لكل قاعة',
    dl_per_role: 'لكل دور',
    dl_include_summary: 'إضافة ملخص للطباعة',
    dl_include_per_employee: 'إضافة تفصيل لكل موظف',
    dl_created_by: 'أنشأه',
    dl_manual: 'يدوي'
  });
  Object.assign(I18N.en, {
    dist_log: 'Distribution Log',
    dl_date_from: 'From date',
    dl_date_to: 'To date',
    dl_single_date: 'Single date',
    dl_all_dates: 'All dates',
    dl_filter_hall: 'Hall',
    dl_filter_employee: 'Employee',
    dl_filter_role: 'Role',
    dl_all: 'All',
    dl_today: 'Today',
    dl_this_week: 'This Week',
    dl_this_month: 'This Month',
    dl_print: 'Print',
    dl_export: 'Export',
    dl_total_records: 'Total records',
    dl_unique_employees: 'Employees',
    dl_total_days: 'Days',
    dl_no_data: 'No data in this range',
    dl_print_title: 'Distributed Staff Report',
    dl_print_subtitle: 'Distribution Sheet',
    dl_employee: 'Employee',
    dl_role: 'Role',
    dl_hall: 'Hall',
    dl_date: 'Date',
    dl_day: 'Day',
    dl_status: 'Status',
    dl_day_ar: 'Day',
    dl_clear_filters: 'Clear filters',
    dl_print_summary: 'Summary',
    dl_per_employee: 'Per Employee',
    dl_per_hall: 'Per Hall',
    dl_per_role: 'Per Role',
    dl_include_summary: 'Include summary in print',
    dl_include_per_employee: 'Include per-employee breakdown',
    dl_created_by: 'Created by',
    dl_manual: 'Manual'
  });

  /* ---------- state ---------- */
  const DL = {
    mode: 'range',          // 'range' | 'single'
    from: addDaysISO(todayISO(), -30),
    to: todayISO(),
    singleDate: todayISO(),
    hallId: 'all',
    employeeId: 'all',
    role: 'all',
    printIncludeSummary: true,
    printIncludePerEmployee: true
  };
  window.__dmDL = DL;

  function addDaysISO(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  }

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  function getDayNameAr(dateStr) {
    if (!dateStr) return '';
    const days = State.lang === 'ar'
      ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr).getDay()];
  }

  function getFiltered() {
    let list = [...(State.data.distributions || [])];

    // Date filter
    if (DL.mode === 'single') {
      list = list.filter(x => x.date === DL.singleDate);
    } else {
      list = list.filter(x => x.date >= DL.from && x.date <= DL.to);
    }

    // Hall filter
    if (DL.hallId !== 'all') {
      list = list.filter(x => x.hallId === DL.hallId);
    }

    // Employee filter
    if (DL.employeeId !== 'all') {
      list = list.filter(x => x.employeeId === DL.employeeId);
    }

    // Role filter
    if (DL.role !== 'all') {
      list = list.filter(x => x.role === DL.role);
    }

    // Sort by date desc, then by hall
    list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (a.hallId || '').localeCompare(b.hallId || '');
    });

    return list;
  }

  /* ---------- register page ---------- */
  Pages.distlog = function (el) {
    const records = getFiltered();
    const uniqueEmployees = new Set(records.map(r => r.employeeId).filter(Boolean)).size;
    const uniqueDays = new Set(records.map(r => r.date)).size;
    const roles = [...new Set((State.data.employees || []).flatMap(e => e.roles || [e.role]))].filter(Boolean);

    el.innerHTML = `
      <!-- FILTERS -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <i data-lucide="filter" style="width:18px;height:18px;color:var(--primary)"></i>
          <span style="font-weight:700;font-size:.95rem">${t('dist_log')}</span>
          <div style="margin-inline-start:auto;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="__dmDLClearFilters()">
              <i data-lucide="x"></i> ${t('dl_clear_filters')}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="__dmDLExport()">
              <i data-lucide="download"></i> ${t('dl_export')}
            </button>
            <button class="btn btn-primary btn-sm" onclick="__dmDLPrint()">
              <i data-lucide="printer"></i> ${t('dl_print')}
            </button>
          </div>
        </div>

        <!-- Mode selector -->
        <div class="tabs" style="margin:0 0 1rem;border-bottom:1px solid var(--border)">
          <div class="tab ${DL.mode === 'range' ? 'active' : ''}" onclick="__dmDLSetMode('range')">
            <i data-lucide="calendar-range" style="width:12px;height:12px;display:inline;vertical-align:-1px"></i>
            ${t('dl_date_from')} → ${t('dl_date_to')}
          </div>
          <div class="tab ${DL.mode === 'single' ? 'active' : ''}" onclick="__dmDLSetMode('single')">
            <i data-lucide="calendar" style="width:12px;height:12px;display:inline;vertical-align:-1px"></i>
            ${t('dl_single_date')}
          </div>
        </div>

        <!-- Date inputs -->
        ${DL.mode === 'range' ? `
          <div class="form-row" style="margin-bottom:1rem">
            <div class="field"><label>${t('dl_date_from')}</label>
              <input type="date" id="dl-from" value="${DL.from}">
            </div>
            <div class="field"><label>${t('dl_date_to')}</label>
              <input type="date" id="dl-to" value="${DL.to}">
            </div>
          </div>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:1rem">
            <button class="btn btn-ghost btn-sm" onclick="__dmDLQuick('today')">${t('dl_today')}</button>
            <button class="btn btn-ghost btn-sm" onclick="__dmDLQuick('week')">${t('dl_this_week')}</button>
            <button class="btn btn-ghost btn-sm" onclick="__dmDLQuick('month')">${t('dl_this_month')}</button>
          </div>
        ` : `
          <div class="form-row" style="margin-bottom:1rem">
            <div class="field"><label>${t('dl_single_date')}</label>
              <input type="date" id="dl-single" value="${DL.singleDate}">
            </div>
          </div>
        `}

        <div class="form-row">
          <div class="field"><label>${t('dl_filter_hall')}</label>
            <select id="dl-hall">
              <option value="all" ${DL.hallId === 'all' ? 'selected' : ''}>${t('dl_all')}</option>
              ${State.data.halls.map(h => `<option value="${h.id}" ${DL.hallId === h.id ? 'selected' : ''}>${h.name[State.lang] || h.name.ar}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>${t('dl_filter_employee')}</label>
            <select id="dl-emp">
              <option value="all" ${DL.employeeId === 'all' ? 'selected' : ''}>${t('dl_all')}</option>
              ${State.data.employees.map(e => `<option value="${e.id}" ${DL.employeeId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>${t('dl_filter_role')}</label>
            <select id="dl-role">
              <option value="all" ${DL.role === 'all' ? 'selected' : ''}>${t('dl_all')}</option>
              ${roles.map(r => `<option value="${r}" ${DL.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;gap:1rem;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;cursor:pointer">
            <input type="checkbox" id="dl-inc-summary" ${DL.printIncludeSummary ? 'checked' : ''} style="accent-color:var(--primary)">
            ${t('dl_include_summary')}
          </label>
          <label style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;cursor:pointer">
            <input type="checkbox" id="dl-inc-employee" ${DL.printIncludePerEmployee ? 'checked' : ''} style="accent-color:var(--primary)">
            ${t('dl_include_per_employee')}
          </label>
        </div>
      </div>

      <!-- STATS -->
      <div class="grid-stats" style="margin-bottom:1rem">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(124,58,237,.1);color:#7c3aed"><i data-lucide="list"></i></div>
          <div class="stat-body">
            <div class="label">${t('dl_total_records')}</div>
            <div class="value">${records.length}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,.1);color:#10b981"><i data-lucide="users"></i></div>
          <div class="stat-body">
            <div class="label">${t('dl_unique_employees')}</div>
            <div class="value">${uniqueEmployees}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(245,158,11,.1);color:#f59e0b"><i data-lucide="calendar-days"></i></div>
          <div class="stat-body">
            <div class="label">${t('dl_total_days')}</div>
            <div class="value">${uniqueDays}</div>
          </div>
        </div>
      </div>

      <!-- TABLE -->
      <div class="card">
        ${records.length ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('dl_date')}</th>
                  <th>${t('dl_day')}</th>
                  <th>${t('dl_employee')}</th>
                  <th>${t('dl_role')}</th>
                  <th>${t('dl_hall')}</th>
                  <th>${t('dl_status')}</th>
                  <th>${t('dl_created_by')}</th>
                </tr>
              </thead>
              <tbody>
                ${records.map(r => {
                  const emp = State.data.employees.find(x => x.id === r.employeeId);
                  const statusColor = { confirmed: 'green', pending: 'yellow', missing: 'red' }[r.status] || 'gray';
                  return `<tr>
                    <td><b>${fmtDate(r.date)}</b></td>
                    <td>${getDayNameAr(r.date)}</td>
                    <td>
                      <div class="cell-user">
                        <div class="av">${initials(emp?.name || r.manualName)}</div>
                        <div>
                          <div style="font-weight:600">${emp?.name || r.manualName || '-'}</div>
                          <div style="font-size:.7rem;color:var(--text-muted)">${emp?.code || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="badge-pill badge-purple">${r.role}</span></td>
                    <td>${hallName(r.hallId)}</td>
                    <td><span class="badge-pill badge-${statusColor}">${t(r.status) || r.status}</span></td>
                    <td style="font-size:.75rem;color:var(--text-muted)">${r.createdBy === 'auto' || r.createdBy === 'bulk' ? (r.createdBy === 'auto' ? '⚡ Auto' : '📦 Bulk') : (r.createdBy || '-')}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="padding:3rem 1rem">
            <i data-lucide="inbox"></i>
            <p>${t('dl_no_data')}</p>
          </div>
        `}
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    /* attach filter listeners */
    const fromEl = document.getElementById('dl-from');
    const toEl = document.getElementById('dl-to');
    const singleEl = document.getElementById('dl-single');
    const hallEl = document.getElementById('dl-hall');
    const empEl = document.getElementById('dl-emp');
    const roleEl = document.getElementById('dl-role');
    const incSumEl = document.getElementById('dl-inc-summary');
    const incEmpEl = document.getElementById('dl-inc-employee');

    if (fromEl) fromEl.onchange = (e) => { DL.from = e.target.value; navigate('distlog'); };
    if (toEl) toEl.onchange = (e) => { DL.to = e.target.value; navigate('distlog'); };
    if (singleEl) singleEl.onchange = (e) => { DL.singleDate = e.target.value; navigate('distlog'); };
    if (hallEl) hallEl.onchange = (e) => { DL.hallId = e.target.value; navigate('distlog'); };
    if (empEl) empEl.onchange = (e) => { DL.employeeId = e.target.value; navigate('distlog'); };
    if (roleEl) roleEl.onchange = (e) => { DL.role = e.target.value; navigate('distlog'); };
    if (incSumEl) incSumEl.onchange = (e) => { DL.printIncludeSummary = e.target.checked; };
    if (incEmpEl) incEmpEl.onchange = (e) => { DL.printIncludePerEmployee = e.target.checked; };
  };

  /* ---------- handlers ---------- */
  window.__dmDLSetMode = function (mode) {
    DL.mode = mode;
    navigate('distlog');
  };

  window.__dmDLClearFilters = function () {
    DL.mode = 'range';
    DL.from = addDaysISO(todayISO(), -30);
    DL.to = todayISO();
    DL.singleDate = todayISO();
    DL.hallId = 'all';
    DL.employeeId = 'all';
    DL.role = 'all';
    navigate('distlog');
  };

  window.__dmDLQuick = function (range) {
    const today = new Date();
    if (range === 'today') {
      DL.from = today.toISOString().slice(0, 10);
      DL.to = DL.from;
    } else if (range === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      DL.from = d.toISOString().slice(0, 10);
      DL.to = today.toISOString().slice(0, 10);
    } else if (range === 'month') {
      DL.from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      DL.to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    }
    navigate('distlog');
  };

  /* ---------- print ---------- */
  window.__dmDLPrint = function () {
    const records = getFiltered();
    if (!records.length) {
      if (typeof showToast === 'function') showToast(t('dl_no_data'), 'warn');
      return;
    }

    const ar = State.lang === 'ar';
    const L = {
      title: ar ? 'كشف الموظفين الموزعين' : 'Distributed Staff Report',
      period: ar ? 'الفترة' : 'Period',
      from: ar ? 'من' : 'From',
      to: ar ? 'إلى' : 'To',
      date: ar ? 'التاريخ' : 'Date',
      day: ar ? 'اليوم' : 'Day',
      employee: ar ? 'الموظف' : 'Employee',
      code: ar ? 'الكود' : 'Code',
      role: ar ? 'الدور' : 'Role',
      hall: ar ? 'القاعة' : 'Hall',
      status: ar ? 'الحالة' : 'Status',
      totalRecords: ar ? 'إجمالي السجلات' : 'Total records',
      uniqueEmployees: ar ? 'عدد الموظفين' : 'Employees',
      uniqueDays: ar ? 'عدد الأيام' : 'Days',
      summary: ar ? 'الملخص' : 'Summary',
      perEmployee: ar ? 'التوزيع لكل موظف' : 'Per-Employee Breakdown',
      count: ar ? 'العدد' : 'Count',
      total: ar ? 'الإجمالي' : 'Total'
    };

    const periodLabel = DL.mode === 'single'
      ? `${L.date}: ${fmtDate(DL.singleDate)}`
      : `${L.from} ${fmtDate(DL.from)} — ${L.to} ${fmtDate(DL.to)}`;

    // Group per employee
    const perEmployee = {};
    records.forEach(r => {
      const emp = State.data.employees.find(x => x.id === r.employeeId);
      const name = emp ? emp.name : (r.manualName || '—');
      perEmployee[name] = perEmployee[name] || { count: 0, days: new Set(), roles: {} };
      perEmployee[name].count++;
      perEmployee[name].days.add(r.date);
      perEmployee[name].roles[r.role] = (perEmployee[name].roles[r.role] || 0) + 1;
    });

    const uniqueEmps = Object.keys(perEmployee).length;
    const uniqueDays = new Set(records.map(r => r.date)).size;

    // HTML body
    const statusBadge = (s) => {
      const colors = { confirmed: '#10b981', pending: '#f59e0b', missing: '#ef4444' };
      const bg = colors[s] || '#64748b';
      return `<span style="display:inline-block;padding:.15rem .5rem;border-radius:999px;font-size:.7rem;font-weight:700;background:${bg}20;color:${bg}">${s || '-'}</span>`;
    };

    let html = `
      <div class="title">${L.title}</div>

      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.75rem;padding:.75rem;background:#f9fafb;border-radius:10px;margin-bottom:1.5rem;font-size:.85rem">
        <div><b>${L.period}:</b> ${periodLabel}</div>
        ${DL.hallId !== 'all' ? `<div><b>${ar ? 'القاعة' : 'Hall'}:</b> ${hallName(DL.hallId)}</div>` : ''}
        ${DL.employeeId !== 'all' ? `<div><b>${ar ? 'الموظف' : 'Employee'}:</b> ${empName(DL.employeeId)}</div>` : ''}
        ${DL.role !== 'all' ? `<div><b>${ar ? 'الدور' : 'Role'}:</b> ${DL.role}</div>` : ''}
      </div>
    `;

    // Summary
    if (DL.printIncludeSummary) {
      html += `
        <div class="title">${L.summary}</div>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">${L.totalRecords}</div><div class="kpi-value">${records.length}</div></div>
          <div class="kpi"><div class="kpi-label">${L.uniqueEmployees}</div><div class="kpi-value">${uniqueEmps}</div></div>
          <div class="kpi"><div class="kpi-label">${L.uniqueDays}</div><div class="kpi-value">${uniqueDays}</div></div>
        </div>
      `;
    }

    // Main table
    html += `
      <div class="title">${ar ? 'التفاصيل' : 'Details'}</div>
      <table>
        <thead>
          <tr>
            <th>${L.date}</th>
            <th>${L.day}</th>
            <th>${L.employee}</th>
            <th>${L.role}</th>
            <th>${L.hall}</th>
            <th>${L.status}</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => {
            const emp = State.data.employees.find(x => x.id === r.employeeId);
            return `<tr>
              <td>${fmtDate(r.date)}</td>
              <td>${getDayNameAr(r.date)}</td>
              <td><b>${emp?.name || r.manualName || '-'}</b></td>
              <td>${r.role}</td>
              <td>${hallName(r.hallId)}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    // Per-employee breakdown
    if (DL.printIncludePerEmployee) {
      html += `
        <div class="title" style="margin-top:2rem">${L.perEmployee}</div>
        <table>
          <thead>
            <tr>
              <th>${L.employee}</th>
              <th>${L.count}</th>
              <th>${ar ? 'الأيام' : 'Days'}</th>
              <th>${ar ? 'الأدوار' : 'Roles'}</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(perEmployee)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([name, info]) => `
                <tr>
                  <td><b>${name}</b></td>
                  <td>${info.count}</td>
                  <td>${info.days.size}</td>
                  <td>${Object.entries(info.roles).map(([r, c]) => `${r}: ${c}`).join(' · ')}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      `;
    }

    // Print via Section 12's helper if available, else fallback
    if (typeof window.__dmDailySheetPDF === 'function') {
      // Use the same print infrastructure
    }

    // Custom print window
    printCustom(ar ? L.title : 'Report', html);
  };

  function printCustom(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=1000,height=1000');
    if (!w) {
      if (typeof showToast === 'function') showToast(State.lang === 'ar' ? 'الرجاء السماح بالنوافذ المنبثقة' : 'Please allow popups', 'warn');
      return;
    }

    const ar = State.lang === 'ar';
    const styles = `
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-family:'Cairo','Inter',system-ui,sans-serif;margin:0;padding:2rem;color:#0f172a;background:#fff;direction:${ar ? 'rtl' : 'ltr'}}
      .header{display:flex;align-items:center;gap:1rem;padding-bottom:1rem;border-bottom:3px solid #7c3aed;margin-bottom:1.5rem}
      .logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem}
      .brand h1{margin:0;font-size:1.35rem;font-weight:800}
      .brand p{margin:0;font-size:.75rem;color:#64748b}
      .brand span{color:#7c3aed}
      .title{font-size:1.1rem;font-weight:700;margin:1.5rem 0 .75rem;padding-bottom:.4rem;border-bottom:2px solid #e5e7eb}
      .title:first-child{margin-top:0}
      table{width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:1rem}
      th,td{padding:.5rem .65rem;text-align:${ar ? 'right' : 'left'};border-bottom:1px solid #e5e7eb}
      th{background:#f3f4f6;font-weight:700;color:#374151;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}
      tbody tr:nth-child(even){background:#fafafa}
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem}
      .kpi{padding:.75rem;background:#f9fafb;border-radius:10px;text-align:center}
      .kpi-label{font-size:.7rem;color:#64748b;margin-bottom:.25rem}
      .kpi-value{font-size:1.25rem;font-weight:800;color:#7c3aed}
      .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #e5e7eb;font-size:.7rem;color:#94a3b8;text-align:center}
      @media print{
        body{padding:1rem}
        .page-break{page-break-before:always}
        tbody tr{page-break-inside:avoid}
      }
    `;

    w.document.write(`<!DOCTYPE html>
<html lang="${State.lang}" dir="${ar ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head>
<body>
  <div class="header">
    <div class="logo">D</div>
    <div class="brand">
      <h1>Dr Media <span>Pro</span></h1>
      <p>${(State.data.settings.companyName || 'Professional Video Production')} · ${State.data.settings.phone || ''}</p>
    </div>
  </div>
  ${bodyHtml}
  <div class="footer">
    ${State.data.settings.companyName || 'Dr Media Pro'} · ${State.data.settings.address || ''} · ${new Date().toLocaleString(ar ? 'ar-EG' : 'en-GB')}
  </div>
  <script>setTimeout(function(){window.print();},400);<\/script>
</body></html>`);
    w.document.close();
  }

  /* ---------- export CSV ---------- */
  window.__dmDLExport = function () {
    const records = getFiltered();
    if (!records.length) {
      if (typeof showToast === 'function') showToast(t('dl_no_data'), 'warn');
      return;
    }

    const headers = ['Date', 'Day', 'Employee', 'Code', 'Role', 'Hall', 'Status', 'CreatedBy'];
    const rows = records.map(r => {
      const emp = State.data.employees.find(x => x.id === r.employeeId);
      return [
        r.date,
        getDayNameAr(r.date),
        emp?.name || r.manualName || '',
        emp?.code || '',
        r.role,
        hallName(r.hallId),
        r.status,
        r.createdBy || ''
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'distribution-log-' + todayISO() + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') showToast('Exported ✓', 'success');
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'distlog')) {
      // Insert after distribution/bulkdist
      const idx = ops.items.findIndex(i => i.id === 'bulkdist');
      const insertAt = idx >= 0 ? idx + 1 : ops.items.findIndex(i => i.id === 'distribution') + 1;
      ops.items.splice(insertAt, 0, { id: 'distlog', icon: 'scroll-text', label: 'dist_log' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- boot ---------- */
  waitFor(
    () => typeof State !== 'undefined'
        && typeof Pages !== 'undefined'
        && typeof navigate === 'function',
    function () {
      registerNav();
      console.log('%c[Section 16] ✓ Distribution Log ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 17: Distribution by Hall
   Version: 4.0.0 (MONTHLY 2-PAGE PRINT)
   ---------------------------------------------------------
   - عرض تفاعلي حسب القاعة
   - طباعة تفصيلية (كل يوم لوحده)
   - 🆕 طباعة الشهر كامل في ورقتين A4 (2 columns)
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 17] Distribution by Hall loading…', 'color:#22c55e;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 17] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  Object.assign(I18N.ar, {
    dist_by_hall: 'توزيع حسب القاعة',
    dbh_from: 'من تاريخ',
    dbh_to: 'إلى تاريخ',
    dbh_hall: 'القاعة',
    dbh_role: 'الدور',
    dbh_employee: 'الموظف',
    dbh_all: 'الكل',
    dbh_today: 'اليوم',
    dbh_week: 'هذا الأسبوع',
    dbh_month: 'هذا الشهر',
    dbh_print: 'طباعة تفصيلية',
    dbh_print_month: 'طباعة الشهر (ورقتين)',
    dbh_export: 'تصدير CSV',
    dbh_clear: 'مسح الفلاتر',
    dbh_records: 'إجمالي التعيينات',
    dbh_halls: 'عدد القاعات',
    dbh_employees: 'عدد الموظفين',
    dbh_days: 'عدد الأيام',
    dbh_no_data: 'لا توجد توزيعات في هذه الفترة',
    dbh_no_staff: 'لا يوجد موظفون معيّنون',
    dbh_client: 'العميل',
    dbh_time: 'الوقت',
    dbh_signature: 'التوقيع',
    dbh_print_hint: 'يُرجى التوقيع أمام الاسم عند الاستلام والتسليم',
    dbh_month_title: 'كشف التوزيع الشهري',
    dbh_page: 'صفحة',
    dbh_of: 'من'
  });
  Object.assign(I18N.en, {
    dist_by_hall: 'Distribution by Hall',
    dbh_from: 'From date',
    dbh_to: 'To date',
    dbh_hall: 'Hall',
    dbh_role: 'Role',
    dbh_employee: 'Employee',
    dbh_all: 'All',
    dbh_today: 'Today',
    dbh_week: 'This Week',
    dbh_month: 'This Month',
    dbh_print: 'Detailed Print',
    dbh_print_month: 'Print Month (2 pages)',
    dbh_export: 'Export CSV',
    dbh_clear: 'Clear filters',
    dbh_records: 'Assignments',
    dbh_halls: 'Halls',
    dbh_employees: 'Employees',
    dbh_days: 'Days',
    dbh_no_data: 'No distributions in this range',
    dbh_no_staff: 'No employees assigned',
    dbh_client: 'Client',
    dbh_time: 'Time',
    dbh_signature: 'Sign',
    dbh_print_hint: 'Please sign next to your name upon receipt',
    dbh_month_title: 'Monthly Distribution Sheet',
    dbh_page: 'Page',
    dbh_of: 'of'
  });

  /* ---------- state ---------- */
  const State17 = {
    from: addDaysISO(todayISO(), -7),
    to: todayISO(),
    hallId: 'all',
    role: 'all',
    employeeId: 'all'
  };
  window.__dmDBH = State17;

  function addDaysISO(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  }

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }
  function hallCode(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.code || '') : '';
  }
  function hallShortName(id) {
    const h = State.data.halls.find(x => x.id === id);
    if (!h) return '-';
    // Try to use short name (last word) for compact print
    const full = h.name[State.lang] || h.name.ar;
    return full.length > 12 ? full.slice(0, 12) + '…' : full;
  }
  function getDayName(dateStr) {
    const days = State.lang === 'ar'
      ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(dateStr).getDay()];
  }
  function getDayShort(dateStr) {
    const days = State.lang === 'ar'
      ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr).getDay()];
  }
  function roleOrder(role) {
    return { Director: 1, Photographer: 2, Crane: 3, Supervisor: 4, Assistant: 5 }[role] || 99;
  }
  function roleShort(role) {
    return {
      Director: State.lang === 'ar' ? 'مخرج' : 'Dir',
      Photographer: State.lang === 'ar' ? 'مصور' : 'Photo',
      Crane: State.lang === 'ar' ? 'كرين' : 'Crane',
      Supervisor: State.lang === 'ar' ? 'مشرف' : 'Sup',
      Assistant: State.lang === 'ar' ? 'مساعد' : 'Asst'
    }[role] || role;
  }

  /* ---------- filter + group ---------- */
  function getFiltered() {
    let list = [...(State.data.distributions || [])];
    list = list.filter(x => x.date >= State17.from && x.date <= State17.to);
    if (State17.hallId !== 'all') list = list.filter(x => x.hallId === State17.hallId);
    if (State17.role !== 'all') list = list.filter(x => x.role === State17.role);
    if (State17.employeeId !== 'all') list = list.filter(x => x.employeeId === State17.employeeId);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  function buildGrouped(records) {
    const grouped = {};
    records.forEach(r => {
      grouped[r.date] = grouped[r.date] || {};
      grouped[r.date][r.hallId] = grouped[r.date][r.hallId] || { hallId: r.hallId, employees: [] };
      grouped[r.date][r.hallId].employees.push(r);
    });
    Object.keys(grouped).forEach(date => {
      const dayBookings = (State.data.bookings || []).filter(b => b.date === date && b.status !== 'cancelled');
      Object.keys(grouped[date]).forEach(hallId => {
        grouped[date][hallId].booking = dayBookings.find(b => b.hallId === hallId) || null;
      });
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const result = {};
    sortedDates.forEach(d => {
      const halls = Object.keys(grouped[d]).sort((a, b) => hallName(a).localeCompare(hallName(b)));
      result[d] = {};
      halls.forEach(h => { result[d][h] = grouped[d][h]; });
    });
    return result;
  }

  /* ---------- register page ---------- */
  Pages.byhall = function (el) {
    const records = getFiltered();
    const grouped = buildGrouped(records);
    const uniqueHalls = new Set(records.map(r => r.hallId)).size;
    const uniqueEmps = new Set(records.map(r => r.employeeId).filter(Boolean)).size;
    const uniqueDays = new Set(records.map(r => r.date)).size;

    const roleSet = new Set();
    (State.data.employees || []).forEach(e => {
      if (e.role) roleSet.add(e.role);
      (e.roles || []).forEach(r => roleSet.add(r));
    });
    const rolesList = [...roleSet].sort();
    const dateKeys = Object.keys(grouped);

    el.innerHTML = `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <i data-lucide="layout-grid" style="width:20px;height:20px;color:var(--primary)"></i>
          <span style="font-weight:700;font-size:1rem">${t('dist_by_hall')}</span>
          <div style="margin-inline-start:auto;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="__dmDBHClear()"><i data-lucide="x"></i> ${t('dbh_clear')}</button>
            <button class="btn btn-ghost btn-sm" onclick="__dmDBHExport()"><i data-lucide="download"></i> ${t('dbh_export')}</button>
            <button class="btn btn-ghost btn-sm" onclick="__dmDBHPrint()"><i data-lucide="printer"></i> ${t('dbh_print')}</button>
            <button class="btn btn-primary btn-sm" onclick="__dmDBHPrintMonth()"><i data-lucide="calendar-range"></i> ${t('dbh_print_month')}</button>
          </div>
        </div>

        <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:1rem">
          <button class="btn btn-ghost btn-sm" onclick="__dmDBHQuick('today')">${t('dbh_today')}</button>
          <button class="btn btn-ghost btn-sm" onclick="__dmDBHQuick('week')">${t('dbh_week')}</button>
          <button class="btn btn-ghost btn-sm" onclick="__dmDBHQuick('month')">${t('dbh_month')}</button>
        </div>

        <div class="form-row">
          <div class="field"><label>${t('dbh_from')}</label><input type="date" id="dbh-from" value="${State17.from}"></div>
          <div class="field"><label>${t('dbh_to')}</label><input type="date" id="dbh-to" value="${State17.to}"></div>
          <div class="field"><label>${t('dbh_hall')}</label>
            <select id="dbh-hall">
              <option value="all" ${State17.hallId === 'all' ? 'selected' : ''}>${t('dbh_all')}</option>
              ${State.data.halls.map(h => `<option value="${h.id}" ${State17.hallId === h.id ? 'selected' : ''}>${h.name[State.lang] || h.name.ar}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>${t('dbh_role')}</label>
            <select id="dbh-role">
              <option value="all" ${State17.role === 'all' ? 'selected' : ''}>${t('dbh_all')}</option>
              ${rolesList.map(r => `<option value="${r}" ${State17.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>${t('dbh_employee')}</label>
            <select id="dbh-emp">
              <option value="all" ${State17.employeeId === 'all' ? 'selected' : ''}>${t('dbh_all')}</option>
              ${State.data.employees.map(e => `<option value="${e.id}" ${State17.employeeId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="grid-stats" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-icon" style="background:rgba(124,58,237,.1);color:#7c3aed"><i data-lucide="list-checks"></i></div><div class="stat-body"><div class="label">${t('dbh_records')}</div><div class="value">${records.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(16,185,129,.1);color:#10b981"><i data-lucide="users"></i></div><div class="stat-body"><div class="label">${t('dbh_employees')}</div><div class="value">${uniqueEmps}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,.1);color:#f59e0b"><i data-lucide="building-2"></i></div><div class="stat-body"><div class="label">${t('dbh_halls')}</div><div class="value">${uniqueHalls}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(6,182,212,.1);color:#06b6d4"><i data-lucide="calendar-days"></i></div><div class="stat-body"><div class="label">${t('dbh_days')}</div><div class="value">${uniqueDays}</div></div></div>
      </div>

      ${!dateKeys.length ? `
        <div class="card">
          <div class="empty-state" style="padding:3rem 1rem"><i data-lucide="calendar-x"></i><p>${t('dbh_no_data')}</p></div>
        </div>
      ` : dateKeys.map(date => {
        const dayHalls = grouped[date];
        const hallIds = Object.keys(dayHalls);
        const dayTotal = hallIds.reduce((s, h) => s + dayHalls[h].employees.length, 0);
        return `
          <div class="card" style="margin-bottom:1rem;padding:0;overflow:hidden">
            <div style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;padding:.85rem 1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
              <div style="display:flex;align-items:center;gap:.6rem">
                <i data-lucide="calendar-check" style="width:18px;height:18px"></i>
                <b style="font-size:1rem">${getDayName(date)} — ${fmtDate(date)}</b>
              </div>
              <div style="display:flex;gap:.75rem;font-size:.78rem;opacity:.95">
                <span>🏛 <b>${hallIds.length}</b></span>
                <span>👥 <b>${dayTotal}</b></span>
              </div>
            </div>

            <div style="padding:1rem">
              ${hallIds.map(hallId => {
                const hallData = dayHalls[hallId];
                const booking = hallData.booking;
                const employees = [...hallData.employees].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
                return `
                  <div style="border:1px solid var(--border);border-radius:12px;padding:.85rem;margin-bottom:.75rem;background:var(--surface-2)">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem;padding-bottom:.65rem;border-bottom:1px dashed var(--border)">
                      <div style="display:flex;align-items:center;gap:.5rem">
                        <i data-lucide="building-2" style="width:16px;height:16px;color:var(--primary)"></i>
                        <b style="font-size:.95rem">${hallName(hallId)}</b>
                        ${hallCode(hallId) ? `<span style="font-size:.7rem;color:var(--text-muted)">(${hallCode(hallId)})</span>` : ''}
                      </div>
                      ${booking ? `
                        <div style="display:flex;gap:.75rem;font-size:.75rem;color:var(--text-muted);flex-wrap:wrap">
                          ${booking.startTime ? `<span>🕐 ${booking.startTime}${booking.endTime ? ' - ' + booking.endTime : ''}</span>` : ''}
                          ${booking.clientName ? `<span>👤 ${booking.clientName}</span>` : ''}
                        </div>
                      ` : ''}
                    </div>

                    ${employees.length ? `
                      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.5rem">
                        ${employees.map(e => {
                          const emp = State.data.employees.find(x => x.id === e.employeeId);
                          const name = emp ? emp.name : (e.manualName || '-');
                          const code = emp ? (emp.code || '') : '';
                          return `
                            <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .65rem;background:var(--surface);border:1px solid var(--border);border-radius:10px">
                              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;flex-shrink:0">${initials(name)}</div>
                              <div style="flex:1;min-width:0">
                                <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
                                <div style="font-size:.68rem;color:var(--text-muted);display:flex;gap:.4rem;flex-wrap:wrap">
                                  <span class="badge-pill badge-purple" style="font-size:.6rem;padding:.1rem .4rem">${e.role}</span>
                                  ${code ? `<span>${code}</span>` : ''}
                                </div>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    ` : `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.8rem">${t('dbh_no_staff')}</div>`}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;

    if (window.lucide) lucide.createIcons();

    const fromEl = document.getElementById('dbh-from');
    const toEl = document.getElementById('dbh-to');
    const hallEl = document.getElementById('dbh-hall');
    const roleEl = document.getElementById('dbh-role');
    const empEl = document.getElementById('dbh-emp');
    if (fromEl) fromEl.onchange = (e) => { State17.from = e.target.value; navigate('byhall'); };
    if (toEl) toEl.onchange = (e) => { State17.to = e.target.value; navigate('byhall'); };
    if (hallEl) hallEl.onchange = (e) => { State17.hallId = e.target.value; navigate('byhall'); };
    if (roleEl) roleEl.onchange = (e) => { State17.role = e.target.value; navigate('byhall'); };
    if (empEl) empEl.onchange = (e) => { State17.employeeId = e.target.value; navigate('byhall'); };
  };

  /* ---------- handlers ---------- */
  window.__dmDBHClear = function () {
    State17.from = addDaysISO(todayISO(), -7);
    State17.to = todayISO();
    State17.hallId = 'all';
    State17.role = 'all';
    State17.employeeId = 'all';
    navigate('byhall');
  };

  window.__dmDBHQuick = function (range) {
    const today = new Date();
    if (range === 'today') {
      State17.from = today.toISOString().slice(0, 10);
      State17.to = State17.from;
    } else if (range === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      State17.from = d.toISOString().slice(0, 10);
      State17.to = today.toISOString().slice(0, 10);
    } else if (range === 'month') {
      State17.from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      State17.to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    }
    navigate('byhall');
  };

  /* =========================================================
     PRINT — DETAILED (كل يوم في صفحة)
     ========================================================= */
  window.__dmDBHPrint = function () {
    const records = getFiltered();
    if (!records.length) {
      if (typeof showToast === 'function') showToast(t('dbh_no_data'), 'warn');
      return;
    }

    const ar = State.lang === 'ar';
    const L = {
      title: ar ? 'كشف التوزيع حسب القاعة' : 'Distribution Sheet by Hall',
      period: ar ? 'الفترة' : 'Period',
      hall: ar ? 'القاعة' : 'Hall',
      role: ar ? 'الدور' : 'Role',
      employee: ar ? 'الموظف' : 'Employee',
      code: ar ? 'الكود' : 'Code',
      phone: ar ? 'الهاتف' : 'Phone',
      sign: ar ? 'التوقيع' : 'Sign',
      client: ar ? 'العميل' : 'Client',
      time: ar ? 'الوقت' : 'Time',
      noStaff: ar ? 'لا يوجد موظفون معيّنون' : 'No employees assigned',
      hint: ar ? 'يُرجى التوقيع أمام الاسم عند الاستلام والتسليم' : 'Please sign next to your name upon receipt',
      totals: ar ? 'الإجمالي' : 'Total'
    };

    const grouped = buildGrouped(records);
    const dates = Object.keys(grouped);
    const periodLabel = `${fmtDate(State17.from)} → ${fmtDate(State17.to)}`;

    let html = `
      <div style="margin-bottom:1.25rem">
        <div style="font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:.25rem">${L.title}</div>
        <div style="font-size:.8rem;color:#64748b;display:flex;gap:1rem;flex-wrap:wrap">
          <span><b>${L.period}:</b> ${periodLabel}</span>
          <span><b>${dates.length}</b> ${ar ? 'يوم' : 'days'}</span>
          <span><b>${records.length}</b> ${ar ? 'تعيين' : 'assignments'}</span>
        </div>
      </div>
    `;

    dates.forEach(date => {
      const dayHalls = grouped[date];
      const hallIds = Object.keys(dayHalls);
      const dayTotal = hallIds.reduce((s, h) => s + dayHalls[h].employees.length, 0);

      html += `
        <div style="page-break-inside:avoid;margin-bottom:1.5rem">
          <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;padding:.65rem 1rem;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:.85rem;flex-wrap:wrap;gap:.5rem">
            <div style="font-size:1rem;font-weight:800">📅 ${getDayName(date)} — ${fmtDate(date)}</div>
            <div style="font-size:.75rem;opacity:.95">🏛 ${hallIds.length} · 👥 ${dayTotal}</div>
          </div>

          ${hallIds.map(hallId => {
            const hallData = dayHalls[hallId];
            const booking = hallData.booking;
            const employees = [...hallData.employees].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

            return `
              <div style="border:2px solid #e5e7eb;border-radius:10px;padding:.85rem;margin-bottom:.75rem;page-break-inside:avoid">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;padding-bottom:.5rem;margin-bottom:.75rem;border-bottom:2px solid #7c3aed20">
                  <div style="font-size:1rem;font-weight:800;color:#7c3aed">
                    🏛 ${hallName(hallId)} ${hallCode(hallId) ? `<span style="font-size:.7rem;color:#94a3b8;font-weight:400">(${hallCode(hallId)})</span>` : ''}
                  </div>
                  ${booking ? `
                    <div style="display:flex;gap:.75rem;font-size:.72rem;color:#475569;flex-wrap:wrap">
                      ${booking.startTime ? `<div><b>${L.time}:</b> ${booking.startTime}${booking.endTime ? ' - ' + booking.endTime : ''}</div>` : ''}
                      ${booking.clientName ? `<div><b>${L.client}:</b> ${booking.clientName}</div>` : ''}
                    </div>
                  ` : ''}
                </div>

                ${employees.length ? `
                  <div style="display:flex;flex-wrap:wrap;gap:.5rem">
                    ${employees.map(e => {
                      const emp = State.data.employees.find(x => x.id === e.employeeId);
                      const name = emp ? emp.name : (e.manualName || '-');
                      const code = emp ? (emp.code || '—') : '—';
                      const phone = emp ? (emp.phone || '—') : '—';
                      return `
                        <div style="flex:1 1 calc(25% - .5rem);min-width:150px;border:1px solid #cbd5e1;border-radius:8px;padding:.55rem;background:#fafafa;box-sizing:border-box">
                          <div style="font-size:.6rem;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.05em;padding-bottom:.3rem;margin-bottom:.35rem;border-bottom:1px dashed #e5e7eb">${e.role}</div>
                          <div style="font-size:.9rem;font-weight:800;color:#0f172a;margin-bottom:.2rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
                          <div style="font-size:.65rem;color:#64748b;display:flex;justify-content:space-between;gap:.25rem;flex-wrap:wrap;margin-bottom:.5rem">
                            <span><b>${L.code}:</b> ${code}</span>
                            <span>${phone !== '—' ? '📞 ' + phone : ''}</span>
                          </div>
                          <div style="border-top:1px dashed #94a3b8;padding-top:.3rem;font-size:.6rem;color:#94a3b8;text-align:center;margin-top:.35rem">${L.sign}</div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                  <div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed #e5e7eb;display:flex;justify-content:space-between;font-size:.72rem;color:#64748b;flex-wrap:wrap;gap:.5rem">
                    <div>${Object.entries(employees.reduce((acc, e) => { acc[e.role] = (acc[e.role] || 0) + 1; return acc; }, {})).map(([r, c]) => `<b>${r}:</b> ${c}`).join(' · ')}</div>
                    <div><b>${L.totals}:</b> ${employees.length}</div>
                  </div>
                ` : `<div style="padding:.75rem;text-align:center;color:#ef4444;font-size:.8rem">${L.noStaff}</div>`}
              </div>
            `;
          }).join('')}
        </div>
      `;
    });

    html += `<div style="margin-top:1.5rem;padding:.75rem 1rem;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:.75rem;color:#78350f;text-align:center">⚠️ ${L.hint}</div>`;

    openPrintWindow(L.title, html);
  };

  /* =========================================================
     🆕 PRINT MONTH — COMPACT 2-PAGE A4 (2 columns)
     ========================================================= */
  window.__dmDBHPrintMonth = function () {
    const records = getFiltered();
    if (!records.length) {
      if (typeof showToast === 'function') showToast(t('dbh_no_data'), 'warn');
      return;
    }

    const ar = State.lang === 'ar';
    const L = {
      title: ar ? 'كشف التوزيع الشهري' : 'Monthly Distribution Sheet',
      period: ar ? 'الفترة' : 'Period',
      noStaff: ar ? 'لا يوجد موظفون' : 'No staff',
      hint: ar ? 'يُرجى التوقيع عند الاستلام' : 'Sign upon receipt',
      days: ar ? 'يوم' : 'days',
      assignments: ar ? 'تعيين' : 'assignments'
    };

    const grouped = buildGrouped(records);
    const dates = Object.keys(grouped).sort(); // ASC (oldest first)

    const periodLabel = `${fmtDate(State17.from)} → ${fmtDate(State17.to)}`;

    // Build a compact day block
    // Each day: header line + one line per hall
    const dayBlock = (date) => {
      const dayHalls = grouped[date];
      const hallIds = Object.keys(dayHalls);

      let block = `
        <div class="day-block">
          <div class="day-header">
            <span class="day-name">${getDayShort(date)} ${date.slice(5).replace('-', '/')}</span>
            <span class="day-badge">${hallIds.length}🏛</span>
          </div>
          <div class="day-halls">
      `;

      hallIds.forEach(hallId => {
        const employees = [...dayHalls[hallId].employees].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
        const names = employees.map(e => {
          const emp = State.data.employees.find(x => x.id === e.employeeId);
          const name = emp ? emp.name : (e.manualName || '—');
          // If multiple roles, prefix with short role
          const roles = new Set(employees.map(x => x.role));
          if (roles.size > 1) {
            return `<span class="chip role-${e.role}">${name}</span>`;
          }
          return `<span class="chip">${name}</span>`;
        }).join('');

        block += `
          <div class="hall-row">
            <span class="hall-name">${hallShortName(hallId)}</span>
            <span class="hall-staff">${names || '—'}</span>
          </div>
        `;
      });

      block += `</div></div>`;
      return block;
    };

    let daysHtml = '';
    dates.forEach(date => {
      daysHtml += dayBlock(date);
    });

    const html = `
      <div class="monthly-print">
        <div class="print-header-info">
          <div><b>${L.period}:</b> ${periodLabel}</div>
          <div><b>${dates.length}</b> ${L.days} · <b>${records.length}</b> ${L.assignments}</div>
        </div>
        <div class="monthly-columns">
          ${daysHtml}
        </div>
      </div>
    `;

    const w = window.open('', '_blank', 'width=1000,height=1000');
    if (!w) {
      if (typeof showToast === 'function') showToast('Please allow popups', 'warn');
      return;
    }

    const styles = `
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4 portrait;margin:8mm}
      body{font-family:'Cairo','Inter',system-ui,sans-serif;margin:0;padding:0;color:#0f172a;background:#fff;direction:${ar ? 'rtl' : 'ltr'};font-size:8pt;line-height:1.35}
      .header{display:flex;align-items:center;gap:.5rem;padding-bottom:.35rem;border-bottom:2px solid #7c3aed;margin-bottom:.5rem}
      .logo{width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,#7c3aed,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.75rem;flex-shrink:0}
      .brand h1{margin:0;font-size:.9rem;font-weight:800;letter-spacing:-.02em}
      .brand p{margin:0;font-size:.55rem;color:#64748b}
      .brand span{color:#7c3aed}
      .print-header-info{
        display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;
        font-size:.7rem;color:#475569;
        padding:.3rem .5rem;background:#f3f4f6;border-radius:4px;margin-bottom:.5rem;
      }
      .monthly-columns{
        column-count:2;
        column-gap:6mm;
        column-rule:1px dashed #cbd5e1;
      }
      .day-block{
        break-inside:avoid;
        page-break-inside:avoid;
        margin-bottom:2.5mm;
        border:1px solid #e5e7eb;
        border-radius:3px;
        overflow:hidden;
      }
      .day-header{
        display:flex;justify-content:space-between;align-items:center;
        background:linear-gradient(135deg,#7c3aed,#6d28d9);
        color:#fff;
        padding:.15rem .4rem;
        font-size:.65rem;
        font-weight:800;
      }
      .day-name{letter-spacing:.02em}
      .day-badge{font-size:.55rem;opacity:.9}
      .day-halls{
        padding:.2rem .3rem;
        background:#fafafa;
      }
      .hall-row{
        display:flex;
        align-items:flex-start;
        gap:.3rem;
        padding:.15rem 0;
        border-bottom:1px dotted #e5e7eb;
        font-size:.62rem;
      }
      .hall-row:last-child{border-bottom:none}
      .hall-name{
        flex-shrink:0;
        min-width:14mm;
        max-width:18mm;
        font-weight:800;
        color:#7c3aed;
        font-size:.6rem;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .hall-staff{
        flex:1;
        display:flex;
        flex-wrap:wrap;
        gap:.15rem .3rem;
      }
      .chip{
        display:inline-block;
        padding:.05rem .3rem;
        background:#fff;
        border:1px solid #cbd5e1;
        border-radius:3px;
        font-size:.58rem;
        font-weight:600;
        white-space:nowrap;
        color:#0f172a;
      }
      .chip.role-Director{border-color:#7c3aed;background:#7c3aed10;color:#6d28d9}
      .chip.role-Photographer{border-color:#10b981;background:#10b98110;color:#059669}
      .chip.role-Crane{border-color:#f59e0b;background:#f59e0b10;color:#d97706}
      .chip.role-Supervisor{border-color:#3b82f6;background:#3b82f610;color:#2563eb}
      .footer{
        margin-top:.4rem;padding-top:.3rem;border-top:1px solid #e5e7eb;
        font-size:.55rem;color:#94a3b8;text-align:center;
      }
      @media print{
        body{padding:0;font-size:8pt}
        .page-break{page-break-before:always}
      }
    `;

    w.document.write(`<!DOCTYPE html>
<html lang="${State.lang}" dir="${ar ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${L.title}</title><style>${styles}</style></head>
<body>
  <div class="header">
    <div class="logo">D</div>
    <div class="brand">
      <h1>Dr Media <span>Pro</span></h1>
      <p>${(State.data.settings.companyName || 'Video Production')} · ${State.data.settings.phone || ''}</p>
    </div>
  </div>
  <div style="font-size:1rem;font-weight:800;color:#0f172a;margin-bottom:.25rem">${L.title}</div>
  ${html}
  <div class="footer">
    ${State.data.settings.companyName || 'Dr Media Pro'} · ${new Date().toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}
  </div>
  <script>setTimeout(function(){window.print();},500);<\/script>
</body></html>`);
    w.document.close();
  };

  /* ---------- print window helper (للطباعة التفصيلية) ---------- */
  function openPrintWindow(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=1000,height=1000');
    if (!w) {
      if (typeof showToast === 'function') showToast('Please allow popups', 'warn');
      return;
    }
    const ar = State.lang === 'ar';
    const styles = `
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-family:'Cairo','Inter',system-ui,sans-serif;margin:0;padding:1.5rem;color:#0f172a;background:#fff;direction:${ar ? 'rtl' : 'ltr'};font-size:12px}
      .header{display:flex;align-items:center;gap:1rem;padding-bottom:.85rem;border-bottom:3px solid #7c3aed;margin-bottom:1.25rem}
      .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.35rem;flex-shrink:0}
      .brand h1{margin:0;font-size:1.25rem;font-weight:800;letter-spacing:-.02em}
      .brand p{margin:0;font-size:.72rem;color:#64748b}
      .brand span{color:#7c3aed}
      .footer{margin-top:2rem;padding-top:.75rem;border-top:1px solid #e5e7eb;font-size:.7rem;color:#94a3b8;text-align:center}
      @media print{
        body{padding:.75rem}
        div{page-break-inside:avoid}
      }
    `;
    w.document.write(`<!DOCTYPE html>
<html lang="${State.lang}" dir="${ar ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head>
<body>
  <div class="header">
    <div class="logo">D</div>
    <div class="brand">
      <h1>Dr Media <span>Pro</span></h1>
      <p>${(State.data.settings.companyName || 'Professional Video Production')} · ${State.data.settings.phone || ''}</p>
    </div>
  </div>
  ${bodyHtml}
  <div class="footer">
    ${State.data.settings.companyName || 'Dr Media Pro'} · ${State.data.settings.address || ''} · ${new Date().toLocaleString(ar ? 'ar-EG' : 'en-GB')}
  </div>
  <script>setTimeout(function(){window.print();},400);<\/script>
</body></html>`);
    w.document.close();
  }

  /* ---------- export CSV ---------- */
  window.__dmDBHExport = function () {
    const records = getFiltered();
    if (!records.length) {
      if (typeof showToast === 'function') showToast(t('dbh_no_data'), 'warn');
      return;
    }
    const headers = ['Date', 'Day', 'Hall', 'Hall Code', 'Role', 'Employee', 'Code', 'Phone'];
    const rows = records.map(r => {
      const emp = State.data.employees.find(x => x.id === r.employeeId);
      return [r.date, getDayName(r.date), hallName(r.hallId), hallCode(r.hallId), r.role, emp ? emp.name : (r.manualName || ''), emp ? (emp.code || '') : '', emp ? (emp.phone || '') : ''];
    });
    const csv = [headers, ...rows].map(row => row.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'distribution-by-hall-' + todayISO() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Exported ✓', 'success');
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(g => g.section === 'operations');
    if (ops && !ops.items.find(i => i.id === 'byhall')) {
      const distIdx = ops.items.findIndex(i => i.id === 'distribution');
      const insertAt = distIdx >= 0 ? distIdx + 1 : ops.items.length;
      ops.items.splice(insertAt, 0, { id: 'byhall', icon: 'layout-grid', label: 'dist_by_hall' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  waitFor(
    () => typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof navigate === 'function',
    function () {
      registerNav();
      console.log('%c[Section 17] ✓ Distribution by Hall ready (v4 — Monthly 2-page print)', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 17] Try: __dmDBHPrintMonth()', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 18 v2: Smart Import (PDF + Images)
   Version: 2.0.0 - SIMPLIFIED
   ---------------------------------------------------------
   - Reads table with columns: Day | Date | Client | Package | Count
   - Detects hall headers
   - Maps packages to event types
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 18] Smart Import v2 loading…', 'color:#f97316;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    const t = setInterval(function () {
      if (++tries > maxTries) {
        clearInterval(t);
        console.warn('[Section 18] timeout');
        return;
      }
      if (cond()) {
        clearInterval(t);
        cb();
      }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.smart_import = 'استيراد ذكي';
  I18N.ar.si_title = 'استيراد الحجوزات من PDF أو صورة';
  I18N.ar.si_dropzone = 'اضغط لاختيار ملف أو اسحبه هنا';
  I18N.ar.si_supported = 'PDF · PNG · JPG · WEBP';
  I18N.ar.si_reading = 'جاري القراءة…';
  I18N.ar.si_ocr = 'جاري التعرف على النص…';
  I18N.ar.si_review = 'مراجعة النتائج';
  I18N.ar.si_found = 'تم العثور على';
  I18N.ar.si_bookings = 'حجز';
  I18N.ar.si_import_all = 'حفظ الكل';
  I18N.ar.si_imported = 'تم الاستيراد';
  I18N.ar.si_no_data = 'لم يتم التعرف على أي حجز';
  I18N.ar.si_try_again = 'حاول مرة أخرى';
  I18N.ar.si_show_raw = 'عرض النص المستخرج';

  I18N.en.smart_import = 'Smart Import';
  I18N.en.si_title = 'Import bookings from PDF or image';
  I18N.en.si_dropzone = 'Click to choose file or drag it here';
  I18N.en.si_supported = 'PDF · PNG · JPG · WEBP';
  I18N.en.si_reading = 'Reading…';
  I18N.en.si_ocr = 'Running OCR…';
  I18N.en.si_review = 'Review Results';
  I18N.en.si_found = 'Found';
  I18N.en.si_bookings = 'bookings';
  I18N.en.si_import_all = 'Save All';
  I18N.en.si_imported = 'Imported';
  I18N.en.si_no_data = 'No bookings detected';
  I18N.en.si_try_again = 'Try again';
  I18N.en.si_show_raw = 'Show extracted text';

  /* ---------- state ---------- */
  const Imp = {
    file: null,
    fileName: '',
    rawText: '',
    parsed: [],
    busy: false,
    status: '',
    showRaw: false
  };
  window.__dmImp = Imp;

  /* ---------- helpers ---------- */
  function norm(s) {
    return String(s || '')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function toAsciiDigits(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48); })
      .replace(/[۰-۹]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48); });
  }

  /* ---------- hall detection ---------- */
  function detectHall(line) {
    const n = norm(line);
    if (n.indexOf('قاعه المغلقه') >= 0) return { key: 'closed', match: 'المغلقة' };
    if (n.indexOf('قاعه الاوبن') >= 0) return { key: 'open', match: 'الأوبن' };
    if (n.indexOf('قاعه الاوبن') >= 0) return { key: 'open', match: 'الأوبن' };
    if (n.indexOf('اوبن') >= 0 && n.length < 40) return { key: 'open', match: 'الأوبن' };
    if (n.indexOf('مغلقه') >= 0 && n.length < 40) return { key: 'closed', match: 'المغلقة' };
    if (n.indexOf('قاعه الصغيره') >= 0) return { key: 'small', match: 'الصغيرة' };
    if (n.indexOf('صغيره') >= 0 && n.length < 40) return { key: 'small', match: 'الصغيرة' };
    if (n.indexOf('كافيه') >= 0 || n.indexOf('كافي') >= 0) return { key: 'cafe', match: 'الكافيه' };
    return null;
  }

  function matchHallId(key) {
    // Try to find a hall in State.data.halls by keyword
    const halls = State.data.halls || [];
    for (let i = 0; i < halls.length; i++) {
      const h = halls[i];
      const ar = norm(h.name.ar || '');
      if (key === 'closed' && (ar.indexOf('مغلقه') >= 0 || ar.indexOf('مغلقة') >= 0)) return h.id;
      if (key === 'open' && (ar.indexOf('اوبن') >= 0 || ar.indexOf('مفتوح') >= 0)) return h.id;
      if (key === 'small' && ar.indexOf('صغيره') >= 0) return h.id;
      if (key === 'cafe' && (ar.indexOf('كافيه') >= 0 || ar.indexOf('كافي') >= 0)) return h.id;
    }
    // Fallback: return first hall
    return halls.length ? halls[0].id : '';
  }

  /* ---------- package → event type ---------- */
  function detectEvent(pkgLine) {
    const n = norm(pkgLine);
    if (n.indexOf('عشاء') >= 0) return 'Wedding';
    if (n.indexOf('سواريه') >= 0) return 'Engagement';
    if (n.indexOf('هاي تي') >= 0) return 'Birthday';
    if (n.indexOf('هاى تى') >= 0) return 'Birthday';
    if (n.indexOf('مطبخ') >= 0) return 'Engagement';
    if (n.indexOf('فرح') >= 0) return 'Wedding';
    if (n.indexOf('خطوبه') >= 0) return 'Engagement';
    return 'Wedding';
  }

  /* ---------- date parsing ---------- */
  function parseDate(text) {
    const t = toAsciiDigits(text);
    const m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return null;
    let d = parseInt(m[1]);
    let mo = parseInt(m[2]);
    let y = parseInt(m[3]);
    if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
    if (mo < 1 || mo > 12) return null;
    if (d < 1 || d > 31) return null;
    const dd = d < 10 ? '0' + d : '' + d;
    const mm = mo < 10 ? '0' + mo : '' + mo;
    return y + '-' + mm + '-' + dd;
  }

  /* ---------- table parser ---------- */
  function parseTable(rawText) {
    const text = toAsciiDigits(rawText);
    const lines = text.split(/\r?\n/).map(function (l) {
      return l.replace(/\s+/g, ' ').trim();
    }).filter(function (l) { return l.length > 0; });

    const results = [];
    let currentHallKey = null;
    let currentHallId = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1) Check if line is a hall header
      const hallHit = detectHall(line);
      if (hallHit) {
        currentHallKey = hallHit.key;
        currentHallId = matchHallId(hallHit.key);
        continue;
      }

      // 2) Look for date in line
      const dateMatch = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (!dateMatch) continue;

      // Found a data row
      const date = parseDate(line);
      if (!date) continue;

      // Extract parts around the date
      const dateStr = dateMatch[0];
      const idx = line.indexOf(dateStr);
      const beforeDate = line.slice(0, idx).trim();
      const afterDate = line.slice(idx + dateStr.length).trim();

      // Count: last number with 2-4 digits
      let count = 0;
      const counts = afterDate.match(/\b(\d{2,4})\b/g);
      if (counts && counts.length > 0) {
        count = parseInt(counts[counts.length - 1]);
        if (count < 20 || count > 2000) count = 0;
      }

      // Client name: Arabic letters sequence in the middle
      // Remove the count and known keywords
      let nameArea = afterDate;
      if (counts && counts.length > 0) {
        nameArea = nameArea.replace(counts[counts.length - 1], ' ');
      }
      // Remove package keywords
      nameArea = nameArea
        .replace(/عشاء\s*\d*/g, ' ')
        .replace(/سواريه/g, ' ')
        .replace(/هاي\s*تي/g, ' ')
        .replace(/مطبخ/g, ' ')
        .replace(/\+/g, ' ')
        .replace(/\d+/g, ' ')
        .trim();

      // Extract client name (first 3-4 Arabic words)
      const nameWords = nameArea.split(/\s+/).filter(function (w) {
        return w.length >= 2 && /[\u0600-\u06FF]/.test(w);
      });
      const clientName = nameWords.slice(0, 4).join(' ');

      // Package → event type
      const pkgArea = afterDate;
      const eventType = detectEvent(pkgArea);

      // Skip empty rows
      if (!clientName && count === 0) continue;

      results.push({
        date: date,
        clientName: clientName || 'عميل',
        phone: '',
        hallId: currentHallId || matchHallId('closed'),
        eventType: eventType,
        guestsCount: count,
        cost: 0,
        startTime: '19:00',
        endTime: '23:00',
        confidence: clientName ? 'high' : 'medium',
        raw: line.slice(0, 200)
      });
    }

    return results;
  }

  /* ---------- libraries ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) return;
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  async function ensureTesseract() {
    if (window.Tesseract) return;
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js');
  }

  /* ---------- read PDF ---------- */
  async function readPdf(file) {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items.map(function (it) { return it.str; }).join(' ');
      text += pageText + '\n';
    }
    return text;
  }

  /* ---------- read image ---------- */
  async function readImage(file) {
    await ensureTesseract();
    const result = await window.Tesseract.recognize(file, 'ara+eng', {
      logger: function (m) {
        if (m.status === 'recognizing text') {
          Imp.status = I18N[State.lang].si_ocr + ' ' + Math.round(m.progress * 100) + '%';
          updateProgressUI();
        }
      }
    });
    return result.data.text;
  }

  /* ---------- update progress UI ---------- */
  function updateProgressUI() {
    const s = document.getElementById('si-status');
    if (s) s.textContent = Imp.status || '';
  }

  /* ---------- process file ---------- */
  async function processFile(file) {
    if (!file) return;
    Imp.file = file;
    Imp.fileName = file.name;
    Imp.busy = true;
    Imp.parsed = [];
    Imp.rawText = '';
    Imp.status = I18N[State.lang].si_reading;
    navigate('importsmart');

    try {
      let text = '';
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        text = await readPdf(file);
      } else {
        Imp.status = I18N[State.lang].si_ocr + '…';
        updateProgressUI();
        text = await readImage(file);
      }
      Imp.rawText = text;
      Imp.parsed = parseTable(text);
      Imp.busy = false;
      Imp.status = '';
      navigate('importsmart');
      if (typeof showToast === 'function') {
        showToast(
          I18N[State.lang].si_found + ' ' + Imp.parsed.length + ' ' + I18N[State.lang].si_bookings,
          Imp.parsed.length ? 'success' : 'warn'
        );
      }
    } catch (err) {
      console.error('[Section 18]', err);
      Imp.busy = false;
      Imp.status = '';
      if (typeof showToast === 'function') showToast('Failed: ' + err.message, 'error');
      navigate('importsmart');
    }
  }

  /* ---------- escape helpers ---------- */
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- render page ---------- */
  Pages.importsmart = function (el) {
    if (Imp.busy) {
      el.innerHTML = '<div class="card" style="max-width:520px;margin:2rem auto;text-align:center;padding:3rem 2rem">' +
        '<div style="font-size:3rem;margin-bottom:1rem">📄</div>' +
        '<div style="font-size:1rem;font-weight:700;margin-bottom:.5rem">' + esc(Imp.status || I18N[State.lang].si_reading) + '</div>' +
        '<div id="si-status" style="font-size:.8rem;color:var(--text-muted);margin-top:1rem">' + esc(Imp.fileName) + '</div>' +
        '</div>';
      return;
    }

    if (Imp.parsed.length > 0) {
      renderReview(el);
    } else {
      renderUpload(el);
    }
  };

  /* ---------- upload ---------- */
  function renderUpload(el) {
    const L = I18N[State.lang];
    el.innerHTML = '<div style="max-width:640px;margin:1rem auto">' +
      '<div class="card" style="padding:2rem">' +
        '<div style="text-align:center;margin-bottom:1.5rem">' +
          '<div style="font-size:3rem;margin-bottom:.5rem">📤</div>' +
          '<h3 style="margin:0 0 .35rem;font-size:1.15rem">' + esc(L.si_title) + '</h3>' +
        '</div>' +
        '<div id="si-dropzone" style="border:3px dashed var(--border);border-radius:16px;padding:3rem 1.5rem;text-align:center;cursor:pointer;background:var(--surface-2);transition:all .2s">' +
          '<div style="font-size:2.5rem;margin-bottom:.5rem">📁</div>' +
          '<div style="font-weight:700;font-size:.95rem;margin-bottom:.35rem">' + esc(L.si_dropzone) + '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted)">' + esc(L.si_supported) + '</div>' +
        '</div>' +
        '<input type="file" id="si-file" accept="application/pdf,image/*" style="display:none">' +
        (Imp.rawText && !Imp.parsed.length ?
          '<div style="margin-top:1rem;padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;font-size:.85rem;color:#ef4444;text-align:center">⚠️ ' + esc(L.si_no_data) + '</div>' : '') +
      '</div>' +
    '</div>';

    const dz = document.getElementById('si-dropzone');
    const fi = document.getElementById('si-file');
    if (dz && fi) {
      dz.onclick = function () { fi.click(); };
      fi.onchange = function (e) {
        if (e.target.files[0]) processFile(e.target.files[0]);
      };
      dz.addEventListener('dragover', function (e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--primary)';
        dz.style.background = 'rgba(124,58,237,.08)';
      });
      dz.addEventListener('dragleave', function () {
        dz.style.borderColor = 'var(--border)';
        dz.style.background = 'var(--surface-2)';
      });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--border)';
        dz.style.background = 'var(--surface-2)';
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
      });
    }
  }

  /* ---------- review ---------- */
  function renderReview(el) {
    const L = I18N[State.lang];
    const halls = State.data.halls || [];
    const rows = Imp.parsed;

    let rowsHtml = '';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const evOptions = ['Wedding', 'Engagement', 'Henna', 'Birthday', 'Corporate', 'Other']
        .map(function (ev) {
          return '<option value="' + ev + '"' + (r.eventType === ev ? ' selected' : '') + '>' + ev + '</option>';
        }).join('');
      const hallOptions = halls.map(function (h) {
        return '<option value="' + h.id + '"' + (r.hallId === h.id ? ' selected' : '') + '>' + esc(h.name[State.lang] || h.name.ar) + '</option>';
      }).join('');
      const confClass = r.confidence === 'high' ? 'green' : r.confidence === 'medium' ? 'yellow' : 'red';

      rowsHtml += '<tr data-idx="' + i + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="badge-pill badge-' + confClass + '">' + r.confidence + '</span></td>' +
        '<td><input class="si-f" data-f="clientName" value="' + esc(r.clientName) + '" style="width:100%;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit"></td>' +
        '<td><input class="si-f" data-f="phone" value="' + esc(r.phone) + '" style="width:100px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit"></td>' +
        '<td><input class="si-f" data-f="date" type="date" value="' + esc(r.date) + '" style="padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit"></td>' +
        '<td><select class="si-f" data-f="hallId" style="width:120px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit">' + hallOptions + '</select></td>' +
        '<td><select class="si-f" data-f="eventType" style="width:110px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit">' + evOptions + '</select></td>' +
        '<td><input class="si-f" data-f="guestsCount" type="number" value="' + (r.guestsCount || 0) + '" style="width:70px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit"></td>' +
        '<td><button class="btn btn-ghost btn-icon btn-sm" onclick="__dmImpDel(' + i + ')" style="color:#ef4444"><i data-lucide="trash-2"></i></button></td>' +
      '</tr>';
    }

    el.innerHTML = '<div class="card" style="margin-bottom:1rem">' +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center">' +
        '<b style="font-size:1rem">' + esc(L.si_review) + '</b>' +
        '<span class="badge-pill badge-purple">' + L.si_found + ' ' + rows.length + ' ' + L.si_bookings + '</span>' +
        '<div style="margin-inline-start:auto;display:flex;gap:.5rem">' +
          '<button class="btn btn-ghost btn-sm" onclick="__dmImpToggleRaw()">' + esc(L.si_show_raw) + '</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="__dmImpReset()"><i data-lucide="rotate-ccw"></i> ' + esc(L.si_try_again) + '</button>' +
          '<button class="btn btn-primary btn-sm" onclick="__dmImpCommit()"><i data-lucide="save"></i> ' + esc(L.si_import_all) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    (Imp.showRaw ?
      '<div class="card" style="margin-bottom:1rem"><pre style="background:var(--surface-2);padding:1rem;border-radius:8px;font-size:.7rem;line-height:1.5;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-word">' + esc(Imp.rawText.slice(0, 4000)) + '</pre></div>'
      : '') +
    '<div class="card" style="padding:0;overflow:hidden">' +
      '<div class="table-wrap" style="border:none;border-radius:0">' +
        '<table class="data-table" style="min-width:900px">' +
          '<thead><tr>' +
            '<th style="width:2rem">#</th>' +
            '<th>Confidence</th>' +
            '<th>Client</th>' +
            '<th>Phone</th>' +
            '<th>Date</th>' +
            '<th>Hall</th>' +
            '<th>Event</th>' +
            '<th>Guests</th>' +
            '<th style="width:3rem"></th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

    if (window.lucide) lucide.createIcons();

    el.querySelectorAll('.si-f').forEach(function (inp) {
      inp.onchange = function (e) {
        const tr = e.target.closest('tr[data-idx]');
        if (!tr) return;
        const idx = parseInt(tr.dataset.idx);
        const f = e.target.dataset.f;
        if (Imp.parsed[idx]) {
          Imp.parsed[idx][f] = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
        }
      };
    });
  }

  /* ---------- public handlers ---------- */
  window.__dmImpToggleRaw = function () {
    Imp.showRaw = !Imp.showRaw;
    navigate('importsmart');
  };

  window.__dmImpReset = function () {
    Imp.file = null;
    Imp.fileName = '';
    Imp.rawText = '';
    Imp.parsed = [];
    Imp.showRaw = false;
    Imp.busy = false;
    navigate('importsmart');
  };

  window.__dmImpDel = function (idx) {
    Imp.parsed.splice(idx, 1);
    navigate('importsmart');
  };

  window.__dmImpCommit = function () {
    if (!Imp.parsed.length) return;
    let added = 0;
    for (let i = 0; i < Imp.parsed.length; i++) {
      const p = Imp.parsed[i];
      if (!p.clientName && !p.phone) continue;
      State.data.bookings.push({
        id: uid('b'),
        date: p.date,
        hallId: p.hallId,
        clientName: p.clientName || '-',
        phone: p.phone || '',
        eventType: p.eventType || 'Wedding',
        startTime: p.startTime || '19:00',
        endTime: p.endTime || '23:00',
        status: 'pending',
        paymentStatus: 'unpaid',
        cost: p.cost || 0,
        guestsCount: p.guestsCount || 0,
        notes: 'مستورد من: ' + Imp.fileName
      });
      added++;
    }
    try { saveData(); } catch (e) {}
    try {
      if (typeof logActivity === 'function') {
        logActivity('bulk-import', 'booking', null, null, { count: added, file: Imp.fileName });
      }
    } catch (e) {}
    showToast(I18N[State.lang].si_imported + ': ' + added + ' ✓', 'success');
    Imp.file = null;
    Imp.fileName = '';
    Imp.rawText = '';
    Imp.parsed = [];
    Imp.showRaw = false;
    setTimeout(function () { navigate('bookings'); }, 400);
  };

  /* ---------- register nav ---------- */
  function registerNav() {
    const ops = NAV_ITEMS.find(function (g) { return g.section === 'operations'; });
    if (ops && !ops.items.find(function (i) { return i.id === 'importsmart'; })) {
      const idx = ops.items.findIndex(function (i) { return i.id === 'bookings'; });
      const at = idx >= 0 ? idx + 1 : ops.items.length;
      ops.items.splice(at, 0, { id: 'importsmart', icon: 'file-input', label: 'smart_import' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- boot ---------- */
  waitFor(
    function () {
      return typeof State !== 'undefined' &&
        typeof Pages !== 'undefined' &&
        typeof navigate === 'function' &&
        typeof NAV_ITEMS !== 'undefined';
    },
    function () {
      registerNav();
      console.log('%c[Section 18] ✓ Smart Import v2 ready', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 19: Bulk Selection & Actions
   Version: 1.0.0
   ---------------------------------------------------------
   - Checkboxes on every table row
   - Select all / none
   - Floating action bar (delete / edit / export / print)
   - Works on: employees, bookings, clients, halls,
     equipment, advances, deductions, bonuses, leaves
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 19] Bulk Selection loading…', 'color:#8b5cf6;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    let tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) {
        clearInterval(t);
        console.warn('[Section 19] timeout');
        return;
      }
      if (cond()) {
        clearInterval(t);
        cb();
      }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.bulk_selected = 'محدد';
  I18N.ar.bulk_delete_confirm = 'هل أنت متأكد من حذف العناصر المحددة؟';
  I18N.ar.bulk_edit = 'تعديل جماعي';
  I18N.ar.bulk_edit_hint = 'سيتم تعديل العناصر المحددة';
  I18N.ar.bulk_no_changes = 'لم تختر أي تغيير';
  I18N.ar.bulk_apply = 'تطبيق';
  I18N.ar.bulk_leave_empty = 'اتركه فارغًا للتخطي';
  I18N.ar.bulk_no_change = 'بدون تغيير';
  I18N.ar.bulk_deleted = 'تم حذف';
  I18N.ar.bulk_updated = 'تم تعديل';

  I18N.en.bulk_selected = 'selected';
  I18N.en.bulk_delete_confirm = 'Delete all selected items?';
  I18N.en.bulk_edit = 'Bulk Edit';
  I18N.en.bulk_edit_hint = 'Selected items will be updated';
  I18N.en.bulk_no_changes = 'No changes selected';
  I18N.en.bulk_apply = 'Apply';
  I18N.en.bulk_leave_empty = 'Leave empty to skip';
  I18N.en.bulk_no_change = 'No change';
  I18N.en.bulk_deleted = 'Deleted';
  I18N.en.bulk_updated = 'Updated';

  /* ---------- state ---------- */
  const Bulk = {
    selected: new Set(),
    page: ''
  };
  window.__dmBulk = Bulk;

  /* ---------- pages where checkboxes make sense ---------- */
  const SUPPORTED_PAGES = {
    employees: true,
    bookings: true,
    clients: true,
    halls: true,
    equipment: true,
    advances: true,
    deductions: true,
    bonuses: true,
    leaves: true
  };

  /* ---------- extract row ID from buttons ---------- */
  const EDIT_PATTERNS = {
    employees: /editEmployee\('([^']+)'\)/,
    bookings: /editBooking\('([^']+)'\)/,
    clients: /editClient\('([^']+)'\)/,
    halls: /editHall\('([^']+)'\)/,
    equipment: /editEquipment\('([^']+)'\)/,
    advances: /openFinanceModal\('[^']+',\s*'([^']+)'\)/,
    deductions: /openFinanceModal\('[^']+',\s*'([^']+)'\)/,
    bonuses: /openFinanceModal\('[^']+',\s*'([^']+)'\)/,
    leaves: /__dmLeave(?:Approve|Reject|Delete)\('([^']+)'\)/
  };

  function extractRowId(tr, page) {
    const pattern = EDIT_PATTERNS[page];
    if (!pattern) return null;
    const buttons = tr.querySelectorAll('button[onclick]');
    for (let i = 0; i < buttons.length; i++) {
      const oc = buttons[i].getAttribute('onclick') || '';
      const m = oc.match(pattern);
      if (m) return m[1];
    }
    return null;
  }

  /* ---------- inject checkboxes ---------- */
  function injectCheckboxes() {
    const page = State.page;
    if (!SUPPORTED_PAGES[page]) {
      removeBar();
      return;
    }
    Bulk.page = page;

    const tables = document.querySelectorAll('.data-table');
    for (let t = 0; t < tables.length; t++) {
      const table = tables[t];
      const thead = table.querySelector('thead tr');
      const tbody = table.querySelector('tbody');
      if (!thead || !tbody) continue;

      // 1) Header checkbox
      if (!thead.querySelector('.dm-bulk-th')) {
        const th = document.createElement('th');
        th.className = 'dm-bulk-th';
        th.style.cssText = 'width:40px;padding:.5rem .4rem';
        th.innerHTML = '<input type="checkbox" class="dm-bulk-select-all" style="accent-color:var(--primary);cursor:pointer;width:16px;height:16px;vertical-align:middle">';
        thead.insertBefore(th, thead.firstChild);
      }

      // 2) Body checkboxes
      const rows = tbody.querySelectorAll('tr');
      for (let r = 0; r < rows.length; r++) {
        const tr = rows[r];
        if (tr.querySelector('.dm-bulk-td')) continue;

        const id = extractRowId(tr, page);
        if (!id) continue;

        tr.dataset.dmRowId = id;

        const td = document.createElement('td');
        td.className = 'dm-bulk-td';
        td.style.cssText = 'width:40px;padding:.5rem .4rem';
        const checked = Bulk.selected.has(id) ? ' checked' : '';
        td.innerHTML = '<input type="checkbox" class="dm-bulk-checkbox" data-id="' + id + '"' + checked + ' style="accent-color:var(--primary);cursor:pointer;width:16px;height:16px;vertical-align:middle">';
        tr.insertBefore(td, tr.firstChild);
      }
    }

    // 3) Bind handlers
    document.querySelectorAll('.dm-bulk-checkbox').forEach(function (cb) {
      if (cb.dataset.dmBound === '1') return;
      cb.dataset.dmBound = '1';
      cb.onchange = function (e) {
        const id = e.target.dataset.id;
        if (e.target.checked) Bulk.selected.add(id);
        else Bulk.selected.delete(id);
        updateBar();
        updateSelectAllState();
      };
    });

    document.querySelectorAll('.dm-bulk-select-all').forEach(function (sa) {
      if (sa.dataset.dmBound === '1') return;
      sa.dataset.dmBound = '1';
      sa.onchange = function (e) {
        const table = sa.closest('table');
        if (!table) return;
        table.querySelectorAll('.dm-bulk-checkbox').forEach(function (cb) {
          cb.checked = e.target.checked;
          const id = cb.dataset.id;
          if (e.target.checked) Bulk.selected.add(id);
          else Bulk.selected.delete(id);
        });
        updateBar();
      };
    });

    // 4) Update select-all reflect
    updateSelectAllState();
    updateBar();
  }

  function updateSelectAllState() {
    const tables = document.querySelectorAll('.data-table');
    tables.forEach(function (table) {
      const sa = table.querySelector('.dm-bulk-select-all');
      if (!sa) return;
      const cbs = table.querySelectorAll('.dm-bulk-checkbox');
      if (!cbs.length) return;
      let total = 0, checked = 0;
      cbs.forEach(function (cb) { total++; if (cb.checked) checked++; });
      sa.checked = total > 0 && checked === total;
      sa.indeterminate = checked > 0 && checked < total;
    });
  }

  /* ---------- floating action bar ---------- */
  function removeBar() {
    const bar = document.getElementById('dm-bulk-bar');
    if (bar) bar.remove();
  }

  function updateBar() {
    const count = Bulk.selected.size;
    if (count === 0) {
      removeBar();
      return;
    }

    let bar = document.getElementById('dm-bulk-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'dm-bulk-bar';
      bar.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:.55rem .85rem;box-shadow:0 20px 40px -10px rgba(0,0,0,.35);display:flex;align-items:center;gap:.5rem;z-index:8600;animation:dmBulkIn .25s cubic-bezier(.2,.9,.3,1.3)';
      document.body.appendChild(bar);

      if (!document.getElementById('dm-bulk-styles')) {
        const s = document.createElement('style');
        s.id = 'dm-bulk-styles';
        s.textContent =
          '@keyframes dmBulkIn{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}' +
          '.dm-bulk-btn{width:36px;height:36px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0}' +
          '.dm-bulk-btn:hover{background:var(--primary);color:#fff;border-color:var(--primary);transform:translateY(-1px)}' +
          '.dm-bulk-btn.dm-bulk-danger:hover{background:#ef4444;border-color:#ef4444}' +
          '.dm-bulk-btn svg{width:16px;height:16px}' +
          '@media (max-width:640px){#dm-bulk-bar{left:1rem;right:1rem;transform:none;justify-content:space-between}.dm-bulk-btn{width:34px;height:34px}}';
        document.head.appendChild(s);
      }
    }

    const L = I18N[State.lang] || I18N.ar;
    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:.5rem;padding-inline-end:.5rem">' +
        '<span style="background:var(--primary);color:#fff;border-radius:50%;min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;padding:0 .35rem">' + count + '</span>' +
        '<span style="font-weight:700;font-size:.85rem;color:var(--text)">' + L.bulk_selected + '</span>' +
      '</div>' +
      '<div style="width:1px;height:24px;background:var(--border)"></div>' +
      '<button class="dm-bulk-btn" data-action="edit" title="' + L.bulk_edit + '">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
      '</button>' +
      '<button class="dm-bulk-btn" data-action="export" title="Export">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>' +
      '</button>' +
      '<button class="dm-bulk-btn" data-action="print" title="Print">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>' +
      '</button>' +
      '<button class="dm-bulk-btn dm-bulk-danger" data-action="delete" title="Delete">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</button>' +
      '<button class="dm-bulk-btn" data-action="clear" title="Clear">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>' +
      '</button>';

    bar.querySelectorAll('.dm-bulk-btn').forEach(function (btn) {
      btn.onclick = function () { handleAction(btn.dataset.action); };
    });
  }

  /* ---------- handle actions ---------- */
  function handleAction(action) {
    const ids = Array.from(Bulk.selected);
    if (!ids.length) return;
    const page = Bulk.page || State.page;

    if (action === 'clear') {
      Bulk.selected.clear();
      document.querySelectorAll('.dm-bulk-checkbox').forEach(function (cb) { cb.checked = false; });
      document.querySelectorAll('.dm-bulk-select-all').forEach(function (sa) { sa.checked = false; sa.indeterminate = false; });
      removeBar();
      return;
    }
    if (action === 'delete') return askDelete(ids, page);
    if (action === 'export') return exportSelected(ids, page);
    if (action === 'print') return printSelected(ids, page);
    if (action === 'edit') return openBulkEdit(ids, page);
  }

  /* ---------- delete ---------- */
  function askDelete(ids, page) {
    const L = I18N[State.lang] || I18N.ar;
    if (typeof confirmDialog === 'function') {
      confirmDialog(L.bulk_delete_confirm + ' (' + ids.length + ')', function () {
        doBulkDelete(ids, page);
      });
    } else if (confirm(L.bulk_delete_confirm + ' (' + ids.length + ')')) {
      doBulkDelete(ids, page);
    }
  }

  function doBulkDelete(ids, page) {
    const idSet = new Set(ids);
    let count = 0;
    const now = new Date().toISOString();
    const user = (State.user && State.user.name) || 'system';

    if (page === 'employees') {
      const toTrash = State.data.employees.filter(function (e) { return idSet.has(e.id); });
      toTrash.forEach(function (e) {
        State.data.trash.push({ id: uid('trash'), type: 'employee', data: e, deletedAt: now, deletedBy: user });
      });
      State.data.employees = State.data.employees.filter(function (e) { return !idSet.has(e.id); });
      count = toTrash.length;
    } else if (page === 'bookings') {
      const toTrash = State.data.bookings.filter(function (e) { return idSet.has(e.id); });
      toTrash.forEach(function (e) {
        State.data.trash.push({ id: uid('trash'), type: 'booking', data: e, deletedAt: now, deletedBy: user });
      });
      State.data.bookings = State.data.bookings.filter(function (e) { return !idSet.has(e.id); });
      count = toTrash.length;
    } else if (page === 'clients') {
      const toTrash = State.data.clients.filter(function (e) { return idSet.has(e.id); });
      toTrash.forEach(function (e) {
        State.data.trash.push({ id: uid('trash'), type: 'client', data: e, deletedAt: now, deletedBy: user });
      });
      State.data.clients = State.data.clients.filter(function (e) { return !idSet.has(e.id); });
      count = toTrash.length;
    } else if (page === 'halls') {
      const toTrash = State.data.halls.filter(function (e) { return idSet.has(e.id); });
      toTrash.forEach(function (e) {
        State.data.trash.push({ id: uid('trash'), type: 'hall', data: e, deletedAt: now, deletedBy: user });
      });
      State.data.halls = State.data.halls.filter(function (e) { return !idSet.has(e.id); });
      count = toTrash.length;
    } else if (page === 'equipment') {
      const toTrash = State.data.equipment.filter(function (e) { return idSet.has(e.id); });
      toTrash.forEach(function (e) {
        State.data.trash.push({ id: uid('trash'), type: 'equipment', data: e, deletedAt: now, deletedBy: user });
      });
      State.data.equipment = State.data.equipment.filter(function (e) { return !idSet.has(e.id); });
      count = toTrash.length;
    } else if (page === 'advances') {
      State.data.advances = State.data.advances.filter(function (e) { return !idSet.has(e.id); });
      count = ids.length;
    } else if (page === 'deductions') {
      State.data.deductions = State.data.deductions.filter(function (e) { return !idSet.has(e.id); });
      count = ids.length;
    } else if (page === 'bonuses') {
      State.data.bonuses = State.data.bonuses.filter(function (e) { return !idSet.has(e.id); });
      count = ids.length;
    } else if (page === 'leaves') {
      State.data.leaves = State.data.leaves.filter(function (e) { return !idSet.has(e.id); });
      count = ids.length;
    }

    if (count) {
      try { saveData(); } catch (e) {}
      try {
        if (typeof logActivity === 'function') {
          logActivity('bulk-delete', page, null, null, { count: count });
        }
      } catch (e) {}
      if (typeof showToast === 'function') {
        var L = I18N[State.lang] || I18N.ar;
        showToast(L.bulk_deleted + ' ' + count, 'success');
      }
    }

    Bulk.selected.clear();
    removeBar();
    setTimeout(function () { navigate(page); }, 200);
  }

  /* ---------- export ---------- */
  function exportSelected(ids, page) {
    const idSet = new Set(ids);
    let headers = [];
    let rows = [];

    if (page === 'employees') {
      headers = ['Code', 'Name', 'Role', 'Phone', 'Day Rate', 'Status'];
      rows = State.data.employees.filter(function (e) { return idSet.has(e.id); }).map(function (e) {
        return [e.code, e.name, e.role, e.phone, e.dayRate, e.status];
      });
    } else if (page === 'bookings') {
      headers = ['ID', 'Date', 'Hall', 'Client', 'Phone', 'Event', 'Start', 'End', 'Cost', 'Status'];
      rows = State.data.bookings.filter(function (e) { return idSet.has(e.id); }).map(function (b) {
        const h = State.data.halls.find(function (x) { return x.id === b.hallId; });
        return [b.id, b.date, h ? (h.name.ar || h.name.en) : '-', b.clientName, b.phone, b.eventType, b.startTime, b.endTime, b.cost, b.status];
      });
    } else if (page === 'clients') {
      headers = ['Name', 'Phone', 'Email', 'Address'];
      rows = State.data.clients.filter(function (e) { return idSet.has(e.id); }).map(function (c) {
        return [c.name, c.phone, c.email, c.address];
      });
    } else if (page === 'equipment') {
      headers = ['Code', 'Name', 'Category', 'Serial', 'Quantity', 'Status'];
      rows = State.data.equipment.filter(function (e) { return idSet.has(e.id); }).map(function (e) {
        return [e.code, e.name, e.category, e.serial, e.quantity, e.status];
      });
    } else if (page === 'halls') {
      headers = ['Code', 'Name', 'Type', 'Status'];
      rows = State.data.halls.filter(function (e) { return idSet.has(e.id); }).map(function (h) {
        return [h.code, (h.name.ar || h.name.en), h.type, h.status];
      });
    } else if (page === 'advances' || page === 'deductions' || page === 'bonuses') {
      headers = ['Employee', 'Amount', 'Date', 'Reason'];
      rows = (State.data[page] || []).filter(function (e) { return idSet.has(e.id); }).map(function (x) {
        const emp = State.data.employees.find(function (e) { return e.id === x.employeeId; });
        return [emp ? emp.name : '-', x.amount, x.date, x.reason];
      });
    } else if (page === 'leaves') {
      headers = ['Employee', 'Type', 'From', 'To', 'Status'];
      rows = (State.data.leaves || []).filter(function (e) { return idSet.has(e.id); }).map(function (l) {
        const emp = State.data.employees.find(function (e) { return e.id === l.employeeId; });
        return [emp ? emp.name : '-', l.type, l.fromDate, l.toDate, l.status];
      });
    } else {
      headers = ['ID'];
      rows = ids.map(function (id) { return [id]; });
    }

    const csv = [headers].concat(rows).map(function (r) {
      return r.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = page + '-selected-' + todayISO() + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') showToast('Exported ✓', 'success');
  }

  /* ---------- print ---------- */
  function printSelected(ids, page) {
    const idSet = new Set(ids);
    const ar = State.lang === 'ar';
    const title = ar ? 'عناصر مختارة' : 'Selected Items';
    let tableHtml = '';

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    if (page === 'employees') {
      const items = State.data.employees.filter(function (e) { return idSet.has(e.id); });
      tableHtml = '<table><thead><tr><th>Code</th><th>Name</th><th>Role</th><th>Phone</th><th>Day Rate</th></tr></thead><tbody>' +
        items.map(function (e) {
          return '<tr><td>' + esc(e.code) + '</td><td>' + esc(e.name) + '</td><td>' + esc(e.role) + '</td><td>' + esc(e.phone) + '</td><td>' + esc(e.dayRate) + '</td></tr>';
        }).join('') + '</tbody></table>';
    } else if (page === 'bookings') {
      const items = State.data.bookings.filter(function (e) { return idSet.has(e.id); });
      tableHtml = '<table><thead><tr><th>Date</th><th>Hall</th><th>Client</th><th>Event</th><th>Time</th><th>Cost</th></tr></thead><tbody>' +
        items.map(function (b) {
          const h = State.data.halls.find(function (x) { return x.id === b.hallId; });
          return '<tr><td>' + fmtDate(b.date) + '</td><td>' + esc(h ? (h.name.ar || h.name.en) : '-') + '</td><td>' + esc(b.clientName) + '</td><td>' + esc(b.eventType) + '</td><td>' + esc(b.startTime) + '-' + esc(b.endTime) + '</td><td>' + esc(b.cost) + '</td></tr>';
        }).join('') + '</tbody></table>';
    } else {
      tableHtml = '<table><thead><tr><th>ID</th></tr></thead><tbody>' +
        ids.map(function (id) { return '<tr><td>' + esc(id) + '</td></tr>'; }).join('') +
        '</tbody></table>';
    }

    const w = window.open('', '_blank', 'width=900,height=800');
    if (!w) {
      if (typeof showToast === 'function') showToast('Please allow popups', 'warn');
      return;
    }

    const styles = 'body{font-family:Cairo,Inter,sans-serif;padding:2rem;direction:' + (ar ? 'rtl' : 'ltr') + ';color:#0f172a}'
      + 'table{width:100%;border-collapse:collapse;font-size:.85rem}'
      + 'th,td{padding:.5rem;border-bottom:1px solid #e5e7eb;text-align:' + (ar ? 'right' : 'left') + '}'
      + 'th{background:#f3f4f6;font-weight:700}'
      + 'h1{color:#7c3aed;font-size:1.3rem}'
      + '.meta{color:#64748b;font-size:.75rem;margin-bottom:1rem}'
      + '@media print{body{padding:0}}';

    w.document.write('<!DOCTYPE html><html lang="' + State.lang + '" dir="' + (ar ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><title>' + title + '</title><style>' + styles + '</style></head><body>'
      + '<h1>Dr Media Pro — ' + title + '</h1>'
      + '<div class="meta">' + new Date().toLocaleString() + ' · ' + ids.length + ' items</div>'
      + tableHtml
      + '<scr' + 'ipt>setTimeout(function(){window.print()},300);</scr' + 'ipt>'
      + '</body></html>');
    w.document.close();
  }

  /* ---------- bulk edit ---------- */
  function getEditableFields(page) {
    const L = I18N[State.lang] || I18N.ar;
    const ar = State.lang === 'ar';

    if (page === 'employees') {
      return [
        { key: 'role', label: ar ? 'الوظيفة' : 'Role', type: 'select', options: ['Director', 'Photographer', 'Crane', 'Supervisor', 'Assistant'] },
        { key: 'status', label: ar ? 'الحالة' : 'Status', type: 'select', options: ['active', 'inactive'] },
        { key: 'dayRate', label: ar ? 'سعر اليوم' : 'Day Rate', type: 'number' }
      ];
    }
    if (page === 'bookings') {
      return [
        { key: 'status', label: ar ? 'الحالة' : 'Status', type: 'select', options: ['pending', 'confirmed', 'completed', 'cancelled'] },
        { key: 'paymentStatus', label: ar ? 'حالة الدفع' : 'Payment', type: 'select', options: ['unpaid', 'partial', 'paid'] },
        { key: 'eventType', label: ar ? 'نوع المناسبة' : 'Event', type: 'select', options: ['Wedding', 'Engagement', 'Birthday', 'Corporate', 'Other'] }
      ];
    }
    if (page === 'equipment') {
      return [
        { key: 'status', label: ar ? 'الحالة' : 'Status', type: 'select', options: ['available', 'assigned', 'maintenance', 'lost', 'damaged'] },
        { key: 'location', label: ar ? 'الموقع' : 'Location', type: 'text' }
      ];
    }
    return null;
  }

  function openBulkEdit(ids, page) {
    const L = I18N[State.lang] || I18N.ar;
    const fields = getEditableFields(page);

    if (!fields) {
      if (typeof showToast === 'function') showToast(
        State.lang === 'ar' ? 'التعديل الجماعي غير متاح لهذه الصفحة' : 'Bulk edit not available for this page',
        'warn'
      );
      return;
    }

    if (typeof openModal !== 'function') return;

    let bodyHtml = '<div style="display:flex;flex-direction:column;gap:1rem">';
    bodyHtml += '<div style="padding:.75rem;background:rgba(124,58,237,.08);border-radius:10px;font-size:.85rem;color:var(--primary)">'
      + '<b>' + ids.length + '</b> ' + (State.lang === 'ar' ? 'عنصر' : 'items') + ' — ' + L.bulk_edit_hint
      + '</div>';

    fields.forEach(function (f) {
      bodyHtml += '<div class="field"><label>' + f.label + '</label>';
      if (f.type === 'select') {
        bodyHtml += '<select id="dm-bulk-f-' + f.key + '">'
          + '<option value="">— ' + L.bulk_no_change + ' —</option>'
          + f.options.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('')
          + '</select>';
      } else if (f.type === 'number') {
        bodyHtml += '<input type="number" id="dm-bulk-f-' + f.key + '" placeholder="' + L.bulk_leave_empty + '">';
      } else {
        bodyHtml += '<input type="text" id="dm-bulk-f-' + f.key + '" placeholder="' + L.bulk_leave_empty + '">';
      }
      bodyHtml += '</div>';
    });
    bodyHtml += '</div>';

    openModal({
      title: '✏️ ' + L.bulk_edit,
      body: bodyHtml,
      footer: '<button class="btn btn-ghost" onclick="closeModal()">' + (State.lang === 'ar' ? 'إلغاء' : 'Cancel') + '</button>'
        + '<button class="btn btn-primary" onclick="__dmBulkApplyEdit()">' + L.bulk_apply + '</button>'
    });

    window.__dmBulkEditCtx = { ids: ids, page: page, fields: fields };
  }

  window.__dmBulkApplyEdit = function () {
    const ctx = window.__dmBulkEditCtx;
    if (!ctx) return;
    const L = I18N[State.lang] || I18N.ar;
    const changes = {};

    ctx.fields.forEach(function (f) {
      const el = document.getElementById('dm-bulk-f-' + f.key);
      if (!el) return;
      const v = el.value.trim();
      if (v === '') return;
      changes[f.key] = f.type === 'number' ? parseFloat(v) : v;
    });

    if (!Object.keys(changes).length) {
      if (typeof showToast === 'function') showToast(L.bulk_no_changes, 'warn');
      return;
    }

    const idSet = new Set(ctx.ids);
    let count = 0;

    if (ctx.page === 'employees') {
      State.data.employees.forEach(function (e) {
        if (idSet.has(e.id)) {
          Object.keys(changes).forEach(function (k) { e[k] = changes[k]; });
          if (changes.role) e.roles = [changes.role];
          count++;
        }
      });
    } else if (ctx.page === 'bookings') {
      State.data.bookings.forEach(function (b) {
        if (idSet.has(b.id)) {
          Object.keys(changes).forEach(function (k) { b[k] = changes[k]; });
          count++;
        }
      });
    } else if (ctx.page === 'equipment') {
      State.data.equipment.forEach(function (e) {
        if (idSet.has(e.id)) {
          Object.keys(changes).forEach(function (k) { e[k] = changes[k]; });
          count++;
        }
      });
    }

    try { saveData(); } catch (e) {}
    try {
      if (typeof logActivity === 'function') {
        logActivity('bulk-edit', ctx.page, null, null, { count: count, changes: changes });
      }
    } catch (e) {}

    if (typeof showToast === 'function') showToast(L.bulk_updated + ' ' + count, 'success');
    if (typeof closeModal === 'function') closeModal();

    Bulk.selected.clear();
    removeBar();
    setTimeout(function () { navigate(ctx.page); }, 300);
  };

  /* ---------- observers + hooks ---------- */
  function hookNavigate() {
    if (typeof window.navigate !== 'function') return;
    const orig = window.navigate;
    window.navigate = function () {
      // Clear selection when page changes
      const newPage = arguments[0];
      if (newPage && newPage !== Bulk.page) {
        Bulk.selected.clear();
        removeBar();
      }
      const r = orig.apply(this, arguments);
      setTimeout(function () { injectCheckboxes(); }, 280);
      return r;
    };
  }

  function watchContentMutations() {
    const target = document.getElementById('content');
    if (!target) return;
    const obs = new MutationObserver(function () {
      clearTimeout(window.__dmBulkObsT);
      window.__dmBulkObsT = setTimeout(function () {
        injectCheckboxes();
      }, 200);
    });
    obs.observe(target, { childList: true, subtree: true });
  }

  /* ---------- boot ---------- */
  waitFor(
    function () {
      return typeof State !== 'undefined'
        && typeof Pages !== 'undefined'
        && typeof navigate === 'function'
        && document.getElementById('content');
    },
    function () {
      hookNavigate();
      watchContentMutations();
      injectCheckboxes();
      console.log('%c[Section 19] ✓ Bulk Selection ready', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 19] Select rows → floating bar appears', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 21: Import v3 (Table-aware + Hall grouping)
   Version: 3.0.0
   ---------------------------------------------------------
   - Better OCR settings (tables)
   - Robust parser for the exact table format
   - Review UI grouped by hall
   - Debug panel showing raw OCR text
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 21] Import v3 loading…', 'color:#f97316;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 21] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.unified_import = 'استيراد ذكي';
  I18N.ar.ui_title = 'استيراد الحجوزات (PDF / صور / Excel)';
  I18N.ar.ui_dropzone = 'اضغط لاختيار ملف أو اسحبه هنا';
  I18N.ar.ui_supported = 'PDF · PNG · JPG · WEBP · XLSX · XLS · CSV';
  I18N.ar.ui_reading = 'جاري القراءة…';
  I18N.ar.ui_ocr = 'جاري التعرف على النص (OCR)…';
  I18N.ar.ui_excel_loading = 'تحميل مكتبة Excel…';
  I18N.ar.ui_review = 'مراجعة النتائج';
  I18N.ar.ui_found = 'تم العثور على';
  I18N.ar.ui_bookings = 'حجز';
  I18N.ar.ui_import_all = 'حفظ الكل';
  I18N.ar.ui_imported = 'تم الاستيراد';
  I18N.ar.ui_no_data = 'لم يتم التعرف على أي حجز';
  I18N.ar.ui_try_again = 'محاولة أخرى';
  I18N.ar.ui_show_raw = 'عرض النص المستخرج';
  I18N.ar.ui_hide_raw = 'إخفاء النص';
  I18N.ar.ui_paste = 'لصق نص يدويًا';
  I18N.ar.ui_paste_title = 'الصق نص الجدول';
  I18N.ar.ui_paste_hint = 'انسخ النص من صورة (بـ OCR خارجي) أو اكتبه يدويًا';
  I18N.ar.ui_parse = 'تحليل النص';
  I18N.ar.ui_debug = 'معاينة نص الـ OCR';
  I18N.ar.ui_analysis = 'تحليل الملف';
  I18N.ar.ui_total = 'إجمالي الحجوزات';
  I18N.ar.ui_guests = 'إجمالي الأفراد';
  I18N.ar.ui_per_hall = 'حسب القاعة';
  I18N.ar.ui_date_range = 'نطاق التاريخ';
  I18N.ar.ui_all_halls = 'كل القاعات';
  I18N.ar.ui_hall_section = 'القاعة';

  I18N.en.unified_import = 'Smart Import';
  I18N.en.ui_title = 'Import bookings (PDF / Images / Excel)';
  I18N.en.ui_dropzone = 'Click to choose file or drag it here';
  I18N.en.ui_supported = 'PDF · PNG · JPG · WEBP · XLSX · XLS · CSV';
  I18N.en.ui_reading = 'Reading…';
  I18N.en.ui_ocr = 'Running OCR…';
  I18N.en.ui_excel_loading = 'Loading Excel library…';
  I18N.en.ui_review = 'Review Results';
  I18N.en.ui_found = 'Found';
  I18N.en.ui_bookings = 'bookings';
  I18N.en.ui_import_all = 'Save All';
  I18N.en.ui_imported = 'Imported';
  I18N.en.ui_no_data = 'No bookings detected';
  I18N.en.ui_try_again = 'Try again';
  I18N.en.ui_show_raw = 'Show raw text';
  I18N.en.ui_hide_raw = 'Hide raw text';
  I18N.en.ui_paste = 'Paste text manually';
  I18N.en.ui_paste_title = 'Paste table text';
  I18N.en.ui_paste_hint = 'Copy text from OCR or type manually';
  I18N.en.ui_parse = 'Parse text';
  I18N.en.ui_debug = 'OCR debug';
  I18N.en.ui_analysis = 'File Analysis';
  I18N.en.ui_total = 'Total bookings';
  I18N.en.ui_guests = 'Total guests';
  I18N.en.ui_per_hall = 'Per hall';
  I18N.en.ui_date_range = 'Date range';
  I18N.en.ui_all_halls = 'All halls';
  I18N.en.ui_hall_section = 'Hall';

  /* ---------- state ---------- */
  var Un = {
    file: null,
    fileName: '',
    fileType: '',
    rawText: '',
    parsed: [],
    busy: false,
    status: '',
    showRaw: false,
    analysis: null,
    activeHallId: 'all'
  };
  window.__dmImportV3 = Un;

  /* ---------- utilities ---------- */
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function toAsciiDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48); })
      .replace(/[۰-۹]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid2(p) { return (p || 'x') + '_' + Math.random().toString(36).slice(2, 9); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- date ---------- */
  function parseDate(input) {
    if (!input) return null;
    if (input instanceof Date) {
      return input.getFullYear() + '-' + pad2(input.getMonth() + 1) + '-' + pad2(input.getDate());
    }
    var t = toAsciiDigits(String(input)).trim();
    var m1 = t.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m1) {
      var yy = parseInt(m1[1]), mo = parseInt(m1[2]), dd = parseInt(m1[3]);
      if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) return yy + '-' + pad2(mo) + '-' + pad2(dd);
    }
    var m2 = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m2) {
      var d2 = parseInt(m2[1]), m2v = parseInt(m2[2]), y2 = parseInt(m2[3]);
      if (y2 < 100) y2 += y2 < 50 ? 2000 : 1900;
      if (m2v >= 1 && m2v <= 12 && d2 >= 1 && d2 <= 31) return y2 + '-' + pad2(m2v) + '-' + pad2(d2);
    }
    var monthMap = {
      'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'مايو': 5, 'يونيو': 6,
      'يوليو': 7, 'اغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7,
      'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    };
    var nn = norm(t);
    for (var k in monthMap) {
      if (nn.indexOf(norm(k)) >= 0) {
        var dm = nn.match(/(\d{1,2})/);
        var ym = nn.match(/(20\d{2}|19\d{2})/);
        var day = dm ? parseInt(dm[1]) : 1;
        var year = ym ? parseInt(ym[1]) : new Date().getFullYear();
        if (day >= 1 && day <= 31) return year + '-' + pad2(monthMap[k]) + '-' + pad2(day);
      }
    }
    return null;
  }

  /* ---------- phones ---------- */
  function parsePhone(text) {
    var t = toAsciiDigits(text);
    var m = t.match(/(?:\+?20|0020)?\s*0?1[0125]\s*\d[\s\d]{7,9}/);
    if (m) {
      var d = m[0].replace(/[^\d]/g, '');
      if (d.indexOf('0020') === 0) return '0' + d.slice(4, 14);
      if (d.indexOf('20') === 0) return '0' + d.slice(2, 12);
      if (d.charAt(0) === '1' && d.length === 10) return '0' + d;
      return d.slice(0, 11);
    }
    return '';
  }

  /* ---------- hall detection ---------- */
  var HALL_KEYWORDS = [
    { key: 'closed', words: ['المغلقه', 'المغلقة', 'قاعه المغلقه', 'مغلقه'], ids: ['مغلقه', 'مغلقة', 'closed'] },
    { key: 'open', words: ['الاوبن', 'الأوبن', 'اوبن', 'قاعه الاوبن', 'قاعه الاوبن'], ids: ['اوبن', 'مفتوح', 'open'] },
    { key: 'small', words: ['الصغيره', 'الصغيرة', 'قاعه الصغيره', 'صغيره'], ids: ['صغيره', 'small'] },
    { key: 'cafe', words: ['الكافيه', 'الكافي', 'كافيه', 'كافي'], ids: ['كافيه', 'كافي', 'cafe'] }
  ];

  function detectHallKey(text) {
    var n = norm(text);
    if (!n) return null;
    for (var i = 0; i < HALL_KEYWORDS.length; i++) {
      var hk = HALL_KEYWORDS[i];
      for (var j = 0; j < hk.words.length; j++) {
        if (n.indexOf(norm(hk.words[j])) >= 0) return hk;
      }
    }
    return null;
  }

  function matchHallIdByKey(key) {
    var halls = (State.data && State.data.halls) || [];
    var hk = HALL_KEYWORDS.find(function (x) { return x.key === key; });
    if (!hk) return halls.length ? halls[0].id : '';
    for (var i = 0; i < halls.length; i++) {
      var h = halls[i];
      var ar = norm(h.name.ar || '');
      var en = norm(h.name.en || '');
      var code = norm(h.code || '');
      for (var j = 0; j < hk.ids.length; j++) {
        var needle = norm(hk.ids[j]);
        if (ar.indexOf(needle) >= 0 || en.indexOf(needle) >= 0 || code === needle) return h.id;
      }
    }
    return halls.length ? halls[0].id : '';
  }

  /* ---------- event detection ---------- */
  var EVENT_RULES = [
    { key: 'Wedding', words: ['عشاء', 'فرح', 'زفاف', 'زواج'] },
    { key: 'Engagement', words: ['سواريه', 'خطوبه', 'خطوبة', 'مطبخ'] },
    { key: 'Henna', words: ['حنه', 'حنة', 'حناء'] },
    { key: 'Birthday', words: ['هاي تي', 'هاى تى', 'عيد ميلاد'] },
    { key: 'Corporate', words: ['مؤتمر', 'اجتماع', 'ندوه'] }
  ];

  function detectEvent(text) {
    var n = norm(text);
    if (!n) return null;
    for (var i = 0; i < EVENT_RULES.length; i++) {
      var r = EVENT_RULES[i];
      for (var j = 0; j < r.words.length; j++) {
        if (n.indexOf(norm(r.words[j])) >= 0) return r.key;
      }
    }
    return null;
  }

  /* ---------- DAY NAMES ---------- */
  var DAY_NAMES = ['الخميس', 'الجمعه', 'الجمعة', 'السبت', 'الاحد', 'الأحد', 'الاثنين', 'الإثنين', 'الثلاثاء', 'الاربعاء', 'الأربعاء'];

  /* =========================================================
     PARSER — line-based, robust for the exact table format
     ========================================================= */
  function extractFromLine(line, currentHallId) {
    var original = line;
    var working = ' ' + toAsciiDigits(line) + ' ';

    // 1. DATE
    var dateMatch = working.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!dateMatch) return null;
    var date = parseDate(dateMatch[0]);
    if (!date) return null;
    working = working.replace(dateMatch[0], ' ');

    // 2. DAY NAME
    var dayName = '';
    for (var di = 0; di < DAY_NAMES.length; di++) {
      var d = DAY_NAMES[di];
      if (working.indexOf(d) >= 0) {
        dayName = d;
        working = working.replace(new RegExp(d, 'g'), ' ');
        break;
      }
    }

    // 3. PACKAGE (عشاء / سواريه / هاي تي / مطبخ) — remove it and adjacent digit
    var pkgType = '';
    var pkgKeywords = ['عشاء', 'سواريه', 'سوارية', 'هاي تي', 'هاى تى', 'هاي تى', 'مطبخ', 'عشا', 'سواريه'];
    for (var pi = 0; pi < pkgKeywords.length; pi++) {
      var p = pkgKeywords[pi];
      var idx = working.indexOf(p);
      if (idx >= 0) {
        pkgType = p;
        var after = working.substring(idx + p.length);
        var afterTrim = after.replace(/^\s*\d+\s*/, ''); // remove optional trailing number
        working = working.substring(0, idx) + ' ' + afterTrim;
        break;
      }
    }

    // 4. COUNT (last number >= 100 and <= 2000)
    var nums = working.match(/\b\d+\b/g) || [];
    var count = 0;
    for (var ni = 0; ni < nums.length; ni++) {
      var v = parseInt(nums[ni]);
      if (v >= 100 && v <= 2000) {
        if (v > count) count = v;
      }
    }
    if (count > 0) {
      working = working.replace(new RegExp('\\b' + count + '\\b'), ' ');
    }

    // 5. CLIENT NAME — remaining Arabic words
    var words = working.split(/\s+/).filter(function (w) {
      return w.length >= 2 && /[\u0600-\u06FF]/.test(w);
    });
    // Filter out noise words
    var stopWords = ['شهر', 'اكتوبر', 'نوفمبر', 'سبتمبر', 'ديسمبر', 'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس'];
    words = words.filter(function (w) { return stopWords.indexOf(norm(w)) < 0; });
    var clientName = words.slice(0, 5).join(' ').trim();

    // 6. EVENT from package + line
    var eventType = detectEvent(pkgType + ' ' + working) || 'Wedding';

    if (!clientName && count === 0) return null;

    return {
      date: date,
      dayName: dayName,
      clientName: clientName || 'عميل',
      phone: '',
      hallId: currentHallId,
      eventType: eventType,
      packageType: pkgType,
      guestsCount: count,
      cost: 0,
      startTime: '19:00',
      endTime: '23:00',
      notes: '',
      confidence: (clientName && date) ? 'high' : 'medium',
      raw: original.slice(0, 200)
    };
  }

  /* ---------- main text parser ---------- */
  function parseRawText(rawText) {
    if (!rawText) return [];
    var text = toAsciiDigits(rawText);
    var lines = text.split(/\r?\n/).map(function (l) {
      return l.replace(/[ \t]+/g, ' ').trim();
    }).filter(function (l) { return l.length > 0; });

    var results = [];
    var currentHallId = matchHallIdByKey('closed');
    var currentHallKey = 'closed';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Skip if line is a column header
      if (/اليوم|التاريخ|اسم العميل|الباكدج|عدد الافراد|عدد الأفراد/.test(line) && !/\d{1,2}[\/\-.]\d{1,2}/.test(line)) {
        continue;
      }

      // Section header detection
      var hallHit = detectHallKey(line);
      if (hallHit && line.length < 60) {
        currentHallKey = hallHit.key;
        currentHallId = matchHallIdByKey(hallHit.key);
        continue;
      }

      // Try extract a booking from the line
      var rec = extractFromLine(line, currentHallId);
      if (rec) results.push(rec);
    }

    // Deduplicate consecutive identical
    var filtered = [];
    for (var k = 0; k < results.length; k++) {
      var r = results[k];
      if (filtered.length) {
        var prev = filtered[filtered.length - 1];
        if (prev.date === r.date && prev.clientName === r.clientName) continue;
      }
      filtered.push(r);
    }

    return filtered;
  }

  window.__dmParseText = function (text) {
    var parsed = parseRawText(text);
    console.log('Parsed:', parsed);
    return parsed;
  };

  /* ---------- Excel parser ---------- */
  var COL_KEYS = {
    date: ['التاريخ', 'تاريخ', 'date', 'day', 'booking date'],
    clientName: ['العميل', 'اسم العميل', 'الاسم', 'client', 'customer', 'name', 'guest'],
    phone: ['الهاتف', 'هاتف', 'تليفون', 'الموبايل', 'phone', 'mobile', 'tel'],
    hall: ['القاعة', 'قاعه', 'hall', 'venue'],
    eventType: ['المناسبة', 'مناسبه', 'النوع', 'event', 'type'],
    package: ['الباكدج', 'باكدج', 'الباقة', 'package', 'menu'],
    guestsCount: ['عدد الأفراد', 'عدد الافراد', 'الأفراد', 'الافراد', 'عدد', 'guests', 'count', 'pax'],
    cost: ['التكلفة', 'تكلفة', 'السعر', 'cost', 'price', 'amount'],
    notes: ['ملاحظات', 'notes', 'comment']
  };

  function detectColumnMap(row) {
    if (!row || !row.length) return null;
    var map = {};
    for (var i = 0; i < row.length; i++) {
      var cell = String(row[i] == null ? '' : row[i]).trim();
      if (!cell) continue;
      var n = norm(cell);
      for (var key in COL_KEYS) {
        if (map[key] !== undefined) continue;
        var words = COL_KEYS[key];
        for (var w = 0; w < words.length; w++) {
          var nw = norm(words[w]);
          if (!nw) continue;
          if (n === nw || n.indexOf(nw) >= 0) { map[key] = i; break; }
        }
      }
    }
    return map;
  }

  function parseExcelSheet(rows, sheetNameHint) {
    var bookings = [];
    var initialHallKey = detectHallKey(sheetNameHint || '');
    var currentHallId = initialHallKey ? matchHallIdByKey(initialHallKey.key) : matchHallIdByKey('closed');
    var colMap = null;
    var detectedCols = null;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || !row.length) continue;
      var nonEmpty = row.filter(function (c) { return c !== '' && c !== null && c !== undefined; });
      if (!nonEmpty.length) continue;

      // Section header (single cell)
      if (nonEmpty.length === 1) {
        var hit = detectHallKey(String(nonEmpty[0]));
        if (hit) { currentHallId = matchHallIdByKey(hit.key); colMap = null; continue; }
      }

      // Header row
      var detected = detectColumnMap(row);
      if (detected && detected.date !== undefined && detected.clientName !== undefined) {
        colMap = detected;
        detectedCols = detected;
        continue;
      }

      // Data row
      if (colMap) {
        var date = colMap.date !== undefined ? parseDate(row[colMap.date]) : null;
        var clientName = colMap.clientName !== undefined ? String(row[colMap.clientName] || '').trim() : '';
        var phone = colMap.phone !== undefined ? parsePhone(row[colMap.phone]) : '';
        var hallId = currentHallId;
        if (colMap.hall !== undefined) {
          var hh = String(row[colMap.hall] || '').trim();
          var dh = detectHallKey(hh);
          if (dh) hallId = matchHallIdByKey(dh.key);
        }
        var eventType = 'Wedding';
        if (colMap.eventType !== undefined) {
          var ev = detectEvent(String(row[colMap.eventType] || ''));
          if (ev) eventType = ev;
        }
        if (colMap.package !== undefined) {
          var ev2 = detectEvent(String(row[colMap.package] || ''));
          if (ev2) eventType = ev2;
        }
        var guestsCount = 0;
        if (colMap.guestsCount !== undefined) {
          var gv = toAsciiDigits(String(row[colMap.guestsCount] || '')).replace(/[^\d]/g, '');
          guestsCount = parseInt(gv) || 0;
        }
        var cost = 0;
        if (colMap.cost !== undefined) {
          var cv = toAsciiDigits(String(row[colMap.cost] || '')).replace(/[^\d.]/g, '');
          cost = parseFloat(cv) || 0;
        }
        var notes = colMap.notes !== undefined ? String(row[colMap.notes] || '').trim() : '';

        if (!date && !clientName) continue;
        if (!clientName) continue;

        bookings.push({
          date: date || todayISO(),
          clientName: clientName,
          phone: phone,
          hallId: hallId,
          eventType: eventType,
          guestsCount: guestsCount,
          cost: cost,
          startTime: '19:00',
          endTime: '23:00',
          notes: notes,
          confidence: (date && clientName) ? 'high' : 'medium',
          raw: row.join(' | ').slice(0, 200)
        });
      }
    }
    return { bookings: bookings, cols: detectedCols };
  }

  function parseExcel(arrayBuffer) {
    if (!window.XLSX) throw new Error('Excel library not loaded');
    var wb = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
    var all = [];
    var cols = null;
    for (var s = 0; s < wb.SheetNames.length; s++) {
      var sheetName = wb.SheetNames[s];
      var ws = wb.Sheets[sheetName];
      var rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false });
      var res = parseExcelSheet(rows, sheetName);
      all = all.concat(res.bookings);
      if (res.cols && !cols) cols = res.cols;
    }
    return { bookings: all, cols: cols };
  }

  /* ---------- library loaders ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function ensurePdfJs() {
    if (window.pdfjsLib) return;
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  async function ensureTesseract() {
    if (window.Tesseract) return;
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js');
  }
  async function ensureXLSX() {
    if (window.XLSX) return;
    Un.status = I18N[State.lang].ui_excel_loading;
    updateStatusUI();
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  }

  /* ---------- readers ---------- */
  async function readPdf(file) {
    await ensurePdfJs();
    var buf = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    var text = '';
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var pageText = content.items.map(function (it) { return it.str; }).join('\n');
      text += pageText + '\n';
    }
    return text;
  }

  async function readImage(file) {
    await ensureTesseract();
    // Better OCR for tables
    var result = await window.Tesseract.recognize(file, 'ara+eng', {
      logger: function (m) {
        if (m.status === 'recognizing text') {
          Un.status = I18N[State.lang].ui_ocr + ' ' + Math.round(m.progress * 100) + '%';
          updateStatusUI();
        }
      },
      tessedit_pageseg_mode: '6', // Uniform block
      preserve_interword_spaces: '1'
    });
    return result.data.text;
  }

  async function readExcel(file) {
    await ensureXLSX();
    var buf = await file.arrayBuffer();
    return parseExcel(buf);
  }

  /* ---------- analysis ---------- */
  function analyze(bookings) {
    if (!bookings || !bookings.length) return null;
    var perHall = {};
    var perEvent = {};
    var totalGuests = 0;
    var minDate = null, maxDate = null;

    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      var hName = matchHallIdName(b.hallId);
      perHall[hName] = (perHall[hName] || 0) + 1;
      perEvent[b.eventType] = (perEvent[b.eventType] || 0) + 1;
      totalGuests += b.guestsCount || 0;
      if (b.date) {
        if (!minDate || b.date < minDate) minDate = b.date;
        if (!maxDate || b.date > maxDate) maxDate = b.date;
      }
    }
    return { total: bookings.length, totalGuests: totalGuests, perHall: perHall, perEvent: perEvent, minDate: minDate, maxDate: maxDate };
  }

  function matchHallIdName(id) {
    var halls = (State.data && State.data.halls) || [];
    for (var i = 0; i < halls.length; i++) {
      if (halls[i].id === id) return halls[i].name[State.lang] || halls[i].name.ar;
    }
    return '(بدون قاعة)';
  }

  /* ---------- process file ---------- */
  async function processFile(file) {
    if (!file) return;
    Un.file = file;
    Un.fileName = file.name;
    Un.parsed = [];
    Un.rawText = '';
    Un.analysis = null;
    Un.busy = true;
    Un.status = I18N[State.lang].ui_reading;
    Un.activeHallId = 'all';
    navigate('importsmart');
    updateStatusUI();

    try {
      var name = (file.name || '').toLowerCase();
      var type = (file.type || '').toLowerCase();
      var isPdf = type === 'application/pdf' || /\.pdf$/.test(name);
      var isExcel = /\.(xlsx|xls|csv)$/.test(name) || type.indexOf('spreadsheet') >= 0 || type.indexOf('excel') >= 0 || type === 'text/csv';
      var isImage = type.indexOf('image/') === 0 || /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(name);

      Un.fileType = isPdf ? 'pdf' : isExcel ? 'excel' : isImage ? 'image' : 'unknown';

      if (isExcel) {
        var res = await readExcel(file);
        Un.parsed = res.bookings || [];
      } else if (isPdf) {
        Un.rawText = await readPdf(file);
        Un.parsed = parseRawText(Un.rawText);
      } else if (isImage) {
        Un.status = I18N[State.lang].ui_ocr + '…';
        updateStatusUI();
        Un.rawText = await readImage(file);
        Un.parsed = parseRawText(Un.rawText);
      } else {
        throw new Error('نوع الملف غير مدعوم');
      }

      Un.analysis = analyze(Un.parsed);
      Un.busy = false;
      Un.status = '';
      navigate('importsmart');
      if (typeof showToast === 'function') {
        var L = I18N[State.lang];
        showToast(L.ui_found + ' ' + Un.parsed.length + ' ' + L.ui_bookings, Un.parsed.length ? 'success' : 'warn');
      }
    } catch (err) {
      console.error('[Section 21]', err);
      Un.busy = false;
      Un.status = '';
      if (typeof showToast === 'function') showToast('خطأ: ' + (err.message || err), 'error');
      navigate('importsmart');
    }
  }

  function updateStatusUI() {
    var s = document.getElementById('ui-status');
    if (s) s.textContent = Un.status || '';
  }

  /* =========================================================
     RENDER
     ========================================================= */
  Pages.importsmart = function (el) {
    if (Un.busy) {
      el.innerHTML =
        '<div class="card" style="max-width:520px;margin:2rem auto;text-align:center;padding:3rem 2rem">' +
        '<div style="font-size:3rem;margin-bottom:1rem">📄</div>' +
        '<div style="font-size:1rem;font-weight:700;margin-bottom:.5rem">' + esc(Un.status || I18N[State.lang].ui_reading) + '</div>' +
        '<div id="ui-status" style="font-size:.8rem;color:var(--text-muted);margin-top:1rem">' + esc(Un.fileName) + '</div>' +
        '</div>';
      return;
    }
    if (Un.parsed.length > 0) renderReview(el);
    else renderUpload(el);
  };

  function renderUpload(el) {
    var L = I18N[State.lang];
    el.innerHTML =
      '<div style="max-width:680px;margin:1rem auto">' +
      '<div class="card" style="padding:2rem">' +
        '<div style="text-align:center;margin-bottom:1.5rem">' +
          '<div style="font-size:3rem;margin-bottom:.5rem">📥</div>' +
          '<h3 style="margin:0 0 .35rem;font-size:1.15rem">' + esc(L.ui_title) + '</h3>' +
        '</div>' +
        '<div id="ui-dropzone" style="border:3px dashed var(--border);border-radius:16px;padding:3rem 1.5rem;text-align:center;cursor:pointer;background:var(--surface-2);transition:all .2s">' +
          '<div style="font-size:2.5rem;margin-bottom:.5rem">📁</div>' +
          '<div style="font-weight:700;font-size:.95rem;margin-bottom:.35rem">' + esc(L.ui_dropzone) + '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted)">' + esc(L.ui_supported) + '</div>' +
        '</div>' +
        '<input type="file" id="ui-file" accept="application/pdf,image/*,.xlsx,.xls,.csv" style="display:none">' +
        '<div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">' +
          '<button class="btn btn-ghost btn-sm" onclick="__dmPasteText()"><i data-lucide="clipboard-paste"></i> ' + esc(L.ui_paste) + '</button>' +
        '</div>' +
        (Un.rawText && !Un.parsed.length ?
          '<div style="margin-top:1rem;padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;font-size:.85rem;color:#ef4444;text-align:center">⚠️ ' + esc(L.ui_no_data) + '</div>' : '') +
      '</div>' +
      '<div class="card" style="margin-top:1rem;background:rgba(124,58,237,.05);border-color:rgba(124,58,237,.2)">' +
        '<div style="font-size:.78rem;color:var(--text-muted);line-height:1.9">' +
          '<b style="color:var(--primary)">💡 الأفضل:</b><br>' +
          '• <b>Excel / CSV</b>: أسرع وأدق 100%<br>' +
          '• <b>PDF</b>: لو النص مكتوب مش ممسوح ضوئيًا<br>' +
          '• <b>صور</b>: ممكن OCR يغلط — استخدم "لصق نص يدويًا" لو مش دقيق' +
        '</div>' +
      '</div>' +
      '</div>';

    var dz = document.getElementById('ui-dropzone');
    var fi = document.getElementById('ui-file');
    if (dz && fi) {
      dz.onclick = function () { fi.click(); };
      fi.onchange = function (e) { if (e.target.files[0]) processFile(e.target.files[0]); };
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.style.borderColor = 'var(--primary)'; dz.style.background = 'rgba(124,58,237,.08)'; });
      dz.addEventListener('dragleave', function () { dz.style.borderColor = 'var(--border)'; dz.style.background = 'var(--surface-2)'; });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--border)';
        dz.style.background = 'var(--surface-2)';
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
      });
    }
    if (window.lucide) lucide.createIcons();
  }

  /* ---------- review with HALL GROUPING ---------- */
  function renderReview(el) {
    var L = I18N[State.lang];
    var halls = State.data.halls || [];
    var rows = Un.parsed;
    var analysis = Un.analysis;

    // Group by hall
    var grouped = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var hid = r.hallId || 'unknown';
      grouped[hid] = grouped[hid] || [];
      grouped[hid].push({ row: r, globalIdx: i });
    }

    var hallIds = Object.keys(grouped);

    // Active filter
    var activeHallId = Un.activeHallId || 'all';
    var visibleGroups = activeHallId === 'all'
      ? hallIds.map(function (hid) { return { hallId: hid, items: grouped[hid] }; })
      : (grouped[activeHallId] ? [{ hallId: activeHallId, items: grouped[activeHallId] }] : []);

    // Analysis
    var analysisHtml = '';
    if (analysis) {
      var hallRows = Object.keys(analysis.perHall).map(function (k) {
        return '<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.8rem"><span>' + esc(k) + '</span><b>' + analysis.perHall[k] + '</b></div>';
      }).join('');
      var evRows = Object.keys(analysis.perEvent).map(function (k) {
        return '<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.8rem"><span>' + esc(k) + '</span><b>' + analysis.perEvent[k] + '</b></div>';
      }).join('');

      analysisHtml =
        '<div class="card" style="margin-bottom:1rem">' +
          '<div style="font-weight:700;margin-bottom:.75rem"><i data-lucide="bar-chart-3" style="width:16px;height:16px;display:inline;vertical-align:-3px;color:var(--primary)"></i> ' + esc(L.ui_analysis) + '</div>' +
          '<div class="grid-3" style="margin-bottom:1rem">' +
            '<div style="padding:.75rem;background:var(--surface-2);border-radius:10px;text-align:center">' +
              '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:.25rem">' + esc(L.ui_total) + '</div>' +
              '<div style="font-size:1.35rem;font-weight:800;color:var(--primary)">' + analysis.total + '</div>' +
            '</div>' +
            '<div style="padding:.75rem;background:var(--surface-2);border-radius:10px;text-align:center">' +
              '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:.25rem">' + esc(L.ui_guests) + '</div>' +
              '<div style="font-size:1.35rem;font-weight:800;color:#f59e0b">' + analysis.totalGuests.toLocaleString() + '</div>' +
            '</div>' +
            '<div style="padding:.75rem;background:var(--surface-2);border-radius:10px;text-align:center">' +
              '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:.25rem">' + esc(L.ui_date_range) + '</div>' +
              '<div style="font-size:.75rem;font-weight:700">' +
                (analysis.minDate ? (fmtDate(analysis.minDate) + ' — ' + fmtDate(analysis.maxDate)) : '—') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="grid-2">' +
            '<div><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);margin-bottom:.5rem;text-transform:uppercase">' + esc(L.ui_per_hall) + '</div>' + (hallRows || '—') + '</div>' +
            '<div><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);margin-bottom:.5rem;text-transform:uppercase">' + esc(L.ui_per_event) + '</div>' + (evRows || '—') + '</div>' +
          '</div>' +
        '</div>';
    }

    // Hall filter buttons
    var filterBtns = '<button class="btn ' + (activeHallId === 'all' ? 'btn-primary' : 'btn-ghost') + ' btn-sm" onclick="__dmSetActiveHall(\'all\')">' + esc(L.ui_all_halls) + ' (' + rows.length + ')</button>';
    for (var hi = 0; hi < hallIds.length; hi++) {
      var hid = hallIds[hi];
      var hName = matchHallIdName(hid);
      var active = activeHallId === hid ? 'btn-primary' : 'btn-ghost';
      filterBtns += '<button class="btn ' + active + ' btn-sm" onclick="__dmSetActiveHall(\'' + hid + '\')">' + esc(hName) + ' (' + grouped[hid].length + ')</button>';
    }

    // Build sections per hall
    var sectionsHtml = '';
    for (var gi = 0; gi < visibleGroups.length; gi++) {
      var grp = visibleGroups[gi];
      var hallName = matchHallIdName(grp.hallId);
      var groupRows = '';

      for (var ii = 0; ii < grp.items.length; ii++) {
        var item = grp.items[ii];
        var r = item.row;
        var idx = item.globalIdx;
        var evOptions = ['Wedding', 'Engagement', 'Henna', 'Birthday', 'Corporate', 'Other'].map(function (ev) {
          return '<option value="' + ev + '"' + (r.eventType === ev ? ' selected' : '') + '>' + ev + '</option>';
        }).join('');
        var hallOptions = halls.map(function (h) {
          return '<option value="' + h.id + '"' + (r.hallId === h.id ? ' selected' : '') + '>' + esc(h.name[State.lang] || h.name.ar) + '</option>';
        }).join('');
        var confClass = r.confidence === 'high' ? 'green' : r.confidence === 'medium' ? 'yellow' : 'red';

        groupRows +=
          '<tr data-idx="' + idx + '">' +
            '<td style="width:2.2rem"><b>' + (idx + 1) + '</b></td>' +
            '<td><span class="badge-pill badge-' + confClass + '">' + r.confidence + '</span></td>' +
            '<td><input class="ui-f" data-f="clientName" value="' + esc(r.clientName) + '" style="width:100%;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem"></td>' +
            '<td><input class="ui-f" data-f="phone" value="' + esc(r.phone) + '" style="width:110px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem"></td>' +
            '<td><input class="ui-f" data-f="date" type="date" value="' + esc(r.date) + '" style="padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem"></td>' +
            '<td><select class="ui-f" data-f="hallId" style="width:120px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem">' + hallOptions + '</select></td>' +
            '<td><select class="ui-f" data-f="eventType" style="width:110px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem">' + evOptions + '</select></td>' +
            '<td><input class="ui-f" data-f="guestsCount" type="number" value="' + (r.guestsCount || 0) + '" style="width:70px;padding:.4rem;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem"></td>' +
            '<td><button class="btn btn-ghost btn-icon btn-sm" onclick="__dmUnifiedDel(' + idx + ')" style="color:#ef4444"><i data-lucide="trash-2"></i></button></td>' +
          '</tr>';
      }

      sectionsHtml +=
        '<div class="card" style="margin-bottom:1rem;padding:0;overflow:hidden">' +
          '<div style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;padding:.75rem 1.25rem;display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-weight:800;font-size:.95rem">🏛 ' + esc(hallName) + '</div>' +
            '<div style="font-size:.78rem;opacity:.95">' + grp.items.length + ' ' + esc(L.ui_bookings) + '</div>' +
          '</div>' +
          '<div class="table-wrap" style="border:none;border-radius:0">' +
            '<table class="data-table" style="min-width:900px">' +
              '<thead><tr>' +
                '<th>#</th><th>Conf</th><th>Client</th><th>Phone</th><th>Date</th><th>Hall</th><th>Event</th><th>Guests</th><th></th>' +
              '</tr></thead>' +
              '<tbody>' + groupRows + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }

    el.innerHTML =
      '<div class="card" style="margin-bottom:1rem">' +
        '<div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center">' +
          '<b style="font-size:1rem">' + esc(L.ui_review) + '</b>' +
          '<span class="badge-pill badge-purple">' + esc(L.ui_found) + ' ' + rows.length + ' ' + esc(L.ui_bookings) + '</span>' +
          '<div style="margin-inline-start:auto;display:flex;gap:.5rem;flex-wrap:wrap">' +
            (Un.rawText ?
              '<button class="btn btn-ghost btn-sm" onclick="__dmUnifiedToggleRaw()"><i data-lucide="code"></i> ' + esc(Un.showRaw ? L.ui_hide_raw : L.ui_show_raw) + '</button>' : '') +
            '<button class="btn btn-ghost btn-sm" onclick="__dmUnifiedReset()"><i data-lucide="rotate-ccw"></i> ' + esc(L.ui_try_again) + '</button>' +
            '<button class="btn btn-primary btn-sm" onclick="__dmUnifiedCommit()"><i data-lucide="save"></i> ' + esc(L.ui_import_all) + '</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:.75rem;display:flex;gap:.35rem;flex-wrap:wrap">' + filterBtns + '</div>' +
      '</div>' +
      analysisHtml +
      (Un.showRaw && Un.rawText ?
        '<div class="card" style="margin-bottom:1rem"><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);margin-bottom:.5rem;text-transform:uppercase">' + esc(L.ui_debug) + '</div><pre style="background:var(--surface-2);padding:1rem;border-radius:8px;font-size:.7rem;line-height:1.5;max-height:280px;overflow:auto;white-space:pre-wrap;word-break:break-word">' + esc(Un.rawText.slice(0, 5000)) + '</pre></div>' : '') +
      sectionsHtml;

    if (window.lucide) lucide.createIcons();

    el.querySelectorAll('.ui-f').forEach(function (inp) {
      inp.onchange = function (e) {
        var tr = e.target.closest('tr[data-idx]');
        if (!tr) return;
        var idx = parseInt(tr.dataset.idx);
        var f = e.target.dataset.f;
        if (Un.parsed[idx]) {
          Un.parsed[idx][f] = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
        }
      };
    });
  }

  /* ---------- public handlers ---------- */
  window.__dmSetActiveHall = function (hid) {
    Un.activeHallId = hid;
    navigate('importsmart');
  };

  window.__dmUnifiedToggleRaw = function () {
    Un.showRaw = !Un.showRaw;
    navigate('importsmart');
  };

  window.__dmUnifiedReset = function () {
    Un.file = null; Un.fileName = ''; Un.fileType = ''; Un.rawText = '';
    Un.parsed = []; Un.showRaw = false; Un.busy = false; Un.analysis = null;
    Un.activeHallId = 'all';
    navigate('importsmart');
  };

  window.__dmUnifiedDel = function (idx) {
    Un.parsed.splice(idx, 1);
    Un.analysis = analyze(Un.parsed);
    navigate('importsmart');
  };

  window.__dmUnifiedCommit = function () {
    if (!Un.parsed.length) return;
    var added = 0;
    for (var i = 0; i < Un.parsed.length; i++) {
      var p = Un.parsed[i];
      if (!p.clientName && !p.phone) continue;
      State.data.bookings.push({
        id: uid2('b'),
        date: p.date,
        hallId: p.hallId,
        clientName: p.clientName || '-',
        phone: p.phone || '',
        eventType: p.eventType || 'Wedding',
        startTime: p.startTime || '19:00',
        endTime: p.endTime || '23:00',
        status: 'pending',
        paymentStatus: 'unpaid',
        cost: p.cost || 0,
        guestsCount: p.guestsCount || 0,
        notes: p.notes || ((State.lang === 'ar' ? 'مستورد من: ' : 'Imported from: ') + Un.fileName)
      });
      added++;
    }
    try { saveData(); } catch (e) {}
    try { if (typeof logActivity === 'function') logActivity('bulk-import', 'booking', null, null, { count: added, file: Un.fileName }); } catch (e) {}
    if (typeof showToast === 'function') showToast(I18N[State.lang].ui_imported + ': ' + added + ' ✓', 'success');
    Un.file = null; Un.fileName = ''; Un.fileType = ''; Un.rawText = '';
    Un.parsed = []; Un.showRaw = false; Un.analysis = null;
    Un.activeHallId = 'all';
    setTimeout(function () { navigate('bookings'); }, 400);
  };

  /* ---------- paste text modal ---------- */
  window.__dmPasteText = function () {
    if (typeof openModal !== 'function') return;
    var L = I18N[State.lang];
    openModal({
      title: L.ui_paste_title,
      size: 'lg',
      body:
        '<div style="margin-bottom:.75rem;font-size:.8rem;color:var(--text-muted)">' + esc(L.ui_paste_hint) + '</div>' +
        '<textarea id="ui-paste-area" rows="14" style="width:100%;padding:.75rem;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:.85rem;line-height:1.5;resize:vertical" placeholder="الصق هنا..."></textarea>',
      footer:
        '<button class="btn btn-ghost" onclick="closeModal()">' + (State.lang === 'ar' ? 'إلغاء' : 'Cancel') + '</button>' +
        '<button class="btn btn-primary" onclick="__dmParsePasted()">' + esc(L.ui_parse) + '</button>'
    });
  };

  window.__dmParsePasted = function () {
    var ta = document.getElementById('ui-paste-area');
    if (!ta || !ta.value.trim()) {
      if (typeof showToast === 'function') showToast('لا يوجد نص', 'warn');
      return;
    }
    Un.rawText = ta.value;
    Un.fileName = 'نص يدوي';
    Un.fileType = 'text';
    Un.parsed = parseRawText(ta.value);
    Un.analysis = analyze(Un.parsed);
    Un.activeHallId = 'all';
    if (typeof closeModal === 'function') closeModal();
    navigate('importsmart');
    if (typeof showToast === 'function') {
      showToast(I18N[State.lang].ui_found + ' ' + Un.parsed.length + ' ' + I18N[State.lang].ui_bookings, Un.parsed.length ? 'success' : 'warn');
    }
  };

  /* ---------- nav registration ---------- */
  function ensureNav() {
    var ops = NAV_ITEMS.find(function (g) { return g.section === 'operations'; });
    if (ops) {
      var ex = ops.items.find(function (i) { return i.id === 'importsmart'; });
      if (!ex) {
        var idx = ops.items.findIndex(function (i) { return i.id === 'bookings'; });
        var at = idx >= 0 ? idx + 1 : ops.items.length;
        ops.items.splice(at, 0, { id: 'importsmart', icon: 'file-input', label: 'unified_import' });
      } else {
        ex.icon = 'file-input';
        ex.label = 'unified_import';
      }
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* ---------- boot ---------- */
  waitFor(
    function () {
      return typeof State !== 'undefined' && typeof Pages !== 'undefined' && typeof navigate === 'function' && typeof NAV_ITEMS !== 'undefined';
    },
    function () {
      ensureNav();
      console.log('%c[Section 21] ✓ Import v3 ready', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 21] Tip: use "Paste text manually" if OCR fails', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 22: Settings Enhancements
   Version: 1.0.0
   ---------------------------------------------------------
   - Factory Reset with automatic backup download
   - Screen lock with PIN (idle timeout)
   - Live clock in topbar
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 22] Settings+ loading…', 'color:#0ea5e9;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 150;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 22] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.reset_title = 'إعادة ضبط المصنع';
  I18N.ar.reset_desc = 'يمسح كل البيانات ويعيد النظام لحالته الأولى';
  I18N.ar.reset_download_first = 'يتم تنزيل نسخة احتياطية تلقائيًا قبل المسح';
  I18N.ar.reset_btn = 'ضبط المصنع';
  I18N.ar.reset_backup_done = 'تم تنزيل النسخة الاحتياطية';
  I18N.ar.reset_confirm1 = 'سيتم مسح كل البيانات نهائيًا وإرجاع النظام لحالته الأولى. متأكد؟';
  I18N.ar.reset_confirm2 = 'هذه آخر فرصة — هل تريد المتابعة حقًا؟';
  I18N.ar.reset_type_word = 'اكتب كلمة "مسح" للتأكيد';
  I18N.ar.reset_word = 'مسح';
  I18N.ar.reset_done = 'تم ضبط المصنع بنجاح';
  I18N.ar.reset_wrong_word = 'الكلمة غير صحيحة';

  I18N.ar.lock_title = 'قفل الشاشة';
  I18N.ar.lock_enable = 'تفعيل القفل التلقائي';
  I18N.ar.lock_pin = 'الرقم السري';
  I18N.ar.lock_pin_hint = '4 أرقام على الأقل';
  I18N.ar.lock_timeout = 'مدة الخمول قبل القفل (دقائق)';
  I18N.ar.lock_now = 'قفل الآن';
  I18N.ar.lock_unlock = 'فتح';
  I18N.ar.lock_enter_pin = 'أدخل الرقم السري';
  I18N.ar.lock_wrong_pin = 'رقم سري غير صحيح';
  I18N.ar.lock_set_first = 'لم يتم تعيين رقم سري بعد — عيّنه من الإعدادات';
  I18N.ar.lock_pin_saved = 'تم حفظ الرقم السري';
  I18N.ar.lock_pin_short = 'الرقم السري قصير جدًا';
  I18N.ar.lock_enabled = 'تم تفعيل القفل';
  I18N.ar.lock_disabled = 'تم تعطيل القفل';

  I18N.en.reset_title = 'Factory Reset';
  I18N.en.reset_desc = 'Wipes all data and restores initial state';
  I18N.en.reset_download_first = 'A backup will download automatically before wiping';
  I18N.en.reset_btn = 'Factory Reset';
  I18N.en.reset_backup_done = 'Backup downloaded';
  I18N.en.reset_confirm1 = 'All data will be permanently deleted. Are you sure?';
  I18N.en.reset_confirm2 = 'This is your last chance — continue?';
  I18N.en.reset_type_word = 'Type the word "RESET" to confirm';
  I18N.en.reset_word = 'RESET';
  I18N.en.reset_done = 'Factory reset completed';
  I18N.en.reset_wrong_word = 'Wrong word';

  I18N.en.lock_title = 'Screen Lock';
  I18N.en.lock_enable = 'Enable auto-lock';
  I18N.en.lock_pin = 'PIN';
  I18N.en.lock_pin_hint = 'At least 4 digits';
  I18N.en.lock_timeout = 'Idle minutes before lock';
  I18N.en.lock_now = 'Lock now';
  I18N.en.lock_unlock = 'Unlock';
  I18N.en.lock_enter_pin = 'Enter PIN';
  I18N.en.lock_wrong_pin = 'Incorrect PIN';
  I18N.en.lock_set_first = 'No PIN set yet — set one in Settings';
  I18N.en.lock_pin_saved = 'PIN saved';
  I18N.en.lock_pin_short = 'PIN too short';
  I18N.en.lock_enabled = 'Lock enabled';
  I18N.en.lock_disabled = 'Lock disabled';

  /* ---------- keys ---------- */
  var K_PIN = 'drmedia_lock_pin_v1';
  var K_ENABLED = 'drmedia_lock_enabled_v1';
  var K_TIMEOUT = 'drmedia_lock_timeout_v1';

  /* ---------- lock state ---------- */
  var Lock = {
    pin: localStorage.getItem(K_PIN) || '',
    enabled: localStorage.getItem(K_ENABLED) === '1',
    timeoutMin: parseInt(localStorage.getItem(K_TIMEOUT)) || 5,
    idleTimer: null,
    locked: false,
    lastActivity: Date.now()
  };
  window.__dmLock = Lock;

  /* =========================================================
     1. LIVE CLOCK IN TOPBAR
     ========================================================= */
  var clockState = { timer: null };

  function injectClock() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;
    if (document.getElementById('dm-clock')) return;

    var el = document.createElement('div');
    el.id = 'dm-clock';
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:.35rem .75rem;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);margin-inline-end:.35rem;min-width:120px;line-height:1.15;user-select:none';
    el.innerHTML = '<div id="dm-clock-time" style="font-weight:800;font-size:.85rem;color:var(--text);font-variant-numeric:tabular-nums">--:--:--</div>' +
                   '<div id="dm-clock-date" style="font-size:.65rem;color:var(--text-muted)">—</div>';

    var notifBtn = document.getElementById('notif-btn');
    if (notifBtn && notifBtn.parentNode) {
      notifBtn.parentNode.insertBefore(el, notifBtn);
    } else {
      topbar.appendChild(el);
    }

    updateClock();
    if (clockState.timer) clearInterval(clockState.timer);
    clockState.timer = setInterval(updateClock, 1000);
  }

  function updateClock() {
    var tEl = document.getElementById('dm-clock-time');
    var dEl = document.getElementById('dm-clock-date');
    if (!tEl || !dEl) return;
    var now = new Date();
    var hh = pad2(now.getHours());
    var mm = pad2(now.getMinutes());
    var ss = pad2(now.getSeconds());
    tEl.textContent = hh + ':' + mm + ':' + ss;
    try {
      var loc = State.lang === 'ar' ? 'ar-EG' : 'en-GB';
      dEl.textContent = now.toLocaleDateString(loc, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      dEl.textContent = now.toLocaleDateString();
    }
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* =========================================================
     2. LOCK — PIN + IDLE
     ========================================================= */
  function saveLockPrefs() {
    try {
      if (Lock.pin) localStorage.setItem(K_PIN, Lock.pin); else localStorage.removeItem(K_PIN);
      localStorage.setItem(K_ENABLED, Lock.enabled ? '1' : '0');
      localStorage.setItem(K_TIMEOUT, String(Lock.timeoutMin));
    } catch (e) {}
  }

  function resetIdleTimer() {
    Lock.lastActivity = Date.now();
    if (Lock.idleTimer) clearTimeout(Lock.idleTimer);
    if (!Lock.enabled || !Lock.pin || Lock.locked) return;
    Lock.idleTimer = setTimeout(function () {
      lockScreen();
    }, Lock.timeoutMin * 60 * 1000);
  }

  function attachActivityListeners() {
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function (ev) {
      document.addEventListener(ev, resetIdleTimer, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') resetIdleTimer();
    });
  }

  function lockScreen() {
    if (Lock.locked) return;
    if (!Lock.pin) {
      if (typeof showToast === 'function') showToast(I18N[State.lang].lock_set_first, 'warn');
      return;
    }
    Lock.locked = true;

    var overlay = document.createElement('div');
    overlay.id = 'dm-lock-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#0f0a1f 0%,#1e1b3a 100%);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(20px)';
    overlay.innerHTML =
      '<div style="max-width:360px;width:100%;text-align:center">' +
        '<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#f59e0b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.75rem;margin:0 auto 1.25rem;box-shadow:0 20px 40px -10px rgba(124,58,237,.5)">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        '</div>' +
        '<div style="color:#fff;font-size:1.1rem;font-weight:700;margin-bottom:.35rem">' + esc(I18N[State.lang].lock_enter_pin) + '</div>' +
        '<div style="color:#94a3b8;font-size:.8rem;margin-bottom:1.5rem">Dr Media Pro</div>' +
        '<input id="dm-lock-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" style="width:100%;padding:1rem;text-align:center;font-size:1.5rem;letter-spacing:.5em;border-radius:14px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;outline:none;font-family:inherit" placeholder="• • • •">' +
        '<div id="dm-lock-msg" style="color:#ef4444;font-size:.8rem;margin-top:.75rem;min-height:1.2em"></div>' +
        '<button id="dm-lock-btn" style="width:100%;margin-top:1rem;padding:.95rem;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;font-weight:700;font-size:1rem;cursor:pointer;font-family:inherit">' +
          esc(I18N[State.lang].lock_unlock) +
        '</button>' +
      '</div>';

    document.body.appendChild(overlay);

    var input = document.getElementById('dm-lock-pin');
    var btn = document.getElementById('dm-lock-btn');
    var msg = document.getElementById('dm-lock-msg');

    function tryUnlock() {
      var val = (input.value || '').trim();
      if (val === Lock.pin) {
        closeLock();
      } else {
        msg.textContent = I18N[State.lang].lock_wrong_pin;
        input.value = '';
        input.focus();
        if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {}
      }
    }

    if (input) { input.focus(); input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); }); }
    if (btn) btn.onclick = tryUnlock;
  }

  function closeLock() {
    var overlay = document.getElementById('dm-lock-overlay');
    if (overlay) overlay.remove();
    Lock.locked = false;
    resetIdleTimer();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.__dmLockNow = function () {
    if (!Lock.pin) {
      if (typeof showToast === 'function') showToast(I18N[State.lang].lock_set_first, 'warn');
      return;
    }
    lockScreen();
  };

  /* =========================================================
     3. FACTORY RESET
     ========================================================= */
  function downloadBackup(reason) {
    try {
      var data = JSON.stringify(State.data, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = 'drmedia-backup-' + stamp + (reason ? '-' + reason : '') + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
      return true;
    } catch (e) {
      console.error('[Section 22] backup failed', e);
      return false;
    }
  }

  window.__dmFactoryReset = function () {
    var L = I18N[State.lang] || I18N.ar;

    if (typeof confirmDialog !== 'function') {
      if (!confirm(L.reset_confirm1)) return;
      doResetStep2();
      return;
    }

    // Step 1: download backup immediately
    var ok = downloadBackup('auto');
    if (ok && typeof showToast === 'function') showToast(L.reset_backup_done + ' ✓', 'success');

    // Step 2: first confirm
    setTimeout(function () {
      confirmDialog(L.reset_confirm1, function () {
        doResetStep2();
      });
    }, 400);
  };

  function doResetStep2() {
    var L = I18N[State.lang] || I18N.ar;
    setTimeout(function () {
      confirmDialog(L.reset_confirm2, function () {
        showResetWordModal();
      });
    }, 200);
  }

  function showResetWordModal() {
    var L = I18N[State.lang] || I18N.ar;
    if (typeof openModal !== 'function') return;
    var word = L.reset_word;

    openModal({
      title: '⚠️ ' + esc(L.reset_title),
      size: 'sm',
      body:
        '<div style="font-size:.85rem;color:var(--text-muted);margin-bottom:.75rem">' + esc(L.reset_type_word) + '</div>' +
        '<div style="font-size:1rem;font-weight:800;color:#ef4444;text-align:center;padding:.75rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;margin-bottom:.75rem;letter-spacing:.15em">' +
          esc(word) +
        '</div>' +
        '<input id="dm-reset-word" type="text" autocomplete="off" style="width:100%;padding:.75rem;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-family:inherit;text-align:center;letter-spacing:.1em;font-size:1rem" placeholder="...">',
      footer:
        '<button class="btn btn-ghost" onclick="closeModal()">' + (State.lang === 'ar' ? 'إلغاء' : 'Cancel') + '</button>' +
        '<button class="btn btn-danger" onclick="__dmConfirmResetWord()">' + esc(L.reset_btn) + '</button>'
    });

    setTimeout(function () {
      var inp = document.getElementById('dm-reset-word');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') window.__dmConfirmResetWord();
        });
      }
    }, 150);
  }

  window.__dmConfirmResetWord = function () {
    var L = I18N[State.lang] || I18N.ar;
    var inp = document.getElementById('dm-reset-word');
    var entered = (inp ? inp.value : '').trim();
    var expected = L.reset_word;

    if (entered !== expected) {
      if (typeof showToast === 'function') showToast(L.reset_wrong_word, 'error');
      return;
    }

    if (typeof closeModal === 'function') closeModal();
    performReset();
  };

  function performReset() {
    var L = I18N[State.lang] || I18N.ar;

    try {
      // Remove all app storage but keep PIN prefs
      var keepPin = Lock.pin;
      var keepEnabled = Lock.enabled ? '1' : '0';
      var keepTimeout = String(Lock.timeoutMin);

      localStorage.clear();

      if (keepPin) localStorage.setItem(K_PIN, keepPin);
      localStorage.setItem(K_ENABLED, keepEnabled);
      localStorage.setItem(K_TIMEOUT, keepTimeout);

      // Reset in-memory state
      if (typeof State !== 'undefined') {
        State.user = null;
        if (typeof seedData === 'function') {
          var seeded = seedData();
          State.data = seeded;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[Section 22] reset failed', e);
    }

    if (typeof showToast === 'function') showToast(L.reset_done + ' ✓', 'success');

    // Reload after short delay to apply
    setTimeout(function () {
      location.reload();
    }, 900);
  }

  /* =========================================================
     4. SETTINGS UI INJECTION
     ========================================================= */
  function renderLockSection(container) {
    var L = I18N[State.lang] || I18N.ar;
    var sec = document.createElement('div');
    sec.className = 'card';
    sec.setAttribute('data-dm-lock-section', '1');

    sec.innerHTML =
      '<h4 style="margin-top:0;font-size:.95rem">' +
        '<i data-lucide="lock" style="width:16px;height:16px;display:inline;color:#7c3aed"></i> ' +
        esc(L.lock_title) +
      '</h4>' +

      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.85rem">' +
        '<span style="font-size:.85rem">' + esc(L.lock_enable) + '</span>' +
        '<label class="switch"><input type="checkbox" id="dm-lock-enabled"' + (Lock.enabled ? ' checked' : '') + '><span class="slider"></span></label>' +
      '</div>' +

      '<div class="field" style="margin-top:.85rem">' +
        '<label>' + esc(L.lock_pin) + '</label>' +
        '<input type="password" id="dm-lock-pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="12" placeholder="' + esc(L.lock_pin_hint) + '" value="' + esc(Lock.pin ? '••••' : '') + '" autocomplete="new-password">' +
      '</div>' +

      '<div class="field" style="margin-top:.85rem">' +
        '<label>' + esc(L.lock_timeout) + '</label>' +
        '<input type="number" id="dm-lock-timeout-input" min="1" max="120" value="' + Lock.timeoutMin + '">' +
      '</div>' +

      '<div style="display:flex;gap:.5rem;margin-top:.85rem;flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" id="dm-lock-save">' + (State.lang === 'ar' ? 'حفظ' : 'Save') + '</button>' +
        '<button class="btn btn-ghost btn-sm" id="dm-lock-now-btn">' +
          '<i data-lucide="lock"></i> ' + esc(L.lock_now) +
        '</button>' +
      '</div>';

    container.appendChild(sec);
    if (window.lucide) lucide.createIcons();

    // Bind
    var enabledEl = sec.querySelector('#dm-lock-enabled');
    var pinEl = sec.querySelector('#dm-lock-pin-input');
    var timeoutEl = sec.querySelector('#dm-lock-timeout-input');
    var saveBtn = sec.querySelector('#dm-lock-save');
    var nowBtn = sec.querySelector('#dm-lock-now-btn');

    if (enabledEl) {
      enabledEl.onchange = function (e) {
        Lock.enabled = e.target.checked;
        if (Lock.enabled && !Lock.pin) {
          if (typeof showToast === 'function') showToast(L.lock_set_first, 'warn');
        }
        saveLockPrefs();
        resetIdleTimer();
      };
    }

    if (saveBtn) {
      saveBtn.onclick = function () {
        var newPin = (pinEl.value || '').trim();
        // If it's the placeholder dots, ignore
        if (newPin === '••••') newPin = Lock.pin;
        if (newPin && newPin.length < 4) {
          if (typeof showToast === 'function') showToast(L.lock_pin_short, 'error');
          return;
        }
        Lock.pin = newPin;
        Lock.timeoutMin = Math.max(1, parseInt(timeoutEl.value) || 5);
        saveLockPrefs();
        if (typeof showToast === 'function') showToast(L.lock_pin_saved + ' ✓', 'success');
        resetIdleTimer();
      };
    }

    if (nowBtn) nowBtn.onclick = function () { window.__dmLockNow(); };
  }

  function renderResetSection(container) {
    var L = I18N[State.lang] || I18N.ar;
    var sec = document.createElement('div');
    sec.className = 'card';
    sec.style.borderColor = 'rgba(239,68,68,.4)';
    sec.setAttribute('data-dm-reset-section', '1');

    sec.innerHTML =
      '<h4 style="margin-top:0;font-size:.95rem;color:#ef4444">' +
        '<i data-lucide="alert-triangle" style="width:16px;height:16px;display:inline"></i> ' +
        esc(L.reset_title) +
      '</h4>' +
      '<p style="font-size:.8rem;color:var(--text-muted);margin:.5rem 0 .35rem">' + esc(L.reset_desc) + '</p>' +
      '<p style="font-size:.75rem;color:#10b981;margin:0 0 .85rem">' +
        '<i data-lucide="shield-check" style="width:12px;height:12px;display:inline;vertical-align:-2px"></i> ' +
        esc(L.reset_download_first) +
      '</p>' +
      '<button class="btn btn-danger btn-sm" id="dm-reset-btn">' +
        '<i data-lucide="refresh-ccw"></i> ' + esc(L.reset_btn) +
      '</button>';

    container.appendChild(sec);
    if (window.lucide) lucide.createIcons();

    var btn = sec.querySelector('#dm-reset-btn');
    if (btn) btn.onclick = function () { window.__dmFactoryReset(); };
  }

  function hookSettingsPage() {
    if (!Pages.settings) return;
    var orig = Pages.settings;
    Pages.settings = function (el) {
      orig.apply(this, arguments);
      setTimeout(function () {
        var grid = el.querySelector('.grid-2');
        if (!grid) return;

        if (!grid.querySelector('[data-dm-lock-section]')) {
          var wrap1 = document.createElement('div');
          grid.appendChild(wrap1);
          renderLockSection(wrap1);
        }
        if (!grid.querySelector('[data-dm-reset-section]')) {
          var wrap2 = document.createElement('div');
          grid.appendChild(wrap2);
          renderResetSection(wrap2);
        }
      }, 150);
    };
  }

  /* =========================================================
     5. LOCK BUTTON IN TOPBAR
     ========================================================= */
  function injectLockBtn() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;
    if (document.getElementById('dm-lock-topbtn')) return;

    var btn = document.createElement('button');
    btn.className = 'topbar-btn';
    btn.id = 'dm-lock-topbtn';
    btn.title = (I18N[State.lang] || I18N.ar).lock_now;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    btn.onclick = function () { window.__dmLockNow(); };

    var notifBtn = document.getElementById('notif-btn');
    if (notifBtn && notifBtn.parentNode) {
      notifBtn.parentNode.insertBefore(btn, notifBtn);
    } else {
      topbar.appendChild(btn);
    }
  }

  /* =========================================================
     6. BOOT
     ========================================================= */
  waitFor(
    function () {
      return typeof State !== 'undefined'
        && typeof Pages !== 'undefined'
        && typeof navigate === 'function'
        && document.getElementById('topbar');
    },
    function () {
      // 1. Clock
      injectClock();

      // 2. Lock button
      injectLockBtn();

      // 3. Lock listeners
      attachActivityListeners();
      resetIdleTimer();

      // 4. Hook settings page
      hookSettingsPage();

      console.log('%c[Section 22] ✓ Settings+ ready (Clock + Lock + Reset)', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 22] Commands:', 'color:#06b6d4;font-style:italic');
      console.log('  __dmLockNow()         — قفل الشاشة الآن');
      console.log('  __dmFactoryReset()    — ضبط المصنع');
      console.log('  __dmLock.enabled      — حالة القفل');
    }
  );

})();
/* =========================================================
   SECTION 23: SaaS Multi-Tenant + Auth + Subscription
   Version: 1.0.0
   ---------------------------------------------------------
   - Multi-tenancy (isolated data per company)
   - Email/Password Auth via Firebase
   - Registration & Onboarding
   - Subscription plans & trial
   - Super Admin panel
   - Payment integration hooks (Paymob-ready)
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 23] SaaS layer loading…', 'color:#10b981;font-weight:bold;font-size:14px');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 23] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* =========================================================
     1. PLANS CONFIG
     ========================================================= */
  var PLANS = {
    trial: {
      id: 'trial', name: 'تجربة', nameEn: 'Trial', price: 0, durationDays: 14,
      limits: { employees: 10, bookings: 100, halls: 1, users: 3 }
    },
    starter: {
      id: 'starter', name: 'Starter', nameEn: 'Starter', price: 500, durationDays: 30,
      limits: { employees: 5, bookings: 100, halls: 1, users: 2 }
    },
    pro: {
      id: 'pro', name: 'Professional', nameEn: 'Professional', price: 1200, durationDays: 30,
      limits: { employees: 20, bookings: 500, halls: 3, users: 10 }
    },
    business: {
      id: 'business', name: 'Business', nameEn: 'Business', price: 2500, durationDays: 30,
      limits: { employees: 50, bookings: 99999, halls: 99, users: 50 }
    },
    enterprise: {
      id: 'enterprise', name: 'Enterprise', nameEn: 'Enterprise', price: -1, durationDays: 30,
      limits: { employees: 999, bookings: 999999, halls: 999, users: 999 }
    }
  };
  window.__dmPlans = PLANS;

  /* =========================================================
     2. STATE
     ========================================================= */
  var SaaS = {
    user: null,          // Firebase user
    profile: null,       // Firestore /users/{uid}
    company: null,       // Firestore /companies/{companyId}
    subscription: null,  // Firestore /subscriptions/{companyId}
    isSuperAdmin: false,
    ready: false,
    authListener: null,
    companyUnsub: null,
    subUnsub: null
  };
  window.__dmSaaS = SaaS;

  function getFb() { return window.DrMediaFB || null; }
  function getDb() { var fb = getFb(); return fb ? fb.db : null; }
  function getAuth() { var fb = getFb(); return fb ? fb.auth : null; }
  function getFsMod() { var fb = getFb(); return fb ? fb.modules.fsMod : null; }
  function getAuthMod() { var fb = getFb(); return fb ? fb.modules.authMod : null; }

  /* =========================================================
     3. i18n
     ========================================================= */
  I18N.ar.saas_register = 'تسجيل جديد';
  I18N.ar.saas_login = 'دخول';
  I18N.ar.saas_email = 'البريد الإلكتروني';
  I18N.ar.saas_password = 'كلمة المرور';
  I18N.ar.saas_company_name = 'اسم الشركة';
  I18N.ar.saas_your_name = 'اسمك';
  I18N.ar.saas_phone = 'رقم الهاتف';
  I18N.ar.saas_create_account = 'إنشاء الحساب';
  I18N.ar.saas_have_account = 'عندك حساب بالفعل؟';
  I18N.ar.saas_no_account = 'معندكش حساب؟';
  I18N.ar.saas_forgot = 'نسيت كلمة المرور؟';
  I18N.ar.saas_plan = 'الباقة';
  I18N.ar.saas_trial = 'تجربة مجانية 14 يوم';
  I18N.ar.saas_welcome = 'أهلاً بيك';
  I18N.ar.saas_my_company = 'شركتي';
  I18N.ar.saas_my_subscription = 'اشتراكي';
  I18N.ar.saas_days_left = 'يوم متبقي';
  I18N.ar.saas_expired = 'انتهى الاشتراك';
  I18N.ar.saas_upgrade = 'ترقية';
  I18N.ar.saas_super_admin = 'لوحة المدير العام';
  I18N.ar.saas_companies = 'الشركات';
  I18N.ar.saas_users_count = 'عدد المستخدمين';
  I18N.ar.saas_logout = 'خروج';
  I18N.ar.saas_email_exists = 'البريد مستخدم بالفعل';
  I18N.ar.saas_invalid_email = 'البريد غير صحيح';
  I18N.ar.saas_weak_pass = 'كلمة المرور ضعيفة (6 أحرف على الأقل)';
  I18N.ar.saas_signup_success = 'تم إنشاء الحساب بنجاح';
  I18N.ar.saas_login_success = 'تم تسجيل الدخول';
  I18N.ar.saas_login_failed = 'البريد أو كلمة المرور غير صحيحة';
  I18N.ar.saas_reset_sent = 'تم إرسال رابط إعادة التعيين للإيميل';
  I18N.ar.saas_old_login = 'دخول قديم (Local)';

  I18N.en.saas_register = 'Sign Up';
  I18N.en.saas_login = 'Login';
  I18N.en.saas_email = 'Email';
  I18N.en.saas_password = 'Password';
  I18N.en.saas_company_name = 'Company Name';
  I18N.en.saas_your_name = 'Your Name';
  I18N.en.saas_phone = 'Phone';
  I18N.en.saas_create_account = 'Create Account';
  I18N.en.saas_have_account = 'Already have an account?';
  I18N.en.saas_no_account = "Don't have an account?";
  I18N.en.saas_forgot = 'Forgot password?';
  I18N.en.saas_plan = 'Plan';
  I18N.en.saas_trial = '14-day free trial';
  I18N.en.saas_welcome = 'Welcome';
  I18N.en.saas_my_company = 'My Company';
  I18N.en.saas_my_subscription = 'My Subscription';
  I18N.en.saas_days_left = 'days left';
  I18N.en.saas_expired = 'Subscription expired';
  I18N.en.saas_upgrade = 'Upgrade';
  I18N.en.saas_super_admin = 'Super Admin';
  I18N.en.saas_companies = 'Companies';
  I18N.en.saas_users_count = 'Users';
  I18N.en.saas_logout = 'Logout';
  I18N.en.saas_email_exists = 'Email already in use';
  I18N.en.saas_invalid_email = 'Invalid email';
  I18N.en.saas_weak_pass = 'Password too weak (6+ chars)';
  I18N.en.saas_signup_success = 'Account created';
  I18N.en.saas_login_success = 'Logged in';
  I18N.en.saas_login_failed = 'Wrong email or password';
  I18N.en.saas_reset_sent = 'Reset link sent to email';
  I18N.en.saas_old_login = 'Legacy login (Local)';

  /* =========================================================
     4. UTILITIES
     ========================================================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 11); }

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
    else console.log('[' + (type || 'info') + ']', msg);
  }

  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
  }

  function nowMs() { return Date.now(); }

  function daysUntil(ts) {
    if (!ts) return 0;
    return Math.max(0, Math.ceil((ts - nowMs()) / 86400000));
  }

  /* =========================================================
     5. AUTH UI — replaces login screen
     ========================================================= */
  function injectSaaSUI() {
    var loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;

    // Add tabs above the form
    var card = loginScreen.querySelector('.login-card');
    if (!card || card.querySelector('.saas-tabs')) return;

    var tabs = document.createElement('div');
    tabs.className = 'saas-tabs';
    tabs.style.cssText = 'display:flex;gap:.5rem;margin-bottom:1.25rem;background:rgba(255,255,255,.05);padding:.35rem;border-radius:12px';
    tabs.innerHTML =
      '<button type="button" class="saas-tab active" data-tab="login" style="flex:1;padding:.65rem;border-radius:9px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s">' +
        esc(I18N[State.lang].saas_login || 'Login') +
      '</button>' +
      '<button type="button" class="saas-tab" data-tab="register" style="flex:1;padding:.65rem;border-radius:9px;background:transparent;color:#cbd5e1;border:none;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s">' +
        esc(I18N[State.lang].saas_register || 'Sign Up') +
      '</button>';

    // Insert at top of card (after brand logo)
    var brandLogo = card.querySelector('.brand-logo');
    if (brandLogo && brandLogo.nextSibling) {
      card.insertBefore(tabs, brandLogo.nextSibling);
    } else {
      card.insertBefore(tabs, card.firstChild);
    }

    // Replace the login form
    var oldForm = card.querySelector('#login-form');
    if (oldForm) oldForm.remove();

    // Add the SaaS form
    var form = document.createElement('div');
    form.id = 'saas-form';
    form.style.cssText = 'display:flex;flex-direction:column;gap:.85rem;margin-top:1rem';
    form.innerHTML = buildLoginForm();
    card.appendChild(form);

    // Add super-admin block (hidden by default)
    var superBlock = document.createElement('div');
    superBlock.id = 'saas-super-block';
    superBlock.style.cssText = 'display:none;margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.1)';
    superBlock.innerHTML =
      '<div style="font-size:.7rem;color:#94a3b8;text-align:center;margin-bottom:.5rem">' +
        (State.lang === 'ar' ? '— أو —' : '— OR —') +
      '</div>' +
      '<button type="button" id="saas-legacy-btn" style="width:100%;padding:.65rem;border-radius:10px;background:rgba(255,255,255,.05);color:#94a3b8;border:1px solid rgba(255,255,255,.1);cursor:pointer;font-family:inherit;font-size:.8rem">' +
        esc(I18N[State.lang].saas_old_login || 'Legacy login') +
      '</button>';
    card.appendChild(superBlock);

    // Bind tabs
    tabs.querySelectorAll('.saas-tab').forEach(function (tb) {
      tb.onclick = function () {
        var mode = tb.dataset.tab;
        tabs.querySelectorAll('.saas-tab').forEach(function (x) {
          x.classList.remove('active');
          x.style.background = 'transparent';
          x.style.color = '#cbd5e1';
        });
        tb.classList.add('active');
        tb.style.background = 'linear-gradient(135deg,#7c3aed,#6d28d9)';
        tb.style.color = '#fff';
        form.innerHTML = mode === 'register' ? buildRegisterForm() : buildLoginForm();
        bindForm(mode);
      };
    });

    // Super admin button
    var legacyBtn = superBlock.querySelector('#saas-legacy-btn');
    if (legacyBtn) {
      legacyBtn.onclick = function () {
        toast(State.lang === 'ar' ? 'استخدم Admin / admin' : 'Use Admin / admin', 'info');
      };
    }

    bindForm('login');
  }

  function buildLoginForm() {
    var L = I18N[State.lang] || I18N.ar;
    return '' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_email) + '</label>' +
        '<div style="position:relative">' +
          '<input id="saas-email" type="email" placeholder="you@example.com" autocomplete="email" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none" required>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_password) + '</label>' +
        '<div style="position:relative">' +
          '<input id="saas-password" type="password" placeholder="••••••••" autocomplete="current-password" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none" required>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;font-size:.8rem">' +
        '<label style="display:flex;align-items:center;gap:.4rem;color:#cbd5e1;cursor:pointer">' +
          '<input type="checkbox" id="saas-remember" checked style="accent-color:#7c3aed">' +
          (State.lang === 'ar' ? 'تذكرني' : 'Remember me') +
        '</label>' +
        '<a href="#" id="saas-forgot" style="color:#a78bfa;text-decoration:none;font-weight:500">' + esc(L.saas_forgot) + '</a>' +
      '</div>' +
      '<button type="button" id="saas-login-btn" style="width:100%;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;padding:.95rem;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;margin-top:.35rem;box-shadow:0 10px 25px -8px #7c3aed">' +
        esc(L.saas_login) +
      '</button>' +
      '<div id="saas-login-msg" style="color:#ef4444;font-size:.8rem;text-align:center;min-height:1.2em"></div>';
  }

  function buildRegisterForm() {
    var L = I18N[State.lang] || I18N.ar;
    return '' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_company_name) + '</label>' +
        '<input id="saas-company" type="text" placeholder="' + esc(L.saas_company_name) + '" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_your_name) + '</label>' +
        '<input id="saas-name" type="text" placeholder="' + esc(L.saas_your_name) + '" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_email) + '</label>' +
        '<input id="saas-email" type="email" placeholder="you@example.com" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_phone) + '</label>' +
        '<input id="saas-phone" type="tel" placeholder="01xxxxxxxxx" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none">' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:#cbd5e1;font-size:.8rem;font-weight:500;display:block;margin-bottom:.4rem">' + esc(L.saas_password) + '</label>' +
        '<input id="saas-password" type="password" placeholder="••••••••" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem 1rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none" required>' +
      '</div>' +
      '<div style="padding:.75rem;background:rgba(16,185,129,.1);border:1px dashed rgba(16,185,129,.4);border-radius:10px;color:#6ee7b7;font-size:.78rem;text-align:center">' +
        '🎁 ' + esc(L.saas_trial) +
      '</div>' +
      '<button type="button" id="saas-register-btn" style="width:100%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:.95rem;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;margin-top:.35rem;box-shadow:0 10px 25px -8px #10b981">' +
        esc(L.saas_create_account) +
      '</button>' +
      '<div id="saas-register-msg" style="color:#ef4444;font-size:.8rem;text-align:center;min-height:1.2em"></div>';
  }

  function bindForm(mode) {
    if (mode === 'login') {
      var loginBtn = document.getElementById('saas-login-btn');
      var forgotBtn = document.getElementById('saas-forgot');
      if (loginBtn) loginBtn.onclick = doLogin;
      if (forgotBtn) forgotBtn.onclick = function (e) { e.preventDefault(); doForgotPassword(); };

      // Enter key
      ['saas-email', 'saas-password'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
      });
    } else {
      var regBtn = document.getElementById('saas-register-btn');
      if (regBtn) regBtn.onclick = doRegister;
      ['saas-company', 'saas-name', 'saas-email', 'saas-phone', 'saas-password'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doRegister(); });
      });
    }
  }

  /* =========================================================
     6. AUTH ACTIONS
     ========================================================= */
  async function doLogin() {
    var L = I18N[State.lang] || I18N.ar;
    var email = (document.getElementById('saas-email') || {}).value || '';
    var pass = (document.getElementById('saas-password') || {}).value || '';
    var msgEl = document.getElementById('saas-login-msg');

    email = email.trim();
    if (!validEmail(email)) { if (msgEl) msgEl.textContent = L.saas_invalid_email; return; }
    if (!pass) { if (msgEl) msgEl.textContent = L.saas_password + '?'; return; }

    if (msgEl) msgEl.textContent = '...';

    try {
      var authMod = getAuthMod();
      if (!authMod || !authMod.signInWithEmailAndPassword) throw new Error('Auth not available');
      var cred = await authMod.signInWithEmailAndPassword(getAuth(), email, pass);
      if (msgEl) msgEl.textContent = '';
      toast(L.saas_login_success + ' ✓', 'success');
      await onUserLoggedIn(cred.user);
    } catch (err) {
      console.error('[Section 23] Login failed:', err);
      var msg = L.saas_login_failed;
      if (err.code === 'auth/user-not-found') msg = State.lang === 'ar' ? 'الحساب غير موجود' : 'User not found';
      else if (err.code === 'auth/wrong-password') msg = L.saas_login_failed;
      else if (err.code === 'auth/too-many-requests') msg = State.lang === 'ar' ? 'محاولات كثيرة، انتظر قليلاً' : 'Too many attempts';
      if (msgEl) msgEl.textContent = msg;
    }
  }

  async function doRegister() {
    var L = I18N[State.lang] || I18N.ar;
    var companyName = (document.getElementById('saas-company') || {}).value || '';
    var name = (document.getElementById('saas-name') || {}).value || '';
    var email = (document.getElementById('saas-email') || {}).value || '';
    var phone = (document.getElementById('saas-phone') || {}).value || '';
    var pass = (document.getElementById('saas-password') || {}).value || '';
    var msgEl = document.getElementById('saas-register-msg');

    companyName = companyName.trim();
    name = name.trim();
    email = email.trim();

    if (!companyName) { if (msgEl) msgEl.textContent = L.saas_company_name; return; }
    if (!name) { if (msgEl) msgEl.textContent = L.saas_your_name; return; }
    if (!validEmail(email)) { if (msgEl) msgEl.textContent = L.saas_invalid_email; return; }
    if (pass.length < 6) { if (msgEl) msgEl.textContent = L.saas_weak_pass; return; }

    if (msgEl) msgEl.textContent = '...';

    try {
      var authMod = getAuthMod();
      var fsMod = getFsMod();
      if (!authMod || !fsMod) throw new Error('Firebase not ready');

      // 1) Create Firebase Auth user
      var cred = await authMod.createUserWithEmailAndPassword(getAuth(), email, pass);
      var user = cred.user;

      // 2) Create company document
      var companyId = 'c_' + user.uid.slice(0, 12);
      var companyRef = fsMod.doc(getDb(), 'companies', companyId);

      var settings = {
        companyName: companyName,
        phone: phone,
        email: email,
        address: '',
        rolePrices: { Director: 300, Photographer: 200, Crane: 250, Supervisor: 250, Assistant: 150 },
        payroll: { p1: { from: 1, to: 10 }, p2: { from: 11, to: 20 }, p3: { from: 21, to: 31 } },
        notifications: { enabled: true, whatsapp: false, whatsappApi: '' },
        distribution: { preventSameHallConsecutive: true, fairRotation: true, maxConsecutiveDays: 6 },
        security: { passwordMin: 6, sessionTimeout: 60 },
        theme: 'light',
        lang: State.lang || 'ar'
      };

      await fsMod.setDoc(companyRef, {
        id: companyId,
        name: companyName,
        ownerUid: user.uid,
        ownerEmail: email,
        phone: phone,
        createdAt: fsMod.serverTimestamp(),
        active: true
      });

      // 3) Create user profile
      var userRef = fsMod.doc(getDb(), 'users', user.uid);
      await fsMod.setDoc(userRef, {
        uid: user.uid,
        email: email,
        name: name,
        phone: phone,
        companyId: companyId,
        role: 'owner',
        createdAt: fsMod.serverTimestamp()
      });

      // 4) Create subscription (trial)
      var trialEnd = nowMs() + (PLANS.trial.durationDays * 86400000);
      var subRef = fsMod.doc(getDb(), 'subscriptions', companyId);
      await fsMod.setDoc(subRef, {
        companyId: companyId,
        planId: 'trial',
        status: 'trialing',
        startedAt: nowMs(),
        expiresAt: trialEnd,
        trialEndsAt: trialEnd,
        createdAt: fsMod.serverTimestamp()
      });

      // 5) Seed initial company data (empty state)
      var stateRef = fsMod.doc(getDb(), 'companies', companyId, 'app', 'main');
      var seed = {
        users: [],
        roles: [
          { id: 'r1', name: 'Admin', permissions: { '*': ['view', 'create', 'edit', 'delete', 'export', 'print', 'approve'] } },
          { id: 'r2', name: 'Manager', permissions: { employees: ['view', 'create', 'edit'], bookings: ['view', 'create', 'edit', 'approve'], reports: ['view', 'export'] } },
          { id: 'r3', name: 'Employee', permissions: { self: ['view'] } }
        ],
        employees: [],
        halls: [
          { id: 'hall1', name: { ar: 'القاعة المغلقة', en: 'Closed Hall' }, code: 'H1', type: 'Closed', status: 'active', address: '', notes: '', requirements: [{ role: 'Director', count: 1 }, { role: 'Photographer', count: 2 }, { role: 'Crane', count: 1 }], cost: 5000 },
          { id: 'hall2', name: { ar: 'القاعة الأوبن', en: 'Open Hall' }, code: 'H2', type: 'Open', status: 'active', address: '', notes: '', requirements: [{ role: 'Director', count: 1 }, { role: 'Photographer', count: 2 }, { role: 'Crane', count: 1 }], cost: 4500 },
          { id: 'hall3', name: { ar: 'الكافيه', en: 'Cafe' }, code: 'H3', type: 'Cafe', status: 'active', address: '', notes: '', requirements: [{ role: 'Photographer', count: 1 }], cost: 1500 }
        ],
        clients: [],
        equipment: [],
        bookings: [],
        distributions: [],
        attendance: [],
        leaves: [],
        substitutions: [],
        advances: [],
        deductions: [],
        bonuses: [],
        notifications: [],
        activityLogs: [],
        settings: settings,
        trash: []
      };

      // Add owner as an admin user in their company
      seed.users.push({
        id: user.uid,
        username: email,
        password: '',
        name: name,
        role: 'Admin',
        employeeId: null,
        email: email,
        firebaseUid: user.uid
      });

      await fsMod.setDoc(stateRef, {
        payload: seed,
        updatedBy: 'system',
        updatedByUser: email,
        updatedAt: fsMod.serverTimestamp(),
        version: nowMs()
      });

      if (msgEl) msgEl.textContent = '';
      toast(L.saas_signup_success + ' 🎉', 'success');
      await onUserLoggedIn(user);
    } catch (err) {
      console.error('[Section 23] Register failed:', err);
      var msg = State.lang === 'ar' ? 'فشل التسجيل' : 'Registration failed';
      if (err.code === 'auth/email-already-in-use') msg = L.saas_email_exists;
      else if (err.code === 'auth/weak-password') msg = L.saas_weak_pass;
      else if (err.code === 'auth/invalid-email') msg = L.saas_invalid_email;
      else if (err.message) msg = err.message;
      if (msgEl) msgEl.textContent = msg;
    }
  }

  async function doForgotPassword() {
    var L = I18N[State.lang] || I18N.ar;
    var email = ((document.getElementById('saas-email') || {}).value || '').trim();
    if (!validEmail(email)) { toast(L.saas_invalid_email, 'error'); return; }
    try {
      var authMod = getAuthMod();
      if (!authMod || !authMod.sendPasswordResetEmail) throw new Error('Auth not available');
      await authMod.sendPasswordResetEmail(getAuth(), email);
      toast(L.saas_reset_sent + ' ✓', 'success');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed', 'error');
    }
  }

  /* =========================================================
     7. ON LOGIN — load company + subscription + sync
     ========================================================= */
  async function onUserLoggedIn(user) {
    if (!user) return;
    SaaS.user = user;
    var fsMod = getFsMod();

    try {
      // Load profile
      var userRef = fsMod.doc(getDb(), 'users', user.uid);
      var userSnap = await fsMod.getDoc(userRef);
      if (!userSnap.exists()) {
        // Legacy user without profile → create one
        console.warn('[Section 23] No profile for user, creating…');
        await fsMod.setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || user.email || 'User',
          phone: '',
          companyId: 'c_' + user.uid.slice(0, 12),
          role: 'owner',
          createdAt: fsMod.serverTimestamp()
        });
        // reload
        var s2 = await fsMod.getDoc(userRef);
        SaaS.profile = s2.data();
      } else {
        SaaS.profile = userSnap.data();
      }

      // Check super admin
      SaaS.isSuperAdmin = SaaS.profile && SaaS.profile.role === 'super_admin';

      if (SaaS.isSuperAdmin) {
        console.log('[Section 23] Super admin detected');
      }

      // Load company
      if (SaaS.profile && SaaS.profile.companyId) {
        var compRef = fsMod.doc(getDb(), 'companies', SaaS.profile.companyId);
        var compSnap = await fsMod.getDoc(compRef);
        if (compSnap.exists()) SaaS.company = compSnap.data();
      }

      // Load subscription
      if (SaaS.company) {
        var subRef = fsMod.doc(getDb(), 'subscriptions', SaaS.company.id);
        var subSnap = await fsMod.getDoc(subRef);
        if (subSnap.exists()) SaaS.subscription = subSnap.data();
      }

      // Attach realtime listeners
      attachCompanyListeners();

      // Set State.user from profile
      if (State) {
        State.user = {
          id: user.uid,
          username: user.email,
          name: SaaS.profile ? SaaS.profile.name : (user.email || 'User'),
          role: SaaS.isSuperAdmin ? 'Admin' : (SaaS.profile ? mapProfileRole(SaaS.profile.role) : 'Admin'),
          employeeId: SaaS.profile ? SaaS.profile.employeeId : null,
          firebaseUid: user.uid,
          companyId: SaaS.profile ? SaaS.profile.companyId : null,
          isSuperAdmin: SaaS.isSuperAdmin
        };
      }

      SaaS.ready = true;

      // Update the UI (show app)
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');

      // Update user chip
      var avatar = document.getElementById('user-avatar');
      var nameEl = document.getElementById('user-name');
      var roleEl = document.getElementById('user-role');
      if (avatar) avatar.textContent = initials(State.user.name);
      if (nameEl) nameEl.textContent = State.user.name;
      if (roleEl) roleEl.textContent = SaaS.isSuperAdmin ? 'Super Admin' : (SaaS.company ? SaaS.company.name : State.user.role);

      // Add subscription banner
      renderSubscriptionBanner();

      // Add super-admin nav if applicable
      if (SaaS.isSuperAdmin) addSuperAdminNav();

      // Navigate
      if (typeof renderSidebar === 'function') renderSidebar();
      if (typeof navigate === 'function') navigate('dashboard');

      // Override saveData to write to Firestore (companies/{id}/app/main)
      overrideSaveDataToFirestore();

      // Update notification
      toast((I18N[State.lang].saas_welcome || 'Welcome') + ' ' + State.user.name + ' 👋', 'success');
    } catch (err) {
      console.error('[Section 23] onUserLoggedIn failed:', err);
      toast(State.lang === 'ar' ? 'فشل تحميل بيانات الشركة' : 'Failed to load company data', 'error');
    }
  }

  function mapProfileRole(role) {
    // Map SaaS roles to legacy roles
    if (role === 'owner' || role === 'admin') return 'Admin';
    if (role === 'manager') return 'Manager';
    return 'Employee';
  }

  /* =========================================================
     8. FIRESTORE LISTENERS — realtime company data
     ========================================================= */
  function attachCompanyListeners() {
    if (!SaaS.company || !SaaS.profile) return;

    var fsMod = getFsMod();
    var stateRef = fsMod.doc(getDb(), 'companies', SaaS.profile.companyId, 'app', 'main');

    if (SaaS.companyUnsub) try { SaaS.companyUnsub(); } catch (e) {}
    SaaS.companyUnsub = fsMod.onSnapshot(stateRef, function (snap) {
      if (!snap.exists()) return;
      var data = snap.data();
      if (!data || !data.payload) return;
      if (data.updatedBy === (SaaS.user ? SaaS.user.uid : '') && !window.__dmSaaSForceRefresh) {
        // own write
        return;
      }
      // Apply remote (from another device)
      console.log('[Section 23] Company data updated — refreshing');
      State.data = data.payload;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}
      if (typeof navigate === 'function' && State.page) navigate(State.page);
    });
  }

  /* =========================================================
     9. OVERRIDE saveData — write to Firestore company path
     ========================================================= */
  var overrideInstalled = false;
  function overrideSaveDataToFirestore() {
    if (overrideInstalled) return;
    overrideInstalled = true;

    var prev = window.saveData;
    window.saveData = async function () {
      // 1) Save locally
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}

      // 2) Push to Firestore (company path)
      if (!SaaS.company || !SaaS.user) return;

      try {
        var fsMod = getFsMod();
        var ref = fsMod.doc(getDb(), 'companies', SaaS.profile.companyId, 'app', 'main');
        await fsMod.setDoc(ref, {
          payload: State.data,
          updatedBy: SaaS.user.uid,
          updatedByUser: SaaS.user.email,
          updatedAt: fsMod.serverTimestamp(),
          version: nowMs()
        });
      } catch (err) {
        console.warn('[Section 23] saveData → Firestore failed:', err);
      }
    };

    console.log('%c[Section 23] ✓ saveData → company Firestore path', 'color:#10b981;font-weight:bold');
  }

  /* =========================================================
     10. SUBSCRIPTION BANNER
     ========================================================= */
  function renderSubscriptionBanner() {
    if (!SaaS.subscription) return;
    var existing = document.getElementById('dm-sub-banner');
    if (existing) existing.remove();

    var sub = SaaS.subscription;
    var days = daysUntil(sub.expiresAt);
    var expired = days <= 0;
    var plan = PLANS[sub.planId] || PLANS.starter;

    var banner = document.createElement('div');
    banner.id = 'dm-sub-banner';
    banner.style.cssText = 'padding:.6rem 1.25rem;background:' +
      (expired ? 'linear-gradient(90deg,#ef4444,#dc2626)' : days < 3 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#10b981,#059669)') +
      ';color:#fff;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap';

    var L = I18N[State.lang] || I18N.ar;
    banner.innerHTML =
      '<span>' +
        (expired ? '🚫 ' : days < 3 ? '⚠️ ' : '✓ ') +
        (expired ? L.saas_expired : 'باقة ' + plan.name + ' — ' + days + ' ' + L.saas_days_left) +
      '</span>' +
      '<button id="dm-sub-upgrade" style="margin-inline-start:auto;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:.35rem .85rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.75rem">' +
        L.saas_upgrade +
      '</button>';

    var main = document.getElementById('main');
    var topbar = document.getElementById('topbar');
    if (main && topbar) {
      topbar.parentNode.insertBefore(banner, topbar.nextSibling);
    }

    var upBtn = banner.querySelector('#dm-sub-upgrade');
    if (upBtn) upBtn.onclick = function () { showPlansModal(); };
  }

  /* =========================================================
     11. PLANS MODAL
     ========================================================= */
  function showPlansModal() {
    if (typeof openModal !== 'function') return;
    var L = I18N[State.lang] || I18N.ar;
    var current = SaaS.subscription ? SaaS.subscription.planId : 'trial';

    var planCards = '';
    Object.keys(PLANS).forEach(function (key) {
      var p = PLANS[key];
      var isCurrent = key === current;
      var priceText = p.price === 0 ? (State.lang === 'ar' ? 'مجانًا' : 'Free') :
        p.price < 0 ? (State.lang === 'ar' ? 'اتصل بنا' : 'Contact us') :
        p.price + ' ' + (State.lang === 'ar' ? 'ج/شهر' : 'EGP/mo');

      planCards +=
        '<div style="border:2px solid ' + (isCurrent ? '#7c3aed' : 'var(--border)') + ';border-radius:14px;padding:1rem;' + (isCurrent ? 'background:rgba(124,58,237,.05);' : '') + '">' +
          '<div style="font-weight:800;font-size:1rem;margin-bottom:.25rem">' + esc(p.name) + '</div>' +
          '<div style="font-size:1.35rem;font-weight:800;color:#7c3aed;margin-bottom:.5rem">' + priceText + '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.75rem">' +
            '👥 ' + p.limits.employees + ' · 📅 ' + p.limits.bookings + ' · 🏛 ' + p.limits.halls +
          '</div>' +
          (isCurrent ?
            '<div style="padding:.4rem;background:#7c3aed;color:#fff;border-radius:8px;text-align:center;font-size:.75rem;font-weight:700">' + (State.lang === 'ar' ? 'باقتك الحالية' : 'Current') + '</div>' :
            '<button onclick="__dmSaaSUpgrade(\'' + key + '\')" style="width:100%;padding:.5rem;background:var(--primary);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.8rem">' +
              (State.lang === 'ar' ? 'ترقية' : 'Upgrade') +
            '</button>') +
        '</div>';
    });

    openModal({
      title: '💎 ' + (State.lang === 'ar' ? 'الباقات' : 'Plans'),
      size: 'xl',
      body: '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem">' + planCards + '</div>' +
        '<div style="margin-top:1rem;padding:.75rem;background:rgba(59,130,246,.08);border-inline-start:3px solid #3b82f6;border-radius:8px;font-size:.75rem;color:var(--text-muted)">' +
          '💳 ' + (State.lang === 'ar' ? 'الدفع عبر Paymob / Fawry — قيد التفعيل' : 'Payment via Paymob / Fawry — coming soon') +
        '</div>',
      footer: '<button class="btn btn-ghost" onclick="closeModal()">' + (State.lang === 'ar' ? 'إغلاق' : 'Close') + '</button>'
    });
  }
  window.__dmShowPlans = showPlansModal;

  window.__dmSaaSUpgrade = function (planId) {
    var L = I18N[State.lang] || I18N.ar;
    toast(
      State.lang === 'ar'
        ? 'سيتم توجيهك لصفحة الدفع قريبًا (Paymob)'
        : 'You will be redirected to payment soon (Paymob)',
      'info'
    );
    // Placeholder — integrate Paymob here:
    // 1. POST to your backend /api/checkout with planId + companyId
    // 2. Backend creates Paymob order
    // 3. Redirect to Paymob iframe
    // 4. On success, backend updates subscriptions/{companyId}
  };

  /* =========================================================
     12. SUPER ADMIN
     ========================================================= */
  function addSuperAdminNav() {
    if (document.getElementById('dm-super-nav')) return;
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    var section = document.createElement('div');
    section.id = 'dm-super-nav';
    section.innerHTML =
      '<div class="nav-section" style="color:#f59e0b;opacity:1">⚡ SUPER ADMIN</div>' +
      '<a class="nav-item" data-page="superadmin" onclick="event.preventDefault();__dmSuperAdmin()" style="cursor:pointer;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3)">' +
        '<i data-lucide="crown" style="color:#f59e0b"></i>' +
        '<span>' + esc(I18N[State.lang].saas_super_admin || 'Super Admin') + '</span>' +
      '</a>';
    nav.appendChild(section);
    if (window.lucide) lucide.createIcons();
  }

  window.__dmSuperAdmin = async function () {
    if (!SaaS.isSuperAdmin) {
      toast(State.lang === 'ar' ? 'هذه اللوحة للمدير العام فقط' : 'Super admin only', 'error');
      return;
    }
    if (typeof navigate !== 'function') return;

    // Register page
    Pages.superadmin = async function (el) {
      el.innerHTML = '<div class="skeleton" style="height:60px;margin-bottom:1rem"></div><div class="skeleton" style="height:200px"></div>';

      try {
        var fsMod = getFsMod();
        var comps = await fsMod.getDocs(fsMod.collection(getDb(), 'companies'));
        var subs = await fsMod.getDocs(fsMod.collection(getDb(), 'subscriptions'));
        var subMap = {};
        subs.forEach(function (d) { subMap[d.id] = d.data(); });

        var rows = [];
        var totalMRR = 0;
        var activeCount = 0;
        var trialCount = 0;

        comps.forEach(function (d) {
          var c = d.data();
          var sub = subMap[c.id] || {};
          var plan = PLANS[sub.planId] || PLANS.trial;
          var days = sub.expiresAt ? daysUntil(sub.expiresAt) : 0;
          var isExpired = days <= 0;

          if (!isExpired) {
            activeCount++;
            if (sub.planId === 'trial') trialCount++;
            else totalMRR += (plan.price || 0);
          }

          rows.push({
            id: c.id,
            name: c.name,
            ownerEmail: c.ownerEmail,
            phone: c.phone,
            plan: plan.name,
            planId: sub.planId || 'trial',
            days: days,
            expired: isExpired,
            createdAt: c.createdAt
          });
        });

        rows.sort(function (a, b) { return (b.days - a.days); });

        el.innerHTML =
          '<div class="grid-stats" style="margin-bottom:1.5rem">' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(124,58,237,.1);color:#7c3aed"><i data-lucide="building-2"></i></div><div class="stat-body"><div class="label">' + (State.lang === 'ar' ? 'إجمالي الشركات' : 'Companies') + '</div><div class="value">' + rows.length + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(16,185,129,.1);color:#10b981"><i data-lucide="check-circle"></i></div><div class="stat-body"><div class="label">' + (State.lang === 'ar' ? 'نشطة' : 'Active') + '</div><div class="value">' + activeCount + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,.1);color:#f59e0b"><i data-lucide="gift"></i></div><div class="stat-body"><div class="label">' + (State.lang === 'ar' ? 'تجارب' : 'Trials') + '</div><div class="value">' + trialCount + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(6,182,212,.1);color:#06b6d4"><i data-lucide="dollar-sign"></i></div><div class="stat-body"><div class="label">MRR</div><div class="value">' + totalMRR.toLocaleString() + ' EGP</div></div></div>' +
          '</div>' +
          '<div class="card" style="padding:0;overflow:hidden">' +
            '<div class="table-wrap" style="border:none;border-radius:0">' +
              '<table class="data-table">' +
                '<thead><tr>' +
                  '<th>' + (State.lang === 'ar' ? 'الشركة' : 'Company') + '</th>' +
                  '<th>Email</th>' +
                  '<th>' + (State.lang === 'ar' ? 'الباقة' : 'Plan') + '</th>' +
                  '<th>' + (State.lang === 'ar' ? 'المتبقي' : 'Days left') + '</th>' +
                  '<th>' + (State.lang === 'ar' ? 'الحالة' : 'Status') + '</th>' +
                '</tr></thead>' +
                '<tbody>' +
                  (rows.length ?
                    rows.map(function (r) {
                      var statusColor = r.expired ? 'red' : (r.days <= 3 ? 'yellow' : 'green');
                      return '<tr>' +
                        '<td><b>' + esc(r.name) + '</b></td>' +
                        '<td>' + esc(r.ownerEmail) + '</td>' +
                        '<td><span class="badge-pill badge-purple">' + esc(r.plan) + '</span></td>' +
                        '<td>' + r.days + ' ' + (State.lang === 'ar' ? 'يوم' : 'd') + '</td>' +
                        '<td><span class="badge-pill badge-' + statusColor + '">' + (r.expired ? 'Expired' : 'Active') + '</span></td>' +
                      '</tr>';
                    }).join('') :
                    '<tr><td colspan="5"><div class="empty-state"><i data-lucide="inbox"></i><p>No companies yet</p></div></td></tr>') +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>';

        if (window.lucide) lucide.createIcons();
      } catch (err) {
        console.error('[Section 23] super admin failed:', err);
        el.innerHTML = '<div class="empty-state"><i data-lucide="alert-triangle"></i><p>Failed to load: ' + esc(err.message) + '</p></div>';
      }
    };

    navigate('superadmin');
  };

  /* =========================================================
     13. LOGOUT — override
     ========================================================= */
  function hookLogout() {
    var orig = window.logout;
    window.logout = async function () {
      try {
        var authMod = getAuthMod();
        if (authMod && authMod.signOut) await authMod.signOut(getAuth());
      } catch (e) { console.warn(e); }
      SaaS.user = null;
      SaaS.profile = null;
      SaaS.company = null;
      SaaS.subscription = null;
      SaaS.isSuperAdmin = false;
      SaaS.ready = false;
      if (SaaS.companyUnsub) try { SaaS.companyUnsub(); } catch (e) {}
      // Call original (clears localStorage etc.)
      if (typeof orig === 'function') return orig.apply(this, arguments);
    };
  }

  /* =========================================================
     14. AUTH STATE OBSERVER
     ========================================================= */
  function attachAuthObserver() {
    var authMod = getAuthMod();
    if (!authMod || !authMod.onAuthStateChanged) return;
    authMod.onAuthStateChanged(getAuth(), function (user) {
      if (user) {
        console.log('[Section 23] Auth state: signed in as', user.email);
        // If login screen still visible, run login handler
        if (!SaaS.ready) {
          onUserLoggedIn(user);
        }
      } else {
        console.log('[Section 23] Auth state: signed out');
        SaaS.user = null;
        SaaS.ready = false;
      }
    });
  }

  /* =========================================================
     15. INIT
     ========================================================= */
  function initSaaS() {
    // 1. Inject login/register tabs
    injectSaaSUI();

    // 2. Hook logout
    hookLogout();

    // 3. Attach auth observer
    attachAuthObserver();

    // 4. Block old login form
    var oldBtn = document.querySelector('.btn-login');
    if (oldBtn) {
      oldBtn.style.display = 'none';
    }

    console.log('%c[Section 23] ✓ SaaS layer ready', 'color:#10b981;font-weight:bold;font-size:13px');
    console.log('%c[Section 23] Super admin: set role="super_admin" in /users/{uid}', 'color:#f59e0b;font-style:italic');
  }

  waitFor(
    function () {
      return window.DrMediaFB && window.DrMediaFB.ready
        && typeof State !== 'undefined'
        && document.getElementById('login-screen');
    },
    function () {
      initSaaS();
    }
  );

})();
/* =========================================================
   SECTION 24: Super Admin Nav Fix
   Version: 1.0.0
   ---------------------------------------------------------
   Fixes: Super Admin nav being wiped by renderSidebar()
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 24] Super Admin Nav Fix loading…', 'color:#f59e0b;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 24] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- inject super admin nav ---------- */
  function injectSuperAdminNav() {
    if (typeof window.__dmSaaS === 'undefined') return;
    var SaaS = window.__dmSaaS;
    if (!SaaS || !SaaS.isSuperAdmin) return;

    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    // Already injected?
    if (document.getElementById('dm-super-nav')) return;

    var section = document.createElement('div');
    section.id = 'dm-super-nav';
    section.innerHTML =
      '<div class="nav-section" style="color:#f59e0b;opacity:1;letter-spacing:.1em">⚡ SUPER ADMIN</div>' +
      '<a class="nav-item" data-page="superadmin" style="cursor:pointer;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#f59e0b">' +
        '<i data-lucide="crown" style="color:#f59e0b"></i>' +
        '<span style="color:#f59e0b;font-weight:700">لوحة المدير العام</span>' +
      '</a>';

    nav.appendChild(section);

    // Bind click
    var link = section.querySelector('.nav-item');
    if (link) {
      link.onclick = function (e) {
        e.preventDefault();
        if (typeof window.__dmSuperAdmin === 'function') window.__dmSuperAdmin();
      };
    }

    if (window.lucide) {
      try { lucide.createIcons(); } catch (e) {}
    }
  }

  /* ---------- hook renderSidebar ---------- */
  function hookRenderSidebar() {
    if (typeof window.renderSidebar !== 'function') {
      console.warn('[Section 24] renderSidebar not found');
      return;
    }
    if (window.renderSidebar.__dmHooked) return;

    var orig = window.renderSidebar;
    window.renderSidebar = function () {
      var result = orig.apply(this, arguments);
      // Always inject after render
      try { injectSuperAdminNav(); } catch (e) { console.warn('[Section 24]', e); }
      return result;
    };
    window.renderSidebar.__dmHooked = true;
    console.log('%c[Section 24] ✓ renderSidebar hooked', 'color:#10b981;font-weight:bold');
  }

  /* ---------- also watch DOM mutations as a fallback ---------- */
  function watchSidebar() {
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    var obs = new MutationObserver(function () {
      // Debounce
      clearTimeout(window.__dm24T);
      window.__dm24T = setTimeout(function () {
        if (typeof window.__dmSaaS !== 'undefined' && window.__dmSaaS.isSuperAdmin) {
          injectSuperAdminNav();
        }
      }, 150);
    });
    obs.observe(nav, { childList: true });
  }

  /* ---------- boot ---------- */
  waitFor(
    function () {
      return typeof window.__dmSaaS !== 'undefined'
        && typeof window.renderSidebar === 'function'
        && document.getElementById('sidebar-nav');
    },
    function () {
      hookRenderSidebar();
      watchSidebar();

      // Try immediately (in case sidebar already rendered)
      injectSuperAdminNav();

      // Also retry after 1s and 3s (in case session restores late)
      setTimeout(injectSuperAdminNav, 1000);
      setTimeout(injectSuperAdminNav, 3000);

      console.log('%c[Section 24] ✓ Ready', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 24] Try: __dmSuperAdmin()', 'color:#06b6d4;font-style:italic');
    }
  );

  // Expose for manual trigger
  window.__dmInjectSuperNav = injectSuperAdminNav;

})();
/* =========================================================
   SECTION 25: Subscription Enforcement
   Version: 1.0.0
   - Blocks access when subscription expired
   - Grace period (3 days read-only)
   - Renewal modal
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 25] Subscription Enforcement loading…', 'color:#ef4444;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 25] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.sub_expired_title = 'انتهى الاشتراك';
  I18N.ar.sub_expired_msg = 'انتهت صلاحية اشتراكك. جدد الآن للاستمرار في استخدام النظام.';
  I18N.ar.sub_grace_title = 'فترة سماح';
  I18N.ar.sub_grace_msg = 'انتهى اشتراكك — أنت في فترة سماح 3 أيام (قراءة فقط). جدد الآن.';
  I18N.ar.sub_renew_now = 'تجديد الاشتراك';
  I18N.ar.sub_contact = 'تواصل معنا';
  I18N.ar.sub_logout = 'خروج';
  I18N.ar.sub_days_expired = 'أيام منذ الانتهاء';

  I18N.en.sub_expired_title = 'Subscription Expired';
  I18N.en.sub_expired_msg = 'Your subscription has ended. Renew now to continue using the system.';
  I18N.en.sub_grace_title = 'Grace Period';
  I18N.en.sub_grace_msg = 'Subscription ended — 3-day grace period (read-only). Renew now.';
  I18N.en.sub_renew_now = 'Renew Subscription';
  I18N.en.sub_contact = 'Contact Us';
  I18N.en.sub_logout = 'Logout';
  I18N.en.sub_days_expired = 'days since expiry';

  /* ---------- config ---------- */
  var GRACE_DAYS = 3;

  /* ---------- state ---------- */
  var Enf = {
    blocked: false,
    readOnly: false,
    overlay: null,
    checkInterval: null
  };
  window.__dmEnforcement = Enf;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- check subscription ---------- */
  function checkSubscription() {
    if (typeof window.__dmSaaS === 'undefined') return 'unknown';
    var SaaS = window.__dmSaaS;
    if (!SaaS.ready || !SaaS.subscription) return 'unknown';
    if (SaaS.isSuperAdmin) return 'super_admin';

    var sub = SaaS.subscription;
    var now = Date.now();
    var expiresAt = sub.expiresAt || 0;
    var daysSinceExpiry = Math.floor((now - expiresAt) / 86400000);

    if (now < expiresAt) return 'active';                     // ✅ valid
    if (daysSinceExpiry < GRACE_DAYS) return 'grace';         // 🟡 read-only
    return 'expired';                                          // 🔴 blocked
  }

  /* ---------- apply enforcement ---------- */
  function applyEnforcement() {
    var status = checkSubscription();
    console.log('[Section 25] Subscription status:', status);

    if (status === 'super_admin' || status === 'unknown') {
      removeOverlay();
      Enf.blocked = false;
      Enf.readOnly = false;
      return;
    }

    if (status === 'expired') {
      Enf.blocked = true;
      Enf.readOnly = true;
      showOverlay('expired');
    } else if (status === 'grace') {
      Enf.blocked = false;
      Enf.readOnly = true;
      showGraceBanner();
    } else {
      removeOverlay();
      removeGraceBanner();
      Enf.blocked = false;
      Enf.readOnly = false;
    }
  }

  /* ---------- overlay (expired) ---------- */
  function showOverlay(type) {
    if (document.getElementById('dm-enf-overlay')) return;
    var L = I18N[State.lang] || I18N.ar;

    var overlay = document.createElement('div');
    overlay.id = 'dm-enf-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:linear-gradient(135deg,rgba(15,10,31,.95),rgba(30,27,58,.95));backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:1rem';

    overlay.innerHTML =
      '<div style="max-width:520px;width:100%;background:var(--surface);border-radius:20px;padding:2.5rem 2rem;text-align:center;box-shadow:0 40px 80px -20px rgba(0,0,0,.6);border:1px solid var(--border)">' +
        '<div style="width:80px;height:80px;border-radius:24px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:2.5rem;box-shadow:0 20px 40px -10px rgba(239,68,68,.5)">🔒</div>' +
        '<h2 style="margin:0 0 .5rem;font-size:1.35rem;font-weight:800">' + esc(L.sub_expired_title) + '</h2>' +
        '<p style="color:var(--text-muted);font-size:.9rem;line-height:1.7;margin:0 0 1.5rem">' + esc(L.sub_expired_msg) + '</p>' +
        '<div style="display:flex;gap:.5rem;flex-direction:column">' +
          '<button id="dm-enf-renew" style="width:100%;padding:.95rem;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;font-weight:700;font-size:.95rem;cursor:pointer;font-family:inherit;box-shadow:0 10px 25px -8px #7c3aed">💳 ' + esc(L.sub_renew_now) + '</button>' +
          '<button id="dm-enf-contact" style="width:100%;padding:.85rem;border-radius:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✉️ ' + esc(L.sub_contact) + '</button>' +
          '<button id="dm-enf-logout" style="width:100%;padding:.75rem;border-radius:12px;background:transparent;color:var(--text-muted);border:none;font-weight:600;font-size:.8rem;cursor:pointer;font-family:inherit">🚪 ' + esc(L.sub_logout) + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#dm-enf-renew').onclick = function () {
      if (typeof window.__dmShowPlans === 'function') window.__dmShowPlans();
      else if (typeof window.__dmSaaSUpgrade === 'function') window.__dmSaaSUpgrade('pro');
    };
    overlay.querySelector('#dm-enf-contact').onclick = function () {
      var email = 'support@drmedia.pro';
      var subject = encodeURIComponent('تجديد الاشتراك - ' + (SaaS.company ? SaaS.company.name : ''));
      window.open('mailto:' + email + '?subject=' + subject, '_blank');
    };
    overlay.querySelector('#dm-enf-logout').onclick = function () {
      if (typeof window.logout === 'function') window.logout();
    };

    // Block interactions
    document.body.style.overflow = 'hidden';
  }

  function removeOverlay() {
    var o = document.getElementById('dm-enf-overlay');
    if (o) o.remove();
    document.body.style.overflow = '';
  }

  /* ---------- grace banner ---------- */
  function showGraceBanner() {
    if (document.getElementById('dm-grace-banner')) return;
    var L = I18N[State.lang] || I18N.ar;

    var banner = document.createElement('div');
    banner.id = 'dm-grace-banner';
    banner.style.cssText = 'padding:.6rem 1.25rem;background:linear-gradient(90deg,#f59e0b,#d97706);color:#fff;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;position:relative;z-index:100';

    banner.innerHTML =
      '<span>⚠️ ' + esc(L.sub_grace_title) + ' — ' + esc(L.sub_grace_msg) + '</span>' +
      '<button id="dm-grace-renew" style="margin-inline-start:auto;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4);color:#fff;padding:.35rem .85rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.75rem">' +
        esc(L.sub_renew_now) +
      '</button>';

    var main = document.getElementById('main');
    var topbar = document.getElementById('topbar');
    if (main && topbar) {
      var existingSub = document.getElementById('dm-sub-banner');
      if (existingSub) existingSub.remove();
      topbar.parentNode.insertBefore(banner, topbar.nextSibling);
    }

    banner.querySelector('#dm-grace-renew').onclick = function () {
      if (typeof window.__dmShowPlans === 'function') window.__dmShowPlans();
    };
  }

  function removeGraceBanner() {
    var b = document.getElementById('dm-grace-banner');
    if (b) b.remove();
  }

  /* ---------- hook saveData — block writes when read-only ---------- */
  function hookSaveData() {
    if (typeof window.saveData !== 'function') return;
    if (window.saveData.__dm25Hooked) return;

    var orig = window.saveData;
    window.saveData = function () {
      if (Enf.readOnly) {
        if (typeof showToast === 'function') {
          showToast(
            State.lang === 'ar' ? '⚠️ اشتراكك انتهى — قراءة فقط' : '⚠️ Subscription expired — read-only',
            'warn'
          );
        }
        return false;
      }
      return orig.apply(this, arguments);
    };
    window.saveData.__dm25Hooked = true;
    console.log('[Section 25] saveData hooked (read-only block)');
  }

  /* ---------- periodic check ---------- */
  function startPeriodicCheck() {
    if (Enf.checkInterval) clearInterval(Enf.checkInterval);
    Enf.checkInterval = setInterval(function () {
      applyEnforcement();
    }, 60 * 1000); // every minute
  }

  /* ---------- boot ---------- */
  waitFor(
    function () {
      return typeof window.__dmSaaS !== 'undefined'
        && window.__dmSaaS.ready;
    },
    function () {
      hookSaveData();
      applyEnforcement();
      startPeriodicCheck();
      console.log('%c[Section 25] ✓ Enforcement ready', 'color:#10b981;font-weight:bold');
    }
  );

  // Expose
  window.__dmCheckSub = checkSubscription;
  window.__dmApplyEnforcement = applyEnforcement;

})();
/* =========================================================
   SECTION 26: Onboarding Wizard
   Version: 1.0.0
   - 4-step wizard shown after signup
   - Step 1: Company info
   - Step 2: Add employees
   - Step 3: Review halls
   - Step 4: First booking
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 26] Onboarding Wizard loading…', 'color:#10b981;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 26] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.onb_welcome = 'مرحبًا بك في Dr Media Pro';
  I18N.ar.onb_subtitle = '5 دقائق ونكون جاهزين — يلا نبدأ';
  I18N.ar.onb_step = 'خطوة';
  I18N.ar.onb_of = 'من';
  I18N.ar.onb_next = 'التالي';
  I18N.ar.onb_back = 'رجوع';
  I18N.ar.onb_finish = 'ابدأ الاستخدام';
  I18N.ar.onb_skip = 'تخطي الجولة';
  I18N.ar.onb_s1_title = 'بيانات الشركة';
  I18N.ar.onb_s1_desc = 'خلي النظام يعرف شركتك';
  I18N.ar.onb_s2_title = 'أضف فريقك';
  I18N.ar.onb_s2_desc = 'المخرجين، المصورين، الكرين — الكل';
  I18N.ar.onb_s3_title = 'القاعات';
  I18N.ar.onb_s3_desc = 'راجع القاعات الافتراضية — عدّلها لاحقًا';
  I18N.ar.onb_s4_title = 'جاهز!';
  I18N.ar.onb_s4_desc = 'ممكن تبدأ أول حجز الآن';
  I18N.ar.onb_add_employee = 'إضافة موظف';
  I18N.ar.onb_name = 'الاسم';
  I18N.ar.onb_role = 'الوظيفة';
  I18N.ar.onb_phone = 'الهاتف';
  I18N.ar.onb_day_rate = 'سعر اليوم';
  I18N.ar.onb_skip_step = 'تخطي الخطوة';

  I18N.en.onb_welcome = 'Welcome to Dr Media Pro';
  I18N.en.onb_subtitle = '5 minutes to get started';
  I18N.en.onb_step = 'Step';
  I18N.en.onb_of = 'of';
  I18N.en.onb_next = 'Next';
  I18N.en.onb_back = 'Back';
  I18N.en.onb_finish = 'Start using';
  I18N.en.onb_skip = 'Skip tour';
  I18N.en.onb_s1_title = 'Company Info';
  I18N.en.onb_s1_desc = 'Let the system know your company';
  I18N.en.onb_s2_title = 'Add your team';
  I18N.en.onb_s2_desc = 'Directors, photographers, crane — everyone';
  I18N.en.onb_s3_title = 'Halls';
  I18N.en.onb_s3_desc = 'Review default halls — edit them later';
  I18N.en.onb_s4_title = 'Ready!';
  I18N.en.onb_s4_desc = 'You can start your first booking now';
  I18N.en.onb_add_employee = 'Add Employee';
  I18N.en.onb_name = 'Name';
  I18N.en.onb_role = 'Role';
  I18N.en.onb_phone = 'Phone';
  I18N.en.onb_day_rate = 'Day Rate';
  I18N.en.onb_skip_step = 'Skip step';

  var ONBOARDING_KEY = 'drmedia_onboarding_done_v1';

  /* ---------- state ---------- */
  var Onb = {
    step: 1,
    totalSteps: 4,
    active: false,
    overlay: null
  };
  window.__dmOnboarding = Onb;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- detect new user ---------- */
  function isNewUser() {
    // New user = just registered, has trial, empty bookings
    if (localStorage.getItem(ONBOARDING_KEY) === '1') return false;
    if (typeof window.__dmSaaS === 'undefined' || !window.__dmSaaS.subscription) return false;
    if (window.__dmSaaS.subscription.planId !== 'trial') return false;
    // Check if company is empty (few bookings)
    var bCount = (State.data.bookings || []).length;
    if (bCount > 3) {
      localStorage.setItem(ONBOARDING_KEY, '1');
      return false;
    }
    return true;
  }

  /* ---------- show wizard ---------- */
  function showWizard() {
    if (Onb.active) return;
    Onb.active = true;
    Onb.step = 1;

    var overlay = document.createElement('div');
    overlay.id = 'dm-onb-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:linear-gradient(135deg,#0f0a1f 0%,#1e1b3a 100%);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    document.body.appendChild(overlay);
    Onb.overlay = overlay;

    renderStep();
  }

  function renderStep() {
    if (!Onb.overlay) return;
    var L = I18N[State.lang] || I18N.ar;

    var steps = [1, 2, 3, 4];
    var progressBar = steps.map(function (s) {
      var active = s <= Onb.step;
      return '<div style="flex:1;height:4px;border-radius:2px;background:' + (active ? '#7c3aed' : 'rgba(255,255,255,.1)') + ';transition:background .3s"></div>';
    }).join('');

    var content = '';
    if (Onb.step === 1) content = renderStep1();
    else if (Onb.step === 2) content = renderStep2();
    else if (Onb.step === 3) content = renderStep3();
    else if (Onb.step === 4) content = renderStep4();

    Onb.overlay.innerHTML =
      '<div style="max-width:640px;width:100%;margin:auto">' +
        '<div style="text-align:center;margin-bottom:1.5rem">' +
          '<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#f59e0b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.75rem;margin:0 auto 1rem;box-shadow:0 20px 40px -10px rgba(124,58,237,.5)">D</div>' +
          '<h2 style="color:#fff;margin:0 0 .25rem;font-size:1.35rem;font-weight:800">' + esc(L.onb_welcome) + '</h2>' +
          '<p style="color:#94a3b8;font-size:.85rem;margin:0">' + esc(L.onb_subtitle) + '</p>' +
        '</div>' +

        '<div style="display:flex;gap:.35rem;margin-bottom:1.5rem">' + progressBar + '</div>' +

        '<div style="background:rgba(21,16,36,.85);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:1.75rem">' +
          '<div style="color:#94a3b8;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.35rem">' +
            esc(L.onb_step) + ' ' + Onb.step + ' ' + esc(L.onb_of) + ' ' + Onb.totalSteps +
          '</div>' +
          content +
        '</div>' +

        '<div style="display:flex;gap:.5rem;margin-top:1.25rem;justify-content:space-between;align-items:center;flex-wrap:wrap">' +
          '<button id="dm-onb-skip" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-family:inherit;font-size:.8rem;padding:.5rem">' + esc(L.onb_skip) + '</button>' +
          '<div style="display:flex;gap:.5rem">' +
            (Onb.step > 1 ? '<button id="dm-onb-back" style="padding:.75rem 1.25rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.15);font-weight:600;cursor:pointer;font-family:inherit;font-size:.85rem">' + esc(L.onb_back) + '</button>' : '') +
            '<button id="dm-onb-next" style="padding:.75rem 1.5rem;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;font-weight:700;cursor:pointer;font-family:inherit;font-size:.9rem;box-shadow:0 10px 25px -8px #7c3aed">' +
              (Onb.step === Onb.totalSteps ? '🎉 ' + esc(L.onb_finish) : esc(L.onb_next) + ' →') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindStepEvents();
  }

  /* ---------- step 1: company ---------- */
  function renderStep1() {
    var L = I18N[State.lang] || I18N.ar;
    var settings = State.data.settings || {};
    var company = (window.__dmSaaS && window.__dmSaaS.company) || {};

    return '' +
      '<h3 style="color:#fff;margin:0 0 .35rem;font-size:1.15rem">' + esc(L.onb_s1_title) + '</h3>' +
      '<p style="color:#94a3b8;font-size:.8rem;margin:0 0 1.25rem">' + esc(L.onb_s1_desc) + '</p>' +

      '<div style="display:flex;flex-direction:column;gap:.85rem">' +
        '<div>' +
          '<label style="display:block;color:#cbd5e1;font-size:.75rem;font-weight:600;margin-bottom:.35rem">' + esc(L.onb_name) + ' ' + (State.lang === 'ar' ? '(الشركة)' : '(Company)') + '</label>' +
          '<input id="dm-onb-company" type="text" value="' + esc(company.name || settings.companyName || '') + '" style="width:100%;padding:.75rem;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.9rem;outline:none">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;color:#cbd5e1;font-size:.75rem;font-weight:600;margin-bottom:.35rem">' + (State.lang === 'ar' ? 'رقم الهاتف' : 'Phone') + '</label>' +
          '<input id="dm-onb-phone" type="tel" value="' + esc(settings.phone || company.phone || '') + '" style="width:100%;padding:.75rem;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.9rem;outline:none">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;color:#cbd5e1;font-size:.75rem;font-weight:600;margin-bottom:.35rem">' + (State.lang === 'ar' ? 'العنوان' : 'Address') + '</label>' +
          '<input id="dm-onb-address" type="text" value="' + esc(settings.address || '') + '" style="width:100%;padding:.75rem;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.9rem;outline:none">' +
        '</div>' +
      '</div>';
  }

  /* ---------- step 2: employees ---------- */
  function renderStep2() {
    var L = I18N[State.lang] || I18N.ar;
    var roles = ['Director', 'Photographer', 'Crane'];

    return '' +
      '<h3 style="color:#fff;margin:0 0 .35rem;font-size:1.15rem">' + esc(L.onb_s2_title) + '</h3>' +
      '<p style="color:#94a3b8;font-size:.8rem;margin:0 0 1rem">' + esc(L.onb_s2_desc) + '</p>' +

      '<div style="display:flex;flex-direction:column;gap:.5rem;max-height:280px;overflow-y:auto;padding-inline-end:.35rem" id="dm-onb-emp-list">' +
        '<div style="padding:.65rem;background:rgba(124,58,237,.08);border:1px dashed rgba(124,58,237,.4);border-radius:10px;color:#a78bfa;font-size:.78rem;text-align:center" id="dm-onb-emp-empty">' +
          (State.lang === 'ar' ? 'مفيش موظفين بعد — أضف أول واحد' : 'No employees yet — add the first one') +
        '</div>' +
      '</div>' +

      '<button id="dm-onb-add-emp" style="width:100%;margin-top:.85rem;padding:.75rem;border-radius:10px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);color:#6ee7b7;font-weight:700;cursor:pointer;font-family:inherit;font-size:.85rem">' +
        '+ ' + esc(L.onb_add_employee) +
      '</button>';
  }

  /* ---------- step 3: halls ---------- */
  function renderStep3() {
    var L = I18N[State.lang] || I18N.ar;
    var halls = State.data.halls || [];

    return '' +
      '<h3 style="color:#fff;margin:0 0 .35rem;font-size:1.15rem">' + esc(L.onb_s3_title) + '</h3>' +
      '<p style="color:#94a3b8;font-size:.8rem;margin:0 0 1rem">' + esc(L.onb_s3_desc) + '</p>' +

      '<div style="display:flex;flex-direction:column;gap:.5rem">' +
        (halls.length ? halls.map(function (h) {
          var total = (h.requirements || []).reduce(function (s, r) { return s + (r.count || 0); }, 0);
          return '<div style="padding:.75rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;display:flex;justify-content:space-between;align-items:center;gap:.5rem">' +
            '<div>' +
              '<div style="color:#fff;font-weight:700;font-size:.9rem">' + esc(h.name[State.lang] || h.name.ar) + '</div>' +
              '<div style="color:#94a3b8;font-size:.72rem;margin-top:.15rem">' +
                (h.requirements || []).map(function (r) { return r.role + ' × ' + r.count; }).join(' · ') +
              '</div>' +
            '</div>' +
            '<div style="background:rgba(124,58,237,.15);color:#a78bfa;font-weight:700;font-size:.72rem;padding:.25rem .6rem;border-radius:8px">' + total + ' 👥</div>' +
          '</div>';
        }).join('') :
        '<div style="padding:1rem;text-align:center;color:#94a3b8;font-size:.8rem">' + (State.lang === 'ar' ? 'مفيش قاعات' : 'No halls') + '</div>') +
      '</div>';
  }

  /* ---------- step 4: done ---------- */
  function renderStep4() {
    var L = I18N[State.lang] || I18N.ar;
    var empCount = (State.data.employees || []).length;
    var hallCount = (State.data.halls || []).length;

    return '' +
      '<div style="text-align:center;padding:.5rem 0">' +
        '<div style="font-size:3.5rem;margin-bottom:.75rem">🎉</div>' +
        '<h3 style="color:#fff;margin:0 0 .35rem;font-size:1.35rem">' + esc(L.onb_s4_title) + '</h3>' +
        '<p style="color:#94a3b8;font-size:.85rem;margin:0 0 1.5rem">' + esc(L.onb_s4_desc) + '</p>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;text-align:center">' +
          '<div style="padding:.85rem;background:rgba(16,185,129,.1);border-radius:10px">' +
            '<div style="font-size:1.5rem;font-weight:800;color:#10b981">' + empCount + '</div>' +
            '<div style="font-size:.72rem;color:#94a3b8;margin-top:.15rem">' + (State.lang === 'ar' ? 'موظف' : 'Employees') + '</div>' +
          '</div>' +
          '<div style="padding:.85rem;background:rgba(124,58,237,.1);border-radius:10px">' +
            '<div style="font-size:1.5rem;font-weight:800;color:#a78bfa">' + hallCount + '</div>' +
            '<div style="font-size:.72rem;color:#94a3b8;margin-top:.15rem">' + (State.lang === 'ar' ? 'قاعة' : 'Halls') + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:1.25rem;padding:.85rem;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:10px;font-size:.78rem;color:#93c5fd;text-align:start;line-height:1.7">' +
          '<b>💡 ' + (State.lang === 'ar' ? 'نصيحة سريعة' : 'Quick tip') + ':</b> ' +
          (State.lang === 'ar'
            ? 'ابدأ بإضافة أول حجز من صفحة "الحجوزات"، وبعدها اعمل التوزيع من صفحة "التوزيع اليومي".'
            : 'Add your first booking from "Bookings" page, then distribute from "Daily Distribution".') +
        '</div>' +
      '</div>';
  }

  /* ---------- bind step events ---------- */
  function bindStepEvents() {
    var L = I18N[State.lang] || I18N.ar;
    var nextBtn = document.getElementById('dm-onb-next');
    var backBtn = document.getElementById('dm-onb-back');
    var skipBtn = document.getElementById('dm-onb-skip');
    var addEmpBtn = document.getElementById('dm-onb-add-emp');

    if (nextBtn) nextBtn.onclick = function () {
      saveStepData();
      if (Onb.step < Onb.totalSteps) {
        Onb.step++;
        renderStep();
      } else {
        finish();
      }
    };

    if (backBtn) backBtn.onclick = function () {
      if (Onb.step > 1) { Onb.step--; renderStep(); }
    };

    if (skipBtn) skipBtn.onclick = function () { finish(); };

    if (addEmpBtn) addEmpBtn.onclick = function () {
      showAddEmployeeForm();
    };
  }

  /* ---------- save step data ---------- */
  function saveStepData() {
    if (Onb.step === 1) {
      var companyEl = document.getElementById('dm-onb-company');
      var phoneEl = document.getElementById('dm-onb-phone');
      var addressEl = document.getElementById('dm-onb-address');

      if (companyEl && companyEl.value.trim()) {
        State.data.settings.companyName = companyEl.value.trim();
        if (window.__dmSaaS && window.__dmSaaS.company) {
          window.__dmSaaS.company.name = companyEl.value.trim();
        }
      }
      if (phoneEl) State.data.settings.phone = phoneEl.value.trim();
      if (addressEl) State.data.settings.address = addressEl.value.trim();

      try { if (typeof saveData === 'function') saveData(); } catch (e) {}
    }
  }

  /* ---------- add employee form ---------- */
  function showAddEmployeeForm() {
    var L = I18N[State.lang] || I18N.ar;
    var list = document.getElementById('dm-onb-emp-list');
    var empty = document.getElementById('dm-onb-emp-empty');
    if (empty) empty.remove();

    var form = document.createElement('div');
    form.style.cssText = 'padding:.75rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:10px;display:flex;flex-direction:column;gap:.5rem;margin-bottom:.5rem';
    form.innerHTML =
      '<input placeholder="' + esc(L.onb_name) + '" class="onb-inp" data-f="name" style="padding:.6rem;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.85rem;outline:none">' +
      '<select class="onb-inp" data-f="role" style="padding:.6rem;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.85rem;outline:none">' +
        '<option value="Director">Director</option>' +
        '<option value="Photographer" selected>Photographer</option>' +
        '<option value="Crane">Crane</option>' +
        '<option value="Supervisor">Supervisor</option>' +
        '<option value="Assistant">Assistant</option>' +
      '</select>' +
      '<input placeholder="' + esc(L.onb_phone) + '" class="onb-inp" data-f="phone" style="padding:.6rem;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.85rem;outline:none">' +
      '<input placeholder="' + esc(L.onb_day_rate) + '" type="number" class="onb-inp" data-f="dayRate" value="200" style="padding:.6rem;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:.85rem;outline:none">' +
      '<div style="display:flex;gap:.35rem">' +
        '<button class="onb-save" style="flex:1;padding:.55rem;border-radius:8px;background:#10b981;color:#fff;border:none;font-weight:700;cursor:pointer;font-family:inherit;font-size:.8rem">✓ Save</button>' +
        '<button class="onb-cancel" style="padding:.55rem .85rem;border-radius:8px;background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,.15);cursor:pointer;font-family:inherit;font-size:.8rem">✕</button>' +
      '</div>';

    list.appendChild(form);

    form.querySelector('.onb-cancel').onclick = function () { form.remove(); };

    form.querySelector('.onb-save').onclick = function () {
      var data = {};
      form.querySelectorAll('.onb-inp').forEach(function (inp) {
        data[inp.dataset.f] = inp.value.trim();
      });
      if (!data.name) {
        if (typeof showToast === 'function') showToast(L.onb_name + '?', 'error');
        return;
      }

      var emp = {
        id: 'emp_' + Math.random().toString(36).slice(2, 9),
        code: 'E' + String((State.data.employees || []).length + 1).padStart(3, '0'),
        name: data.name,
        role: data.role || 'Photographer',
        roles: [data.role || 'Photographer'],
        phone: data.phone || '',
        dayRate: parseInt(data.dayRate) || 200,
        salary: 0,
        hireDate: todayISO(),
        status: 'active',
        notes: ''
      };

      State.data.employees.push(emp);
      try { if (typeof saveData === 'function') saveData(); } catch (e) {}

      // Add to list
      var item = document.createElement('div');
      item.style.cssText = 'padding:.55rem .75rem;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;display:flex;justify-content:space-between;align-items:center';
      item.innerHTML =
        '<div><b style="color:#fff;font-size:.85rem">' + esc(emp.name) + '</b>' +
        '<div style="color:#94a3b8;font-size:.7rem;margin-top:.1rem">' + esc(emp.role) + ' · ' + esc(emp.phone || '—') + '</div></div>' +
        '<div style="color:#6ee7b7;font-weight:700;font-size:.75rem">✓</div>';

      form.remove();
      list.appendChild(item);

      if (typeof showToast === 'function') {
        showToast(State.lang === 'ar' ? 'تم إضافة ' + emp.name : 'Added ' + emp.name, 'success');
      }
    };
  }

  /* ---------- finish ---------- */
  function finish() {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch (e) {}
    if (Onb.overlay) { Onb.overlay.remove(); Onb.overlay = null; }
    Onb.active = false;
    if (typeof navigate === 'function') navigate('dashboard');
    if (typeof showToast === 'function') {
      showToast(State.lang === 'ar' ? '🎉 أهلاً بك في Dr Media Pro' : '🎉 Welcome to Dr Media Pro', 'success');
    }
  }

  /* ---------- boot ---------- */
  function checkAndShow() {
    if (isNewUser()) {
      setTimeout(showWizard, 1200);
    }
  }

  waitFor(
    function () {
      return typeof window.__dmSaaS !== 'undefined'
        && window.__dmSaaS.ready
        && typeof State !== 'undefined';
    },
    function () {
      setTimeout(checkAndShow, 800);
      console.log('%c[Section 26] ✓ Onboarding ready', 'color:#10b981;font-weight:bold');
    }
  );

  // Expose
  window.__dmStartOnboarding = showWizard;
  window.__dmResetOnboarding = function () {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch (e) {}
    showWizard();
  };

})();
/* =========================================================
   SECTION 27 (v2): Client-Side Payment — No Cloud Functions
   Version: 2.0.0
   ---------------------------------------------------------
   - Mock payment flow (works now)
   - Manual activation by Super Admin
   - Ready to swap in Paymob iframe later
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 27 v2] Payment (Client-Side) loading…', 'color:#10b981;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 27] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.pay_title = 'ترقية الاشتراك';
  I18N.ar.pay_choose_method = 'اختار طريقة الدفع';
  I18N.ar.pay_bank_transfer = 'تحويل بنكي';
  I18N.ar.pay_instapay = 'InstaPay';
  I18N.ar.pay_vodafone = 'فودافون كاش';
  I18N.ar.pay_paymob = 'بطاقة (Paymob)';
  I18N.ar.pay_coming_soon = 'قريبًا';
  I18N.ar.pay_i_paid = 'تم الدفع — تفعيل الاشتراك';
  I18N.ar.pay_activated = 'تم تفعيل الاشتراك 🎉';
  I18N.ar.pay_amount = 'المبلغ';
  I18N.ar.pay_instructions = 'أرسل المبلغ على:';
  I18N.ar.pay_then_click = 'بعد التحويل، اضغط الزر تحت وهنفعل الاشتراك خلال دقائق';
  I18N.ar.pay_already_active = 'اشتراكك نشط بالفعل';
  I18N.ar.pay_admin_activation = 'تفعيل فوري (Super Admin فقط)';
  I18N.ar.pay_activate_now = 'تفعيل الآن';
  I18N.ar.pay_choose_plan = 'اختار الباقة';

  I18N.en.pay_title = 'Upgrade Subscription';
  I18N.en.pay_choose_method = 'Choose payment method';
  I18N.en.pay_bank_transfer = 'Bank Transfer';
  I18N.en.pay_instapay = 'InstaPay';
  I18N.en.pay_vodafone = 'Vodafone Cash';
  I18N.en.pay_paymob = 'Card (Paymob)';
  I18N.en.pay_coming_soon = 'Coming soon';
  I18N.en.pay_i_paid = 'I paid — Activate';
  I18N.en.pay_activated = 'Subscription activated 🎉';
  I18N.en.pay_amount = 'Amount';
  I18N.en.pay_instructions = 'Send payment to:';
  I18N.en.pay_then_click = 'After transfer, click below and we will activate within minutes';
  I18N.en.pay_already_active = 'Your subscription is already active';
  I18N.en.pay_admin_activation = 'Instant activate (Super Admin only)';
  I18N.en.pay_activate_now = 'Activate now';
  I18N.en.pay_choose_plan = 'Choose plan';

  /* ---------- payment config (عدّلها بمعلوماتك) ---------- */
  var PAYMENT_INFO = {
    bankName: 'البنك الأهلي المصري',
    bankAccount: '1234 5678 9012 3456',
    accountName: 'Dr Media Pro',
    instapay: 'ahmedshreif94@instapay',
    vodafone: '01002670948',
    supportEmail: 'support@drmedia.pro',
    supportPhone: '+201002670948'
  };

  /* ---------- state ---------- */
  var Pay = {
    active: false,
    planId: null,
    modal: null
  };
  window.__dmPay = Pay;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* =========================================================
     OVERRIDE UPGRADE — called from plans modal
     ========================================================= */
  window.__dmSaaSUpgrade = function (planId) {
    if (typeof closeModal === 'function') closeModal();
    setTimeout(function () {
      openPaymentModal(planId);
    }, 200);
  };

  /* =========================================================
     PAYMENT MODAL
     ========================================================= */
  function openPaymentModal(planId) {
    var L = I18N[State.lang] || I18N.ar;
    var plan = (window.__dmPlans || {})[planId];
    if (!plan) { if (typeof showToast === 'function') showToast('Plan not found', 'error'); return; }
    if (plan.price <= 0) { if (typeof showToast === 'function') showToast('Contact us for this plan', 'info'); return; }

    Pay.active = true;
    Pay.planId = planId;

    // Remove existing
    var existing = document.getElementById('dm-pay-modal');
    if (existing) existing.remove();

    var isSuperAdmin = window.__dmSaaS && window.__dmSaaS.isSuperAdmin;
    var isSaaSReady = window.__dmSaaS && window.__dmSaaS.ready;

    if (!isSaaSReady) {
      if (typeof showToast === 'function') showToast('Please sign in first', 'error');
      return;
    }

    var modal = document.createElement('div');
    modal.id = 'dm-pay-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(15,10,31,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';

    modal.innerHTML =
      '<div style="max-width:560px;width:100%;background:var(--surface);border-radius:20px;overflow:hidden;border:1px solid var(--border);box-shadow:0 40px 80px -20px rgba(0,0,0,.6);max-height:95vh;display:flex;flex-direction:column">' +

        /* Header */
        '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(16,185,129,.08));display:flex;justify-content:space-between;align-items:center">' +
          '<div>' +
            '<div style="font-weight:800;font-size:1.05rem">💳 ' + esc(L.pay_title) + '</div>' +
            '<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem">' + esc(plan.name) + ' · ' + plan.price + ' EGP / ' + (State.lang === 'ar' ? 'شهر' : 'mo') + '</div>' +
          '</div>' +
          '<button id="dm-pay-close" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:.4rem;border-radius:8px;font-size:1.2rem;line-height:1">✕</button>' +
        '</div>' +

        /* Body */
        '<div style="padding:1.5rem;overflow-y:auto;flex:1">' +

          (isSuperAdmin ? renderSuperAdminBlock(plan, planId) : '') +

          /* Payment methods */
          '<div style="margin-bottom:1rem">' +
            '<div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">' +
              esc(L.pay_choose_method) +
            '</div>' +

            renderMethod('bank', '🏦', L.pay_bank_transfer, plan, PAYMENT_INFO.bankName + '\n' + PAYMENT_INFO.bankAccount + '\n' + PAYMENT_INFO.accountName) +
            renderMethod('instapay', '⚡', L.pay_instapay, plan, PAYMENT_INFO.instapay) +
            renderMethod('vodafone', '📱', L.pay_vodafone, plan, PAYMENT_INFO.vodafone) +
            renderMethod('paymob', '💳', L.pay_paymob, plan, null, true /* disabled */) +
          '</div>' +

          /* Contact info */
          '<div style="margin-top:1.25rem;padding:.75rem 1rem;background:rgba(59,130,246,.08);border-inline-start:3px solid #3b82f6;border-radius:8px;font-size:.78rem;color:var(--text-muted);line-height:1.7">' +
            '📞 ' + (State.lang === 'ar' ? 'بعد الدفع، تواصل معنا:' : 'After payment, contact us:') + '<br>' +
            '<b style="color:var(--text)">' + esc(PAYMENT_INFO.supportEmail) + '</b><br>' +
            '<b style="color:var(--text)">' + esc(PAYMENT_INFO.supportPhone) + '</b>' +
          '</div>' +

        '</div>' +

        /* Footer */
        '<div style="padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:.5rem;justify-content:flex-end;background:var(--surface)">' +
          '<button id="dm-pay-done" class="btn btn-ghost" style="padding:.7rem 1.25rem">' +
            (State.lang === 'ar' ? 'إغلاق' : 'Close') +
          '</button>' +
          '<button id="dm-pay-i-paid" class="btn btn-primary" style="padding:.7rem 1.25rem">' +
            '✓ ' + esc(L.pay_i_paid) +
          '</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(modal);
    Pay.modal = modal;

    /* Bind */
    modal.querySelector('#dm-pay-close').onclick = closePaymentModal;
    modal.querySelector('#dm-pay-done').onclick = closePaymentModal;

    modal.querySelector('#dm-pay-i-paid').onclick = function () {
      handlePaidNotification(planId, plan);
    };

    /* Super admin activate */
    var activateBtn = modal.querySelector('#dm-activate-now');
    if (activateBtn) {
      activateBtn.onclick = function () {
        activateSubscription(planId, plan);
      };
    }

    /* Copy account number */
    modal.querySelectorAll('.dm-copy-btn').forEach(function (btn) {
      btn.onclick = function () {
        var text = btn.dataset.copy;
        copyToClipboard(text);
        btn.textContent = '✓';
        setTimeout(function () { btn.textContent = '📋'; }, 1500);
      };
    });
  }

  /* ---------- render single payment method ---------- */
  function renderMethod(id, icon, label, plan, value, disabled) {
    var ar = State.lang === 'ar';
    var arrow = ar ? '◀' : '▶';
    return '' +
      '<div style="padding:.85rem;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;margin-bottom:.5rem;display:flex;align-items:flex-start;gap:.75rem;' + (disabled ? 'opacity:.5;' : '') + '">' +
        '<div style="width:40px;height:40px;border-radius:10px;background:' + (disabled ? 'rgba(100,116,139,.15)' : 'rgba(124,58,237,.12)') + ';color:' + (disabled ? '#94a3b8' : '#7c3aed') + ';display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0">' + icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:.9rem;color:var(--text);margin-bottom:.15rem">' + esc(label) + (disabled ? ' <span style="font-size:.65rem;background:var(--surface);padding:.1rem .4rem;border-radius:4px;color:var(--text-muted)">' + esc((I18N[State.lang] || I18N.ar).pay_coming_soon) + '</span>' : '') + '</div>' +
          (value && !disabled ?
            '<div style="font-size:.75rem;color:var(--text-muted);white-space:pre-line;line-height:1.5;margin-bottom:.35rem">' + esc(value) + '</div>' +
            '<button class="dm-copy-btn" data-copy="' + esc(value) + '" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:.25rem .55rem;font-size:.7rem;cursor:pointer;font-family:inherit;color:var(--text-muted)">📋 ' + (ar ? 'نسخ' : 'Copy') + '</button>'
            : '') +
        '</div>' +
      '</div>';
  }

  /* ---------- super admin instant activation ---------- */
  function renderSuperAdminBlock(plan, planId) {
    var L = I18N[State.lang] || I18N.ar;
    return '' +
      '<div style="padding:1rem;background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.08));border:2px dashed rgba(245,158,11,.4);border-radius:12px;margin-bottom:1.25rem">' +
        '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.65rem">' +
          '<span style="font-size:1.2rem">⚡</span>' +
          '<div style="font-weight:800;font-size:.85rem;color:#f59e0b">' + esc(L.pay_admin_activation) + '</div>' +
        '</div>' +
        '<button id="dm-activate-now" style="width:100%;padding:.75rem;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;font-weight:700;cursor:pointer;font-family:inherit;font-size:.85rem">' +
          '✓ ' + esc(L.pay_activate_now) + ' — ' + esc(plan.name) +
        '</button>' +
      '</div>';
  }

  /* ---------- close ---------- */
  function closePaymentModal() {
    var m = document.getElementById('dm-pay-modal');
    if (m) m.remove();
    Pay.active = false;
    Pay.planId = null;
    Pay.modal = null;
  }

  /* =========================================================
     ACTIVATE SUBSCRIPTION (write directly to Firestore)
     ========================================================= */
  async function activateSubscription(planId, plan) {
    if (!window.__dmSaaS || !window.__dmSaaS.profile || !window.__dmSaaS.profile.companyId) {
      if (typeof showToast === 'function') showToast('No company found', 'error');
      return;
    }

    var fsMod = window.DrMediaFB.modules.fsMod;
    var companyId = window.__dmSaaS.profile.companyId;

    try {
      var now = Date.now();
      var expiresAt = now + (plan.durationDays * 86400000);

      // Update subscription doc
      var subRef = fsMod.doc(window.DrMediaFB.db, 'subscriptions', companyId);
      await fsMod.setDoc(subRef, {
        companyId: companyId,
        planId: planId,
        status: 'active',
        startedAt: now,
        expiresAt: expiresAt,
        lastPaymentMode: 'manual',
        lastPaymentAt: now,
        activatedBy: window.__dmSaaS.user ? window.__dmSaaS.user.uid : 'system',
        updatedAt: fsMod.serverTimestamp()
      }, { merge: true });

      // Also log in payment_orders for history
      var orderRef = fsMod.doc(window.DrMediaFB.db, 'payment_orders', 'MANUAL_' + now);
      await fsMod.setDoc(orderRef, {
        orderId: 'MANUAL_' + now,
        companyId: companyId,
        planId: planId,
        amount: plan.price,
        status: 'success',
        mode: 'manual',
        activatedBy: window.__dmSaaS.user ? window.__dmSaaS.user.uid : 'system',
        createdAt: fsMod.serverTimestamp()
      });

      // Refresh SaaS data
      window.__dmSaaS.subscription = {
        companyId: companyId,
        planId: planId,
        status: 'active',
        startedAt: now,
        expiresAt: expiresAt
      };

      if (typeof showToast === 'function') {
        showToast((I18N[State.lang] || I18N.ar).pay_activated + ' ✓', 'success');
      }

      // Close modal and reload
      closePaymentModal();
      setTimeout(function () {
        if (typeof window.__dmApplyEnforcement === 'function') window.__dmApplyEnforcement();
        window.location.reload();
      }, 900);

    } catch (err) {
      console.error('[Section 27] activation failed:', err);
      if (typeof showToast === 'function') {
        showToast((State.lang === 'ar' ? 'فشل التفعيل: ' : 'Activation failed: ') + err.message, 'error');
      }
    }
  }

  /* =========================================================
     USER CLICKED "I PAID" — send notification to admin
     ========================================================= */
  async function handlePaidNotification(planId, plan) {
    if (!window.__dmSaaS || !window.__dmSaaS.profile) return;

    var fsMod = window.DrMediaFB.modules.fsMod;
    var companyId = window.__dmSaaS.profile.companyId;
    var userEmail = window.__dmSaaS.user ? window.__dmSaaS.user.email : 'unknown';
    var userName = window.__dmSaaS.profile.name || 'User';
    var companyName = window.__dmSaaS.company ? window.__dmSaaS.company.name : 'Unknown';

    var L = I18N[State.lang] || I18N.ar;

    if (typeof showToast === 'function') {
      showToast(State.lang === 'ar' ? 'جاري الإرسال…' : 'Sending…', 'info');
    }

    try {
      var now = Date.now();
      var orderRef = fsMod.doc(window.DrMediaFB.db, 'payment_orders', 'PENDING_' + now);
      await fsMod.setDoc(orderRef, {
        orderId: 'PENDING_' + now,
        companyId: companyId,
        companyName: companyName,
        planId: planId,
        amount: plan.price,
        status: 'pending_verification',
        mode: 'manual-transfer',
        userName: userName,
        userEmail: userEmail,
        createdAt: fsMod.serverTimestamp()
      });

      // Also add to super admin notifications
      try {
        var notifRef = fsMod.doc(window.DrMediaFB.db, 'super_admin', 'notifications');
        var notifSnap = await fsMod.getDoc(notifRef);
        var notifications = notifSnap.exists() ? (notifSnap.data().items || []) : [];
        notifications.unshift({
          id: 'n_' + now,
          type: 'payment',
          title: 'طلب ترقية جديد',
          body: companyName + ' (' + userName + ') — باقة ' + plan.name + ' — ' + plan.price + ' EGP',
          companyId: companyId,
          planId: planId,
          amount: plan.price,
          email: userEmail,
          createdAt: now,
          read: false
        });
        await fsMod.setDoc(notifRef, { items: notifications.slice(0, 100) }, { merge: true });
      } catch (e) {
        console.warn('[Section 27] notification save failed', e);
      }

      if (typeof showToast === 'function') {
        showToast(
          State.lang === 'ar'
            ? '✓ تم إرسال الطلب — هيتم التفعيل خلال دقائق'
            : '✓ Request sent — will be activated soon',
          'success'
        );
      }
      closePaymentModal();

    } catch (err) {
      console.error('[Section 27] failed:', err);
      if (typeof showToast === 'function') {
        showToast((State.lang === 'ar' ? 'فشل: ' : 'Failed: ') + err.message, 'error');
      }
    }
  }

  /* ---------- clipboard helper ---------- */
  function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (typeof showToast === 'function') {
        showToast(State.lang === 'ar' ? 'تم النسخ ✓' : 'Copied ✓', 'success');
      }
    } catch (e) {}
  }

  /* =========================================================
     SUPER ADMIN — view pending payments
     ========================================================= */
  window.__dmViewPendingPayments = async function () {
    if (!window.__dmSaaS || !window.__dmSaaS.isSuperAdmin) {
      if (typeof showToast === 'function') showToast('Super Admin only', 'error');
      return;
    }

    try {
      var fsMod = window.DrMediaFB.modules.fsMod;
      var snap = await fsMod.getDocs(fsMod.collection(window.DrMediaFB.db, 'payment_orders'));
      var orders = [];
      snap.forEach(function (d) { orders.push(d.data()); });
      orders.sort(function (a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });

      var pending = orders.filter(function (o) { return o.status === 'pending_verification'; });

      var rows = pending.map(function (o) {
        return '<tr>' +
          '<td><b>' + esc(o.companyName || o.companyId) + '</b></td>' +
          '<td>' + esc(o.userName || '') + '<br><span style="font-size:.7rem;color:var(--text-muted)">' + esc(o.userEmail || '') + '</span></td>' +
          '<td><span class="badge-pill badge-purple">' + esc(o.planId) + '</span></td>' +
          '<td><b>' + (o.amount || 0) + ' EGP</b></td>' +
          '<td>' +
            '<button onclick="__dmApprovePayment(\'' + o.companyId + '\',\'' + o.planId + '\')" class="btn btn-success btn-sm">✓ Approve</button> ' +
            '<button onclick="__dmRejectPayment(\'' + o.orderId + '\')" class="btn btn-danger btn-sm">✕ Reject</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      if (typeof openModal === 'function') {
        openModal({
          title: '💰 Pending Payments (' + pending.length + ')',
          size: 'xl',
          body: pending.length ?
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>Company</th><th>User</th><th>Plan</th><th>Amount</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
            '<div class="empty-state"><p>No pending payments</p></div>'
        });
      }
    } catch (err) {
      console.error(err);
      if (typeof showToast === 'function') showToast('Failed to load: ' + err.message, 'error');
    }
  };

  window.__dmApprovePayment = async function (companyId, planId) {
    var plan = (window.__dmPlans || {})[planId];
    if (!plan) return;
    var fsMod = window.DrMediaFB.modules.fsMod;
    var now = Date.now();
    await fsMod.setDoc(fsMod.doc(window.DrMediaFB.db, 'subscriptions', companyId), {
      companyId: companyId,
      planId: planId,
      status: 'active',
      startedAt: now,
      expiresAt: now + (plan.durationDays * 86400000),
      activatedBy: window.__dmSaaS.user.uid,
      updatedAt: fsMod.serverTimestamp()
    }, { merge: true });
    if (typeof showToast === 'function') showToast('Approved ✓', 'success');
    if (typeof closeModal === 'function') closeModal();
    window.__dmViewPendingPayments();
  };

  window.__dmRejectPayment = async function (orderId) {
    var fsMod = window.DrMediaFB.modules.fsMod;
    await fsMod.updateDoc(fsMod.doc(window.DrMediaFB.db, 'payment_orders', orderId), {
      status: 'rejected',
      rejectedAt: fsMod.serverTimestamp(),
      rejectedBy: window.__dmSaaS.user.uid
    });
    if (typeof showToast === 'function') showToast('Rejected', 'info');
    if (typeof closeModal === 'function') closeModal();
    window.__dmViewPendingPayments();
  };

  /* =========================================================
     BOOT
     ========================================================= */
  waitFor(
    function () {
      return typeof window.__dmSaaS !== 'undefined'
        && typeof window.__dmPlans !== 'undefined'
        && typeof window.DrMediaFB !== 'undefined';
    },
    function () {
      console.log('%c[Section 27 v2] ✓ Client-side payment ready', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 27 v2] Super Admin: __dmViewPendingPayments()', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 28: Subscription Page
   Version: 1.0.0
   - Dedicated "My Subscription" page in sidebar
   - Shows current plan, expiry, days left
   - "Upgrade" button opens payment modal
   - Payment history
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 28] Subscription Page loading…', 'color:#10b981;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 28] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  I18N.ar.my_sub_page = 'اشتراكي';
  I18N.ar.sub_current_plan = 'باقتك الحالية';
  I18N.ar.sub_expires_on = 'تنتهي في';
  I18N.ar.sub_status = 'الحالة';
  I18N.ar.sub_upgrade_btn = 'ترقية الباقة';
  I18N.ar.sub_renew_btn = 'تجديد';
  I18N.ar.sub_history = 'سجل المدفوعات';
  I18N.ar.sub_no_history = 'لا يوجد سجل بعد';
  I18N.ar.sub_active = 'نشط';
  I18N.ar.sub_trialing = 'تجربة';
  I18N.ar.sub_expired_status = 'منتهي';
  I18N.ar.sub_grace = 'فترة سماح';
  I18N.ar.sub_plan_features = 'مميزات الباقة';
  I18N.ar.sub_manage = 'إدارة الاشتراك';

  I18N.en.my_sub_page = 'My Subscription';
  I18N.en.sub_current_plan = 'Current Plan';
  I18N.en.sub_expires_on = 'Expires on';
  I18N.en.sub_status = 'Status';
  I18N.en.sub_upgrade_btn = 'Upgrade Plan';
  I18N.en.sub_renew_btn = 'Renew';
  I18N.en.sub_history = 'Payment History';
  I18N.en.sub_no_history = 'No history yet';
  I18N.en.sub_active = 'Active';
  I18N.en.sub_trialing = 'Trial';
  I18N.en.sub_expired_status = 'Expired';
  I18N.en.sub_grace = 'Grace period';
  I18N.en.sub_plan_features = 'Plan Features';
  I18N.en.sub_manage = 'Manage Subscription';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    try {
      return d.toLocaleDateString(State.lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  function daysLeft(ts) {
    if (!ts) return 0;
    return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
  }

  /* =========================================================
     PAGE: My Subscription
     ========================================================= */
  Pages.mysub = function (el) {
    if (!window.__dmSaaS || !window.__dmSaaS.ready) {
      el.innerHTML = '<div class="empty-state" style="padding:3rem 1rem"><i data-lucide="lock"></i><p>' +
        (State.lang === 'ar' ? 'سجل دخول أول' : 'Please login first') + '</p></div>';
      if (window.lucide) lucide.createIcons();
      return;
    }

    var L = I18N[State.lang] || I18N.ar;
    var SaaS = window.__dmSaaS;
    var sub = SaaS.subscription || { planId: 'trial', status: 'trialing', expiresAt: 0 };
    var plan = (window.__dmPlans || {})[sub.planId] || { name: 'Trial', price: 0, limits: {} };

    var days = daysLeft(sub.expiresAt);
    var isActive = sub.expiresAt > Date.now();
    var statusText = isActive ? (sub.planId === 'trial' ? L.sub_trialing : L.sub_active) : L.sub_expired_status;
    var statusColor = isActive ? (sub.planId === 'trial' ? '#f59e0b' : '#10b981') : '#ef4444';

    // Status icon
    var statusIcon = isActive ? (sub.planId === 'trial' ? '⏱' : '✓') : '🚫';

    el.innerHTML =
      '<div style="max-width:960px;margin:0 auto">' +

        /* Hero Card */
        '<div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,' + statusColor + '15,' + statusColor + '05);border:2px solid ' + statusColor + '40;padding:1.75rem">' +
          '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">' +
            '<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,' + statusColor + ',' + statusColor + 'cc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 15px 30px -10px ' + statusColor + '80">' +
              statusIcon +
            '</div>' +
            '<div style="flex:1;min-width:200px">' +
              '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700">' + esc(L.sub_current_plan) + '</div>' +
              '<div style="font-size:1.75rem;font-weight:800;color:var(--text);line-height:1.1;margin:.25rem 0">' + esc(plan.name) + '</div>' +
              '<div style="font-size:.85rem;color:var(--text-muted)">' +
                (plan.price > 0 ? plan.price + ' EGP / ' + (State.lang === 'ar' ? 'شهر' : 'mo') : (State.lang === 'ar' ? 'مجاني' : 'Free')) +
              '</div>' +
            '</div>' +
            '<div style="text-align:end">' +
              '<span class="badge-pill" style="background:' + statusColor + '20;color:' + statusColor + ';padding:.4rem .9rem;font-size:.75rem">' +
                '● ' + esc(statusText) +
              '</span>' +
              (isActive ?
                '<div style="margin-top:.5rem;font-size:.75rem;color:var(--text-muted)">' +
                  '<b style="color:' + statusColor + '">' + days + '</b> ' + (State.lang === 'ar' ? 'يوم متبقي' : 'days left') +
                '</div>'
                : '') +
            '</div>' +
          '</div>' +

          (sub.expiresAt ?
            '<div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border);display:flex;gap:1rem;flex-wrap:wrap;font-size:.85rem">' +
              '<div><span style="color:var(--text-muted)">' + esc(L.sub_expires_on) + ':</span> <b>' + esc(fmtDate(sub.expiresAt)) + '</b></div>' +
              (sub.startedAt ? '<div><span style="color:var(--text-muted)">' + (State.lang === 'ar' ? 'بدأ في' : 'Started on') + ':</span> <b>' + esc(fmtDate(sub.startedAt)) + '</b></div>' : '') +
            '</div>' : '') +

          '<div style="margin-top:1.25rem;display:flex;gap:.5rem;flex-wrap:wrap">' +
            '<button class="btn btn-primary" id="dm-sub-upgrade-main" style="padding:.75rem 1.5rem">' +
              '💎 ' + esc(isActive ? L.sub_upgrade_btn : L.sub_renew_btn) +
            '</button>' +
          '</div>' +
        '</div>' +

        /* Features Card */
        '<div class="grid-2" style="margin-bottom:1.5rem">' +
          '<div class="card">' +
            '<h4 style="margin:0 0 1rem;font-size:.95rem;display:flex;align-items:center;gap:.5rem">' +
              '<i data-lucide="list-checks" style="width:16px;height:16px;color:var(--primary)"></i>' +
              esc(L.sub_plan_features) +
            '</h4>' +
            (plan.limits ?
              '<div style="display:flex;flex-direction:column;gap:.65rem;font-size:.85rem">' +
                featureRow('👥', State.lang === 'ar' ? 'عدد الموظفين' : 'Employees', plan.limits.employees) +
                featureRow('📅', State.lang === 'ar' ? 'عدد الحجوزات/شهر' : 'Bookings/month', plan.limits.bookings) +
                featureRow('🏛', State.lang === 'ar' ? 'عدد القاعات' : 'Halls', plan.limits.halls) +
                featureRow('👤', State.lang === 'ar' ? 'عدد المستخدمين' : 'Users', plan.limits.users) +
              '</div>'
              : '') +
          '</div>' +
          '<div class="card">' +
            '<h4 style="margin:0 0 1rem;font-size:.95rem;display:flex;align-items:center;gap:.5rem">' +
              '<i data-lucide="clock" style="width:16px;height:16px;color:var(--primary)"></i>' +
              esc(L.sub_history) +
            '</h4>' +
            '<div id="dm-sub-history-list" style="font-size:.85rem">' +
              '<div style="color:var(--text-muted);text-align:center;padding:1rem">' + esc(L.sub_no_history) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>';

    if (window.lucide) lucide.createIcons();

    /* Bind upgrade button */
    var upBtn = document.getElementById('dm-sub-upgrade-main');
    if (upBtn) {
      upBtn.onclick = function () {
        if (typeof window.__dmShowPlans === 'function') window.__dmShowPlans();
      };
    }

    /* Load payment history */
    loadPaymentHistory();
  };

  function featureRow(icon, label, value) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem .75rem;background:var(--surface-2);border-radius:8px">' +
      '<span>' + icon + ' ' + esc(label) + '</span>' +
      '<b style="color:var(--primary)">' + (value >= 99999 ? '∞' : esc(value)) + '</b>' +
    '</div>';
  }

  async function loadPaymentHistory() {
    var listEl = document.getElementById('dm-sub-history-list');
    if (!listEl) return;
    var L = I18N[State.lang] || I18N.ar;

    try {
      var fsMod = window.DrMediaFB.modules.fsMod;
      var companyId = window.__dmSaaS.profile.companyId;
      var q = fsMod.query(
        fsMod.collection(window.DrMediaFB.db, 'payment_orders'),
        fsMod.where('companyId', '==', companyId)
      );
      var snap = await fsMod.getDocs(q);
      var orders = [];
      snap.forEach(function (d) {
        var o = d.data();
        if (o.status === 'success') orders.push(o);
      });

      if (!orders.length) {
        listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem">' + esc(L.sub_no_history) + '</div>';
        return;
      }

      orders.sort(function (a, b) {
        return (b.createdAt && b.createdAt.seconds || b.lastPaymentAt || 0) - (a.createdAt && a.createdAt.seconds || a.lastPaymentAt || 0);
      });

      listEl.innerHTML = orders.slice(0, 8).map(function (o) {
        var date = o.createdAt ? (o.createdAt.seconds ? o.createdAt.seconds * 1000 : o.createdAt) : Date.now();
        return '<div style="display:flex;justify-content:space-between;padding:.55rem 0;border-bottom:1px solid var(--border)">' +
          '<div>' +
            '<div style="font-weight:600">' + esc(o.planId || '—') + '</div>' +
            '<div style="font-size:.7rem;color:var(--text-muted)">' + esc(fmtDate(date)) + ' · ' + esc(o.mode || 'manual') + '</div>' +
          '</div>' +
          '<div style="text-align:end">' +
            '<div style="font-weight:700;color:#10b981">' + (o.amount || 0) + ' EGP</div>' +
            '<div style="font-size:.7rem;color:#10b981">✓</div>' +
          '</div>' +
        '</div>';
      }).join('');

    } catch (err) {
      console.warn('[Section 28] history load failed', err);
      listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem;font-size:.75rem">Failed to load</div>';
    }
  }

  /* =========================================================
     ADD NAV ITEM
     ========================================================= */
  function registerNav() {
    var sys = NAV_ITEMS.find(function (g) { return g.section === 'system'; });
    if (sys && !sys.items.find(function (i) { return i.id === 'mysub'; })) {
      var settingsIdx = sys.items.findIndex(function (i) { return i.id === 'settings'; });
      var at = settingsIdx >= 0 ? settingsIdx : sys.items.length;
      sys.items.splice(at, 0, { id: 'mysub', icon: 'credit-card', label: 'my_sub_page' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* =========================================================
     ADD SETTINGS SECTION
     ========================================================= */
  function hookSettings() {
    if (!Pages.settings) return;
    if (Pages.settings.__dm28Hooked) return;
    var orig = Pages.settings;
    Pages.settings = function (el) {
      orig.apply(this, arguments);
      setTimeout(function () {
        var grid = el.querySelector('.grid-2');
        if (!grid || grid.querySelector('[data-dm-sub-section]')) return;

        var wrap = document.createElement('div');
        wrap.setAttribute('data-dm-sub-section', '1');
        var L = I18N[State.lang] || I18N.ar;
        var SaaS = window.__dmSaaS;
        var sub = SaaS.subscription || { planId: 'trial', expiresAt: 0 };
        var plan = (window.__dmPlans || {})[sub.planId] || { name: 'Trial' };
        var days = Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 86400000));

        wrap.className = 'card';
        wrap.innerHTML =
          '<h4 style="margin-top:0;font-size:.95rem">' +
            '<i data-lucide="credit-card" style="width:16px;height:16px;display:inline;color:#7c3aed"></i> ' +
            esc(L.sub_manage) +
          '</h4>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.85rem;padding:.65rem;background:var(--surface-2);border-radius:10px">' +
            '<span style="font-weight:700">' + esc(plan.name) + '</span>' +
            '<span style="font-size:.75rem;color:var(--text-muted)">' + (days > 0 ? days + ' ' + (State.lang === 'ar' ? 'يوم متبقي' : 'days left') : L.sub_expired_status) + '</span>' +
          '</div>' +
          '<button id="dm-set-upgrade" class="btn btn-primary btn-sm" style="margin-top:.85rem;width:100%">' +
            '💎 ' + esc(L.sub_upgrade_btn) +
          '</button>' +
          '<button id="dm-set-view" class="btn btn-ghost btn-sm" style="margin-top:.5rem;width:100%">' +
            '📄 ' + esc(L.my_sub_page) +
          '</button>';
        grid.appendChild(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.querySelector('#dm-set-upgrade').onclick = function () {
          if (typeof window.__dmShowPlans === 'function') window.__dmShowPlans();
        };
        wrap.querySelector('#dm-set-view').onclick = function () {
          if (typeof navigate === 'function') navigate('mysub');
        };
      }, 150);
    };
    Pages.settings.__dm28Hooked = true;
  }

  /* =========================================================
     HOOK THE BANNER UPGRADE BUTTON — ensure it works
     ========================================================= */
  function fixBannerButton() {
    // Re-inject if missing
    setInterval(function () {
      var btn = document.getElementById('dm-sub-upgrade');
      if (btn && !btn.__dm28Fixed) {
        btn.__dm28Fixed = true;
        btn.onclick = function () {
          if (typeof window.__dmShowPlans === 'function') window.__dmShowPlans();
        };
      }
    }, 2000);
  }

  /* =========================================================
     BOOT
     ========================================================= */
  waitFor(
    function () {
      return typeof Pages !== 'undefined'
        && typeof NAV_ITEMS !== 'undefined'
        && typeof window.__dmSaaS !== 'undefined';
    },
    function () {
      registerNav();
      hookSettings();
      fixBannerButton();
      console.log('%c[Section 28] ✓ Subscription page ready', 'color:#10b981;font-weight:bold');
      console.log('%c[Section 28] Try: navigate("mysub")', 'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 29: Super Admin Exemption
   Version: 1.0.0
   - Super Admin = unlimited subscription (no expiry)
   - Hides subscription banners for super admin
   - Shows "Super Admin" badge on subscription page
   - Overrides enforcement to always bypass super admin
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 29] Super Admin Exemption loading…', 'color:#f59e0b;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 29] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isSuperAdmin() {
    return !!(window.__dmSaaS && window.__dmSaaS.isSuperAdmin);
  }

  /* =========================================================
     1. HIDE SUBSCRIPTION BANNER FOR SUPER ADMIN
     ========================================================= */
  function hideSubBannerForSuperAdmin() {
    if (!isSuperAdmin()) return;

    // Remove the subscription banner (green/red bar from Section 23)
    var subBanner = document.getElementById('dm-sub-banner');
    if (subBanner) subBanner.remove();

    // Remove grace banner (from Section 25)
    var graceBanner = document.getElementById('dm-grace-banner');
    if (graceBanner) graceBanner.remove();

    // Remove enforcement overlay if any
    var enfOverlay = document.getElementById('dm-enf-overlay');
    if (enfOverlay) enfOverlay.remove();
  }

  /* =========================================================
     2. ADD SUPER ADMIN BADGE IN TOPBAR
     ========================================================= */
  function addSuperAdminTopBadge() {
    if (!isSuperAdmin()) return;
    if (document.getElementById('dm-super-badge')) return;

    var topbar = document.getElementById('topbar');
    if (!topbar) return;

    var badge = document.createElement('div');
    badge.id = 'dm-super-badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:.35rem;padding:.35rem .7rem;border-radius:8px;background:linear-gradient(135deg,rgba(245,158,11,.15),rgba(245,158,11,.05));border:1px solid rgba(245,158,11,.4);color:#f59e0b;font-size:.7rem;font-weight:800;margin-inline-end:.35rem;letter-spacing:.03em';
    badge.innerHTML = '👑 SUPER ADMIN · ∞';

    var notifBtn = document.getElementById('notif-btn');
    if (notifBtn && notifBtn.parentNode) {
      notifBtn.parentNode.insertBefore(badge, notifBtn);
    } else {
      topbar.appendChild(badge);
    }
  }

  /* =========================================================
     3. OVERRIDE "MY SUBSCRIPTION" PAGE FOR SUPER ADMIN
     ========================================================= */
  function overrideMySubPage() {
    if (!Pages.mysub) return;

    var orig = Pages.mysub;
    Pages.mysub = function (el) {
      if (!isSuperAdmin()) {
        return orig.apply(this, arguments);
      }

      // Super Admin view — unlimited, no upgrade prompts
      var L = I18N[State.lang] || I18N.ar;
      var ar = State.lang === 'ar';

      el.innerHTML =
        '<div style="max-width:960px;margin:0 auto">' +

          '<div class="card" style="background:linear-gradient(135deg,rgba(245,158,11,.15),rgba(245,158,11,.03));border:2px solid rgba(245,158,11,.4);padding:2rem">' +
            '<div style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">' +
              '<div style="width:88px;height:88px;border-radius:24px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2.75rem;box-shadow:0 20px 40px -10px rgba(245,158,11,.5)">👑</div>' +
              '<div style="flex:1;min-width:200px">' +
                '<div style="font-size:.72rem;color:#f59e0b;text-transform:uppercase;letter-spacing:.1em;font-weight:800">' + (ar ? 'الوضع الحالي' : 'Current Mode') + '</div>' +
                '<div style="font-size:2rem;font-weight:800;color:var(--text);line-height:1.1;margin:.25rem 0">' + (ar ? 'مدير عام' : 'Super Administrator') + '</div>' +
                '<div style="font-size:.9rem;color:var(--text-muted);line-height:1.6">' +
                  (ar ? 'وصول كامل غير محدود — بدون قيود اشتراك' : 'Full unlimited access — no subscription limits') +
                '</div>' +
              '</div>' +
              '<div style="text-align:end">' +
                '<span class="badge-pill" style="background:rgba(16,185,129,.15);color:#10b981;padding:.5rem 1rem;font-size:.85rem;font-weight:800">' +
                  '∞ ' + (ar ? 'غير محدود' : 'Unlimited') +
                '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="grid-2" style="margin-top:1.5rem">' +

            '<div class="card">' +
              '<h4 style="margin:0 0 1rem;font-size:.95rem;display:flex;align-items:center;gap:.5rem">' +
                '<i data-lucide="star" style="width:16px;height:16px;color:#f59e0b"></i>' +
                (ar ? 'مميزات المدير العام' : 'Super Admin Privileges') +
              '</h4>' +
              '<div style="display:flex;flex-direction:column;gap:.65rem;font-size:.85rem">' +
                privRow('♾️', ar ? 'موظفين غير محدودين' : 'Unlimited employees') +
                privRow('📅', ar ? 'حجوزات غير محدودة' : 'Unlimited bookings') +
                privRow('🏛', ar ? 'قاعات غير محدودة' : 'Unlimited halls') +
                privRow('👥', ar ? 'مستخدمين غير محدودين' : 'Unlimited users') +
                privRow('⚡', ar ? 'لوحة إدارة جميع الشركات' : 'Manage all companies') +
                privRow('🎁', ar ? 'تفعيل اشتراكات العملاء يدويًا' : 'Manually activate customer subscriptions') +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<h4 style="margin:0 0 1rem;font-size:.95rem;display:flex;align-items:center;gap:.5rem">' +
                '<i data-lucide="zap" style="width:16px;height:16px;color:#7c3aed"></i>' +
                (ar ? 'أوامر سريعة' : 'Quick Actions') +
              '</h4>' +
              '<div style="display:flex;flex-direction:column;gap:.5rem">' +
                '<button class="btn btn-primary btn-sm" onclick="__dmSuperAdmin()">' +
                  '⚡ ' + (ar ? 'لوحة المدير العام' : 'Super Admin Panel') +
                '</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="__dmViewPendingPayments()">' +
                  '💰 ' + (ar ? 'طلبات الدفع المعلقة' : 'Pending Payments') +
                '</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="__dmShowPlans()">' +
                  '💎 ' + (ar ? 'عرض الباقات (للمراجعة)' : 'View Plans (for reference)') +
                '</button>' +
              '</div>' +
              '<div style="margin-top:1rem;padding:.75rem;background:rgba(59,130,246,.08);border-inline-start:3px solid #3b82f6;border-radius:8px;font-size:.72rem;color:var(--text-muted);line-height:1.6">' +
                '💡 ' + (ar ? 'كمدير عام، مفيش اشتراك ينتهي عليك. لكن تقدر تجرب تدفع كعميل من حساب تاني.' : 'As Super Admin, you have no subscription expiry. Test payment from a different account.') +
              '</div>' +
            '</div>' +

          '</div>' +

        '</div>';

      if (window.lucide) lucide.createIcons();
    };

    function privRow(icon, label) {
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.55rem .75rem;background:var(--surface-2);border-radius:8px">' +
        '<span>' + icon + '</span>' +
        '<span style="flex:1">' + esc(label) + '</span>' +
        '<span style="color:#10b981;font-weight:700">✓</span>' +
      '</div>';
    }

    console.log('[Section 29] ✓ My Subscription overridden for Super Admin');
  }

  /* =========================================================
     4. OVERRIDE ENFORCEMENT CHECK
     ========================================================= */
  function overrideEnforcement() {
    // Wrap __dmCheckSub to always return active for super admin
    if (typeof window.__dmCheckSub === 'function') {
      var orig = window.__dmCheckSub;
      window.__dmCheckSub = function () {
        if (isSuperAdmin()) return 'active';
        return orig.apply(this, arguments);
      };
    }

    // Wrap applyEnforcement
    if (typeof window.__dmApplyEnforcement === 'function') {
      var origApply = window.__dmApplyEnforcement;
      window.__dmApplyEnforcement = function () {
        if (isSuperAdmin()) {
          var enfOverlay = document.getElementById('dm-enf-overlay');
          if (enfOverlay) enfOverlay.remove();
          var graceBanner = document.getElementById('dm-grace-banner');
          if (graceBanner) graceBanner.remove();
          return;
        }
        return origApply.apply(this, arguments);
      };
    }
  }

  /* =========================================================
     5. OVERRIDE SETTINGS SUBSCRIPTION SECTION FOR SUPER ADMIN
     ========================================================= */
  function fixSettingsSubSection() {
    var check = setInterval(function () {
      var sec = document.querySelector('[data-dm-sub-section]');
      if (!sec) return;
      if (sec.__dm29Fixed) return;
      if (!isSuperAdmin()) { sec.__dm29Fixed = true; return; }

      sec.__dm29Fixed = true;
      var ar = State.lang === 'ar';
      var L = I18N[State.lang] || I18N.ar;

      sec.innerHTML =
        '<h4 style="margin-top:0;font-size:.95rem">' +
          '<i data-lucide="crown" style="width:16px;height:16px;display:inline;color:#f59e0b"></i> ' +
          (ar ? 'الاشتراك' : 'Subscription') +
        '</h4>' +
        '<div style="margin-top:.85rem;padding:.85rem;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.3);border-radius:10px">' +
          '<div style="display:flex;align-items:center;gap:.5rem">' +
            '<span style="font-size:1.25rem">👑</span>' +
            '<div style="flex:1">' +
              '<div style="font-weight:800;font-size:.9rem;color:#f59e0b">' + (ar ? 'مدير عام' : 'Super Admin') + '</div>' +
              '<div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem">' + (ar ? 'وصول غير محدود' : 'Unlimited access') + '</div>' +
            '</div>' +
            '<span class="badge-pill badge-green">∞</span>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:.85rem;width:100%" onclick="__dmSuperAdmin()">' +
          '⚡ ' + (ar ? 'لوحة المدير العام' : 'Super Admin Panel') +
        '</button>';

      if (window.lucide) lucide.createIcons();
    }, 1000);
    setTimeout(function () { clearInterval(check); }, 30000);
  }

  /* =========================================================
     6. WATCH FOR BANNERS — hide as soon as they appear
     ========================================================= */
  function watchForBanners() {
    setInterval(function () {
      if (!isSuperAdmin()) return;
      var sub = document.getElementById('dm-sub-banner');
      if (sub) sub.remove();
      var grace = document.getElementById('dm-grace-banner');
      if (grace) grace.remove();
      var enf = document.getElementById('dm-enf-overlay');
      if (enf) enf.remove();
    }, 1500);
  }

  /* =========================================================
     7. BOOT
     ========================================================= */
  function init() {
    hideSubBannerForSuperAdmin();
    addSuperAdminTopBadge();
    overrideMySubPage();
    overrideEnforcement();
    fixSettingsSubSection();
    watchForBanners();

    console.log('%c[Section 29] ✓ Super Admin exemption active', 'color:#10b981;font-weight:bold');
  }

  waitFor(
    function () {
      return typeof window.__dmSaaS !== 'undefined'
        && window.__dmSaaS.ready
        && typeof Pages !== 'undefined';
    },
    function () {
      init();
      // Retry after a moment in case things load late
      setTimeout(init, 1500);
      setTimeout(init, 4000);
    }
  );

  // Expose for manual
  window.__dmFixSuperAdminBanner = hideSubBannerForSuperAdmin;

})();
/* =========================================================
   SECTION 30: Complete SaaS Enhancements
   Version: 1.0.0
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 30] SaaS Complete loading…', 'color:#10b981;font-weight:bold;font-size:14px');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 30] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isSuperAdmin() {
    return !!(window.__dmSaaS && window.__dmSaaS.isSuperAdmin);
  }

  function isLoggedIn() {
    return !!(window.__dmSaaS && window.__dmSaaS.user && window.__dmSaaS.ready);
  }

  /* =========================================================
     1. COPYRIGHT FOOTER
     ========================================================= */
  var COPYRIGHT = {
    company: 'Dr Media Pro',
    developer: 'أحمد شريف',
    phone: '01002670948',
    year: '2026'
  };

  function addCopyrightFooter() {
    // Login screen footer
    var loginCard = document.querySelector('.login-card');
    if (loginCard && !loginCard.querySelector('.dm-copyright')) {
      var loginFoot = document.createElement('div');
      loginFoot.className = 'dm-copyright';
      loginFoot.style.cssText = 'margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.08);text-align:center;font-size:.7rem;color:#94a3b8;line-height:1.7';
      loginFoot.innerHTML =
        '© ' + COPYRIGHT.year + ' <b style="color:#a78bfa">' + esc(COPYRIGHT.company) + '</b> — جميع الحقوق محفوظة<br>' +
        '<span style="opacity:.75">تصميم وتطوير: ' + esc(COPYRIGHT.developer) + ' · ' + esc(COPYRIGHT.phone) + '</span>';
      loginCard.appendChild(loginFoot);
    }

    // App footer (bottom of content)
    var content = document.getElementById('content');
    if (content && !document.querySelector('.dm-app-copyright')) {
      var appFoot = document.createElement('div');
      appFoot.className = 'dm-app-copyright';
      appFoot.style.cssText = 'margin-top:3rem;padding:1.25rem;text-align:center;font-size:.72rem;color:var(--text-muted);border-top:1px solid var(--border);line-height:1.8';
      appFoot.innerHTML =
        '© ' + COPYRIGHT.year + ' <b style="color:var(--primary)">' + esc(COPYRIGHT.company) + '</b> — جميع الحقوق محفوظة<br>' +
        '<span style="opacity:.7">تصميم وتطوير: ' + esc(COPYRIGHT.developer) + ' · ' + esc(COPYRIGHT.phone) + '</span>';
      content.appendChild(appFoot);
    }
  }

  /* =========================================================
     2. FORCE LOGIN — NO AUTO-LOGIN
     ========================================================= */
  function disableAutoLogin() {
    // 1. Disable localStorage session restore
    try {
      var session = localStorage.getItem('drmedia_pro_session');
      if (session) {
        localStorage.removeItem('drmedia_pro_session');
        console.log('[Section 30] Cleared auto-login session');
      }
    } catch (e) {}

    // 2. Override restoreSession to always return false
    try {
      window.restoreSession = function () { return false; };
    } catch (e) {}

    // 3. Set Firebase Auth persistence to SESSION (only current tab)
    try {
      var fb = window.DrMediaFB;
      if (fb && fb.auth && fb.modules && fb.modules.authMod) {
        var authMod = fb.modules.authMod;
        if (authMod.setPersistence && authMod.browserSessionPersistence) {
          authMod.setPersistence(fb.auth, authMod.browserSessionPersistence)
            .then(function () {
              console.log('[Section 30] ✓ Firebase persistence = SESSION');
            })
            .catch(function (e) { console.warn('[Section 30] persistence failed:', e); });
        }
      }
    } catch (e) {}

    // 4. Sign out if page was reloaded (fresh session check)
    // Actually don't sign out existing sessions to avoid breaking flow
    // But we won't auto-restore them
  }

  function forceLoginOnLoad() {
    // If on login screen but session exists in State.user, clear it
    if (!isLoggedIn()) return;
    // We're on the app; if the user refreshed the page, we want them to see login
    // But if they're actively using the app, don't interrupt
    // Only force logout if page was freshly loaded (not a session within a tab)
    var wasLoaded = sessionStorage.getItem('dm_app_loaded');
    if (!wasLoaded) {
      sessionStorage.setItem('dm_app_loaded', '1');
      // First load of this tab → force logout
      try {
        var fb = window.DrMediaFB;
        if (fb && fb.auth && fb.modules && fb.modules.authMod) {
          fb.modules.authMod.signOut(fb.auth).then(function () {
            console.log('[Section 30] Signed out on fresh load');
            window.location.reload();
          });
        }
      } catch (e) {}
    }
  }

  /* =========================================================
     3. HIDE INTERNAL PAGES FOR NON-SUPER-ADMIN
     ========================================================= */
  var INTERNAL_PAGES = ['counters'];

  function hideInternalNavItems() {
    if (isSuperAdmin()) return;
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    INTERNAL_PAGES.forEach(function (pageId) {
      var link = nav.querySelector('[data-page="' + pageId + '"]');
      if (link) link.remove();
    });
  }

  function blockInternalPages() {
    if (isSuperAdmin()) return;
    INTERNAL_PAGES.forEach(function (pageId) {
      if (Pages[pageId]) {
        var orig = Pages[pageId];
        Pages[pageId] = function (el) {
          el.innerHTML = '<div class="empty-state" style="padding:4rem 1rem">' +
            '<i data-lucide="lock"></i>' +
            '<p>' + (State.lang === 'ar' ? 'هذه الصفحة غير متاحة' : 'This page is not available') + '</p>' +
          '</div>';
          if (window.lucide) lucide.createIcons();
        };
      }
    });
  }

  /* =========================================================
     4. TRIAL = 1 DAY + AUTO-CLEANUP
     ========================================================= */
  function changeTrialDuration() {
    if (window.__dmPlans && window.__dmPlans.trial) {
      window.__dmPlans.trial.durationDays = 1;
      console.log('[Section 30] ✓ Trial = 1 day');
    }
  }

  // Auto-cleanup: when trial expired > 1 day ago, delete company data
  async function cleanupExpiredTrials() {
    if (!isLoggedIn()) return;
    if (isSuperAdmin()) return;

    var SaaS = window.__dmSaaS;
    if (!SaaS.subscription || !SaaS.profile) return;
    if (SaaS.subscription.planId !== 'trial') return;

    var expiresAt = SaaS.subscription.expiresAt || 0;
    var daysSinceExpiry = Math.floor((Date.now() - expiresAt) / 86400000);

    // Trial expired more than 1 day ago
    if (daysSinceExpiry >= 1) {
      console.log('[Section 30] Trial expired > 1 day — cleaning up');
      showCleanupNotice();
    }
  }

  function showCleanupNotice() {
    var overlay = document.createElement('div');
    overlay.id = 'dm-cleanup-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:linear-gradient(135deg,#0f0a1f 0%,#1e1b3a 100%);display:flex;align-items:center;justify-content:center;padding:1rem;text-align:center';

    overlay.innerHTML =
      '<div style="max-width:480px;background:rgba(21,16,36,.9);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:2.5rem 2rem;backdrop-filter:blur(20px)">' +
        '<div style="font-size:3.5rem;margin-bottom:1rem">⏰</div>' +
        '<h2 style="color:#fff;margin:0 0 .75rem;font-size:1.35rem;font-weight:800">' +
          (State.lang === 'ar' ? 'انتهت تجربتك المجانية' : 'Your trial has ended') +
        '</h2>' +
        '<p style="color:#94a3b8;font-size:.9rem;line-height:1.7;margin:0 0 1.5rem">' +
          (State.lang === 'ar'
            ? 'تم إيقاف حسابك التجريبي. بياناتك محفوظة لمدة 24 ساعة، وبعدها سيتم حذفها تلقائيًا. للاحتفاظ بها، اشترك الآن.'
            : 'Your trial has ended. Your data is preserved for 24 hours, then deleted automatically. Subscribe now to keep it.') +
        '</p>' +
        '<div style="display:flex;gap:.5rem;flex-direction:column">' +
          '<button id="dm-cleanup-subscribe" style="width:100%;padding:.95rem;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;font-weight:700;font-size:.95rem;cursor:pointer;font-family:inherit;box-shadow:0 10px 25px -8px #7c3aed">' +
            '💎 ' + (State.lang === 'ar' ? 'اشترك الآن' : 'Subscribe Now') +
          '</button>' +
          '<button id="dm-cleanup-logout" style="width:100%;padding:.75rem;border-radius:12px;background:transparent;color:#94a3b8;border:none;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">' +
            (State.lang === 'ar' ? 'تسجيل خروج' : 'Logout') +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#dm-cleanup-subscribe').onclick = function () {
      overlay.remove();
      if (typeof window.__dmShowPlans === 'function') window.__dmShowPlans();
    };

    overlay.querySelector('#dm-cleanup-logout').onclick = async function () {
      try {
        var fb = window.DrMediaFB;
        if (fb && fb.auth && fb.modules && fb.modules.authMod) {
          await fb.modules.authMod.signOut(fb.auth);
        }
      } catch (e) {}
      window.location.reload();
    };
  }

  // Actual auto-delete (called by super admin or scheduled)
  window.__dmDeleteExpiredTrialData = async function (companyId) {
    if (!isSuperAdmin()) return false;
    try {
      var fsMod = window.DrMediaFB.modules.fsMod;
      // Delete company data
      await fsMod.deleteDoc(fsMod.doc(window.DrMediaFB.db, 'companies', companyId, 'app', 'main'));
      await fsMod.deleteDoc(fsMod.doc(window.DrMediaFB.db, 'companies', companyId));
      await fsMod.deleteDoc(fsMod.doc(window.DrMediaFB.db, 'subscriptions', companyId));
      console.log('[Section 30] Deleted trial data for', companyId);
      return true;
    } catch (e) {
      console.error('[Section 30] delete failed:', e);
      return false;
    }
  };

  /* =========================================================
     5. SUPER ADMIN — SUBSCRIBERS TRACKING PANEL
     ========================================================= */
  window.__dmShowSubscribers = async function () {
    if (!isSuperAdmin()) {
      if (typeof showToast === 'function') showToast('Super Admin only', 'error');
      return;
    }

    var el = document.getElementById('content');
    if (!el) return;

    // Register page
    Pages.subscribers = async function (container) {
      container.innerHTML = '<div class="skeleton" style="height:60px;margin-bottom:1rem"></div><div class="skeleton" style="height:200px"></div>';

      try {
        var fsMod = window.DrMediaFB.modules.fsMod;

        // Load companies + subscriptions + users in parallel
        var [comps, subs] = await Promise.all([
          fsMod.getDocs(fsMod.collection(window.DrMediaFB.db, 'companies')),
          fsMod.getDocs(fsMod.collection(window.DrMediaFB.db, 'subscriptions'))
        ]);

        var subMap = {};
        subs.forEach(function (d) { subMap[d.id] = d.data(); });

        var companies = [];
        comps.forEach(function (d) {
          var c = d.data();
          var sub = subMap[c.id] || {};
          var plan = (window.__dmPlans || {})[sub.planId] || { name: 'Trial', price: 0 };
          var days = sub.expiresAt ? Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 86400000)) : 0;
          var expired = days <= 0;

          companies.push({
            id: c.id,
            name: c.name || '—',
            ownerEmail: c.ownerEmail || '—',
            phone: c.phone || '—',
            planId: sub.planId || 'trial',
            planName: plan.name,
            price: plan.price || 0,
            days: days,
            expired: expired,
            status: sub.status || 'unknown',
            createdAt: c.createdAt,
            expiresAt: sub.expiresAt
          });
        });

        // Sort: expired first, then by days
        companies.sort(function (a, b) {
          if (a.expired !== b.expired) return a.expired ? 1 : -1;
          return a.days - b.days;
        });

        // Stats
        var total = companies.length;
        var active = companies.filter(function (c) { return !c.expired; }).length;
        var expired = companies.filter(function (c) { return c.expired; }).length;
        var trials = companies.filter(function (c) { return c.planId === 'trial' && !c.expired; }).length;
        var mrr = companies.reduce(function (sum, c) {
          return sum + (!c.expired && c.planId !== 'trial' ? c.price : 0);
        }, 0);

        // Filter
        var filter = State.filters.subFilter || 'all';
        var filtered = companies.filter(function (c) {
          if (filter === 'all') return true;
          if (filter === 'active') return !c.expired;
          if (filter === 'expired') return c.expired;
          if (filter === 'trial') return c.planId === 'trial';
          if (filter === 'paid') return c.planId !== 'trial' && !c.expired;
          return true;
        });

        // Rows
        var rows = filtered.map(function (c) {
          var statusColor = c.expired ? 'red' : (c.days <= 3 ? 'yellow' : 'green');
          var statusText = c.expired ? 'Expired' : (c.planId === 'trial' ? 'Trial' : 'Active');

          return '<tr>' +
            '<td><div style="font-weight:700">' + esc(c.name) + '</div><div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem">' + esc(c.id) + '</div></td>' +
            '<td><div>' + esc(c.ownerEmail) + '</div><div style="font-size:.7rem;color:var(--text-muted)">' + esc(c.phone) + '</div></td>' +
            '<td><span class="badge-pill badge-purple">' + esc(c.planName) + '</span></td>' +
            '<td><b>' + (c.price || 0) + '</b> EGP</td>' +
            '<td><b style="color:' + (c.expired ? '#ef4444' : '#10b981') + '">' + c.days + '</b></td>' +
            '<td><span class="badge-pill badge-' + statusColor + '">' + statusText + '</span></td>' +
            '<td>' +
              '<div style="display:flex;gap:.25rem">' +
                '<button class="btn btn-ghost btn-icon btn-sm" onclick="__dmViewSubCompany(\'' + c.id + '\')" title="View"><i data-lucide="eye"></i></button>' +
                '<button class="btn btn-success btn-icon btn-sm" onclick="__dmExtendSub(\'' + c.id + '\')" title="Extend"><i data-lucide="calendar-plus"></i></button>' +
                '<button class="btn btn-ghost btn-icon btn-sm" onclick="__dmChangeSubPlan(\'' + c.id + '\')" title="Change Plan" style="color:#7c3aed"><i data-lucide="trending-up"></i></button>' +
                '<button class="btn btn-ghost btn-icon btn-sm" onclick="__dmDeleteSub(\'' + c.id + '\',\'' + esc(c.name) + '\')" title="Delete" style="color:#ef4444"><i data-lucide="trash-2"></i></button>' +
              '</div>' +
            '</td>' +
          '</tr>';
        }).join('');

        container.innerHTML =
          '<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;align-items:center">' +
            '<i data-lucide="users" style="width:22px;height:22px;color:#f59e0b"></i>' +
            '<span style="font-weight:800;font-size:1.05rem">متابعة المشتركين</span>' +
            '<div style="margin-inline-start:auto;display:flex;gap:.5rem;flex-wrap:wrap">' +
              '<button class="btn btn-ghost btn-sm" onclick="__dmExportSubscribers()"><i data-lucide="download"></i> تصدير</button>' +
              '<button class="btn btn-primary btn-sm" onclick="__dmRefreshSubscribers()"><i data-lucide="refresh-cw"></i> تحديث</button>' +
            '</div>' +
          '</div>' +

          '<div class="grid-stats" style="margin-bottom:1rem">' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(124,58,237,.1);color:#7c3aed"><i data-lucide="building-2"></i></div><div class="stat-body"><div class="label">إجمالي المشتركين</div><div class="value">' + total + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(16,185,129,.1);color:#10b981"><i data-lucide="check-circle"></i></div><div class="stat-body"><div class="label">نشط</div><div class="value">' + active + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(239,68,68,.1);color:#ef4444"><i data-lucide="alert-circle"></i></div><div class="stat-body"><div class="label">منتهي</div><div class="value">' + expired + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,.1);color:#f59e0b"><i data-lucide="gift"></i></div><div class="stat-body"><div class="label">تجارب</div><div class="value">' + trials + '</div></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:rgba(6,182,212,.1);color:#06b6d4"><i data-lucide="dollar-sign"></i></div><div class="stat-body"><div class="label">MRR</div><div class="value">' + mrr.toLocaleString() + ' EGP</div></div></div>' +
          '</div>' +

          '<div class="tabs" style="margin-bottom:1rem">' +
            '<div class="tab ' + (filter === 'all' ? 'active' : '') + '" onclick="__dmSubFilter(\'all\')">الكل (' + total + ')</div>' +
            '<div class="tab ' + (filter === 'active' ? 'active' : '') + '" onclick="__dmSubFilter(\'active\')">نشط</div>' +
            '<div class="tab ' + (filter === 'trial' ? 'active' : '') + '" onclick="__dmSubFilter(\'trial\')">تجارب</div>' +
            '<div class="tab ' + (filter === 'paid' ? 'active' : '') + '" onclick="__dmSubFilter(\'paid\')">مدفوع</div>' +
            '<div class="tab ' + (filter === 'expired' ? 'active' : '') + '" onclick="__dmSubFilter(\'expired\')">منتهي</div>' +
          '</div>' +

          '<div class="card" style="padding:0;overflow:hidden">' +
            '<div class="table-wrap" style="border:none;border-radius:0">' +
              '<table class="data-table">' +
                '<thead><tr>' +
                  '<th>الشركة</th>' +
                  '<th>المالك</th>' +
                  '<th>الباقة</th>' +
                  '<th>السعر</th>' +
                  '<th>الأيام</th>' +
                  '<th>الحالة</th>' +
                  '<th>إجراءات</th>' +
                '</tr></thead>' +
                '<tbody>' + (rows || '<tr><td colspan="7"><div class="empty-state"><i data-lucide="inbox"></i><p>لا يوجد مشتركين بعد</p></div></td></tr>') + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>';

        if (window.lucide) lucide.createIcons();

      } catch (err) {
        console.error('[Section 30] subscribers load failed:', err);
        container.innerHTML = '<div class="empty-state"><i data-lucide="alert-triangle"></i><p>فشل التحميل: ' + esc(err.message) + '</p></div>';
        if (window.lucide) lucide.createIcons();
      }
    };

    // Register nav item (Super Admin only)
    var sys = NAV_ITEMS.find(function (g) { return g.section === 'system'; });
    if (sys && !sys.items.find(function (i) { return i.id === 'subscribers'; })) {
      var settingsIdx = sys.items.findIndex(function (i) { return i.id === 'settings'; });
      var at = settingsIdx >= 0 ? settingsIdx : sys.items.length;
      sys.items.splice(at, 0, { id: 'subscribers', icon: 'users', label: 'متابعة المشتركين' });
    }

    try { renderSidebar(); } catch (e) {}
    if (typeof navigate === 'function') navigate('subscribers');
  };

  /* ---------- Super Admin Actions ---------- */
  window.__dmSubFilter = function (filter) {
    State.filters.subFilter = filter;
    if (typeof navigate === 'function') navigate('subscribers');
  };

  window.__dmRefreshSubscribers = function () {
    if (typeof navigate === 'function') navigate('subscribers');
  };

  window.__dmViewSubCompany = async function (companyId) {
    try {
      var fsMod = window.DrMediaFB.modules.fsMod;
      var snap = await fsMod.getDoc(fsMod.doc(window.DrMediaFB.db, 'companies', companyId));
      if (!snap.exists()) { showToast('Not found', 'error'); return; }
      var c = snap.data();

      var subSnap = await fsMod.getDoc(fsMod.doc(window.DrMediaFB.db, 'subscriptions', companyId));
      var sub = subSnap.exists() ? subSnap.data() : {};

      openModal({
        title: '🏢 ' + c.name,
        size: 'lg',
        body: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.85rem">' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">COMPANY ID</b><div style="margin-top:.2rem">' + esc(c.id) + '</div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">NAME</b><div style="margin-top:.2rem">' + esc(c.name) + '</div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">OWNER EMAIL</b><div style="margin-top:.2rem">' + esc(c.ownerEmail || '—') + '</div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">PHONE</b><div style="margin-top:.2rem">' + esc(c.phone || '—') + '</div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">PLAN</b><div style="margin-top:.2rem"><span class="badge-pill badge-purple">' + esc(sub.planId || 'trial') + '</span></div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">STATUS</b><div style="margin-top:.2rem">' + esc(sub.status || '—') + '</div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">EXPIRES</b><div style="margin-top:.2rem">' + (sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : '—') + '</div></div>' +
          '<div><b style="color:var(--text-muted);font-size:.7rem">CREATED</b><div style="margin-top:.2rem">' + (c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : '—') + '</div></div>' +
        '</div>'
      });
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  window.__dmExtendSub = async function (companyId) {
    var days = prompt('كم يوم تريد إضافته؟', '30');
    if (!days) return;
    days = parseInt(days);
    if (!days || days <= 0) return;

    try {
      var fsMod = window.DrMediaFB.modules.fsMod;
      var subRef = fsMod.doc(window.DrMediaFB.db, 'subscriptions', companyId);
      var snap = await fsMod.getDoc(subRef);
      var current = snap.exists() ? snap.data() : {};
      var currentExpiry = current.expiresAt || Date.now();
      var newExpiry = Math.max(currentExpiry, Date.now()) + (days * 86400000);

      await fsMod.setDoc(subRef, {
        companyId: companyId,
        status: 'active',
        expiresAt: newExpiry,
        extendedBy: window.__dmSaaS.user.uid,
        extendedAt: fsMod.serverTimestamp()
      }, { merge: true });

      showToast('✓ تم تمديد الاشتراك ' + days + ' يوم', 'success');
      navigate('subscribers');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  window.__dmChangeSubPlan = function (companyId) {
    var plans = window.__dmPlans || {};
    var options = Object.keys(plans).map(function (k) {
      return k + ' (' + plans[k].price + ' EGP)';
    }).join('\n');
    var chosen = prompt('اختر الباقة:\n' + options, 'pro');
    if (!chosen || !plans[chosen]) return;

    (async function () {
      try {
        var fsMod = window.DrMediaFB.modules.fsMod;
        var plan = plans[chosen];
        var subRef = fsMod.doc(window.DrMediaFB.db, 'subscriptions', companyId);
        await fsMod.setDoc(subRef, {
          companyId: companyId,
          planId: chosen,
          status: 'active',
          startedAt: Date.now(),
          expiresAt: Date.now() + (plan.durationDays * 86400000),
          changedBy: window.__dmSaaS.user.uid,
          updatedAt: fsMod.serverTimestamp()
        }, { merge: true });
        showToast('✓ تم التغيير إلى ' + plan.name, 'success');
        navigate('subscribers');
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      }
    })();
  };

  window.__dmDeleteSub = function (companyId, companyName) {
    if (!confirm('⚠️ حذف نهائي لشركة "' + companyName + '"؟\n\nسيتم حذف كل البيانات ولا يمكن استرجاعها!')) return;
    if (!confirm('تأكيد أخير: أنت متأكد 100%؟')) return;

    (async function () {
      var ok = await window.__dmDeleteExpiredTrialData(companyId);
      if (ok) {
        showToast('✓ تم الحذف', 'success');
        navigate('subscribers');
      } else {
        showToast('فشل الحذف', 'error');
      }
    })();
  };

  window.__dmExportSubscribers = async function () {
    try {
      var fsMod = window.DrMediaFB.modules.fsMod;
      var [comps, subs] = await Promise.all([
        fsMod.getDocs(fsMod.collection(window.DrMediaFB.db, 'companies')),
        fsMod.getDocs(fsMod.collection(window.DrMediaFB.db, 'subscriptions'))
      ]);

      var subMap = {};
      subs.forEach(function (d) { subMap[d.id] = d.data(); });

      var rows = [['Company ID', 'Name', 'Owner Email', 'Phone', 'Plan', 'Days Left', 'Status']];
      comps.forEach(function (d) {
        var c = d.data();
        var sub = subMap[c.id] || {};
        var days = sub.expiresAt ? Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 86400000)) : 0;
        rows.push([
          c.id,
          c.name || '',
          c.ownerEmail || '',
          c.phone || '',
          sub.planId || 'trial',
          days,
          sub.status || 'unknown'
        ]);
      });

      var csv = rows.map(function (r) {
        return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');

      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'subscribers-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ تم التصدير', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  /* ---------- Add nav item on super admin login ---------- */
  function ensureSuperAdminNav() {
    if (!isSuperAdmin()) return;
    var sys = NAV_ITEMS.find(function (g) { return g.section === 'system'; });
    if (sys && !sys.items.find(function (i) { return i.id === 'subscribers'; })) {
      var settingsIdx = sys.items.findIndex(function (i) { return i.id === 'settings'; });
      var at = settingsIdx >= 0 ? settingsIdx : sys.items.length;
      sys.items.splice(at, 0, { id: 'subscribers', icon: 'users', label: 'متابعة المشتركين' });
    }

    // Add to Super Admin section
    var nav = document.getElementById('sidebar-nav');
    if (nav && !nav.querySelector('[data-page="subscribers"]')) {
      var superSection = document.getElementById('dm-super-nav');
      if (superSection) {
        var link = document.createElement('a');
        link.className = 'nav-item';
        link.setAttribute('data-page', 'subscribers');
        link.style.cssText = 'cursor:pointer;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.3);color:#7c3aed';
        link.innerHTML = '<i data-lucide="users" style="color:#7c3aed"></i><span style="color:#7c3aed;font-weight:700">متابعة المشتركين</span>';
        link.onclick = function (e) {
          e.preventDefault();
          window.__dmShowSubscribers();
        };
        superSection.appendChild(link);
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /* =========================================================
     6. LOAD LIMITED FEATURES BASED ON PLAN
     ========================================================= */
  // (Can be extended later — basic structure)

  /* =========================================================
     7. HOOK NAVIGATE — enforce plan
     ========================================================= */
  function hookNavigateForPlan() {
    if (typeof window.navigate !== 'function') return;
    if (window.navigate.__dm30Hooked) return;
    var orig = window.navigate;
    window.navigate = function (page) {
      // Hide internal pages for non-super-admin
      if (!isSuperAdmin() && INTERNAL_PAGES.indexOf(page) >= 0) {
        if (typeof showToast === 'function') showToast('غير متاح', 'error');
        return;
      }
      return orig.apply(this, arguments);
    };
    window.navigate.__dm30Hooked = true;
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    addCopyrightFooter();
    changeTrialDuration();
    hideInternalNavItems();
    blockInternalPages();
    ensureSuperAdminNav();
    hookNavigateForPlan();
  }

  waitFor(
    function () {
      return typeof State !== 'undefined' && typeof Pages !== 'undefined';
    },
    function () {
      boot();

      // On login ready
      waitFor(
        function () { return isLoggedIn(); },
        function () {
          boot();
          cleanupExpiredTrials();
          ensureSuperAdminNav();

          // Watch for banners for super admin
          if (isSuperAdmin()) {
            setInterval(function () {
              var sub = document.getElementById('dm-sub-banner');
              if (sub) sub.remove();
              var grace = document.getElementById('dm-grace-banner');
              if (grace) grace.remove();
              var enf = document.getElementById('dm-enf-overlay');
              if (enf) enf.remove();
            }, 1500);
          }
        }
      );

      // Login screen also needs copyright
      setInterval(addCopyrightFooter, 3000);

      console.log('%c[Section 30] ✓ Complete SaaS ready', 'color:#10b981;font-weight:bold;font-size:13px');
      console.log('%c[Section 30] Commands:', 'color:#06b6d4;font-style:italic');
      console.log('  __dmShowSubscribers()  — متابعة المشتركين');
      console.log('  __dmDeleteExpiredTrialData(companyId)  — حذف شركة');
    }
  );

  // Handle fresh page loads — force login
  window.addEventListener('load', function () {
    setTimeout(function () {
      // Clear auto-login session on fresh load
      try {
        var marker = sessionStorage.getItem('dm_page_loaded');
        if (!marker) {
          sessionStorage.setItem('dm_page_loaded', '1');
          localStorage.removeItem('drmedia_pro_session');
        }
      } catch (e) {}
    }, 500);
  });

  window.__dmResetPageLoadFlag = function () {
    try { sessionStorage.removeItem('dm_page_loaded'); } catch (e) {}
  };

})();
/* =========================================================
   SECTION 32: Login Flow Master Control
   Version: 1.0.0 (REPLACES Section 31)
   ---------------------------------------------------------
   - ONE source of truth for login flow
   - No auto-reload loops
   - No repeated signouts
   - Uses sessionStorage flag: cleared when tab closes
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 32] Login Flow Master loading…', 'color:#ef4444;font-weight:bold;font-size:14px');

  /* =========================================================
     FLAGS
     ========================================================= */
  var ACTIVE_KEY = 'dm_session_active_v2';
  var INITED_KEY = 'dm_flow_inited_v2';

  function hasActive() {
    try { return sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) { return false; }
  }
  function setActive() {
    try { sessionStorage.setItem(ACTIVE_KEY, '1'); } catch (e) {}
  }
  function clearActive() {
    try { sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {}
  }
  function markInited() {
    try { sessionStorage.setItem(INITED_KEY, '1'); } catch (e) {}
  }
  function wasInited() {
    try { return sessionStorage.getItem(INITED_KEY) === '1'; } catch (e) { return false; }
  }

  /* =========================================================
     1. PRE-LOAD CLEANUP
     ========================================================= */
  // Clear stale Firebase auth cache if no active tab session
  if (!hasActive()) {
    try {
      Object.keys(localStorage).forEach(function (key) {
        if (key.indexOf('firebase:authUser') === 0 ||
            key.indexOf('firebase:persistence') === 0) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem('drmedia_pro_session');
      console.log('[Section 32] Cleared stale session cache');
    } catch (e) {}
  }

  // Kill Section 30's aggressive reload logic
  try {
    sessionStorage.setItem('dm_app_loaded', '1');
    sessionStorage.setItem('dm_page_loaded', '1');
  } catch (e) {}

  /* =========================================================
     2. PREVENT ALL AUTO-RELOADS
     ========================================================= */
  var reloadCount = 0;
  var origReload = window.location.reload;
  try {
    window.location.reload = function () {
      reloadCount++;
      if (reloadCount > 3) {
        console.warn('[Section 32] BLOCKED reload #' + reloadCount);
        return;
      }
      console.log('[Section 32] reload #' + reloadCount);
      return origReload.apply(window.location, arguments);
    };
  } catch (e) {}

  /* =========================================================
     3. WAIT FOR FIREBASE
     ========================================================= */
  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 200;
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > maxTries) { clearInterval(t); console.warn('[Section 32] timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  waitFor(
    function () {
      return window.DrMediaFB && window.DrMediaFB.auth && window.DrMediaFB.modules
        && window.DrMediaFB.modules.authMod;
    },
    async function () {
      var fb = window.DrMediaFB;
      var authMod = fb.modules.authMod;

      /* ----- 1. Set SESSION persistence ----- */
      try {
        if (authMod.setPersistence && authMod.browserSessionPersistence) {
          await authMod.setPersistence(fb.auth, authMod.browserSessionPersistence);
          console.log('[Section 32] ✓ Persistence = SESSION');
        }
      } catch (e) {
        console.warn('[Section 32] persistence failed:', e);
      }

      /* ----- 2. Handle current user ----- */
      var currentUser = fb.auth.currentUser;

      if (currentUser && !hasActive() && !wasInited()) {
        // Fresh page load with a stored session — sign out silently
        console.log('[Section 32] Stale session — signing out (no reload)');
        try {
          await authMod.signOut(fb.auth);
        } catch (e) { console.warn(e); }

        // Switch UI to login without reload
        switchToLoginScreen();
      } else if (currentUser && hasActive()) {
        // Active tab session — let it through
        console.log('[Section 32] Active session — proceeding');
      } else if (!currentUser) {
        // No user — ensure login screen visible
        switchToLoginScreen();
      }

      markInited();

      /* ----- 3. Watch auth changes ----- */
      if (authMod.onAuthStateChanged) {
        authMod.onAuthStateChanged(fb.auth, function (user) {
          if (user) {
            setActive();
            console.log('[Section 32] ✓ Session marked active');
          } else {
            clearActive();
            console.log('[Section 32] Session cleared');
          }
        });
      }

      /* ----- 4. Watch login buttons ----- */
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && (t.id === 'saas-login-btn' || t.id === 'saas-register-btn')) {
          setActive();
        }
      }, true);

      /* ----- 5. Override logout ----- */
      if (typeof window.logout === 'function' && !window.logout.__dm32) {
        var origLogout = window.logout;
        window.logout = function () {
          clearActive();
          return origLogout.apply(this, arguments);
        };
        window.logout.__dm32 = true;
      }

      console.log('%c[Section 32] ✓ Login flow controlled', 'color:#10b981;font-weight:bold');
    }
  );

  /* =========================================================
     4. SAFE UI SWITCH (no reload)
     ========================================================= */
  function switchToLoginScreen() {
    var loginScreen = document.getElementById('login-screen');
    var appScreen = document.getElementById('app');
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
      loginScreen.style.display = '';
    }
    if (appScreen) {
      appScreen.classList.add('hidden');
    }
    if (window.__dmSaaS) {
      window.__dmSaaS.ready = false;
      window.__dmSaaS.user = null;
    }
  }

  /* =========================================================
     5. MANUAL COMMANDS
     ========================================================= */
  window.__dmForceLogin = async function () {
    try {
      var fb = window.DrMediaFB;
      if (fb && fb.auth && fb.modules && fb.modules.authMod) {
        await fb.modules.authMod.signOut(fb.auth);
      }
    } catch (e) {}
    clearActive();
    try { localStorage.removeItem('drmedia_pro_session'); } catch (e) {}
    switchToLoginScreen();
    console.log('[Section 32] Forced login screen');
  };

  window.__dmSessionStatus = function () {
    var s = {
      activeFlag: hasActive(),
      initedFlag: wasInited(),
      firebaseUser: window.DrMediaFB && window.DrMediaFB.auth ? (window.DrMediaFB.auth.currentUser ? window.DrMediaFB.auth.currentUser.email : 'none') : 'fb-not-ready',
      saasReady: window.__dmSaaS ? window.__dmSaaS.ready : false,
      saasUser: window.__dmSaaS && window.__dmSaaS.user ? window.__dmSaaS.user.email : 'none',
      reloadCount: reloadCount
    };
    console.table(s);
    return s;
  };

})();



/* #########################################################
   ##### FINAL — All sections loaded                    #####
   ######################################################### */
console.log('%c[DrMedia Update] ═══════════════════════════', 'color:#7c3aed;font-weight:bold;font-size:14px');
console.log('%c[DrMedia Update] ✓ All 4 sections registered', 'color:#10b981;font-weight:bold');
console.log('%c[DrMedia Update] Test: __dmSyncStatus()', 'color:#06b6d4;font-style:italic');
