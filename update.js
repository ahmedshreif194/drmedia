/* =========================================================
   Dr Media Pro — UPDATE PACK
   File: update.js
   Version: 3.0.0
   Features: Firebase Real Integration + Counters Tab
   =========================================================
   ⚠️ DO NOT EDIT index.html — All features live here.
   ========================================================= */

(function () {
  'use strict';

  console.log('%c[DrMedia Update] v3.0.0 loading…', 'color:#7c3aed;font-weight:bold');

  /* =========================================================
     1. FIREBASE CONFIG
     ========================================================= */
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
  const FIRESTORE_COLLECTION = 'app_state';
  const FIRESTORE_DOC = 'main';

  /* =========================================================
     2. FIREBASE STATE FLAGS
     ========================================================= */
  const FB = {
    ready: false,
    app: null,
    db: null,
    auth: null,
    rtdb: null,
    storage: null,
    analytics: null,
    modules: {},
    status: 'initializing', // initializing | online | offline | error
    lastSyncAt: null,
    lastSyncDir: null,
    lastError: null
  };
  window.DrMediaFB = FB;

  /* =========================================================
     3. WAIT FOR CORE APP
     ========================================================= */
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

  /* =========================================================
     4. LOGIN SANDBOX FIX (from v1.1)
     ========================================================= */
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
      if (typeof window.attemptLogin !== 'function') {
        alert('System not ready. Please refresh.');
        return false;
      }
      let ok = false;
      try { ok = window.attemptLogin(u, p); }
      catch (err) {
        console.error('[DrMedia] Login error:', err);
        if (typeof showToast === 'function') showToast('خطأ في تسجيل الدخول', 'error');
        return false;
      }
      if (ok) {
        if (typeof showToast === 'function') showToast('تم تسجيل الدخول بنجاح', 'success');
        if (typeof startApp === 'function') startApp();
        // Trigger Firebase sync after login
        setTimeout(() => syncOnLogin(), 500);
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

    console.log('%c[DrMedia] ✓ Login patched', 'color:#10b981;font-weight:bold');
    return true;
  }

  /* =========================================================
     5. DYNAMIC FIREBASE MODULE LOADER
     ========================================================= */
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
    try {
      analyticsMod = await import(`${base}/firebase-analytics.js`);
    } catch (e) {
      console.warn('[Firebase] Analytics module not loaded', e);
    }
    return { appMod, authMod, fsMod, rtdbMod, storageMod, analyticsMod };
  }

  /* =========================================================
     6. BOOTSTRAP FIREBASE
     ========================================================= */
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
      console.log('%c[Firebase] ✓ Initialized', 'color:#f59e0b;font-weight:bold', FIREBASE_CONFIG.projectId);
      return true;
    } catch (err) {
      FB.status = 'error';
      FB.lastError = err.message || String(err);
      console.error('[Firebase] Init failed:', err);
      return false;
    }
  }

  /* =========================================================
     7. FIRESTORE READ / WRITE
     ========================================================= */
  async function fsReadMainDoc() {
    if (!FB.ready) return null;
    const { doc, getDoc } = FB.modules.fsMod;
    try {
      const snap = await getDoc(doc(FB.db, FIRESTORE_COLLECTION, FIRESTORE_DOC));
      if (window.DrMediaCounters) window.DrMediaCounters.trackRead(FIRESTORE_COLLECTION, 1);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Read failed:', err);
      if (window.DrMediaCounters) window.DrMediaCounters.trackFail();
      return null;
    }
  }

  async function fsWriteMainDoc(data) {
    if (!FB.ready) return false;
    const { doc, setDoc, serverTimestamp } = FB.modules.fsMod;
    try {
      await setDoc(
        doc(FB.db, FIRESTORE_COLLECTION, FIRESTORE_DOC),
        {
          payload: data,
          updatedAt: serverTimestamp(),
          updatedBy: (State.user && State.user.username) || 'system'
        },
        { merge: false }
      );
      if (window.DrMediaCounters) {
        window.DrMediaCounters.trackWrite(FIRESTORE_COLLECTION, 1);
        window.DrMediaCounters.trackPush();
      }
      FB.lastSyncAt = new Date();
      FB.lastSyncDir = 'push';
      return true;
    } catch (err) {
      console.warn('[Firestore] Write failed:', err);
      if (window.DrMediaCounters) window.DrMediaCounters.trackFail();
      return false;
    }
  }

  /* =========================================================
     8. SMART MERGE
     ========================================================= */
  function mergeData(localData, remoteData) {
    if (!remoteData || !remoteData.payload) return localData;
    const remote = remoteData.payload;
    const countLocal = (localData.bookings || []).length + (localData.employees || []).length;
    const countRemote = (remote.bookings || []).length + (remote.employees || []).length;
    if (countRemote > countLocal) {
      console.log('[Sync] Firestore wins (more data)');
      return remote;
    }
    console.log('[Sync] localStorage wins');
    return localData;
  }

  /* =========================================================
     9. DEBOUNCED PUSH
     ========================================================= */
  let pushTimer = null;
  function schedulePush() {
    if (!FB.ready) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      await fsWriteMainDoc(State.data);
    }, 1200);
  }

  /* =========================================================
     10. SYNC ON LOGIN
     ========================================================= */
  async function syncOnLogin() {
    if (!FB.ready) return;
    console.log('[Sync] Pulling from Firestore…');
    const remote = await fsReadMainDoc();
    if (remote && remote.payload) {
      const merged = mergeData(State.data, remote);
      if (merged !== State.data) {
        State.data = merged;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}
        console.log('[Sync] State replaced with Firestore version');
        try { navigate(State.page); } catch (e) {}
      } else {
        schedulePush();
      }
      FB.lastSyncAt = new Date();
      FB.lastSyncDir = 'pull';
      if (window.DrMediaCounters) window.DrMediaCounters.trackPull();
    } else {
      schedulePush();
    }
  }

  /* =========================================================
     11. HOOKS
     ========================================================= */
  function hookSaveData() {
    try {
      const original = window.saveData;
      window.saveData = function () {
        const r = original.apply(this, arguments);
        try {
          if (FB.ready) schedulePush();
          if (window.DrMediaCounters) window.DrMediaCounters.trackWrite('localStorage', 1);
        } catch (e) {}
        return r;
      };
      console.log('[Hook] saveData hooked');
    } catch (e) { console.warn('[Hook] saveData failed', e); }
  }

  function hookLogin() {
    try {
      const original = window.attemptLogin;
      window.attemptLogin = function (u, p) {
        const ok = original.apply(this, arguments);
        if (ok) setTimeout(() => syncOnLogin(), 300);
        return ok;
      };
    } catch (e) {}
  }

  function hookLogout() {
    try {
      const original = window.logout;
      window.logout = function () {
        return original.apply(this, arguments);
      };
    } catch (e) {}
  }

  /* =========================================================
     12. COUNTERS ENGINE
     ========================================================= */
  const COUNTERS_KEY = 'drmedia_firebase_counters_v3';
  const QUOTAS = { reads: 50000, writes: 20000, deletes: 20000 };
  const PRICING = {
    read: 0.06 / 100000,
    write: 0.18 / 100000,
    delete: 0.02 / 100000
  };

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
    try {
      const raw = localStorage.getItem(COUNTERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return emptyCounters();
  }
  function persistCounters() {
    try { localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters)); } catch (e) {}
  }

  let counters = loadCounters();

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

  /* =========================================================
     13. I18N PATCH
     ========================================================= */
  function patchI18N() {
    Object.assign(I18N.ar, {
      counters: 'عدادات Firebase',
      firebase_plan: 'الخطة',
      free_tier: 'Spark (مجانية)',
      quota_used: 'مستخدم',
      quota_remaining: 'متبقي',
      reads: 'قراءات',
      writes: 'كتابات',
      deletes: 'حذف',
      daily_reads: 'قراءات اليوم',
      daily_writes: 'كتابات اليوم',
      daily_deletes: 'حذف اليوم',
      total_reads: 'إجمالي القراءات',
      total_writes: 'إجمالي الكتابات',
      total_deletes: 'إجمالي الحذف',
      estimated_cost: 'التكلفة المتوقعة',
      daily_cost: 'التكلفة اليومية',
      monthly_cost: 'الشهري (متوقع)',
      usage_details: 'تفاصيل الاستخدام',
      operations_breakdown: 'توزيع العمليات',
      collection: 'المجموعة',
      daily_usage: 'الاستخدام اليومي',
      reset_counters: 'تصفير العدادات',
      refresh: 'تحديث',
      pricing_note: 'الحسابات بناءً على Blaze: $0.06/100k قراءة، $0.18/100k كتابة.',
      safe: 'آمن',
      near_limit: 'قريب من الحد',
      limit_reached: 'وصل للحد',
      history_days: 'آخر 14 يوم',
      firebase_status: 'حالة Firebase',
      online: 'متصل',
      offline: 'غير متصل',
      initializing: 'جاري التهيئة',
      error: 'خطأ',
      project: 'المشروع',
      last_sync: 'آخر مزامنة',
      sync_stats: 'إحصائيات المزامنة',
      pushes: 'عمليات رفع',
      pulls: 'عمليات سحب',
      failures: 'فشل'
    });
    Object.assign(I18N.en, {
      counters: 'Firebase Counters',
      firebase_plan: 'Plan',
      free_tier: 'Spark (Free)',
      quota_used: 'Used',
      quota_remaining: 'Remaining',
      reads: 'Reads',
      writes: 'Writes',
      deletes: 'Deletes',
      daily_reads: "Today's Reads",
      daily_writes: "Today's Writes",
      daily_deletes: "Today's Deletes",
      total_reads: 'Total Reads',
      total_writes: 'Total Writes',
      total_deletes: 'Total Deletes',
      estimated_cost: 'Estimated Cost',
      daily_cost: 'Daily Cost',
      monthly_cost: 'Monthly (Est.)',
      usage_details: 'Usage Details',
      operations_breakdown: 'Operations Breakdown',
      collection: 'Collection',
      daily_usage: 'Daily Usage',
      reset_counters: 'Reset Counters',
      refresh: 'Refresh',
      pricing_note: 'Based on Blaze: $0.06/100k reads, $0.18/100k writes.',
      safe: 'Safe',
      near_limit: 'Near Limit',
      limit_reached: 'Limit Reached',
      history_days: 'Last 14 days',
      firebase_status: 'Firebase Status',
      online: 'Online',
      offline: 'Offline',
      initializing: 'Initializing',
      error: 'Error',
      project: 'Project',
      last_sync: 'Last Sync',
      sync_stats: 'Sync Stats',
      pushes: 'Pushes',
      pulls: 'Pulls',
      failures: 'Failures'
    });
  }

  /* =========================================================
     14. COUNTERS PAGE
     ========================================================= */
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
            <div style="margin-top:1rem;font-size:.75rem;color:var(--text-muted)">
              <b>${t('last_sync')}:</b> ${FB.lastSyncAt ? FB.lastSyncAt.toLocaleString(State.lang === 'ar' ? 'ar-EG' : 'en-GB') : '—'} ${FB.lastSyncDir ? `(${FB.lastSyncDir})` : ''}
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
            data: {
              labels,
              datasets: [
                { label: t('reads'), data: history.map((h) => h.reads), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
                { label: t('writes'), data: history.map((h) => h.writes), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
                { label: t('deletes'), data: history.map((h) => h.deletes), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.08)', fill: false, tension: 0.4, borderWidth: 2, pointRadius: 3 }
              ]
            },
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

  /* =========================================================
     15. NETWORK WATCHER
     ========================================================= */
  function watchNetwork() {
    window.addEventListener('online', () => {
      FB.status = FB.ready ? 'online' : 'error';
      if (FB.ready) schedulePush();
      showToast('Network: Online', 'success');
    });
    window.addEventListener('offline', () => {
      FB.status = 'offline';
      showToast('Network: Offline — changes will sync later', 'warn');
    });
  }

  /* =========================================================
     16. MAIN
     ========================================================= */
  whenAppReady(async function () {
    console.log('%c[DrMedia Pro] Bootstrapping update.js v3…', 'color:#7c3aed;font-weight:bold');

    // 1) Login fix first (most important)
    patchLogin();

    // 2) Patch i18n + register counters page
    patchI18N();
    registerCountersPage();
    watchNetwork();

    // 3) Bootstrap Firebase
    const ok = await bootstrapFirebase();

    if (!ok) {
      console.warn('[DrMedia] Firebase init failed — running in local-only mode');
      if (typeof showToast === 'function') showToast('Firebase init failed — local mode', 'warn');
      return;
    }

    // 4) Hooks
    hookSaveData();
    hookLogin();
    hookLogout();

    // 5) If already logged in (session restored), trigger sync
    if (State.user) {
      console.log('[DrMedia] Session found — syncing…');
      await syncOnLogin();
    }

    // 6) Welcome toast (once)
    const WELCOME_KEY = 'drmedia_update_welcome_v3';
    if (!localStorage.getItem(WELCOME_KEY)) {
      setTimeout(() => {
        if (typeof showToast === 'function') {
          showToast(
            State.lang === 'ar'
              ? '🔥 Firebase متصل — تبويب العدادات جاهز'
              : '🔥 Firebase connected — Counters tab ready',
            'success'
          );
        }
        localStorage.setItem(WELCOME_KEY, '1');
      }, 2500);
    }

    console.log('%c[DrMedia Pro] ✓ update.js v3 ready', 'color:#10b981;font-weight:bold');
  });

})();

