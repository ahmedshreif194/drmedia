/* =========================================================
   Dr Media Pro — UPDATE PACK
   File: update.js
   Version: 1.0.0
   Feature: Firebase Counters Tab
   =========================================================
   ⚠️ DO NOT EDIT index.html
   All future features are added to this file.
   ========================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     🧠 CORE HOOK — Wait for Dr Media Pro to be ready
     --------------------------------------------------------- */
  function whenAppReady(callback) {
    let attempts = 0;
    const maxAttempts = 40; // 4 seconds max
    const interval = setInterval(() => {
      attempts++;
      // Check that the core app is loaded (global bindings exist)
      try {
        if (
          typeof Pages !== 'undefined' &&
          typeof NAV_ITEMS !== 'undefined' &&
          typeof State !== 'undefined' &&
          typeof I18N !== 'undefined' &&
          typeof navigate === 'function'
        ) {
          clearInterval(interval);
          callback();
        }
      } catch (e) {}
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('[DrMedia Update] Core app not detected. Aborting.');
      }
    }, 100);
  }

  /* ---------------------------------------------------------
     🚀 MAIN UPDATE LOGIC
     --------------------------------------------------------- */
  whenAppReady(function () {
    console.log('%c[DrMedia Pro] update.js loaded — bootstrapping…', 'color:#7c3aed;font-weight:bold');

    /* ========================================================
       1. i18n strings
       ======================================================== */
    Object.assign(I18N.ar, {
      counters: 'عدادات Firebase',
      firebase_counters: 'عدادات Firebase',
      firebase_plan: 'خطة Firebase',
      free_tier: 'Spark (المجانية)',
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
      monthly_cost: 'التكلفة الشهرية (متوقعة)',
      usage_details: 'تفاصيل الاستخدام',
      operations_breakdown: 'توزيع العمليات',
      collection: 'المجموعة',
      operations: 'العمليات',
      daily_usage: 'الاستخدام اليومي',
      reset_counters: 'تصفير العدادات',
      refresh: 'تحديث',
      pricing_note: 'الحسابات بناءً على أسعار Firebase Blaze: $0.06 / 100k قراءة، $0.18 / 100k كتابة.',
      safe: 'آمن',
      near_limit: 'قريب من الحد',
      limit_reached: 'وصل للحد',
      new_feature: 'ميزة جديدة',
      history_days: 'آخر 14 يوم'
    });

    Object.assign(I18N.en, {
      counters: 'Firebase Counters',
      firebase_counters: 'Firebase Counters',
      firebase_plan: 'Firebase Plan',
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
      monthly_cost: 'Monthly Cost (Est.)',
      usage_details: 'Usage Details',
      operations_breakdown: 'Operations Breakdown',
      collection: 'Collection',
      operations: 'Operations',
      daily_usage: 'Daily Usage',
      reset_counters: 'Reset Counters',
      refresh: 'Refresh',
      pricing_note: 'Based on Firebase Blaze pricing: $0.06 / 100k reads, $0.18 / 100k writes.',
      safe: 'Safe',
      near_limit: 'Near Limit',
      limit_reached: 'Limit Reached',
      new_feature: 'New Feature',
      history_days: 'Last 14 days'
    });

    /* ========================================================
       2. Firebase Counters — Storage & Quotas
       ======================================================== */
    const COUNTERS_KEY = 'drmedia_firebase_counters_v1';

    // Firebase Spark (Free) tier daily quotas
    const QUOTAS = {
      reads: 50000,
      writes: 20000,
      deletes: 20000,
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      bandwidthBytes: 1 * 1024 * 1024 * 1024  // 1 GB/day
    };

    // Blaze pricing (per operation)
    const PRICING = {
      read: 0.06 / 100000,   // $0.06 per 100k
      write: 0.18 / 100000,  // $0.18 per 100k
      delete: 0.02 / 100000  // $0.02 per 100k
    };

    function emptyCounters() {
      return {
        today: { date: new Date().toISOString().slice(0, 10), reads: 0, writes: 0, deletes: 0, bandwidth: 0 },
        total: { reads: 0, writes: 0, deletes: 0, bandwidth: 0 },
        storage: 0,
        byCollection: {},
        history: []
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
      try {
        localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
      } catch (e) {}
    }

    let counters = loadCounters();

    function ensureTodayRollover() {
      const today = new Date().toISOString().slice(0, 10);
      if (counters.today.date !== today) {
        // Archive yesterday
        counters.history.push({ ...counters.today });
        if (counters.history.length > 30) counters.history.shift();
        // Reset today
        counters.today = { date: today, reads: 0, writes: 0, deletes: 0, bandwidth: 0 };
        persistCounters();
      }
    }

    function bumpCollection(name, kind, count) {
      counters.byCollection[name] = counters.byCollection[name] || { reads: 0, writes: 0, deletes: 0 };
      counters.byCollection[name][kind] += count;
    }

    // Public API — other modules can call these
    window.DrMediaCounters = {
      trackRead: function (collection, count) {
        count = count || 1;
        ensureTodayRollover();
        counters.today.reads += count;
        counters.total.reads += count;
        bumpCollection(collection || 'unknown', 'reads', count);
        persistCounters();
      },
      trackWrite: function (collection, count) {
        count = count || 1;
        ensureTodayRollover();
        counters.today.writes += count;
        counters.total.writes += count;
        bumpCollection(collection || 'unknown', 'writes', count);
        persistCounters();
      },
      trackDelete: function (collection, count) {
        count = count || 1;
        ensureTodayRollover();
        counters.today.deletes += count;
        counters.total.deletes += count;
        bumpCollection(collection || 'unknown', 'deletes', count);
        persistCounters();
      },
      trackStorage: function (bytes) {
        counters.storage += bytes || 0;
        persistCounters();
      },
      get: function () { return counters; },
      reset: function () {
        counters = emptyCounters();
        persistCounters();
      }
    };

    /* ========================================================
       3. Hook into saveData() — count every write
       ======================================================== */
    try {
      const _origSaveData = saveData;
      // Reassign the global function binding
      // (function declarations are writable on the global scope)
      saveData = function () {
        try {
          ensureTodayRollover();
          counters.today.writes += 1;
          counters.total.writes += 1;
          bumpCollection('State.data', 'writes', 1);
          persistCounters();
        } catch (e) {}
        return _origSaveData.apply(this, arguments);
      };
    } catch (e) {
      console.warn('[DrMedia Update] Failed to hook saveData', e);
    }

    /* ========================================================
       4. Hook into navigate() — count reads per page
       ======================================================== */
    try {
      const _origNavigate = navigate;
      navigate = function (page) {
        try {
          ensureTodayRollover();
          let readCount = 5;
          const d = State.data || {};
          switch (page) {
            case 'dashboard': readCount = 8; break;
            case 'bookings':  readCount = (d.bookings || []).length || 1; break;
            case 'employees': readCount = (d.employees || []).length || 1; break;
            case 'halls':     readCount = (d.halls || []).length || 1; break;
            case 'clients':   readCount = (d.clients || []).length || 1; break;
            case 'equipment': readCount = (d.equipment || []).length || 1; break;
            case 'payroll':   readCount = ((d.employees || []).length * 3) || 3; break;
            case 'distribution': readCount = 20; break;
            case 'attendance':   readCount = (d.employees || []).length || 1; break;
            case 'advances':  readCount = (d.advances || []).length || 1; break;
            case 'deductions': readCount = (d.deductions || []).length || 1; break;
            case 'bonuses':   readCount = (d.bonuses || []).length || 1; break;
            case 'reports':   readCount = 30; break;
            case 'activity':  readCount = (d.activityLogs || []).length || 1; break;
            case 'trash':     readCount = (d.trash || []).length || 1; break;
            case 'users':     readCount = (d.users || []).length || 1; break;
            default: readCount = 3;
          }
          counters.today.reads += readCount;
          counters.total.reads += readCount;
          bumpCollection(page, 'reads', readCount);
          persistCounters();
        } catch (e) {}
        return _origNavigate.apply(this, arguments);
      };
    } catch (e) {
      console.warn('[DrMedia Update] Failed to hook navigate', e);
    }

    /* ========================================================
       5. The Counters Page
       ======================================================== */
    Pages.counters = function (el) {
      ensureTodayRollover();
      const c = counters;

      const pct = (used, total) => Math.min(100, Math.round((used / total) * 100));
      const colorFor = (p) => (p < 50 ? '#10b981' : p < 80 ? '#f59e0b' : '#ef4444');
      const badgeFor = (p) => (p < 50 ? 'green' : p < 80 ? 'yellow' : 'red');
      const labelFor = (p) => (p < 50 ? t('safe') : p < 80 ? t('near_limit') : t('limit_reached'));

      const readsPct = pct(c.today.reads, QUOTAS.reads);
      const writesPct = pct(c.today.writes, QUOTAS.writes);
      const deletesPct = pct(c.today.deletes, QUOTAS.deletes);

      // Estimated cost (based on Blaze pricing)
      const dailyCost =
        c.today.reads * PRICING.read +
        c.today.writes * PRICING.write +
        c.today.deletes * PRICING.delete;
      const monthlyCost = dailyCost * 30;

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
            <i data-lucide="zap" style="width:14px;height:14px;color:#f59e0b"></i>
            <span style="font-size:.8rem;font-weight:600">${t('firebase_plan')}: ${t('free_tier')}</span>
          </div>
          <div style="margin-inline-start:auto;display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" id="ctr-refresh">
              <i data-lucide="refresh-cw"></i> ${t('refresh')}
            </button>
            <button class="btn btn-ghost btn-sm" id="ctr-reset" style="color:#ef4444">
              <i data-lucide="rotate-ccw"></i> ${t('reset_counters')}
            </button>
          </div>
        </div>

        <!-- Daily Quota Cards -->
        <div class="grid-stats" style="margin-bottom:1.5rem">
          ${quotaCard(t('daily_reads'), c.today.reads, QUOTAS.reads, 'book-open', '#7c3aed')}
          ${quotaCard(t('daily_writes'), c.today.writes, QUOTAS.writes, 'pencil', '#10b981')}
          ${quotaCard(t('daily_deletes'), c.today.deletes, QUOTAS.deletes, 'trash-2', '#ef4444')}
        </div>

        <!-- Charts -->
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

        <!-- Totals -->
        <div class="grid-3" style="margin-bottom:1.5rem">
          <div class="card">
            <div style="font-size:.72rem;color:var(--text-muted)">${t('total_reads')}</div>
            <div style="font-size:1.7rem;font-weight:800;color:#7c3aed;line-height:1.1">${c.total.reads.toLocaleString()}</div>
          </div>
          <div class="card">
            <div style="font-size:.72rem;color:var(--text-muted)">${t('total_writes')}</div>
            <div style="font-size:1.7rem;font-weight:800;color:#10b981;line-height:1.1">${c.total.writes.toLocaleString()}</div>
          </div>
          <div class="card">
            <div style="font-size:.72rem;color:var(--text-muted)">${t('total_deletes')}</div>
            <div style="font-size:1.7rem;font-weight:800;color:#ef4444;line-height:1.1">${c.total.deletes.toLocaleString()}</div>
          </div>
        </div>

        <!-- Cost -->
        <div class="card" style="margin-bottom:1.5rem">
          <h4 class="section-title" style="margin-top:0"><i data-lucide="dollar-sign"></i> ${t('estimated_cost')}</h4>
          <div class="grid-2">
            <div>
              <div style="font-size:.72rem;color:var(--text-muted)">${t('daily_cost')}</div>
              <div style="font-size:1.5rem;font-weight:800">$ ${dailyCost.toFixed(4)}</div>
            </div>
            <div>
              <div style="font-size:.72rem;color:var(--text-muted)">${t('monthly_cost')}</div>
              <div style="font-size:1.5rem;font-weight:800">$ ${monthlyCost.toFixed(2)}</div>
            </div>
          </div>
          <p style="font-size:.72rem;color:var(--text-muted);margin-top:.85rem;margin-bottom:0">${t('pricing_note')}</p>
        </div>

        <!-- Per-collection breakdown -->
        <div class="card">
          <h4 class="section-title" style="margin-top:0"><i data-lucide="layers"></i> ${t('usage_details')} — ${t('collection')}</h4>
          ${
            Object.keys(c.byCollection).length
              ? `<div class="table-wrap">
                  <table class="data-table">
                    <thead><tr>
                      <th>${t('collection')}</th>
                      <th>${t('reads')}</th>
                      <th>${t('writes')}</th>
                      <th>${t('deletes')}</th>
                    </tr></thead>
                    <tbody>
                      ${Object.entries(c.byCollection)
                        .sort((a, b) => (b[1].reads + b[1].writes) - (a[1].reads + a[1].writes))
                        .map(
                          ([k, v]) => `
                          <tr>
                            <td><b>${k}</b></td>
                            <td>${v.reads.toLocaleString()}</td>
                            <td>${v.writes.toLocaleString()}</td>
                            <td>${v.deletes.toLocaleString()}</td>
                          </tr>`
                        ).join('')}
                    </tbody>
                  </table>
                </div>`
              : `<div class="empty-state"><i data-lucide="inbox"></i><p>${t('no_data')}</p></div>`
          }
        </div>
      `;

      if (window.lucide) lucide.createIcons();

      // Refresh button
      const refreshBtn = document.getElementById('ctr-refresh');
      if (refreshBtn) refreshBtn.onclick = () => Pages.counters(el);

      // Reset button
      const resetBtn = document.getElementById('ctr-reset');
      if (resetBtn)
        resetBtn.onclick = () => {
          if (window.confirm(t('reset_counters') + '?')) {
            window.DrMediaCounters.reset();
            counters = loadCounters();
            showToast(t('saved'), 'success');
            Pages.counters(el);
          }
        };

      // Draw charts after DOM settles
      setTimeout(() => {
        const history = [...c.history.slice(-13), c.today];
        const labels = history.map((h) => h.date.slice(5)); // MM-DD
        const readsData = history.map((h) => h.reads);
        const writesData = history.map((h) => h.writes);
        const deletesData = history.map((h) => h.deletes);

        const dailyCanvas = document.getElementById('ch-counter-daily');
        if (dailyCanvas && window.Chart) {
          if (window.__dm_chart_daily) {
            try { window.__dm_chart_daily.destroy(); } catch (e) {}
          }
          window.__dm_chart_daily = new Chart(dailyCanvas, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [
                {
                  label: t('reads'),
                  data: readsData,
                  borderColor: '#7c3aed',
                  backgroundColor: 'rgba(124,58,237,.1)',
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 3
                },
                {
                  label: t('writes'),
                  data: writesData,
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16,185,129,.1)',
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 3
                },
                {
                  label: t('deletes'),
                  data: deletesData,
                  borderColor: '#ef4444',
                  backgroundColor: 'rgba(239,68,68,.08)',
                  fill: false,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 3
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { boxWidth: 10, padding: 10, font: { size: 11 } }
                }
              },
              scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
              }
            }
          });
        }

        const opsCanvas = document.getElementById('ch-counter-ops');
        if (opsCanvas && window.Chart) {
          if (window.__dm_chart_ops) {
            try { window.__dm_chart_ops.destroy(); } catch (e) {}
          }
          window.__dm_chart_ops = new Chart(opsCanvas, {
            type: 'doughnut',
            data: {
              labels: [t('reads'), t('writes'), t('deletes')],
              datasets: [
                {
                  data: [c.total.reads, c.total.writes, c.total.deletes],
                  backgroundColor: ['#7c3aed', '#10b981', '#ef4444'],
                  borderWidth: 0
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { boxWidth: 10, padding: 12, font: { size: 11 } }
                }
              }
            }
          });
        }
      }, 80);
    };

    /* ========================================================
       6. Register nav item in sidebar
       ======================================================== */
    const systemSection = NAV_ITEMS.find((g) => g.section === 'system');
    if (systemSection && !systemSection.items.find((i) => i.id === 'counters')) {
      // Insert right after Dashboard-ish position (start of system section)
      systemSection.items.unshift({
        id: 'counters',
        icon: 'gauge',
        label: 'counters'
      });
    }

    /* ========================================================
       7. Re-render sidebar so the item appears immediately
       ======================================================== */
    try {
      if (typeof renderSidebar === 'function') renderSidebar();
    } catch (e) {}

    // Also re-render on future logins (if user logs in fresh)
    const originalStartApp = window.startApp;
    if (typeof originalStartApp === 'function') {
      window.startApp = function () {
        const r = originalStartApp.apply(this, arguments);
        setTimeout(() => {
          try { renderSidebar(); } catch (e) {}
        }, 100);
        return r;
      };
    }

    /* ========================================================
       8. Welcome toast on first install
       ======================================================== */
    const WELCOME_KEY = 'drmedia_update_welcome_counters_v1';
    if (!localStorage.getItem(WELCOME_KEY)) {
      setTimeout(() => {
        try {
          showToast(
            State.lang === 'ar'
              ? '🎉 ميزة جديدة: تبويب عدادات Firebase أُضيف للنظام'
              : '🎉 New feature: Firebase Counters tab added',
            'success'
          );
          localStorage.setItem(WELCOME_KEY, '1');
        } catch (e) {}
      }, 2500);
    }

    console.log('%c[DrMedia Pro] ✓ Firebase Counters tab registered', 'color:#10b981;font-weight:bold');
  });
})();