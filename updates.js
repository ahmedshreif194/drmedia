// =============================================
// Dr Media Pro - ملف التحديثات الموحد (يشمل جميع التحسينات + تبويب تحديث النظام)
// =============================================

// ====== تحديث: عرض التاريخ والوقت (المدير + الموظف) ======
(function() {
    console.log('🟢 تحميل: التاريخ والوقت');
    var observer = new MutationObserver(function(mutations) {
        injectDateTime();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function updateDateTime(element) {
        var now = new Date();
        var options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        var dateStr = now.toLocaleDateString('ar-EG', options);
        var timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        element.textContent = dateStr + ' - ' + timeStr;
    }

    function injectDateTime() {
        // المدير
        var topbar = document.querySelector('.topbar');
        if (topbar && !document.getElementById('liveDateTime')) {
            var span = document.createElement('span');
            span.id = 'liveDateTime';
            span.style.cssText = 'margin:0 15px;font-weight:bold;color:#16a34a;white-space:nowrap;font-size:14px;';
            var btn = topbar.querySelector('button');
            if (btn) {
                btn.parentNode.insertBefore(span, btn);
            } else {
                topbar.appendChild(span);
            }
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
        }
        // الموظف
        var empHeader = document.querySelector('#app header');
        if (empHeader && !document.getElementById('liveDateTimeEmp')) {
            var span = document.createElement('span');
            span.id = 'liveDateTimeEmp';
            span.style.cssText = 'font-weight:bold;color:#16a34a;white-space:nowrap;font-size:14px;margin-right:20px;';
            var h1 = empHeader.querySelector('h1');
            if (h1) {
                h1.insertAdjacentElement('afterend', span);
            } else {
                empHeader.appendChild(span);
            }
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
        }
    }
    // محاولة فورية
    injectDateTime();
})();

// ====== تحديث: قوائم منسدلة شاملة للموظفين (كل الموظفين بدون تقييد الدور) ======
(function() {
    console.log('🟢 تحميل: قوائم منسدلة شاملة للموظفين');

    // انتظار تعريف AppRenderer و state
    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    function enhanceBookingsTable() {
        var rows = document.querySelectorAll('#content-area table tbody tr');
        rows.forEach(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 6) return;
            var cell = cells[5]; // عمود الموظفون
            if (!cell || cell.querySelector('.emp-swap-select')) return;

            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            var assigned = booking.assignedEmployees || [];
            cell.innerHTML = '';

            // قائمة جميع الموظفين النشطين (مرة واحدة لكل الخلية)
            var allEmployees = state.employees.filter(e => e.active);

            assigned.forEach(function(empId) {
                var emp = state.employees.find(e => e.id === empId);
                if (!emp) return;

                var select = document.createElement('select');
                select.className = 'emp-swap-select border p-1 rounded text-sm';
                select.style.cssText = 'margin-bottom:4px; width:100%;';

                // إضافة خيار فارغ للإزالة (اختياري)
                var emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '-- إزالة --';
                select.appendChild(emptyOpt);

                allEmployees.forEach(function(e) {
                    var opt = document.createElement('option');
                    opt.value = e.id;
                    opt.textContent = e.name + ' (' + e.role + ')';
                    if (e.id === empId) opt.selected = true;
                    select.appendChild(opt);
                });

                select.addEventListener('change', function() {
                    var newEmpId = this.value;
                    var oldEmpId = empId;
                    var booking = state.bookings.find(b => b.id === bookingId);
                    if (!booking) return;

                    // إذا اختار "إزالة" (فارغ)، نحذف الموظف
                    if (!newEmpId) {
                        booking.assignedEmployees = booking.assignedEmployees.filter(id => id !== oldEmpId);
                    } else {
                        // استبدال القديم بالجديد (إذا لم يكن موجوداً فعلاً)
                        var idx = booking.assignedEmployees.indexOf(oldEmpId);
                        if (idx !== -1) {
                            booking.assignedEmployees[idx] = newEmpId;
                        } else {
                            // إذا حُذف القديم بطريقة ما، نضيف الجديد
                            if (!booking.assignedEmployees.includes(newEmpId)) {
                                booking.assignedEmployees.push(newEmpId);
                            }
                        }
                    }
                    DataManager.updateEmployeeOrders();
                    DataManager.saveAllData();
                    Utils.showMsg('✅ تم تغيير الموظف');
                    // إعادة رسم الصف ليظهر الترتيب الجديد (اختياري)
                    AppRenderer.renderBookings();
                });

                cell.appendChild(select);
            });

            // زر إضافة موظف جديد (يظهر جميع الموظفين غير المعينين)
            var addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.className = 'btn-secondary text-xs';
            addBtn.style.cssText = 'margin-top:6px;';
            addBtn.onclick = function() {
                var booking = state.bookings.find(b => b.id === bookingId);
                if (!booking) return;
                var assignedSet = new Set(booking.assignedEmployees || []);
                var available = allEmployees.filter(e => !assignedSet.has(e.id));
                if (available.length === 0) {
                    Utils.showWarning('جميع الموظفين معينون بالفعل');
                    return;
                }
                var options = available.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
                Utils.openModal(`
                    <h3>إضافة موظف للحجز</h3>
                    <select id="addEmpSelect" class="w-full border-2 p-2 my-2 rounded-xl">${options}</select>
                    <div class="flex gap-2 mt-4">
                        <button onclick="window._addEmpToBooking('${bookingId}')" class="btn-primary flex-1">💾 حفظ</button>
                        <button onclick="Utils.closeModal()" class="btn-outline flex-1">إلغاء</button>
                    </div>
                `);
            };
            cell.appendChild(addBtn);
        });
    }

    // دالة الإضافة (عامة)
    window._addEmpToBooking = function(bookingId) {
        var empId = document.getElementById('addEmpSelect')?.value;
        if (!empId) return Utils.showError('اختر موظفاً');
        var booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) return;
        if (!booking.assignedEmployees) booking.assignedEmployees = [];
        if (booking.assignedEmployees.includes(empId)) {
            Utils.showWarning('الموظف مضاف بالفعل');
            return;
        }
        booking.assignedEmployees.push(empId);
        DataManager.updateEmployeeOrders();
        DataManager.saveAllData();
        Utils.closeModal();
        AppRenderer.renderBookings();
    };

    // ربط التحسين برسم جدول الحجوزات
    function init() {
        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings.apply(this, arguments);
            requestAnimationFrame(function() {
                enhanceBookingsTable();
            });
        };
        // تحسين أولي إن وجد الجدول
        if (document.querySelector('#content-area table tbody')) {
            enhanceBookingsTable();
        }
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState !== 'loading') {
        waitForApp(init);
    }
})();

