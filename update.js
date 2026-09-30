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



/* #########################################################
   ##### FINAL — All sections loaded                    #####
   ######################################################### */
console.log('%c[DrMedia Update] ═══════════════════════════', 'color:#7c3aed;font-weight:bold;font-size:14px');
console.log('%c[DrMedia Update] ✓ All 4 sections registered', 'color:#10b981;font-weight:bold');
console.log('%c[DrMedia Update] Test: __dmSyncStatus()', 'color:#06b6d4;font-style:italic');
