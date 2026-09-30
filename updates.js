/* =========================================================
   Dr Media Pro — UPDATE PACK
   File: update.js
   Version: 2.0.0
   Feature: Firebase Real Integration + Counters Tab
   =========================================================
   ⚠️ DO NOT EDIT index.html — All features live here.
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     CONFIG — Your Firebase project
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
  const FIRESTORE_MAIN_DOC = 'app_state/main';

  /* =========================================================
     STATE FLAGS
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
    lastSyncDir: null, // 'push' | 'pull' | null
    listeners: []
  };

  window.Firebase = FB; // expose for debugging

  /* =========================================================
     WAIT FOR CORE APP
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
          typeof saveData === 'function'
        ) {
          clearInterval(t);
          cb();
        }
      } catch (e) {}
      if (tries > 40) clearInterval(t);
    }, 100);
  }

  /* =========================================================
     DYNAMIC SCRIPT LOADER
     ========================================================= */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.type = 'module';
      s.textContent = `import * as M from '${src}'; window.__dm_mod_${Math.random().toString(36).slice(2)} = M;`;
      // Simpler: use <script type="module" src> with importmap via blob
      // Instead we use dynamic import() from global scope below
      resolve();
    });
  }

  // Use dynamic import() directly — works in all modern browsers
  async function loadFirebaseModules() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
    const [appMod, authMod, fsMod, rtdbMod, storageMod] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
      import(`${base}/firebase-database.js`),
      import(`${base}/firebase-storage.js`)
    ]);
    // Analytics is optional
    let analyticsMod = null;
    try {
      analyticsMod = await import(`${base}/firebase-analytics.js`);
    } catch (e) {
      console.warn('[Firebase] Analytics not loaded', e);
    }
    return { appMod, authMod, fsMod, rtdbMod, storageMod, analyticsMod };
  }

  /* =========================================================
     BOOTSTRAP FIREBASE
     ========================================================= */
  async function bootstrapFirebase() {
    try {
      FB.status = 'initializing';
      const mods = await loadFirebaseModules();
      FB.modules = mods;

      // Initialize app
      FB.app = mods.appMod.initializeApp(FIREBASE_CONFIG);
      FB.auth = mods.authMod.getAuth(FB.app);
      FB.db = mods.fsMod.getFirestore(FB.app);
      FB.rtdb = mods.rtdbMod.getDatabase(FB.app);
      FB.storage = mods.storageMod.getStorage(FB.app);

      // Analytics (optional, may fail if blocked)
      try {
        if (mods.analyticsMod && typeof mods.analyticsMod.isSupported === 'function') {
          const ok = await mods.analyticsMod.isSupported();
          if (ok) FB.analytics = mods.analyticsMod.getAnalytics(FB.app);
        }
      } catch (e) {}

      FB.ready = true;
      FB.status = 'online';
      console.log('%c[Firebase] ✓ Initialized', 'color:#f59e0b;font-weight:bold', {
        projectId: FIREBASE_CONFIG.projectId,
        authDomain: FIREBASE_CONFIG.authDomain
      });
      return true;
    } catch (err) {
      FB.status = 'error';
      console.error('[Firebase] Init failed:', err);
      return false;
    }
  }

  /* =========================================================
     FIRESTORE SYNC
     ========================================================= */
  async function fsReadMainDoc() {
    if (!FB.ready) return null;
    const { doc, getDoc } = FB.modules.fsMod;
    try {
      const snap = await getDoc(doc(FB.db, 'app_state', 'main'));
      window.DrMediaCounters && window.DrMediaCounters.trackRead('app_state', 1);
      if (snap.exists()) return snap.data();
      return null;
    } catch (err) {
      console.warn('[Firestore] Read failed:', err);
      return null;
    }
  }

  async function fsWriteMainDoc(data) {
    if (!FB.ready) return false;
    const { doc, setDoc, serverTimestamp } = FB.modules.fsMod;
    try {
      await setDoc(
        doc(FB.db, 'app_state', 'main'),
        {
          payload: data,
          updatedAt: serverTimestamp(),
          updatedBy: (State.user && State.user.username) || 'system'
        },
        { merge: false }
      );
      window.DrMediaCounters && window.DrMediaCounters.trackWrite('app_state', 1);
      return true;
    } catch (err) {
      console.warn('[Firestore] Write failed:', err);
      return false;
    }
  }

  /* =========================================================
     SMART MERGE — localStorage vs Firestore
     ========================================================= */
  function mergeData(localData, remoteData) {
    if (!remoteData || !remoteData.payload) return localData;
    const remote = remoteData.payload;
    // If remote has more items overall, prefer remote
    const countLocal = (localData.bookings || []).length + (localData.employees || []).length;
    const countRemote = (remote.bookings || []).length + (remote.employees || []).length;
    if (countRemote > countLocal) {
      console.log('[Sync] Firestore wins (more data)');
      return remote;
    }
    console.log('[Sync] localStorage wins (or equal)');
    return localData;
  }

  /* =========================================================
     PUSH LOCAL → FIRESTORE (debounced)
     ========================================================= */
  let pushTimer = null;
  function schedulePush() {
    if (!FB.ready) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      const ok = await fsWriteMainDoc(State.data);
      if (ok) {
        FB.lastSyncAt = new Date();
        FB.lastSyncDir = 'push';
        console.log('[Sync] Pushed to Firestore');
      }
    }, 1200); // 1.2s debounce
  }

  /* =========================================================
     HYBRID SYNC: PULL ON LOGIN, PUSH ON SAVE
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
        // Push local as authoritative if it's the same or newer
        schedulePush();
      }
      FB.lastSyncAt = new Date();
      FB.lastSyncDir = 'pull';
    } else {
      // First time — push local to Firestore
      schedulePush();
    }
  }

  /* =========================================================
     HOOK saveData() — Auto-push to Firestore
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
    } catch (e) {
      console.warn('[Hook] saveData failed', e);
    }
  }

  /* =========================================================
     HOOK attemptLogin() — Trigger sync after auth
     ========================================================= */
  function hookLogin() {
    try {
      const original = window.attemptLogin;
      window.attemptLogin = function (u, p) {
        const ok = original.apply(this, arguments);
        if (ok) {
          setTimeout(() => syncOnLogin(), 300);
        }
        return ok;
      };
    } catch (e) {}
  }

  /* =========================================================
     HOOK logout() — Clear listeners
     ========================================================= */
  function hookLogout() {
    try {
      const original = window.logout;
      window.logout = function () {
        FB.listeners.forEach((unsub) => { try { unsub(); } catch (e) {} });
        FB.listeners = [];
        return original.apply(this, arguments);
      };
    } catch (e) {}
  }

  /* =========================================================
     FIREBASE COUNTERS ENGINE (Real)
     ========================================================= */
  const COUNTERS_KEY = 'drmedia_firebase_counters_v2';
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
    trackRead: function (coll, n) {
      n = n || 1;
      ensureRollover();
      counters.today.reads += n;
      counters.total.reads += n;
      bumpColl(coll || 'unknown', 'reads', n);
      persistCounters();
    },
    trackWrite: function (coll, n) {
      n = n || 1;
      ensureRollover();
      counters.today.writes += n;
      counters.total.writes += n;
      bumpColl(coll || 'unknown', 'writes', n);
      persistCounters();
    },
    trackDelete: function (coll, n) {
      n = n || 1;
      ensureRollover();
      counters.today.deletes += n;
      counters.total.deletes += n;
      bumpColl(coll || 'unknown', 'deletes', n);
      persistCounters();
    },
    trackPush: function () { counters.syncStats.pushes++; persistCounters(); },
    trackPull: function () { counters.syncStats.pulls++; persistCounters(); },
    trackFail: function () { counters.syncStats.failures++; persistCounters(); },
    get: function () { return counters; },
    reset: function () {
      counters = emptyCounters();
      persistCounters();
    }
  };

  /* =========================================================
     i18n — additional strings
     ========================================================= */
  function patchI18N() {
    Object.assign(I18N.ar, {
      counters: 'عدادات Firebase',
      firebase_counters: 'عدادات Firebase',
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
      operations: 'العمليات',
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
      sync_now: 'مزامنة الآن',
      pull_from_cloud: 'سحب من السحابة',
      push_to_cloud: 'رفع للسحابة',
      sync_stats: 'إحصائيات المزامنة',
      pushes: 'عمليات رفع',
      pulls: 'عمليات سحب',
      failures: 'فشل'
    });
    Object.assign(I18N.en, {
      counters: 'Firebase Counters',
      firebase_counters: 'Firebase Counters',
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
      operations: 'Operations',
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
      sync_now: 'Sync Now',
      pull_from_cloud: 'Pull from Cloud',
      push_to_cloud: 'Push to Cloud',
      sync_stats: 'Sync Stats',
      pushes: 'Pushes',
      pulls: 'Pulls',
      failures: 'Failures'
    });
  }

  /* =========================================================
     THE COUNTERS PAGE
     ========================================================= */
  function registerCountersPage() {
    Pages.counters = function (el) {
      ensureRollover();
      const c = counters;
      const pct = (u, t) => Math.min(100, Math.round((u / t) * 100));
      const colorFor = (p) => (p < 50 ? '#10b981' : p < 80 ? '#f59e0b' : '#ef4444');
      const badgeFor = (p) => (p < 50 ? 'green' : p < 80 ? 'yellow' : 'red');
      const labelFor = (p) => (p < 50 ? t('safe') : p < 80 ? t('near_limit') : t('limit_reached'));

      const readsPct = pct(c.today.reads, QUOTAS.reads);
      const writesPct = pct(c.today.writes, QUOTAS.writes);
      const deletesPct = pct(c.today.deletes, QUOTAS.deletes);

      const dailyCost = c.today.reads * PRICING.read + c.today.writes * PRICING.write + c.today.deletes * PRICING.delete;
      const monthlyCost = dailyCost * 30;

      const statusColor = {
        online: '#10b981',
        offline: '#ef4444',
        initializing: '#f59e0b',
        error: '#ef4444'
      }[FB.status] || '#64748b';

      const statusLabel = {
        online: t('online'),
        offline: t('offline'),
        initializing: t('initializing'),
        error: t('error')
      }[FB.status] || FB.status;

      const quotaCard = (label, used, total, icon, color) => {
        const p = pct(used, total);
        return `
          <div class="stat-card" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.75rem">
              <div class="stat-icon" style="background:${color}20;color:${color};width:40px;height:40px">
                <i data-lucide="${icon}" style="width:18px;height:18px"></i>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:.7rem;color:var(--text-muted)">${label}</div>
                <div style="font-size:1.35rem;font-weight:800;line-height:1">${used.toLocaleString()}</div>
              </div>
              <span class="badge-pill badge-${badgeFor(p)}">${p}%</span>
            </div>
            <div style="height:6px;background:var(--surface-2);border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${p}%;background:${colorFor(p)};border-radius:999px;transition:width .5s ease"></div>
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
            <button class="btn btn-ghost btn-sm" id="ctr-pull"><i data-lucide="cloud-download"></i> ${t('pull_from_cloud')}</button>
            <button class="btn btn-ghost btn-sm" id="ctr-push"><i data-lucide="cloud-upload"></i> ${t('push_to_cloud')}</button>
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
          <div class="card"><div style="font-size:.72rem;color:var(--text-muted)">${t('total_reads')}</div><div style="font-size:1.7rem;font-weight:800;color:#7c3aed;line-height:1.1">${c.total.reads.toLocaleString()}</div></div>
          <div class="card"><div style="font-size:.72rem;color:var(--text-muted)">${t('total_writes')}</div><div style="font-size:1.7rem;font-weight:800;color:#10b981;line-height:1.1">${c.total.writes.toLocaleString()}</div></div>
          <div class="card"><div style="font-size:.72rem;color:var(--text-muted)">${t('total_deletes')}</div><div style="font-size:1.7rem;font-weight:800;color:#ef4444;line-height:1.1">${c.total.deletes.toLocaleString()}</div></div>
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
              <b>${t('last_sync')}:</b> ${FB.lastSyncAt ? FB.lastSyncAt.toLocaleString(State.lang === 'ar' ? 'ar-EG' : 'en-GB') : '—'} 
              ${FB.lastSyncDir ? `(${FB.lastSyncDir === 'push' ? t('pushes') : t('pulls')})` : ''}
            </div>
          </div>
        </div>

        <div class="card">
          <h4 class="section-title" style="margin-top:0"><i data-lucide="layers"></i> ${t('usage_details')} — ${t('collection')}</h4>
          ${
            Object.keys(c.byCollection).length
              ? `<div class="table-wrap">
                  <table class="data-table">
                    <thead><tr><th>${t('collection')}</th><th>${t('reads')}</th><th>${t('writes')}</th><th>${t('deletes')}</th></tr></thead>
                    <tbody>
                      ${Object.entries(c.byCollection)
                        .sort((a, b) => (b[1].reads + b[1].writes) - (a[1].reads + a[1].writes))
                        .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v.reads.toLocaleString()}</td><td>${v.writes.toLocaleString()}</td><td>${v.deletes.toLocaleString()}</td></tr>`)
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : `<div class="empty-state"><i data-lucide="inbox"></i><p>${t('no_data')}</p></div>`
          }
        </div>
      `;

      if (window.lucide) lucide.createIcons();

      // Actions
      el.querySelector('#ctr-refresh').onclick = () => Pages.counters(el);
      el.querySelector('#ctr-reset').onclick = () => {
        if (confirm(t('reset_counters') + '?')) {
          window.DrMediaCounters.reset();
          counters = loadCounters();
          showToast(t('saved'), 'success');
          Pages.counters(el);
        }
      };
      el.querySelector('#ctr-push').onclick = async () => {
        if (!FB.ready) return showToast(t('offline'), 'error');
        const ok = await fsWriteMainDoc(State.data);
        if (ok) {
          window.DrMediaCounters.trackPush();
          FB.lastSyncAt = new Date();
          FB.lastSyncDir = 'push';
          showToast(t('saved'), 'success');
          Pages.counters(el);
        } else {
          window.DrMediaCounters.trackFail();
          showToast('Push failed', 'error');
        }
      };
      el.querySelector('#ctr-pull').onclick = async () => {
        if (!FB.ready) return showToast(t('offline'), 'error');
        const remote = await fsReadMainDoc();
        if (remote && remote.payload) {
          if (confirm('Replace local data with cloud version?')) {
            State.data = remote.payload;
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data)); } catch (e) {}
            window.DrMediaCounters.trackPull();
            FB.lastSyncAt = new Date();
            FB.lastSyncDir = 'pull';
            showToast(t('saved'), 'success');
            navigate(State.page);
          }
        } else {
          showToast('No cloud data found', 'warn');
        }
      };

      // Charts
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

    // Register nav item
    const sys = NAV_ITEMS.find((g) => g.section === 'system');
    if (sys && !sys.items.find((i) => i.id === 'counters')) {
      sys.items.unshift({ id: 'counters', icon: 'gauge', label: 'counters' });
    }
    try { renderSidebar(); } catch (e) {}
  }

  /* =========================================================
     NETWORK STATUS LISTENER