// ====== تحديث: أزرار الحالة الثلاثية (معلق/مكتمل/ملغي) + أزرار إلغاء ======
(function() {
    console.log('🟢 تحميل: أزرار الحالة الثلاثية');
    function enhanceStatusColumn() {
        var rows = document.querySelectorAll('#content-area table tbody tr');
        rows.forEach(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            var statusCell = cells[4];
            if (!statusCell || statusCell.querySelector('.status-radio-group')) return;
            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;
            var currentStatus = booking.status || 'pending';
            var statuses = [
                { value: 'pending', label: 'معلق', color: '#f59e0b' },
                { value: 'completed', label: 'مكتمل', color: '#10b981' },
                { value: 'cancelled', label: 'ملغي', color: '#ef4444' }
            ];
            statusCell.innerHTML = '';
            var container = document.createElement('div');
            container.className = 'status-radio-group';
            container.style.cssText = 'display:flex; gap:6px; align-items:center;';
            statuses.forEach(function(st) {
                var label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; gap:4px; cursor:pointer; font-size:0.75rem; padding:4px 8px; border-radius:20px; transition:0.2s;';
                label.style.backgroundColor = currentStatus === st.value ? st.color : '#f3f4f6';
                label.style.color = currentStatus === st.value ? '#fff' : '#374151';
                label.style.border = '1px solid ' + st.color;

                var radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'status-' + bookingId;
                radio.value = st.value;
                radio.checked = (currentStatus === st.value);
                radio.style.cssText = 'display:none;';
                radio.addEventListener('change', function() {
                    BookingManager.changeStatus(bookingId, this.value);
                    container.querySelectorAll('label').forEach(function(lbl) {
                        var r = lbl.querySelector('input');
                        var s = statuses.find(function(x) { return x.value === r.value; });
                        lbl.style.backgroundColor = r.checked ? s.color : '#f3f4f6';
                        lbl.style.color = r.checked ? '#fff' : '#374151';
                    });
                });
                label.appendChild(radio);
                label.appendChild(document.createTextNode(st.label));
                container.appendChild(label);
            });
            statusCell.appendChild(container);
        });

        // أزرار إلغاء في النوافذ المنبثقة
        new MutationObserver(function() {
            var modal = document.getElementById('modal');
            if (modal && modal.classList.contains('show')) {
                var content = document.getElementById('modalContent');
                if (content) {
                    content.querySelectorAll('button').forEach(function(btn) {
                        if ((btn.textContent.includes('حفظ') || btn.textContent.includes('💾')) &&
                            !btn.nextElementSibling?.classList.contains('cancel-btn-auto')) {
                            var cancelBtn = document.createElement('button');
                            cancelBtn.textContent = 'إلغاء';
                            cancelBtn.className = btn.className + ' cancel-btn-auto';
                            cancelBtn.onclick = function(e) { e.preventDefault(); Utils.closeModal(); };
                            btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
                        }
                    });
                }
            }
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    if (typeof AppRenderer !== 'undefined') {
        var origRenderBookings2 = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings2.apply(this, arguments);
            setTimeout(enhanceStatusColumn, 200);
        };
    }
})();

// ====== تحديث: تحسين تنسيق صفحة الحجوزات (CSS) ======
(function() {
    console.log('🟢 تحميل: تنسيقات جدول الحجوزات');
    if (document.getElementById('booking-enhanced-styles')) return;
    var style = document.createElement('style');
    style.id = 'booking-enhanced-styles';
    style.textContent = `
        #content-area .bg-card { padding: 18px !important; border-radius: 18px !important; }
        #content-area table { font-size: 0.85rem; }
        #content-area table th { background: var(--primary); color: white; padding: 12px 6px; }
        #content-area table td { padding: 10px 6px; vertical-align: middle; }
        #content-area table tbody tr:hover { background: #f0fdf4; }
        #content-area .overflow-x-auto { border-radius: 12px; border: 1px solid var(--border); }
        body.dark #content-area table th { background: #2d3a4a; }
        body.dark #content-area table tbody tr:hover { background: #2d3a3a; }
    `;
    document.head.appendChild(style);
})();

// ====== تحديث: قائمة Styles (شكل الواجهة) ======
(function() {
    console.log('🟢 تحميل: أنماط الشكل (Styles)');
    var STYLES = {
        default: { name: 'الافتراضي', css: '' },
        rounded: { name: 'دائري ناعم', css: `
            :root { --radius-btn: 40px; --radius-lg: 28px; --radius-xl: 32px; }
            .btn, .stat-card, .bg-card, .sidebar-item, .modal-content { border-radius: var(--radius-lg) !important; }
            .btn { border-radius: var(--radius-btn) !important; }
            .modal-content { border-radius: var(--radius-xl) !important; }
        `},
        compact: { name: 'مدمج', css: `
            :root { --radius-btn: 8px; --radius-lg: 8px; --radius-xl: 10px; }
            .btn { padding: 6px 14px; font-size: 0.8rem; }
            table { font-size: 0.78rem; }
            th, td { padding: 6px 5px; }
            .stat-card, .bg-card { padding: 12px; }
            .sidebar { width: 220px; }
            .main-content { margin-right: 220px; padding: 16px; padding-top: calc(60px + 16px); }
            .topbar { height: 60px; padding: 10px 16px; right: 220px; }
        `},
        spacious: { name: 'واسع', css: `
            :root { --radius-btn: 30px; --radius-lg: 24px; --radius-xl: 28px; }
            .main-content { padding: 40px; padding-top: calc(80px + 40px); }
            .stat-card, .bg-card { padding: 30px; margin-bottom: 30px; }
            .btn { padding: 12px 28px; font-size: 1rem; }
            .sidebar { width: 280px; }
            .main-content { margin-right: 280px; }
            .topbar { right: 280px; height: 80px; padding: 18px 28px; }
        `},
        modern: { name: 'مودرن', css: `
            :root { --radius-btn: 20px; --radius-lg: 16px; --radius-xl: 20px; }
            .sidebar { background: #1e293b; color: #e2e8f0; }
            .sidebar-item { color: #94a3b8; }
            .sidebar-item:hover { background: #334155; color: white; }
            .sidebar-item.active { background: var(--primary); color: white; }
            .topbar { border-bottom: 2px solid var(--primary); }
            .btn { text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px; }
        `}
    };

    var savedStyle = localStorage.getItem('drmedia_style') || 'default';
    function applyStyle(name) {
        var oldStyle = document.getElementById('dynamic-style-patch');
        if (oldStyle) oldStyle.remove();
        if (name !== 'default' && STYLES[name]) {
            var style = document.createElement('style');
            style.id = 'dynamic-style-patch';
            style.textContent = STYLES[name].css;
            document.head.appendChild(style);
        }
        localStorage.setItem('drmedia_style', name);
    }
    applyStyle(savedStyle);
    window._applyGlobalStyle = function(name) {
        applyStyle(name);
        Utils.showMsg('✅ تم تغيير شكل الواجهة');
    };

    // حقن القائمة في الإعدادات
    var checkInterval = setInterval(function() {
        var wa = document.getElementById('waMsgTemplate');
        if (wa && !document.getElementById('styleSelectContainer')) {
            clearInterval(checkInterval);
            var html = `<div id="styleSelectContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                <label class="text-sm font-semibold">🎨 شكل الواجهة (Style)</label>
                <select id="styleSelect" class="w-full border-2 p-2 rounded-xl mt-1" onchange="window._applyGlobalStyle(this.value)">
                    ${Object.keys(STYLES).map(k => `<option value="${k}" ${savedStyle===k?'selected':''}>${STYLES[k].name}</option>`).join('')}
                </select>
            </div>`;
            wa.insertAdjacentHTML('afterend', html);
        }
    }, 300);
})();

// ====== تحديث: لوحة مراقبة حية + صفحة تقارير متقدمة ======
(function() {
    console.log('🟢 تحميل: لوحة مراقبة وتقارير متقدمة');
    // لوحة المراقبة
    if (typeof AppRenderer !== 'undefined') {
        var origDashboard = AppRenderer.renderDashboard;
        AppRenderer.renderDashboard = function() {
            origDashboard.apply(this, arguments);
            setTimeout(function() {
                if (document.getElementById('liveMonitorCards')) return;
                var today = Utils.getTodayDateStr();
                var todayBookings = state.bookings.filter(b => b.date === today && !b.deleted && b.status !== 'cancelled').length;
                var activeEmps = state.employees.filter(e => state.attendanceRecords.some(a => a.empId === e.id && a.date === today && a.checkIn && !a.checkOut)).length;
                var busyHalls = new Set(state.bookings.filter(b => b.date === today && !b.deleted && b.status !== 'cancelled').map(b => b.hallId)).size;
                var html = `<div id="liveMonitorCards" style="margin-top:20px;">
                    <h3 style="font-weight:bold;">📡 لوحة المراقبة الحية</h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:12px;">
                        <div class="stat-card" style="border-left:4px solid #3b82f6;"><div class="stat-value" style="color:#3b82f6;">${todayBookings}</div><div class="stat-label">حجوزات اليوم</div></div>
                        <div class="stat-card" style="border-left:4px solid #10b981;"><div class="stat-value" style="color:#10b981;">${activeEmps}</div><div class="stat-label">موظفون متواجدون</div></div>
                        <div class="stat-card" style="border-left:4px solid #f59e0b;"><div class="stat-value" style="color:#f59e0b;">${busyHalls}</div><div class="stat-label">قاعات مشغولة</div></div>
                    </div></div>`;
                var grid = document.querySelector('#content-area .grid');
                if (grid) grid.insertAdjacentHTML('afterend', html);
            }, 200);
        };
    }
})();

// ====== تحديث: 10 مميزات متقدمة (مدمجة بشكل آمن) ======
(function() {
    console.log('🟢 تحميل: المميزات العشر');
    // 1. تنبيهات ذكية (في الخلفية)
    setInterval(function() {
        var today = Utils.getTodayDateStr();
        var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
        state.bookings.forEach(function(b) {
            if (b.status === 'pending' && !b.deleted && (b.date === today || b.date === tomorrow)) {
                if (!b.assignedEmployees || b.assignedEmployees.length === 0) {
                    console.warn('⚠️ حجز بدون موظفين:', b.clientName);
                }
            }
        });
    }, 60000);
    // 2. الجدول الزمني (تمت إضافته سابقاً)
    // 3. مشرف قاعة (اختياري)
    // 4. تحسين الفلاشات
    if (typeof AppRenderer !== 'undefined') {
        var origFlash = AppRenderer.renderFlash;
        AppRenderer.renderFlash = function() {
            origFlash.apply(this, arguments);
            setTimeout(function() {
                document.querySelectorAll('#content-area table tbody tr').forEach(function(row) {
                    var cells = row.querySelectorAll('td');
                    if (cells.length > 6) {
                        var date = new Date(cells[2]?.textContent);
                        if (!isNaN(date) && (new Date() - date) > 2*86400000 && cells[5]?.textContent.trim() !== 'العريس') {
                            row.style.backgroundColor = '#ffe0e0';
                        }
                    }
                });
            }, 200);
        };
    }
    // 5. أتمتة التوزيع (موجود في الإعدادات)
    // 6. قوالب واتساب (موجود)
    // 7. تصدير PDF (اختياري)
    // 8. وضع عدم الاتصال
    var statusBar = document.createElement('div');
    statusBar.id = 'offlineStatusBar';
    statusBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:6px;text-align:center;font-weight:bold;z-index:9999;';
    document.body.appendChild(statusBar);
    function updateOnlineStatus() {
        statusBar.style.background = navigator.onLine ? '#10b981' : '#f59e0b';
        statusBar.textContent = navigator.onLine ? '🟢 متصل' : '🟠 غير متصل - البيانات محفوظة محلياً';
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    // 9. شاشة عرض عامة (عند إضافة ?public للرابط)
    if (window.location.search.includes('public')) {
        document.body.innerHTML = '<div style="padding:20px;font-family:Tahoma;text-align:center;"><h1>📋 حجوزات اليوم</h1>' +
        state.bookings.filter(b => b.date === Utils.getTodayDateStr() && !b.deleted).map(b => `<p>${b.hallName} - ${b.clientName}</p>`).join('') + '</div>';
    }
    // 10. Google Drive (الزر موجود في الإعدادات)
})();

// ====== تحديث: ترتيب تصاعدي للأوردرات في واجهة الموظف ======
(function() {
    console.log('🟢 تحميل: ترتيب الأوردرات في واجهة الموظف');
    if (typeof AppRenderer !== 'undefined') {
        var origEmpDash = AppRenderer.renderEmpDash;
        AppRenderer.renderEmpDash = function() {
            origEmpDash.apply(this, arguments);
            setTimeout(function() {
                var container = document.querySelector('#app .max-h-60.overflow-y-auto');
                if (!container) return;
                var items = Array.from(container.querySelectorAll('.border-b'));
                if (items.length === 0) return;
                items.sort(function(a, b) {
                    var dateA = (a.textContent.match(/\d{4}-\d{2}-\d{2}/) || ['9999'])[0];
                    var dateB = (b.textContent.match(/\d{4}-\d{2}-\d{2}/) || ['9999'])[0];
                    return dateA.localeCompare(dateB);
                });
                items.forEach(function(item) {
                    item.style.padding = '12px 8px';
                    item.style.borderRadius = '8px';
                    container.appendChild(item);
                });
            }, 400);
        };
    }
})();

// ====== تحديث: إصلاح التزامن + تحسين الموبايل ======
(function() {
    console.log('🟢 تحميل: إصلاح التزامن وتحسين الموبايل');
    // إصلاح التزامن
    window._manualSync = async function() {
        if (!state.useFirebase || !state.db) return Utils.showError('Firebase غير مهيأ');
        try {
            var s = await state.db.ref('/').once('value');
            if (s.exists()) {
                DataManager._loadDataObject(s.val());
                DataManager._ensureMinimumData();
                DataManager.updateEmployeeOrders();
                await DataManager.saveAllData();
                Utils.showMsg('✅ تمت المزامنة');
            }
        } catch(e) { Utils.showError('فشلت المزامنة'); }
    };
    // تحسينات الموبايل
    if (!document.getElementById('mobile-responsive-fix')) {
        var style = document.createElement('style');
        style.id = 'mobile-responsive-fix';
        style.textContent = `
            @media (max-width: 768px) {
                .main-content { padding: 12px !important; padding-top: 60px !important; }
                .topbar { padding: 10px 12px !important; height: 60px !important; right: 0 !important; }
                .btn, button { min-height: 44px; padding: 10px 16px; font-size: 0.9rem; }
                select, input { font-size: 16px !important; }
                .modal-content { width: 95% !important; margin: 10px; border-radius: 16px; }
            }
        `;
        document.head.appendChild(style);
    }
})();

// ====== تحديث: حضور سابق متعدد الموظفين + زر "حضور وانصراف" ======
(function() {
    console.log('🟢 تحميل: حضور سابق متعدد');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    function init() {
        // 1. استبدال نافذة الحضور السابق
        AppRenderer.showPastAttendanceModal = function() {
            var empOpts = state.employees.map(e => 
                `<option value="${e.id}">${e.name} (${e.role})</option>`
            ).join('');
            
            Utils.openModal(`
                <h3 class="text-xl font-bold mb-4">📅 تسجيل حضور / انصراف (متعدد)</h3>
                <p class="text-sm mb-2">اختر الموظفين (يمكنك تحديد أكثر من واحد):</p>
                <select id="pastEmpSelect" multiple class="w-full border-2 p-2 my-2 rounded-xl h-40">
                    ${empOpts}
                </select>
                <p class="text-sm mt-2 mb-1">التاريخ:</p>
                <input type="date" id="pastDate" class="w-full border-2 p-2 my-2 rounded-xl" 
                       value="${Utils.getTodayDateStr()}">
                <div class="flex gap-2 mt-4">
                    <button onclick="AppRenderer.recordPastAttendanceMulti()" class="btn-primary flex-1">
                        ✅ حضور وانصراف
                    </button>
                    <button onclick="Utils.closeModal()" class="btn-outline flex-1">إلغاء</button>
                </div>
            `);
        };

        // 2. الدالة الجديدة لمعالجة الطلب
        AppRenderer.recordPastAttendanceMulti = function() {
            var empSelect = document.getElementById('pastEmpSelect');
            var dateInput = document.getElementById('pastDate');
            if (!empSelect || !dateInput) return;

            var selectedOptions = Array.from(empSelect.selectedOptions);
            if (selectedOptions.length === 0) {
                Utils.showError('⚠️ اختر موظفًا واحدًا على الأقل');
                return;
            }
            var date = dateInput.value;
            if (!date) {
                Utils.showError('⚠️ اختر تاريخًا');
                return;
            }

            // تسجيل حضور ثم انصراف لكل موظف مختار
            selectedOptions.forEach(function(option) {
                var empId = option.value;
                AttendanceManager.recordAttendanceForDate(empId, date, 'checkIn');
                AttendanceManager.recordAttendanceForDate(empId, date, 'checkOut');
            });

            Utils.closeModal();
            AppRenderer.renderAttendance(); // تحديث صفحة الحضور
            Utils.showMsg(`✅ تم تسجيل حضور وانصراف لـ ${selectedOptions.length} موظف`);
        };

        console.log('✅ تحديث الحضور السابق جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== تحديث: زر توزيع عادل للحضور فقط ======
(function() {
    console.log('🟢 تحميل: توزيع عادل للحضور');

    // انتظار تعريف DistributionManager و AppRenderer
    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // دالة التوزيع العادل على الحضور فقط
    async function distributeFairlyAmongPresent() {
        var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
        if (!pending.length) {
            Utils.showWarning('لا توجد حجوزات معلقة');
            return;
        }

        // الموظفون النشطون
        var allEmployees = state.employees.filter(e => e.active);
        var dirs = allEmployees.filter(e => e.role === 'مخرج');
        var phs  = allEmployees.filter(e => e.role === 'مصور');
        var crs  = allEmployees.filter(e => e.role === 'كرين');

        // تفريغ التوزيعات السابقة للحجوزات المعلقة
        pending.forEach(b => b.assignedEmployees = []);

        // لكل حجز، نحدد الموظفين الحاضرين في ذلك اليوم
        pending.forEach(function(b) {
            var date = b.date;
            // الموظفون الذين سجلوا حضورًا في هذا التاريخ
            var presentIds = state.attendanceRecords
                .filter(a => a.date === date && a.checkIn)
                .map(a => a.empId);
            
            // دوال مساعدة لاختيار الأفضل من بين الحضور فقط
            function pickBest(emps) {
                var available = emps.filter(e => presentIds.includes(e.id));
                if (!available.length) return null;
                // ترتيب تصاعدي حسب عدد الأوردرات الحالية
                available.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
                return available[0];
            }

            var hallType = state.halls.find(h => h.id === b.hallId)?.type || 'closed';
            var assigned = [];

            if (hallType === 'cafe') {
                var p = pickBest(phs);
                if (p) assigned.push(p.id);
            } else {
                var d = pickBest(dirs);
                if (d) assigned.push(d.id);
                
                // مصورين (حتى 2)
                var phList = phs.filter(e => presentIds.includes(e.id));
                phList.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
                for (var i = 0; i < Math.min(2, phList.length); i++) {
                    assigned.push(phList[i].id);
                }
                
                var c = pickBest(crs);
                if (c) assigned.push(c.id);
            }

            b.assignedEmployees = assigned;
        });

        DataManager.updateEmployeeOrders();
        await DataManager.saveAllData();

        // إشعارات (اختياري)
        for (var b of pending) {
            for (var eid of (b.assignedEmployees || [])) {
                var emp = state.employees.find(e => e.id === eid);
                if (emp) {
                    NotificationManager.notifyEmployee(
                        emp,
                        'تم توزيع أوردر (للحضور)',
                        `لديك أوردر لـ ${b.clientName} يوم ${b.date} بقاعة ${b.hallName}`,
                        true
                    );
                }
            }
        }

        DataManager.addActivity('توزيع عادل للحضور', `تم توزيع ${pending.length} حجز على الحضور فقط`);
        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
        Utils.showMsg(`✅ تم توزيع ${pending.length} حجز بعدالة بين الحضور`);
    }

    // دالة لحقن الزر في صفحة التوزيع
    function injectButtonInDistribution() {
        // نراقب ظهور صفحة التوزيع
        var observer = new MutationObserver(function(mutations) {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('fairDistributeBtn')) {
                var btn = document.createElement('button');
                btn.id = 'fairDistributeBtn';
                btn.className = 'btn-secondary'; // لون مختلف لتمييزه
                btn.textContent = '🧑‍🤝‍🧑 توزيع عادل للحضور';
                btn.onclick = distributeFairlyAmongPresent;
                container.appendChild(btn);
                observer.disconnect(); // اكتفينا
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    // بدء التشغيل
    function init() {
        injectButtonInDistribution();
        console.log('✅ زر توزيع الحضور جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== تحديث: زر توزيع غير المعينين ======
(function() {
    console.log('🟢 تحميل: زر توزيع غير المعينين');

    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // الدالة التي توزع الحجوزات التي ليس لها موظفين
    async function distributeUnassignedBookings() {
        // نجلب الحجوزات المعلقة التي ليس لها موظفين معينين
        var unassigned = state.bookings.filter(b => 
            b.status === 'pending' && !b.deleted && (!b.assignedEmployees || b.assignedEmployees.length === 0)
        );
        if (!unassigned.length) {
            Utils.showWarning('لا توجد حجوزات غير معينة');
            return;
        }

        var allEmployees = state.employees.filter(e => e.active);
        var dirs = allEmployees.filter(e => e.role === 'مخرج');
        var phs  = allEmployees.filter(e => e.role === 'مصور');
        var crs  = allEmployees.filter(e => e.role === 'كرين');

        unassigned.forEach(function(b) {
            var date = b.date;
            // الموظفون الذين سجلوا حضورًا في هذا التاريخ
            var presentIds = state.attendanceRecords
                .filter(a => a.date === date && a.checkIn)
                .map(a => a.empId);

            function pickBest(emps) {
                var available = emps.filter(e => presentIds.includes(e.id));
                if (!available.length) return null;
                available.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
                return available[0];
            }

            var hallType = state.halls.find(h => h.id === b.hallId)?.type || 'closed';
            var assigned = [];

            if (hallType === 'cafe') {
                var p = pickBest(phs);
                if (p) assigned.push(p.id);
            } else {
                var d = pickBest(dirs);
                if (d) assigned.push(d.id);
                
                var phList = phs.filter(e => presentIds.includes(e.id));
                phList.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
                for (var i = 0; i < Math.min(2, phList.length); i++) {
                    assigned.push(phList[i].id);
                }
                
                var c = pickBest(crs);
                if (c) assigned.push(c.id);
            }

            b.assignedEmployees = assigned;
        });

        DataManager.updateEmployeeOrders();
        await DataManager.saveAllData();

        DataManager.addActivity('توزيع غير المعينين', `تم توزيع ${unassigned.length} حجز غير معين`);
        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
        Utils.showMsg(`✅ تم توزيع ${unassigned.length} حجز غير معين على الحضور`);
    }

    // حقن الزر في صفحة التوزيع
    function injectButton() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('distributeUnassignedBtn')) {
                var btn = document.createElement('button');
                btn.id = 'distributeUnassignedBtn';
                btn.className = 'btn-secondary';
                btn.style.backgroundColor = '#f97316'; // لون برتقالي مميز
                btn.style.color = 'white';
                btn.textContent = '⚡ توزيع غير المعينين';
                btn.onclick = distributeUnassignedBookings;
                container.appendChild(btn);
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    function init() {
        injectButton();
        console.log('✅ زر توزيع غير المعينين جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== تحديث: زر استكمال / توزيع متساوي ======
(function() {
    console.log('🟢 تحميل: زر استكمال التوزيع المتساوي');

    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // دالة التوزيع المتساوي (استكمال)
    async function equalizeDistribution() {
        // جميع الحجوزات المعلقة
        var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
        if (!pending.length) {
            Utils.showWarning('لا توجد حجوزات معلقة');
            return;
        }

        // مسح جميع التعيينات الحالية
        pending.forEach(b => b.assignedEmployees = []);

        var allEmployees = state.employees.filter(e => e.active);
        var dirs = allEmployees.filter(e => e.role === 'مخرج');
        var phs  = allEmployees.filter(e => e.role === 'مصور');
        var crs  = allEmployees.filter(e => e.role === 'كرين');

        // ترتيب الموظفين تصاعدياً حسب totalOrders (الأقل أولاً)
        dirs.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
        phs.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
        crs.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));

        // مؤشرات دائرية لكل دور
        var dirIdx = 0, phIdx = 0, crIdx = 0;

        // تجميع الحجوزات حسب التاريخ لتجنب تعارض موظف في نفس اليوم
        var byDate = {};
        pending.forEach(b => {
            if (!byDate[b.date]) byDate[b.date] = [];
            byDate[b.date].push(b);
        });

        // معالجة كل يوم على حدة
        Object.keys(byDate).sort().forEach(function(date) {
            var dayBookings = byDate[date];
            var busySet = new Set(); // موظفون مشغولون في هذا اليوم

            dayBookings.forEach(function(b) {
                var hallType = state.halls.find(h => h.id === b.hallId)?.type || 'closed';
                var assigned = [];

                if (hallType === 'cafe') {
                    // نبحث عن أول مصور متاح (غير مشغول اليوم)
                    var found = false;
                    for (var i = 0; i < phs.length; i++) {
                        var idx = (phIdx + i) % phs.length;
                        var emp = phs[idx];
                        if (!busySet.has(emp.id)) {
                            assigned.push(emp.id);
                            busySet.add(emp.id);
                            phIdx = (idx + 1) % phs.length;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        // إذا لم نجد، نأخذ أول مصور (حتى لو مشغول) كحل أخير
                        if (phs.length) assigned.push(phs[phIdx % phs.length].id);
                    }
                } else {
                    // مخرج
                    for (var i = 0; i < dirs.length; i++) {
                        var idx = (dirIdx + i) % dirs.length;
                        var emp = dirs[idx];
                        if (!busySet.has(emp.id)) {
                            assigned.push(emp.id);
                            busySet.add(emp.id);
                            dirIdx = (idx + 1) % dirs.length;
                            break;
                        }
                    }
                    // مصورين (حتى 2)
                    for (var i = 0; i < 2; i++) {
                        for (var j = 0; j < phs.length; j++) {
                            var idx = (phIdx + j) % phs.length;
                            var emp = phs[idx];
                            if (!busySet.has(emp.id) && !assigned.includes(emp.id)) {
                                assigned.push(emp.id);
                                busySet.add(emp.id);
                                phIdx = (idx + 1) % phs.length;
                                break;
                            }
                        }
                    }
                    // كرين
                    for (var i = 0; i < crs.length; i++) {
                        var idx = (crIdx + i) % crs.length;
                        var emp = crs[idx];
                        if (!busySet.has(emp.id)) {
                            assigned.push(emp.id);
                            busySet.add(emp.id);
                            crIdx = (idx + 1) % crs.length;
                            break;
                        }
                    }
                }

                b.assignedEmployees = assigned;
            });
        });

        DataManager.updateEmployeeOrders();
        await DataManager.saveAllData();

        DataManager.addActivity('توزيع متساوي', 'تم إعادة توزيع جميع الحجوزات المعلقة بتساوٍ');
        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
        Utils.showMsg('✅ تم توزيع الحجوزات بالتساوي (استكمال)');
    }

    // حقن الزر في صفحة التوزيع
    function injectButton() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('equalizeDistBtn')) {
                var btn = document.createElement('button');
                btn.id = 'equalizeDistBtn';
                btn.className = 'btn-secondary';
                btn.style.backgroundColor = '#8b5cf6'; // بنفسجي
                btn.style.color = 'white';
                btn.textContent = '📊 استكمال / توزيع متساوي';
                btn.onclick = equalizeDistribution;
                container.appendChild(btn);
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    function init() {
        injectButton();
        console.log('✅ زر استكمال التوزيع المتساوي جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== تحديث: تبويب "تحديث النظام" لرفع الكود إلى GitHub دون مسح القديم ======
(function() {
    console.log('🟢 تحميل: تبويب تحديث النظام (آمن)');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    function initSystemUpdater() {
        // ====== 1. إضافة التبويب إلى القائمة الجانبية ======
        if (!AppRenderer.pages.includes('systemUpdater')) {
            AppRenderer.pages.push('systemUpdater');
        }

        var sidebarContainer = document.querySelector('.sidebar .py-2');
        if (sidebarContainer && !document.querySelector('[data-page="systemUpdater"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-page', 'systemUpdater');
            item.onclick = function() { AppRenderer.navigateTo('systemUpdater'); };
            item.innerHTML = '<span>🔧 تحديث النظام</span>';
            sidebarContainer.appendChild(item);
        }

        // ====== 2. تعريف صفحة التحديث ======
        AppRenderer.renderSystemUpdater = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = '🔧 تحديث النظام';

            // إعدادات مخزنة
            var settings = JSON.parse(localStorage.getItem('drmedia_github_push') || '{}');
            var token = settings.token || '';
            var repoOwner = settings.repoOwner || '';
            var repoName = settings.repoName || '';
            var filePath = settings.filePath || 'updates.js';

            c.innerHTML = `
            <div class="bg-card">
                <h2 class="text-xl font-bold mb-4">🔧 تحديث النظام عبر GitHub</h2>
                <p class="text-sm text-gray-500 mb-4">الصق كود JavaScript هنا واضغط "رفع إلى GitHub" لتحديث ملف التحديثات تلقائياً. <b style="color:red;">سيتم إضافة الكود إلى نهاية الملف الحالي، وليس مسحه.</b></p>

                <div style="margin-bottom:20px; border:1px solid #e5e7eb; border-radius:12px; padding:15px;">
                    <h3 class="font-semibold mb-2">⚙️ إعدادات الاتصال بـ GitHub</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <div>
                            <label class="text-xs">اسم المستخدم (Owner)</label>
                            <input id="repoOwner" value="${repoOwner}" class="w-full border-2 p-2 rounded-xl">
                        </div>
                        <div>
                            <label class="text-xs">اسم المستودع (Repo)</label>
                            <input id="repoName" value="${repoName}" class="w-full border-2 p-2 rounded-xl">
                        </div>
                        <div>
                            <label class="text-xs">مسار الملف</label>
                            <input id="filePath" value="${filePath}" class="w-full border-2 p-2 rounded-xl">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs">GitHub Token (بصلاحية repo)</label>
                        <input id="githubToken" type="password" value="${token}" class="w-full border-2 p-2 rounded-xl" placeholder="ghp_xxxxx">
                        <small class="text-gray-500">أنشئ token من 
                            <a href="https://github.com/settings/tokens" target="_blank" class="text-blue-600 underline">هنا</a>
                            (حدد صلاحية repo)
                        </small>
                    </div>
                </div>

                <div style="margin-bottom:10px;">
                    <label class="font-semibold">📝 كود JavaScript للتحديث:</label>
                    <textarea id="updateCode" class="w-full border-2 p-3 rounded-xl font-mono text-sm" rows="12" placeholder="الصق كود التحديث هنا..."></textarea>
                </div>

                <button id="pushToGitHubBtn" class="btn-primary w-full">🚀 رفع إلى GitHub</button>
                <button id="saveSettingsBtn" class="btn-secondary w-full mt-2">💾 حفظ الإعدادات</button>
                <div id="pushStatus" class="mt-3 text-center"></div>

                <div class="footer-bar">${APP_CONFIG.footerText}</div>
            </div>`;

            // ====== 3. أحداث الأزرار ======
            document.getElementById('saveSettingsBtn').onclick = function() {
                var newSettings = {
                    token: document.getElementById('githubToken').value.trim(),
                    repoOwner: document.getElementById('repoOwner').value.trim(),
                    repoName: document.getElementById('repoName').value.trim(),
                    filePath: document.getElementById('filePath').value.trim() || 'updates.js'
                };
                localStorage.setItem('drmedia_github_push', JSON.stringify(newSettings));
                Utils.showMsg('✅ تم حفظ الإعدادات');
            };

            document.getElementById('pushToGitHubBtn').onclick = async function() {
                var newCode = document.getElementById('updateCode').value.trim();
                if (!newCode) {
                    Utils.showError('⚠️ الرجاء لصق كود التحديث');
                    return;
                }
                var settings = JSON.parse(localStorage.getItem('drmedia_github_push') || '{}');
                if (!settings.token || !settings.repoOwner || !settings.repoName) {
                    Utils.showError('⚠️ الرجاء ملء إعدادات الاتصال بـ GitHub أولاً');
                    return;
                }

                var statusDiv = document.getElementById('pushStatus');
                statusDiv.innerHTML = '<span style="color:blue;">🔄 جاري جلب الملف الحالي...</span>';

                var apiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${settings.filePath}`;
                try {
                    // أولاً: جلب الملف الحالي للحصول على sha والمحتوى القديم
                    var getRes = await fetch(apiUrl, {
                        headers: { 'Authorization': `token ${settings.token}` }
                    });
                    var sha = null;
                    var oldContent = '';
                    if (getRes.ok) {
                        var fileData = await getRes.json();
                        sha = fileData.sha;
                        // فك ترميز base64 للحصول على المحتوى القديم
                        oldContent = atob(fileData.content);
                    }

                    // إضافة الكود الجديد إلى نهاية المحتوى القديم
                    var updatedContent = oldContent + '\n\n' + newCode;
                    var contentEncoded = btoa(unescape(encodeURIComponent(updatedContent)));

                    var body = {
                        message: 'تحديث من تبويب تحديث النظام - أضاف كود جديد',
                        content: contentEncoded,
                        branch: 'main'
                    };
                    if (sha) body.sha = sha; // مطلوب عند التحديث

                    statusDiv.innerHTML = '<span style="color:blue;">🔄 جاري رفع التحديث...</span>';

                    var putRes = await fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${settings.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });

                    if (putRes.ok) {
                        statusDiv.innerHTML = '<span style="color:green;">✅ تم رفع التحديث بنجاح إلى GitHub! سيتم تطبيقه خلال 30 ثانية.</span>';
                    } else {
                        var err = await putRes.json();
                        throw new Error(err.message || 'فشل الرفع');
                    }
                } catch(e) {
                    statusDiv.innerHTML = `<span style="color:red;">❌ خطأ: ${e.message}</span>`;
                }
            };
        };

        console.log('✅ تبويب تحديث النظام (الآمن) جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(initSystemUpdater);
    });

    if (document.readyState !== 'loading') {
        waitForApp(initSystemUpdater);
    }
})();