/* =========================================================
   SECTION 2 (v5): Realtime Live Sync — BULLETPROOF
   Version: 5.0.0
   
   - REPLACES saveData completely (no wrapping)
   - Polls State.data hash every 2.5s (backup trigger)
   - Listens to Firestore in real-time
   - Shows live sync indicator in topbar
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 2 v5] ═══ Loading ═══', 'color:#7c3aed;font-weight:bold;font-size:14px');

  // Kill any old listeners from previous versions
  if (window.DrMediaSync) {
    if (window.DrMediaSync.unsub) { try { window.DrMediaSync.unsub(); } catch (e) {} }
    if (window.DrMediaSync.pollTimer) clearInterval(window.DrMediaSync.pollTimer);
    if (window.DrMediaSync.pushTimer) clearTimeout(window.DrMediaSync.pushTimer);
  }

  const TAB_ID = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
  window.__DM_TAB_ID = TAB_ID;
  console.log('%c[Section 2 v5] My TAB_ID: ' + TAB_ID, 'color:#06b6d4;font-weight:bold;font-size:13px');

  const Sync = {
    active: false,
    unsub: null,
    updatesReceived: 0,
    writesSent: 0,
    lastSyncAt: null,
    lastPushAt: null,
    lastError: null,
    pushTimer: null,
    pollTimer: null,
    applyingRemote: false,
    lastHash: '',
    tabId: TAB_ID
  };
  window.DrMediaSync = Sync;

  /* ==========================================================
     UTILITIES
     ========================================================== */
  function waitFor(cond, cb, label) {
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > 300) {
        clearInterval(t);
        console.warn('[Section 2 v5] Timeout waiting for: ' + (label || 'condition'));
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
        JSON.stringify(d.settings || {}).length,
        // Also hash a few names to detect edits
        (d.employees || []).map(e => e.name).join(',').length,
        (d.bookings || []).map(b => b.clientName).join(',').length
      ].join('|');
    } catch (e) { return ''; }
  }

  /* ==========================================================
     PUSH TO CLOUD
     ========================================================== */
  function pushToCloud(reason) {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) {
      console.warn('[Section 2 v5] Firebase not ready');
      return;
    }
    if (!State.user) {
      console.warn('[Section 2 v5] Not logged in — skipping push');
      return;
    }

    console.log('%c[Section 2 v5] 📤 PUSH (' + reason + ')', 'color:#f59e0b;font-weight:bold');

    const { doc, setDoc, serverTimestamp } = window.DrMediaFB.modules.fsMod;
    const ref = doc(window.DrMediaFB.db, 'app_state', 'main');

    const payload = {
      payload: State.data,
      updatedBy: TAB_ID,
      updatedByUser: State.user.username,
      updatedAt: serverTimestamp(),
      version: Date.now()
    };

    setDoc(ref, payload)
      .then(() => {
        Sync.writesSent++;
        Sync.lastPushAt = new Date();
        Sync.lastError = null;
        console.log('%c[Section 2 v5] ✅ WRITE OK (#' + Sync.writesSent + ')', 'color:#10b981;font-weight:bold');
        updateIndicator('push');
      })
      .catch(err => {
        Sync.lastError = err.code + ': ' + err.message;
        console.error('[Section 2 v5] ❌ WRITE FAILED:', err);
        updateIndicator('error');
      });
  }

  /* ==========================================================
     FIRESTORE LISTENER
     ========================================================== */
  function startListener() {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) return false;
    if (Sync.unsub) { try { Sync.unsub(); } catch (e) {} Sync.unsub = null; }

    const { doc, onSnapshot } = window.DrMediaFB.modules.fsMod;
    const ref = doc(window.DrMediaFB.db, 'app_state', 'main');

    Sync.unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          console.log('[Section 2 v5] Doc does not exist yet');
          return;
        }
        const remote = snap.data();
        if (!remote || !remote.payload) return;

        const isMine = remote.updatedBy === TAB_ID;
        console.log('%c[Section 2 v5] 👁 Snapshot (from=' + remote.updatedBy + ', mine=' + isMine + ')',
                    isMine ? 'color:#64748b' : 'color:#10b981;font-weight:bold');

        if (isMine) return;

        // Apply remote
        Sync.updatesReceived++;
        Sync.lastSyncAt = new Date();
        Sync.applyingRemote = true;

        const session = State.user;
        State.data = remote.payload;
        if (session && State.data.users) {
          const u = State.data.users.find(x => x.id === session.id);
          if (u) State.user = { id: u.id, username: u.username, name: u.name, role: u.role, employeeId: u.employeeId };
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}
        Sync.lastHash = computeHash();

        console.log('%c[Section 2 v5] ✅ APPLIED REMOTE UPDATE (#' + Sync.updatesReceived + ')', 'color:#10b981;font-weight:bold;font-size:13px');
        if (typeof showToast === 'function') {
          showToast(
            '🔄 ' + (State.lang === 'ar' ? 'تحديث من جهاز آخر' : 'Update from another device'),
            'success'
          );
        }
        updateIndicator('receive');

        setTimeout(() => {
          try {
            if (State.page && typeof navigate === 'function') navigate(State.page);
            if (typeof updateNotifBadge === 'function') updateNotifBadge();
          } catch (e) {}
          Sync.applyingRemote = false;
        }, 300);
      },
      (err) => {
        console.error('[Section 2 v5] Listener error:', err);
        Sync.lastError = err.code + ': ' + err.message;
        updateIndicator('error');
      }
    );

    Sync.active = true;
    console.log('%c[Section 2 v5] ✓ Listener active', 'color:#10b981;font-weight:bold');
    return true;
  }

  /* ==========================================================
     REPLACE saveData ENTIRELY
     ========================================================== */
  function replaceSaveData() {
    window.saveData = function saveData() {
      // 1. Always persist locally
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data));
      } catch (e) {
        console.warn('[Section 2 v5] localStorage failed:', e);
      }

      // 2. Skip cloud push if we're just applying remote data
      if (Sync.applyingRemote) return;

      // 3. Skip if not logged in
      if (!State.user) return;

      // 4. Debounced push
      clearTimeout(Sync.pushTimer);
      Sync.pushTimer = setTimeout(function () {
        pushToCloud('saveData');
      }, 400);
    };
    console.log('%c[Section 2 v5] ✓ saveData REPLACED (not wrapped)', 'color:#10b981;font-weight:bold');
  }

  /* ==========================================================
     HASH POLLING — backup trigger
     ========================================================== */
  function startPolling() {
    Sync.lastHash = computeHash();
    Sync.pollTimer = setInterval(function () {
      if (Sync.applyingRemote) return;
      if (!State.user) return;

      const h = computeHash();
      if (h !== Sync.lastHash) {
        console.log('[Section 2 v5] ⚡ Hash changed — polling detected change');
        Sync.lastHash = h;
        clearTimeout(Sync.pushTimer);
        Sync.pushTimer = setTimeout(function () {
          pushToCloud('poll');
        }, 300);
      }
    }, 2500);
    console.log('%c[Section 2 v5] ✓ Hash polling active (2.5s)', 'color:#10b981');
  }

  /* ==========================================================
     TOPBAR SYNC INDICATOR
     ========================================================== */
  function injectIndicator() {
    if (document.getElementById('dm-sync-indicator')) return;
    const topbar = document.getElementById('topbar');
    if (!topbar) return;

    const wrap = document.createElement('div');
    wrap.id = 'dm-sync-indicator';
    wrap.style.cssText = 'display:flex;align-items:center;gap:.4rem;padding:.35rem .65rem;border-radius:8px;background:rgba(16,185,129,.12);color:#10b981;font-size:.7rem;font-weight:600;margin-inline-end:.35rem;cursor:pointer;transition:all .3s;user-select:none';
    wrap.title = 'Click to sync manually';
    wrap.innerHTML = '<span id="dm-sync-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;transition:all .3s"></span><span id="dm-sync-label">Live</span>';

    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn && notifBtn.parentNode) notifBtn.parentNode.insertBefore(wrap, notifBtn);
    else topbar.appendChild(wrap);

    // Add keyframes
    if (!document.getElementById('dm-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'dm-pulse-style';
      s.textContent = '@keyframes dmPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}';
      document.head.appendChild(s);
    }
    const dot = document.getElementById('dm-sync-dot');
    if (dot) dot.style.animation = 'dmPulse 2s infinite';

    // Click → manual sync
    wrap.onclick = function () {
      console.log('[Section 2 v5] Manual sync requested');
      pushToCloud('manual');
    };
  }

  function updateIndicator(mode) {
    const wrap = document.getElementById('dm-sync-indicator');
    const label = document.getElementById('dm-sync-label');
    const dot = document.getElementById('dm-sync-dot');
    if (!wrap || !label || !dot) return;

    const colors = {
      push:    { bg: 'rgba(245,158,11,.15)', fg: '#f59e0b', text: 'Pushing…', dot: '#f59e0b' },
      receive: { bg: 'rgba(124,58,237,.15)', fg: '#7c3aed', text: 'Synced ✓',  dot: '#7c3aed' },
      error:   { bg: 'rgba(239,68,68,.15)',  fg: '#ef4444', text: 'Error',     dot: '#ef4444' },
      active:  { bg: 'rgba(16,185,129,.12)', fg: '#10b981', text: 'Live',      dot: '#10b981' }
    };
    const c = colors[mode] || colors.active;
    wrap.style.background = c.bg;
    wrap.style.color = c.fg;
    label.textContent = c.text;
    dot.style.background = c.dot;

    // Reset to "Live" after 3 seconds
    clearTimeout(wrap._resetT);
    wrap._resetT = setTimeout(function () {
      wrap.style.background = colors.active.bg;
      wrap.style.color = colors.active.fg;
      label.textContent = colors.active.text;
      dot.style.background = colors.active.dot;
    }, 3000);
  }

  /* ==========================================================
     VISIBILITY CHANGE — force sync when tab comes back
     ========================================================== */
  function watchVisibility() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && State.user && Sync.active) {
        console.log('[Section 2 v5] Tab visible — refreshing listener');
        // Trigger a fresh read
        startListener();
      }
    });
  }

  /* ==========================================================
     MANUAL TEST HELPERS
     ========================================================== */
  window.__dmSyncNow = function () {
    console.log('=== MANUAL SYNC ===');
    pushToCloud('manual-cli');
  };

  window.__dmSyncStatus = function () {
    const s = {
      tabId: TAB_ID,
      firebaseReady: window.DrMediaFB && window.DrMediaFB.ready,
      syncActive: Sync.active,
      loggedIn: !!State.user,
      username: State.user && State.user.username,
      writesSent: Sync.writesSent,
      updatesReceived: Sync.updatesReceived,
      lastPushAt: Sync.lastPushAt,
      lastSyncAt: Sync.lastSyncAt,
      lastError: Sync.lastError,
      bookingsCount: (State.data.bookings || []).length,
      employeesCount: (State.data.employees || []).length,
      currentHash: computeHash()
    };
    console.table(s);
    return s;
  };

  /* ==========================================================
     BOOT
     ========================================================== */
  waitFor(
    function () {
      return window.DrMediaFB && window.DrMediaFB.ready
          && typeof State !== 'undefined'
          && document.getElementById('topbar');
    },
    function () {
      console.log('%c[Section 2 v5] Firebase ready — bootstrapping', 'color:#10b981');

      replaceSaveData();
      injectIndicator();
      watchVisibility();
      startPolling();

      if (State.user) {
        console.log('[Section 2 v5] Session found — starting listener');
        startListener();
        // Push current state so other devices see us
        setTimeout(function () { pushToCloud('boot'); }, 800);
      } else {
        console.log('[Section 2 v5] No session — will start on login');
        // Hook login
        const origLogin = window.attemptLogin;
        if (typeof origLogin === 'function') {
          window.attemptLogin = function () {
            const ok = origLogin.apply(this, arguments);
            if (ok) setTimeout(function () {
              console.log('[Section 2 v5] Login detected — starting sync');
              startListener();
              setTimeout(function () { pushToCloud('login'); }, 500);
            }, 400);
            return ok;
          };
        }
      }

      console.log('%c[Section 2 v5] ═══ READY ═══', 'color:#10b981;font-weight:bold;font-size:14px');
      console.log('%c[Section 2 v5] Test commands:\n  __dmSyncNow()    — force push\n  __dmSyncStatus() — check status',
                  'color:#06b6d4;font-style:italic');
    }
  );

})();
/* =========================================================
   SECTION 3: Command Palette (Ctrl+K / Cmd+K)
   Added: v3.2.0
   Purpose: Fast keyboard-driven navigation & actions
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 3] Command Palette loading…', 'color:#06b6d4;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 100;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (cond()) { clearInterval(t); cb(); }
      else if (tries >= maxTries) { clearInterval(t); console.warn('[Section 3] timeout'); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  function patchI18n() {
    if (typeof I18N === 'undefined') return;
    Object.assign(I18N.ar, {
      cmd_placeholder: 'اكتب للبحث أو تنفيذ أمر...',
      cmd_no_results: 'لا توجد نتائج',
      cmd_pages: 'الصفحات',
      cmd_actions: 'الإجراءات',
      cmd_employees: 'الموظفون',
      cmd_bookings: 'الحجوزات',
      cmd_clients: 'العملاء',
      cmd_halls: 'القاعات',
      cmd_equipment: 'المعدات'
    });
    Object.assign(I18N.en, {
      cmd_placeholder: 'Type to search or run a command…',
      cmd_no_results: 'No results',
      cmd_pages: 'Pages',
      cmd_actions: 'Actions',
      cmd_employees: 'Employees',
      cmd_bookings: 'Bookings',
      cmd_clients: 'Clients',
      cmd_halls: 'Halls',
      cmd_equipment: 'Equipment'
    });
  }

  /* ---------- Inject styles ---------- */
  function injectStyles() {
    if (document.getElementById('dm-cmd-styles')) return;
    const s = document.createElement('style');
    s.id = 'dm-cmd-styles';
    s.textContent = `
      .dm-cmd-backdrop {
        position:fixed;inset:0;z-index:9999;
        background:rgba(15,10,31,.65);
        backdrop-filter:blur(6px);
        display:flex;align-items:flex-start;justify-content:center;
        padding-top:12vh;padding-inline:1rem;
        animation:dmFadeIn .15s ease;
      }
      @keyframes dmFadeIn { from{opacity:0} to{opacity:1} }

      .dm-cmd-box {
        width:100%;max-width:620px;
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:16px;
        box-shadow:0 30px 80px -20px rgba(0,0,0,.5);
        overflow:hidden;
        animation:dmSlideIn .2s ease;
      }
      @keyframes dmSlideIn { from{transform:translateY(-10px);opacity:0} to{transform:none;opacity:1} }

      .dm-cmd-input-wrap {
        display:flex;align-items:center;gap:.75rem;
        padding:1rem 1.25rem;
        border-bottom:1px solid var(--border);
      }
      .dm-cmd-input-wrap svg { color:var(--text-muted);width:20px;height:20px;flex-shrink:0; }

      .dm-cmd-input {
        flex:1;background:transparent;border:none;outline:none;
        color:var(--text);font-size:1rem;font-family:inherit;
      }
      .dm-cmd-input::placeholder { color:var(--text-muted); }

      .dm-cmd-kbd {
        font-size:.7rem;color:var(--text-muted);
        background:var(--surface-2);border:1px solid var(--border);
        padding:.15rem .4rem;border-radius:6px;
        font-family:ui-monospace,monospace;
      }

      .dm-cmd-results {
        max-height:52vh;overflow-y:auto;padding:.5rem 0;
      }
      .dm-cmd-results::-webkit-scrollbar{width:6px}
      .dm-cmd-results::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px}

      .dm-cmd-section {
        padding:.5rem 1rem .35rem;
        font-size:.68rem;font-weight:700;
        color:var(--text-muted);
        text-transform:uppercase;letter-spacing:.06em;
      }

      .dm-cmd-item {
        display:flex;align-items:center;gap:.75rem;
        padding:.6rem 1.25rem;
        cursor:pointer;
        transition:background .1s;
        color:var(--text);
      }
      .dm-cmd-item:hover,
      .dm-cmd-item.active {
        background:var(--surface-2);
      }
      .dm-cmd-item.active {
        box-shadow:inset 3px 0 0 var(--primary);
      }
      .dm-cmd-item .dm-cmd-icon {
        width:32px;height:32px;border-radius:8px;
        background:var(--surface-2);
        display:flex;align-items:center;justify-content:center;
        color:var(--primary);flex-shrink:0;
      }
      .dm-cmd-item .dm-cmd-icon svg { width:16px;height:16px; }
      .dm-cmd-item .dm-cmd-body { flex:1;min-width:0; }
      .dm-cmd-item .dm-cmd-title {
        font-size:.88rem;font-weight:600;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .dm-cmd-item .dm-cmd-sub {
        font-size:.72rem;color:var(--text-muted);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .dm-cmd-item .dm-cmd-hint {
        font-size:.65rem;color:var(--text-muted);
        padding:.15rem .4rem;border-radius:6px;
        background:var(--surface-2);flex-shrink:0;
      }
      .dm-cmd-empty {
        padding:2rem 1rem;text-align:center;color:var(--text-muted);
      }
      .dm-cmd-empty svg {
        width:40px;height:40px;opacity:.3;margin-bottom:.5rem;display:block;margin-inline:auto;
      }

      .dm-cmd-footer {
        padding:.5rem 1rem;border-top:1px solid var(--border);
        display:flex;gap:.75rem;justify-content:flex-end;
        font-size:.7rem;color:var(--text-muted);
      }
      .dm-cmd-footer kbd {
        background:var(--surface-2);border:1px solid var(--border);
        padding:.1rem .35rem;border-radius:4px;
        font-family:ui-monospace,monospace;font-size:.65rem;
        margin-inline-end:.2rem;
      }

      /* Topbar button */
      .dm-cmd-trigger {
        display:none;
        align-items:center;gap:.4rem;
        padding:.45rem .75rem;border-radius:8px;
        background:var(--surface-2);
        border:1px solid var(--border);
        color:var(--text-muted);font-size:.75rem;
        cursor:pointer;font-family:inherit;
        transition:all .15s;
      }
      .dm-cmd-trigger:hover {
        color:var(--text);
        border-color:var(--primary);
      }
      @media (min-width:768px) {
        .dm-cmd-trigger { display:flex; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ---------- state ---------- */
  let isOpen = false;
  let activeIndex = 0;
  let currentResults = [];

  /* ---------- build searchable index ---------- */
  function buildIndex() {
    const items = [];

    // Pages
    if (typeof NAV_ITEMS !== 'undefined') {
      NAV_ITEMS.forEach(group => {
        (group.items || []).forEach(item => {
          if (item.id === 'counters') return; // skip counters
          items.push({
            section: 'pages',
            title: (I18N[State.lang] && I18N[State.lang][item.label]) || item.label,
            sub: group.section,
            icon: item.icon,
            action: () => { if (typeof navigate === 'function') navigate(item.id); },
            keywords: [item.id, item.label, group.section].join(' ').toLowerCase()
          });
        });
      });
    }

    // Employees
    (State.data.employees || []).forEach(e => {
      items.push({
        section: 'employees',
        title: e.name,
        sub: `${e.role} · ${e.code || ''}`,
        icon: 'user',
        action: () => { if (typeof viewEmployee === 'function') viewEmployee(e.id); },
        keywords: [e.name, e.role, e.code, e.phone].filter(Boolean).join(' ').toLowerCase()
      });
    });

    // Clients
    (State.data.clients || []).forEach(c => {
      items.push({
        section: 'clients',
        title: c.name,
        sub: c.phone || c.email || '',
        icon: 'user-circle',
        action: () => { if (typeof editClient === 'function') editClient(c.id); },
        keywords: [c.name, c.phone, c.email].filter(Boolean).join(' ').toLowerCase()
      });
    });

    // Halls
    (State.data.halls || []).forEach(h => {
      items.push({
        section: 'halls',
        title: h.name[State.lang] || h.name.ar,
        sub: h.type || '',
        icon: 'building-2',
        action: () => { if (typeof editHall === 'function') editHall(h.id); },
        keywords: [h.name.ar, h.name.en, h.code, h.type].filter(Boolean).join(' ').toLowerCase()
      });
    });

    // Equipment
    (State.data.equipment || []).forEach(eq => {
      items.push({
        section: 'equipment',
        title: eq.name,
        sub: `${eq.category} · ${eq.code}`,
        icon: 'camera',
        action: () => { if (typeof editEquipment === 'function') editEquipment(eq.id); },
        keywords: [eq.name, eq.category, eq.code, eq.serial].filter(Boolean).join(' ').toLowerCase()
      });
    });

    // Recent bookings (last 20)
    [...(State.data.bookings || [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .forEach(b => {
        items.push({
          section: 'bookings',
          title: b.clientName || b.id,
          sub: `${b.date} · ${hallName(b.hallId)}`,
          icon: 'calendar-check',
          action: () => { if (typeof editBooking === 'function') editBooking(b.id); },
          keywords: [b.clientName, b.id, b.date, b.phone].filter(Boolean).join(' ').toLowerCase()
        });
      });

    // Actions
    items.push({
      section: 'actions',
      title: State.lang === 'ar' ? 'إضافة موظف جديد' : 'Add new employee',
      sub: '+ N',
      icon: 'user-plus',
      action: () => { if (typeof editEmployee === 'function') editEmployee(); },
      keywords: 'add employee new create إضافة موظف جديد'
    });
    items.push({
      section: 'actions',
      title: State.lang === 'ar' ? 'إضافة حجز جديد' : 'Add new booking',
      sub: '',
      icon: 'calendar-plus',
      action: () => { if (typeof editBooking === 'function') editBooking(); },
      keywords: 'add booking new create إضافة حجز جديد'
    });
    items.push({
      section: 'actions',
      title: State.lang === 'ar' ? 'التوزيع التلقائي' : 'Auto distribute staff',
      sub: '',
      icon: 'wand-2',
      action: () => {
        if (typeof navigate === 'function') navigate('distribution');
        setTimeout(() => { if (typeof autoDistribute === 'function') autoDistribute(); }, 400);
      },
      keywords: 'auto distribute توزيع تلقائي'
    });
    items.push({
      section: 'actions',
      title: State.lang === 'ar' ? 'تبديل الوضع الليلي' : 'Toggle dark mode',
      sub: '',
      icon: 'moon',
      action: () => {
        State.theme = State.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, State.theme); } catch (e) {}
        if (typeof applyTheme === 'function') applyTheme();
        if (typeof navigate === 'function') navigate(State.page);
      },
      keywords: 'theme dark light mode تبديل الوضع الليلي'
    });
    items.push({
      section: 'actions',
      title: State.lang === 'ar' ? 'تبديل اللغة' : 'Switch language',
      sub: State.lang === 'ar' ? 'English' : 'العربية',
      icon: 'languages',
      action: () => {
        State.lang = State.lang === 'ar' ? 'en' : 'ar';
        try { localStorage.setItem(LANG_KEY, State.lang); } catch (e) {}
        if (typeof applyLang === 'function') applyLang();
        if (typeof renderSidebar === 'function') renderSidebar();
        if (typeof navigate === 'function') navigate(State.page);
      },
      keywords: 'language lang arabic english تبديل اللغة'
    });

    return items;
  }

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  /* ---------- search ---------- */
  function search(query, index) {
    if (!query) {
      // Return popular items
      return index.filter(i => i.section === 'pages' || i.section === 'actions').slice(0, 12);
    }
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

  /* ---------- render ---------- */
  function render(query) {
    const index = buildIndex();
    const results = search(query, index);
    currentResults = results;
    activeIndex = 0;

    const resultsEl = document.getElementById('dm-cmd-results');
    if (!resultsEl) return;

    if (!results.length) {
      resultsEl.innerHTML = `
        <div class="dm-cmd-empty">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <div>${I18N[State.lang].cmd_no_results}</div>
        </div>`;
      return;
    }

    // Group by section
    const groups = {};
    results.forEach(r => {
      groups[r.section] = groups[r.section] || [];
      groups[r.section].push(r);
    });

    let html = '';
    let globalIdx = 0;
    Object.keys(groups).forEach(section => {
      const sectionLabel = I18N[State.lang]['cmd_' + section] || section;
      html += `<div class="dm-cmd-section">${sectionLabel}</div>`;
      groups[section].forEach(item => {
        const idx = globalIdx++;
        html += `
          <div class="dm-cmd-item ${idx === 0 ? 'active' : ''}" data-index="${idx}">
            <div class="dm-cmd-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" data-lucide="${item.icon}"><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <div class="dm-cmd-body">
              <div class="dm-cmd-title">${escapeHtml(item.title)}</div>
              ${item.sub ? `<div class="dm-cmd-sub">${escapeHtml(item.sub)}</div>` : ''}
            </div>
            <div class="dm-cmd-hint">↵</div>
          </div>
        `;
      });
    });

    resultsEl.innerHTML = html;

    // Re-render lucide icons
    if (window.lucide) {
      try { window.lucide.createIcons(); } catch (e) {}
    }

    // Attach handlers
    resultsEl.querySelectorAll('.dm-cmd-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = +el.dataset.index;
        selectResult(idx);
      });
      el.addEventListener('mouseenter', () => {
        activeIndex = +el.dataset.index;
        updateActive();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function updateActive() {
    const items = document.querySelectorAll('.dm-cmd-item');
    items.forEach((el, i) => {
      if (+el.dataset.index === activeIndex) {
        el.classList.add('active');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  function selectResult(idx) {
    const item = currentResults[idx];
    if (!item) return;
    close();
    setTimeout(() => {
      try { item.action(); } catch (e) { console.error('[Section 3] action failed', e); }
    }, 80);
  }

  /* ---------- open / close ---------- */
  function open() {
    if (isOpen) return;
    isOpen = true;

    const backdrop = document.createElement('div');
    backdrop.className = 'dm-cmd-backdrop';
    backdrop.id = 'dm-cmd-backdrop';
    backdrop.innerHTML = `
      <div class="dm-cmd-box" onclick="event.stopPropagation()">
        <div class="dm-cmd-input-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" class="dm-cmd-input" id="dm-cmd-input" placeholder="${I18N[State.lang].cmd_placeholder}" autocomplete="off" spellcheck="false">
          <span class="dm-cmd-kbd">ESC</span>
        </div>
        <div class="dm-cmd-results" id="dm-cmd-results"></div>
        <div class="dm-cmd-footer">
          <span><kbd>↑↓</kbd>Navigate</span>
          <span><kbd>↵</kbd>Select</span>
          <span><kbd>ESC</kbd>Close</span>
        </div>
      </div>
    `;
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectResult(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  /* ---------- global keyboard shortcut ---------- */
  document.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K';
    const cmd = e.metaKey || e.ctrlKey;
    if (isK && cmd) {
      e.preventDefault();
      if (isOpen) close();
      else open();
    }
    // Also support: / alone (when not typing)
    if (e.key === '/' && !isOpen) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
      if (!isInput) {
        e.preventDefault();
        open();
      }
    }
  });

  /* ---------- trigger button in topbar ---------- */
  function injectTrigger() {
    if (document.getElementById('dm-cmd-trigger')) return;
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    const btn = document.createElement('button');
    btn.className = 'dm-cmd-trigger';
    btn.id = 'dm-cmd-trigger';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <span>Search…</span>
      <span class="dm-cmd-kbd">⌘K</span>
    `;
    btn.onclick = open;

    const searchBox = topbar.querySelector('.search-box');
    if (searchBox) {
      searchBox.parentNode.insertBefore(btn, searchBox);
      // Hide the old search box
      searchBox.style.display = 'none';
    } else {
      topbar.appendChild(btn);
    }
  }

  /* ---------- boot ---------- */
  waitFor(
    () => typeof State !== 'undefined'
        && typeof NAV_ITEMS !== 'undefined'
        && typeof navigate === 'function'
        && document.getElementById('topbar'),
    function () {
      patchI18n();
      injectStyles();
      injectTrigger();
      console.log('%c[Section 3] ✓ Command Palette ready — press Ctrl+K', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 4: WhatsApp Integration (Click-to-Chat)
   Added: v3.3.0
   Purpose: Send WhatsApp messages to employees with templates
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 4] WhatsApp Integration loading…', 'color:#25d366;font-weight:bold');

  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 100;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (cond()) { clearInterval(t); cb(); }
      else if (tries >= maxTries) { clearInterval(t); console.warn('[Section 4] timeout'); }
    }, 100);
  }

  /* ---------- i18n ---------- */
  function patchI18n() {
    if (typeof I18N === 'undefined') return;
    Object.assign(I18N.ar, {
      whatsapp: 'واتساب',
      whatsapp_send: 'إرسال واتساب',
      whatsapp_templates: 'قوالب الرسائل',
      whatsapp_choose: 'اختر القالب',
      whatsapp_preview: 'معاينة الرسالة',
      whatsapp_send_btn: 'فتح واتساب',
      whatsapp_no_phone: 'الموظف ليس له رقم هاتف مسجل',
      tpl_assignment: 'تعيين في قاعة',
      tpl_reminder: 'تذكير بموعد',
      tpl_payslip: 'كشف مرتب',
      tpl_custom: 'رسالة مخصصة',
      whatsapp_settings: 'إعدادات واتساب',
      whatsapp_default_country: 'كود الدولة الافتراضي',
      whatsapp_signature: 'التوقيع'
    });
    Object.assign(I18N.en, {
      whatsapp: 'WhatsApp',
      whatsapp_send: 'Send WhatsApp',
      whatsapp_templates: 'Message Templates',
      whatsapp_choose: 'Choose Template',
      whatsapp_preview: 'Message Preview',
      whatsapp_send_btn: 'Open WhatsApp',
      whatsapp_no_phone: 'Employee has no phone number',
      tpl_assignment: 'Hall Assignment',
      tpl_reminder: 'Appointment Reminder',
      tpl_payslip: 'Pay Slip',
      tpl_custom: 'Custom Message',
      whatsapp_settings: 'WhatsApp Settings',
      whatsapp_default_country: 'Default Country Code',
      whatsapp_signature: 'Signature'
    });
  }

  /* ---------- phone normalizer ---------- */
  function normalizePhone(phone) {
    if (!phone) return null;
    let p = String(phone).replace(/[^\d+]/g, '');
    // Remove leading 00
    if (p.startsWith('00')) p = p.slice(2);
    // If starts with 0 (local), replace with default country
    const country = (State.data.settings && State.data.settings.whatsappCountry) || '20';
    if (p.startsWith('0')) p = country + p.slice(1);
    if (p.startsWith('+')) p = p.slice(1);
    return p;
  }

  /* ---------- templates ---------- */
  function buildTemplates(ctx) {
    const sig = (State.data.settings && State.data.settings.whatsappSignature) || 'Dr Media Pro';
    const company = (State.data.settings && State.data.settings.companyName) || 'Dr Media Pro';

    return {
      tpl_assignment: {
        label: I18N[State.lang].tpl_assignment,
        build: () => {
          const name = ctx.empName || 'زميلنا';
          const hall = ctx.hallName || 'القاعة';
          const role = ctx.role || 'موظف';
          const date = ctx.date || '';
          const time = ctx.time || '';
          if (State.lang === 'ar') {
            return `مرحبًا ${name}،\nتم توزيعك يوم ${date} على ${hall}.\nالوظيفة: ${role}\n${time ? 'وقت العمل: ' + time + '\n' : ''}\nشكرًا لك,\n${sig}`;
          }
          return `Hi ${name},\nYou are assigned on ${date} at ${hall}.\nRole: ${role}\n${time ? 'Time: ' + time + '\n' : ''}\nThanks,\n${sig}`;
        }
      },
      tpl_reminder: {
        label: I18N[State.lang].tpl_reminder,
        build: () => {
          const name = ctx.empName || 'زميلنا';
          if (State.lang === 'ar') {
            return `مرحبًا ${name}،\nتذكير بموعدك غدًا في ${ctx.hallName || 'القاعة'} الساعة ${ctx.time || '7:00 PM'}.\n\n${sig}`;
          }
          return `Hi ${name},\nReminder: you have an appointment tomorrow at ${ctx.hallName || 'the hall'} at ${ctx.time || '7:00 PM'}.\n\n${sig}`;
        }
      },
      tpl_payslip: {
        label: I18N[State.lang].tpl_payslip,
        build: () => {
          const name = ctx.empName || 'زميلنا';
          const amount = ctx.amount || '0';
          if (State.lang === 'ar') {
            return `مرحبًا ${name}،\nتم إصدار كشف مرتبك.\nالصافي: EGP ${amount}\n\n${sig}`;
          }
          return `Hi ${name},\nYour pay slip is ready.\nNet: EGP ${amount}\n\n${sig}`;
        }
      },
      tpl_custom: {
        label: I18N[State.lang].tpl_custom,
        build: () => '',
        custom: true
      }
    };
  }

  /* ---------- open WhatsApp ---------- */
  function openWhatsApp(phone, message) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      if (typeof showToast === 'function') {
        showToast(I18N[State.lang].whatsapp_no_phone, 'error');
      } else {
        alert('No phone number');
      }
      return false;
    }
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  /* ---------- main modal ---------- */
  function showModal(ctx) {
    // Build templates
    const templates = buildTemplates(ctx);

    // Modal HTML
    const modalHtml = `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="field">
          <label>${I18N[State.lang].whatsapp_choose}</label>
          <select id="wa-tpl" style="width:100%;padding:.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
            ${Object.keys(templates).map(k => `<option value="${k}">${templates[k].label}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>${I18N[State.lang].whatsapp_preview}</label>
          <textarea id="wa-msg" rows="8" style="width:100%;padding:.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit;resize:vertical;font-size:.85rem;line-height:1.5"></textarea>
        </div>

        <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:var(--text-muted)">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span id="wa-phone">${ctx.phone || '—'}</span>
        </div>
      </div>
    `;

    // Open modal using existing system
    if (typeof openModal === 'function') {
      openModal({
        title: `💬 ${I18N[State.lang].whatsapp} — ${ctx.empName || ''}`,
        size: 'lg',
        body: modalHtml,
        footer: `
          <button class="btn btn-ghost" onclick="closeModal()">${I18N[State.lang].cancel || 'Cancel'}</button>
          <button class="btn btn-success" id="wa-send-btn" style="background:#25d366">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:inline;vertical-align:-2px"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            ${I18N[State.lang].whatsapp_send_btn}
          </button>
        `
      });
    } else {
      alert('Modal system not available');
      return;
    }

    // Fill initial template
    const sel = document.getElementById('wa-tpl');
    const ta = document.getElementById('wa-msg');

    function applyTemplate() {
      const key = sel.value;
      const tpl = templates[key];
      if (tpl && !tpl.custom) {
        ta.value = tpl.build();
      } else {
        ta.value = '';
        ta.focus();
      }
    }

    sel.addEventListener('change', applyTemplate);
    applyTemplate();

    // Send handler
    const sendBtn = document.getElementById('wa-send-btn');
    sendBtn.onclick = () => {
      const message = ta.value.trim();
      if (!message) {
        if (typeof showToast === 'function') showToast('الرسالة فارغة', 'warn');
        return;
      }
      openWhatsApp(ctx.phone, message);
      if (typeof showToast === 'function') {
        showToast(State.lang === 'ar' ? 'تم فتح واتساب' : 'WhatsApp opened', 'success');
      }
      // Log activity
      try {
        if (typeof logActivity === 'function') {
          logActivity('whatsapp-send', 'employee', ctx.employeeId, null, { template: sel.value });
        }
      } catch (e) {}
      if (typeof closeModal === 'function') closeModal();
    };
  }

  /* ---------- public API ---------- */
  window.whatsappEmployee = function (employeeId, extraContext) {
    const emp = State.data.employees.find(e => e.id === employeeId);
    if (!emp) return;
    const ctx = Object.assign({
      employeeId: emp.id,
      empName: emp.name,
      phone: emp.phone
    }, extraContext || {});
    showModal(ctx);
  };

  window.whatsappByContext = function (ctx) {
    showModal(ctx || {});
  };

  /* ---------- wrap Pages to inject buttons ---------- */
  function wrapPages() {
    if (typeof Pages === 'undefined') return;

    // Wrap distribution page
    if (Pages.distribution) {
      const origDist = Pages.distribution;
      Pages.distribution = function (el) {
        origDist.apply(this, arguments);
        // Inject WhatsApp button next to each employee chip
        setTimeout(() => injectDistributionButtons(), 100);
      };
    }

    // Wrap employees page — add WhatsApp button per row
    if (Pages.employees) {
      const origEmp = Pages.employees;
      Pages.employees = function (el) {
        origEmp.apply(this, arguments);
        setTimeout(() => injectEmployeesButtons(), 100);
      };
    }
  }

  function injectDistributionButtons() {
    // Find all emp-chips and add WhatsApp button
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
          hallName: hallName(dist.hallId),
          role: dist.role,
          date: dist.date,
          time: booking ? (booking.startTime + ' - ' + booking.endTime) : ''
        });
      };
      chip.appendChild(btn);
    });
  }

  function injectEmployeesButtons() {
    // Add WhatsApp button in actions cell of each row
    const tables = document.querySelectorAll('.data-table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const actionCell = row.querySelector('td:last-child');
        if (!actionCell) return;
        if (actionCell.querySelector('.wa-btn')) return;

        // Find employee ID from the row's buttons (they call editEmployee('empId'))
        const btn = row.querySelector('button[onclick*="editEmployee"]');
        if (!btn) return;
        const match = btn.getAttribute('onclick').match(/editEmployee\('([^']+)'\)/);
        if (!match) return;
        const empId = match[1];

        const waBtn = document.createElement('button');
        waBtn.className = 'btn btn-ghost btn-icon btn-sm wa-btn';
        waBtn.title = 'WhatsApp';
        waBtn.style.color = '#25d366';
        waBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        waBtn.onclick = (e) => {
          e.stopPropagation();
          whatsappEmployee(empId);
        };

        // Insert before the action buttons group
        const actionsDiv = actionCell.querySelector('div');
        if (actionsDiv) actionsDiv.appendChild(waBtn);
        else actionCell.appendChild(waBtn);
      });
    });
  }

  function hallName(id) {
    const h = State.data.halls.find(x => x.id === id);
    return h ? (h.name[State.lang] || h.name.ar) : '-';
  }

  /* ---------- settings section ---------- */
  function ensureSettings() {
    if (!State.data.settings) State.data.settings = {};
    if (!State.data.settings.whatsappCountry) State.data.settings.whatsappCountry = '20';
    if (!State.data.settings.whatsappSignature) State.data.settings.whatsappSignature = 'Dr Media Pro';
  }

  /* ---------- boot ---------- */
  waitFor(
    () => typeof State !== 'undefined'
        && typeof Pages !== 'undefined'
        && typeof openModal === 'function'
        && typeof navigate === 'function',
    function () {
      patchI18n();
      ensureSettings();
      wrapPages();

      // Also expose a topbar quick action
      const topbar = document.getElementById('topbar');
      if (topbar && !document.getElementById('dm-wa-quick')) {
        // Add a WhatsApp quick-pick button (opens employee chooser)
        const quickBtn = document.createElement('button');
        quickBtn.className = 'topbar-btn';
        quickBtn.id = 'dm-wa-quick';
        quickBtn.title = 'WhatsApp — Send message';
        quickBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#25d366" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        quickBtn.onclick = () => {
          // Choose employee
          openModal({
            title: `💬 ${I18N[State.lang].whatsapp}`,
            body: `
              <div class="field">
                <label>${I18N[State.lang].employees}</label>
                <select id="wa-pick-emp" style="width:100%;padding:.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
                  <option value="">—</option>
                  ${State.data.employees.map(e => `<option value="${e.id}">${e.name} (${e.phone || '—'})</option>`).join('')}
                </select>
              </div>
            `,
            footer: `
              <button class="btn btn-ghost" onclick="closeModal()">${I18N[State.lang].cancel || 'Cancel'}</button>
              <button class="btn btn-success" id="wa-pick-go" style="background:#25d366">${I18N[State.lang].whatsapp_send_btn}</button>
            `
          });
          document.getElementById('wa-pick-go').onclick = () => {
            const empId = document.getElementById('wa-pick-emp').value;
            if (!empId) return;
            if (typeof closeModal === 'function') closeModal();
            setTimeout(() => whatsappEmployee(empId), 200);
          };
        };

        const notifBtn = document.getElementById('notif-btn');
        if (notifBtn && notifBtn.parentNode) {
          notifBtn.parentNode.insertBefore(quickBtn, notifBtn);
        } else {
          topbar.appendChild(quickBtn);
        }
      }

      console.log('%c[Section 4] ✓ WhatsApp Integration ready', 'color:#25d366;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 2 (v2): Realtime Live Sync — FIXED
   Version: 3.1.1
   Fix: Uses unique TAB_ID per browser tab instead of username
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 2 v2] Realtime Live Sync loading…', 'color:#7c3aed;font-weight:bold');

  /* ---------- kill old Section 2 listener ---------- */
  if (window.DrMediaSync && typeof window.DrMediaSync.unsub === 'function') {
    try {
      window.DrMediaSync.unsub();
      window.DrMediaSync.active = false;
      console.log('[Section 2 v2] Killed old Section 2 listener');
    } catch (e) {}
  }

  /* ---------- unique tab identifier ---------- */
  const TAB_ID = 'tab_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
  console.log('[Section 2 v2] My TAB_ID:', TAB_ID);

  /* ---------- wait helper ---------- */
  function waitFor(cond, cb, maxTries) {
    maxTries = maxTries || 100;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (cond()) { clearInterval(t); cb(); }
      else if (tries >= maxTries) { clearInterval(t); console.warn('[Section 2 v2] timeout'); }
    }, 100);
  }

  /* ---------- sync state ---------- */
  const Sync = {
    active: false,
    unsub: null,
    lastSyncAt: null,
    updatesReceived: 0,
    writesSent: 0,
    applyingRemote: false,
    pushTimer: null
  };
  window.DrMediaSync = Sync;

  /* ---------- i18n ---------- */
  function patchI18n() {
    if (typeof I18N === 'undefined') return;
    Object.assign(I18N.ar, {
      sync_updated: 'تم تحديث البيانات من السحابة'
    });
    Object.assign(I18N.en, {
      sync_updated: 'Data updated from cloud'
    });
  }

  /* ---------- topbar indicator ---------- */
  function injectIndicator() {
    if (document.getElementById('dm-sync-indicator')) return;
    const topbar = document.getElementById('topbar');
    if (!topbar) return;

    const notifBtn = document.getElementById('notif-btn');
    const wrap = document.createElement('div');
    wrap.id = 'dm-sync-indicator';
    wrap.style.cssText = `display:flex;align-items:center;gap:.35rem;padding:.35rem .65rem;border-radius:8px;background:rgba(16,185,129,.1);color:#10b981;font-size:.7rem;font-weight:600;margin-inline-end:.35rem;cursor:pointer;transition:all .2s`;
    wrap.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;animation:dm-pulse 2s infinite"></span><span id="dm-sync-label">Live</span>`;
    wrap.title = 'Realtime Live Sync — Click to toggle';

    if (notifBtn && notifBtn.parentNode) notifBtn.parentNode.insertBefore(wrap, notifBtn);
    else topbar.appendChild(wrap);

    if (!document.getElementById('dm-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'dm-pulse-style';
      s.textContent = `@keyframes dm-pulse {0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(1.2);}}`;
      document.head.appendChild(s);
    }

    wrap.addEventListener('click', () => {
      if (Sync.active) { stopSync(); setIndicatorState('paused'); }
      else { startSync(); setIndicatorState('active'); }
    });
  }

  function setIndicatorState(state) {
    const wrap = document.getElementById('dm-sync-indicator');
    const label = document.getElementById('dm-sync-label');
    if (!wrap || !label) return;
    const dot = wrap.querySelector('span');
    if (state === 'active') {
      wrap.style.background = 'rgba(16,185,129,.1)';
      wrap.style.color = '#10b981';
      label.textContent = 'Live';
      if (dot) dot.style.background = '#10b981';
    } else {
      wrap.style.background = 'rgba(100,116,139,.1)';
      wrap.style.color = '#64748b';
      label.textContent = 'Paused';
      if (dot) dot.style.background = '#64748b';
    }
  }

  function flashIndicator() {
    const wrap = document.getElementById('dm-sync-indicator');
    if (!wrap) return;
    wrap.style.transform = 'scale(1.2)';
    setTimeout(() => { wrap.style.transform = 'scale(1)'; }, 350);
  }

  /* ---------- OVERRIDE saveData completely ---------- */
  function overrideSaveData() {
    window.saveData = function () {
      // 1. Persist locally
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}
      // 2. Don't echo remote data back
      if (Sync.applyingRemote) return;
      // 3. Debounced push
      if (Sync.active && window.DrMediaFB && window.DrMediaFB.ready) {
        clearTimeout(Sync.pushTimer);
        Sync.pushTimer = setTimeout(pushNow, 700);
      }
    };
    console.log('[Section 2 v2] saveData overridden');
  }

  /* ---------- PUSH ---------- */
  function pushNow() {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) return;
    try {
      const { doc, setDoc, serverTimestamp } = window.DrMediaFB.modules.fsMod;
      const ref = doc(window.DrMediaFB.db, 'app_state', 'main');
      setDoc(ref, {
        payload: State.data,
        version: Date.now(),
        updatedBy: TAB_ID,
        updatedByUser: State.user ? State.user.username : null,
        updatedAt: serverTimestamp()
      }).then(() => {
        Sync.writesSent++;
        Sync.lastSyncAt = new Date();
        console.log('[Section 2 v2] → Pushed to cloud');
        if (window.DrMediaCounters) window.DrMediaCounters.trackWrite('app_state', 1);
      }).catch(err => {
        console.warn('[Section 2 v2] Push failed:', err);
      });
    } catch (e) { console.error('[Section 2 v2] pushNow error:', e); }
  }

  /* ---------- LISTENER ---------- */
  function startSync() {
    if (Sync.active) return;
    if (!window.DrMediaFB || !window.DrMediaFB.ready) {
      console.warn('[Section 2 v2] Firebase not ready');
      return;
    }
    try {
      const { doc, onSnapshot } = window.DrMediaFB.modules.fsMod;
      const ref = doc(window.DrMediaFB.db, 'app_state', 'main');

      Sync.unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const remote = snap.data();
        if (!remote || !remote.payload) return;

        // ✅ SKIP ONLY OUR OWN WRITES
        if (remote.updatedBy === TAB_ID) {
          console.log('[Section 2 v2] ← Own write echo — skip');
          return;
        }

        console.log('[Section 2 v2] ← Update from another tab:', {
          from: (remote.updatedBy || '').slice(0, 12),
          user: remote.updatedByUser
        });

        Sync.updatesReceived++;
        Sync.lastSyncAt = new Date();
        Sync.applyingRemote = true;

        const session = State.user;
        State.data = remote.payload;

        if (session && State.data.users) {
          const u = State.data.users.find(x => x.id === session.id);
          if (u) {
            State.user = { id: u.id, username: u.username, name: u.name, role: u.role, employeeId: u.employeeId };
          }
        }

        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}

        if (typeof showToast === 'function') {
          showToast(
            State.lang === 'ar' ? '🔄 تم تحديث البيانات من السحابة' : '🔄 Data updated from cloud',
            'info'
          );
        }
        flashIndicator();

        setTimeout(() => {
          try {
            if (State.page && typeof navigate === 'function') navigate(State.page);
            if (typeof updateNotifBadge === 'function') updateNotifBadge();
          } catch (e) {}
          Sync.applyingRemote = false;
        }, 250);
      }, (err) => {
        console.warn('[Section 2 v2] Snapshot error:', err);
      });

      Sync.active = true;
      console.log('%c[Section 2 v2] ✓ ACTIVE', 'color:#10b981;font-weight:bold');
    } catch (err) {
      console.error('[Section 2 v2] Failed to start:', err);
    }
  }

  function stopSync() {
    if (Sync.unsub) { try { Sync.unsub(); } catch (e) {} Sync.unsub = null; }
    Sync.active = false;
    console.log('[Section 2 v2] Paused');
  }

  /* ---------- hooks ---------- */
  function hookLogout() {
    try {
      const orig = window.logout;
      window.logout = function () { stopSync(); return orig.apply(this, arguments); };
    } catch (e) {}
  }

  function hookLogin() {
    try {
      const orig = window.attemptLogin;
      window.attemptLogin = function (u, p) {
        const ok = orig.apply(this, arguments);
        if (ok) setTimeout(() => { startSync(); setIndicatorState('active'); }, 500);
        return ok;
      };
    } catch (e) {}
  }

  /* ---------- boot ---------- */
  waitFor(
    () => typeof window.DrMediaFB !== 'undefined' && window.DrMediaFB.ready
        && typeof State !== 'undefined' && typeof navigate === 'function',
    function () {
      patchI18n();
      injectIndicator();
      hookLogout();
      hookLogin();
      overrideSaveData();

      if (State.user) { startSync(); setIndicatorState('active'); }
      else setIndicatorState('paused');

      console.log('%c[Section 2 v2] ✓ Initialized', 'color:#10b981;font-weight:bold');
    }
  );

})();
/* =========================================================
   SECTION 2 (v4): Realtime Live Sync — FINAL
   Version: 4.0.0
   - Waits 2s after boot, then FORCE-overrides saveData
   - Exposes __dmTestSync() for manual testing
   - Verbose logging with clear markers
   ========================================================= */
(function () {
  'use strict';

  console.log('%c[Section 2 v4] Loading…', 'color:#7c3aed;font-weight:bold;font-size:14px');

  // Kill old listeners
  if (window.DrMediaSync && window.DrMediaSync.unsub) {
    try { window.DrMediaSync.unsub(); } catch (e) {}
  }

  const TAB_ID = 'tab_' + Math.random().toString(36).slice(2, 8);
  window.__DM_TAB_ID = TAB_ID;
  console.log('%c[Section 2 v4] This tab ID: ' + TAB_ID, 'color:#06b6d4;font-weight:bold');

  const Sync = {
    active: false,
    unsub: null,
    updatesReceived: 0,
    writesSent: 0,
    pushTimer: null,
    applyingRemote: false,
    tabId: TAB_ID
  };
  window.DrMediaSync = Sync;

  function waitFor(cond, cb) {
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > 200) { clearInterval(t); console.warn('[Section 2 v4] wait timeout'); return; }
      if (cond()) { clearInterval(t); cb(); }
    }, 100);
  }

  /* ============= PUSH ============= */
  function pushToCloud(reason) {
    console.log('[Section 2 v4] 📤 pushToCloud() — reason:', reason || 'auto');
    if (!window.DrMediaFB || !window.DrMediaFB.ready) {
      console.warn('[Section 2 v4] Firebase not ready — skip push');
      return;
    }

    const { doc, setDoc, serverTimestamp } = window.DrMediaFB.modules.fsMod;
    const ref = doc(window.DrMediaFB.db, 'app_state', 'main');

    const data = {
      payload: State.data,
      updatedBy: TAB_ID,
      updatedByUser: (State.user && State.user.username) || 'anon',
      updatedAt: serverTimestamp(),
      version: Date.now()
    };

    setDoc(ref, data)
      .then(() => {
        Sync.writesSent++;
        console.log('%c[Section 2 v4] ✓ WRITE SUCCESS — total: ' + Sync.writesSent, 'color:#10b981;font-weight:bold');
        if (typeof showToast === 'function') showToast('✓ Synced (' + TAB_ID + ')', 'success');
      })
      .catch(err => {
        console.error('[Section 2 v4] ✗ WRITE FAILED:', err.code, err.message);
        if (typeof showToast === 'function') showToast('Write failed: ' + err.code, 'error');
      });
  }

  /* ============= LISTENER ============= */
  function startListener() {
    if (!window.DrMediaFB || !window.DrMediaFB.ready) return;
    const { doc, onSnapshot } = window.DrMediaFB.modules.fsMod;
    const ref = doc(window.DrMediaFB.db, 'app_state', 'main');

    Sync.unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        console.log('[Section 2 v4] 📭 No doc yet');
        return;
      }
      const remote = snap.data();
      if (!remote) return;

      const isMine = remote.updatedBy === TAB_ID;
      console.log('[Section 2 v4] 👁 Snapshot: from=' + remote.updatedBy + ' mine=' + isMine);

      if (isMine) return; // skip own echo
      if (!remote.payload) return;

      Sync.updatesReceived++;
      Sync.applyingRemote = true;

      const session = State.user;
      State.data = remote.payload;
      if (session && State.data.users) {
        const u = State.data.users.find(x => x.id === session.id);
        if (u) State.user = { id: u.id, username: u.username, name: u.name, role: u.role, employeeId: u.employeeId };
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}

      console.log('%c[Section 2 v4] ✓ APPLIED remote update #' + Sync.updatesReceived, 'color:#10b981;font-weight:bold');
      if (typeof showToast === 'function') {
        showToast('🔄 ' + (State.lang === 'ar' ? 'تحديث من السحابة' : 'Update from cloud'), 'info');
      }

      setTimeout(() => {
        try {
          if (State.page && typeof navigate === 'function') navigate(State.page);
          if (typeof updateNotifBadge === 'function') updateNotifBadge();
        } catch (e) {}
        Sync.applyingRemote = false;
      }, 300);
    }, (err) => {
      console.error('[Section 2 v4] listener error:', err);
    });

    Sync.active = true;
    console.log('%c[Section 2 v4] ✓ Listener active', 'color:#10b981');
  }

  /* ============= BOOT ============= */
  waitFor(
    () => window.DrMediaFB && window.DrMediaFB.ready
        && typeof State !== 'undefined'
        && typeof saveData === 'function',
    function () {
      // Wait 2s so all other sections finish loading first
      setTimeout(function () {
        const PREVIOUS = window.saveData;

        window.saveData = function () {
          const r = PREVIOUS.apply(this, arguments);

          // Skip if we're just applying remote data
          if (Sync.applyingRemote) return r;

          // Skip if no user
          if (!State.user) return r;

          // Debounced push
          clearTimeout(Sync.pushTimer);
          Sync.pushTimer = setTimeout(function () {
            pushToCloud('saveData hook');
          }, 500);

          return r;
        };

        console.log('%c[Section 2 v4] ✓ saveData hook INSTALLED (final)', 'color:#10b981;font-weight:bold');

        // Expose manual test
        window.__dmTestSync = function () {
          console.log('=== MANUAL SYNC TEST ===');
          console.log('TAB_ID:', TAB_ID);
          console.log('User:', State.user && State.user.username);
          console.log('FB ready:', window.DrMediaFB && window.DrMediaFB.ready);
          pushToCloud('manual test');
        };

        window.__dmSyncStatus = function () {
          console.log({
            tabId: TAB_ID,
            syncActive: Sync.active,
            writesSent: Sync.writesSent,
            updatesReceived: Sync.updatesReceived,
            firebaseReady: window.DrMediaFB && window.DrMediaFB.ready
          });
        };
      }, 2000);

      // Start listener
      if (State.user) {
        startListener();
        console.log('[Section 2 v4] Session found — listener started');
      } else {
        console.log('[Section 2 v4] No session yet — will start on login');
      }

      // Hook login to start listener
      const origLogin = window.attemptLogin;
      window.attemptLogin = function () {
        const ok = origLogin.apply(this, arguments);
        if (ok) setTimeout(function () {
          if (!Sync.active) startListener();
        }, 400);
        return ok;
      };

      console.log('%c[Section 2 v4] ✓ Ready. Run __dmTestSync() to test manually.', 'color:#10b981;font-weight:bold;font-size:13px');
    }
  );

})();
