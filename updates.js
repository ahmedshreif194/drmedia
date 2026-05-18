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
    injectDateTime();
})();

// ====== تحديث: قوائم منسدلة شاملة للموظفين ======
(function() {
    console.log('🟢 تحميل: قوائم منسدلة للموظفين');
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
            var cell = cells[5];
            if (!cell || cell.querySelector('.emp-swap-select')) return;

            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            var assigned = booking.assignedEmployees || [];
            cell.innerHTML = '';
            var allEmployees = state.employees.filter(e => e.active);

            assigned.forEach(function(empId) {
                var emp = state.employees.find(e => e.id === empId);
                if (!emp) return;

                var select = document.createElement('select');
                select.className = 'emp-swap-select border p-1 rounded text-sm';
                select.style.cssText = 'margin-bottom:4px; width:100%;';

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
                    if (!newEmpId) {
                        booking.assignedEmployees = booking.assignedEmployees.filter(id => id !== oldEmpId);
                    } else {
                        var idx = booking.assignedEmployees.indexOf(oldEmpId);
                        if (idx !== -1) {
                            booking.assignedEmployees[idx] = newEmpId;
                        } else {
                            if (!booking.assignedEmployees.includes(newEmpId)) {
                                booking.assignedEmployees.push(newEmpId);
                            }
                        }
                    }
                    DataManager.updateEmployeeOrders();
                    DataManager.saveAllData();
                    Utils.showMsg('✅ تم تغيير الموظف');
                    AppRenderer.renderBookings();
                });

                cell.appendChild(select);
            });

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
                    <h3>إضافة موظف</h3>
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

    function init() {
        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings.apply(this, arguments);
            requestAnimationFrame(function() {
                enhanceBookingsTable();
            });
        };
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

// ====== تحديث: أزرار الحالة الثلاثية + أزرار إلغاء ======
(function() {
    console.log('🟢 تحميل: أزرار الحالة');
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

// ====== تحديث: تحسين تنسيق الجدول ======
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

// ====== تحديث: أنماط الشكل (Styles) ======
(function() {
    console.log('🟢 تحميل: أنماط الشكل');
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

// ====== تحديث: لوحة مراقبة حية (إصلاح النصوص) ======
(function() {
    console.log('🟢 تحميل: لوحة المراقبة');
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

                var container = document.createElement('div');
                container.id = 'liveMonitorCards';
                container.style.marginTop = '20px';
                var title = document.createElement('h3');
                title.style.fontWeight = 'bold';
                title.textContent = '📡 لوحة المراقبة الحية';
                container.appendChild(title);
                var grid = document.createElement('div');
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px,1fr))';
                grid.style.gap = '12px';

                function addCard(value, label, color) {
                    var card = document.createElement('div');
                    card.className = 'stat-card';
                    card.style.borderLeft = '4px solid ' + color;
                    var valDiv = document.createElement('div');
                    valDiv.className = 'stat-value';
                    valDiv.style.color = color;
                    valDiv.textContent = value;
                    var lblDiv = document.createElement('div');
                    lblDiv.className = 'stat-label';
                    lblDiv.textContent = label;
                    card.appendChild(valDiv);
                    card.appendChild(lblDiv);
                    grid.appendChild(card);
                }

                addCard(todayBookings, 'حجوزات اليوم', '#3b82f6');
                addCard(activeEmps, 'موظفون متواجدون', '#10b981');
                addCard(busyHalls, 'قاعات مشغولة', '#f59e0b');

                container.appendChild(grid);
                var contentArea = document.getElementById('content-area');
                if (contentArea) {
                    var firstGrid = contentArea.querySelector('.grid');
                    if (firstGrid) {
                        firstGrid.parentNode.insertBefore(container, firstGrid.nextSibling);
                    }
                }
            }, 200);
        };
    }
})();

// ====== تحديث: 10 مميزات متقدمة (مدمجة بشكل آمن) ======
(function() {
    console.log('🟢 تحميل: المميزات العشر');
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
    // مؤشر الاتصال في الأعلى
    function updateConnectionIndicator() {
        var indicator = document.getElementById('connectionIndicator');
        if (!indicator) return;
        var online = navigator.onLine;
        indicator.innerHTML = (online ? '🟢 متصل' : '🟠 غير متصل');
        indicator.style.color = online ? '#16a34a' : '#f59e0b';
    }
    // حقن المؤشر
    function injectConnectionIndicator() {
        // إخفاء الشريط السفلي
        var oldBar = document.getElementById('offlineStatusBar');
        if (oldBar) oldBar.style.display = 'none';

        var topbar = document.querySelector('.topbar');
        if (!topbar || document.getElementById('connectionIndicator')) return;

        var span = document.createElement('span');
        span.id = 'connectionIndicator';
        span.style.cssText = 'margin-right:15px; font-weight:bold; font-size:14px;';
        updateConnectionIndicator();

        var logoutBtn = topbar.querySelector('button');
        if (logoutBtn) {
            logoutBtn.parentNode.insertBefore(span, logoutBtn);
        } else {
            topbar.appendChild(span);
        }

        window.addEventListener('online', updateConnectionIndicator);
        window.addEventListener('offline', updateConnectionIndicator);
    }

    window.addEventListener('DOMContentLoaded', function() {
        var check = setInterval(function() {
            if (document.querySelector('.topbar')) {
                injectConnectionIndicator();
                clearInterval(check);
            }
        }, 200);
    });

    // لو النظام جاهز
    if (document.querySelector('.topbar')) {
        injectConnectionIndicator();
    }

    // الصفحة العامة
    if (window.location.search.includes('public')) {
        document.body.innerHTML = '<div style="padding:20px;font-family:Tahoma;text-align:center;"><h1>📋 حجوزات اليوم</h1>' +
        state.bookings.filter(b => b.date === Utils.getTodayDateStr() && !b.deleted).map(b => `<p>${b.hallName} - ${b.clientName}</p>`).join('') + '</div>';
    }
})();

// ====== تحديث: ترتيب الأوردرات في واجهة الموظف ======
(function() {
    console.log('🟢 تحميل: ترتيب الأوردرات');
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
    console.log('🟢 تحميل: إصلاح التزامن والموبايل');
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

// ====== تحديث: حضور سابق متعدد ======
(function() {
    console.log('🟢 تحميل: حضور سابق متعدد');
    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    function init() {
        AppRenderer.showPastAttendanceModal = function() {
            var empOpts = state.employees.map(e => 
                `<option value="${e.id}">${e.name} (${e.role})</option>`
            ).join('');
            Utils.openModal(`
                <h3 class="text-xl font-bold mb-4">📅 تسجيل حضور / انصراف (متعدد)</h3>
                <p class="text-sm mb-2">اختر الموظفين:</p>
                <select id="pastEmpSelect" multiple class="w-full border-2 p-2 my-2 rounded-xl h-40">${empOpts}</select>
                <input type="date" id="pastDate" class="w-full border-2 p-2 my-2 rounded-xl" value="${Utils.getTodayDateStr()}">
                <div class="flex gap-2 mt-4">
                    <button onclick="AppRenderer.recordPastAttendanceMulti()" class="btn-primary flex-1">✅ حضور وانصراف</button>
                    <button onclick="Utils.closeModal()" class="btn-outline flex-1">إلغاء</button>
                </div>
            `);
        };

        AppRenderer.recordPastAttendanceMulti = function() {
            var empSelect = document.getElementById('pastEmpSelect');
            var dateInput = document.getElementById('pastDate');
            if (!empSelect || !dateInput) return;
            var opts = Array.from(empSelect.selectedOptions);
            if (!opts.length) return Utils.showError('اختر موظفًا واحدًا على الأقل');
            opts.forEach(function(opt) {
                AttendanceManager.recordAttendanceForDate(opt.value, dateInput.value, 'checkIn');
                AttendanceManager.recordAttendanceForDate(opt.value, dateInput.value, 'checkOut');
            });
            Utils.closeModal();
            AppRenderer.renderAttendance();
            Utils.showMsg(`✅ تم تسجيل ${opts.length} موظف`);
        };
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(init); });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== تحديث: أزرار التوزيع الإضافية (العادل + غير المعينين + الاستكمال) ======
(function() {
    console.log('🟢 تحميل: أزرار التوزيع الإضافية');

    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    function injectButtons() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (!container) return;

            if (!document.getElementById('fairDistributeBtn')) {
                var btn1 = document.createElement('button');
                btn1.id = 'fairDistributeBtn';
                btn1.className = 'btn-secondary';
                btn1.textContent = '🧑‍🤝‍🧑 توزيع عادل للحضور';
                btn1.onclick = async function() {
                    var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
                    if (!pending.length) return Utils.showWarning('لا توجد حجوزات');
                    pending.forEach(b => b.assignedEmployees = []);
                    var dirs = state.employees.filter(e => e.role === 'مخرج' && e.active);
                    var phs = state.employees.filter(e => e.role === 'مصور' && e.active);
                    var crs = state.employees.filter(e => e.role === 'كرين' && e.active);
                    pending.forEach(function(b) {
                        var presentIds = state.attendanceRecords.filter(a => a.date === b.date && a.checkIn).map(a => a.empId);
                        function pick(emps) { var av = emps.filter(e => presentIds.includes(e.id)); av.sort((a,b)=> (a.totalOrders||0)-(b.totalOrders||0)); return av[0] || null; }
                        var assigned = [];
                        if ((state.halls.find(h=>h.id===b.hallId)||{}).type === 'cafe') { var p = pick(phs); if(p) assigned.push(p.id); }
                        else {
                            var d = pick(dirs); if(d) assigned.push(d.id);
                            var phList = phs.filter(e=>presentIds.includes(e.id)).sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
                            for(var i=0; i<Math.min(2,phList.length); i++) assigned.push(phList[i].id);
                            var c = pick(crs); if(c) assigned.push(c.id);
                        }
                        b.assignedEmployees = assigned;
                    });
                    DataManager.updateEmployeeOrders(); await DataManager.saveAllData();
                    AppRenderer.renderBookings(); AppRenderer.renderDistribution();
                    Utils.showMsg('✅ توزيع عادل للحضور');
                };
                container.appendChild(btn1);
            }

            if (!document.getElementById('distributeUnassignedBtn')) {
                var btn2 = document.createElement('button');
                btn2.id = 'distributeUnassignedBtn';
                btn2.className = 'btn-secondary';
                btn2.style.backgroundColor = '#f97316'; btn2.style.color = 'white';
                btn2.textContent = '⚡ توزيع غير المعينين';
                btn2.onclick = async function() {
                    var unassigned = state.bookings.filter(b => b.status === 'pending' && !b.deleted && (!b.assignedEmployees || b.assignedEmployees.length === 0));
                    if (!unassigned.length) return Utils.showWarning('لا توجد حجوزات غير معينة');
                    var dirs = state.employees.filter(e => e.role === 'مخرج' && e.active);
                    var phs = state.employees.filter(e => e.role === 'مصور' && e.active);
                    var crs = state.employees.filter(e => e.role === 'كرين' && e.active);
                    unassigned.forEach(function(b) {
                        var presentIds = state.attendanceRecords.filter(a => a.date === b.date && a.checkIn).map(a => a.empId);
                        function pick(emps) { var av = emps.filter(e => presentIds.includes(e.id)); av.sort((a,b)=> (a.totalOrders||0)-(b.totalOrders||0)); return av[0] || null; }
                        var assigned = [];
                        if ((state.halls.find(h=>h.id===b.hallId)||{}).type === 'cafe') { var p = pick(phs); if(p) assigned.push(p.id); }
                        else {
                            var d = pick(dirs); if(d) assigned.push(d.id);
                            var phList = phs.filter(e=>presentIds.includes(e.id)).sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
                            for(var i=0; i<Math.min(2,phList.length); i++) assigned.push(phList[i].id);
                            var c = pick(crs); if(c) assigned.push(c.id);
                        }
                        b.assignedEmployees = assigned;
                    });
                    DataManager.updateEmployeeOrders(); await DataManager.saveAllData();
                    AppRenderer.renderBookings(); AppRenderer.renderDistribution();
                    Utils.showMsg('✅ توزيع غير المعينين');
                };
                container.appendChild(btn2);
            }

            if (!document.getElementById('equalizeDistBtn')) {
                var btn3 = document.createElement('button');
                btn3.id = 'equalizeDistBtn';
                btn3.className = 'btn-secondary';
                btn3.style.backgroundColor = '#8b5cf6'; btn3.style.color = 'white';
                btn3.textContent = '📊 استكمال / توزيع متساوي';
                btn3.onclick = async function() {
                    var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
                    if (!pending.length) return Utils.showWarning('لا توجد حجوزات');
                    pending.forEach(b => b.assignedEmployees = []);
                    var dirs = state.employees.filter(e => e.role === 'مخرج' && e.active).sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
                    var phs = state.employees.filter(e => e.role === 'مصور' && e.active).sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
                    var crs = state.employees.filter(e => e.role === 'كرين' && e.active).sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
                    var dirIdx=0, phIdx=0, crIdx=0;
                    var byDate = {};
                    pending.forEach(b => { if(!byDate[b.date]) byDate[b.date]=[]; byDate[b.date].push(b); });
                    Object.keys(byDate).sort().forEach(function(date) {
                        var busy = new Set();
                        byDate[date].forEach(function(b) {
                            var hallType = (state.halls.find(h=>h.id===b.hallId)||{}).type || 'closed';
                            var assigned = [];
                            if (hallType === 'cafe') {
                                for(var i=0; i<phs.length; i++) { var idx=(phIdx+i)%phs.length; if(!busy.has(phs[idx].id)) { assigned.push(phs[idx].id); busy.add(phs[idx].id); phIdx=(idx+1)%phs.length; break; } }
                                if(!assigned.length && phs.length) assigned.push(phs[phIdx%phs.length].id);
                            } else {
                                for(var i=0; i<dirs.length; i++) { var idx=(dirIdx+i)%dirs.length; if(!busy.has(dirs[idx].id)) { assigned.push(dirs[idx].id); busy.add(dirs[idx].id); dirIdx=(idx+1)%dirs.length; break; } }
                                for(var i=0; i<2; i++) { for(var j=0; j<phs.length; j++) { var idx=(phIdx+j)%phs.length; if(!busy.has(phs[idx].id) && !assigned.includes(phs[idx].id)) { assigned.push(phs[idx].id); busy.add(phs[idx].id); phIdx=(idx+1)%phs.length; break; } } }
                                for(var i=0; i<crs.length; i++) { var idx=(crIdx+i)%crs.length; if(!busy.has(crs[idx].id)) { assigned.push(crs[idx].id); busy.add(crs[idx].id); crIdx=(idx+1)%crs.length; break; } }
                            }
                            b.assignedEmployees = assigned;
                        });
                    });
                    DataManager.updateEmployeeOrders(); await DataManager.saveAllData();
                    AppRenderer.renderBookings(); AppRenderer.renderDistribution();
                    Utils.showMsg('✅ توزيع متساو');
                };
                container.appendChild(btn3);
            }
            observer.disconnect();
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(injectButtons); });
    if (document.readyState !== 'loading') waitForApp(injectButtons);
})();

// ====== تحديث: اختبار التحديث (مُصحح) ======
(function() {
    console.log('🟢 تم تحميل ميزة اختبار التحديث');
    var checkInterval = setInterval(function() {
        var topbar = document.querySelector('.topbar');
        if (topbar && !document.getElementById('testUpdateBtn')) {
            clearInterval(checkInterval);
            var btn = document.createElement('button');
            btn.id = 'testUpdateBtn';
            btn.textContent = '🧪 اختبار التحديث';
            btn.style.cssText = 'margin:0 10px; padding:6px 14px; background:#f59e0b; color:white; border:none; border-radius:20px; cursor:pointer; font-weight:bold;';
            btn.onclick = function() { Utils.showMsg('✅ التحديثات تعمل بنجاح!', 'success'); };
            var logoutBtn = topbar.querySelector('button');
            if (logoutBtn) {
                logoutBtn.parentNode.insertBefore(btn, logoutBtn);  // تم التصحيح: btn وليس span
            } else {
                topbar.appendChild(btn);
            }
        }
    }, 300);
})();
// ====== تحديث: تعديل الأوردرات في صفحة الموظفين + تسوية تلقائية (النسخة النهائية) ======
(function() {
    console.log('🟢 تحميل: تعديل الأوردرات مع التسوية التلقائية (النسخة النهائية)');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    // دالة التسوية (إعادة توزيع الحجوزات المعلقة بالتساوي)
    async function equalizeOrders() {
        var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
        if (!pending.length) {
            console.log('لا توجد حجوزات معلقة للتسوية');
            return;
        }

        // مسح التوزيعات السابقة
        pending.forEach(b => b.assignedEmployees = []);

        var dirs = state.employees.filter(e => e.role === 'مخرج' && e.active)
                    .sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
        var phs  = state.employees.filter(e => e.role === 'مصور' && e.active)
                    .sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));
        var crs  = state.employees.filter(e => e.role === 'كرين' && e.active)
                    .sort((a,b)=>(a.totalOrders||0)-(b.totalOrders||0));

        var dirIdx = 0, phIdx = 0, crIdx = 0;

        var byDate = {};
        pending.forEach(b => {
            if (!byDate[b.date]) byDate[b.date] = [];
            byDate[b.date].push(b);
        });

        Object.keys(byDate).sort().forEach(function(date) {
            var busy = new Set();
            byDate[date].forEach(function(b) {
                var hallType = (state.halls.find(h => h.id === b.hallId) || {}).type || 'closed';
                var assigned = [];

                if (hallType === 'cafe') {
                    for (var i = 0; i < phs.length; i++) {
                        var idx = (phIdx + i) % phs.length;
                        var emp = phs[idx];
                        if (!busy.has(emp.id)) { assigned.push(emp.id); busy.add(emp.id); phIdx = (idx+1)%phs.length; break; }
                    }
                    if (!assigned.length && phs.length) assigned.push(phs[phIdx % phs.length].id);
                } else {
                    for (var i = 0; i < dirs.length; i++) {
                        var idx = (dirIdx + i) % dirs.length;
                        var emp = dirs[idx];
                        if (!busy.has(emp.id)) { assigned.push(emp.id); busy.add(emp.id); dirIdx = (idx+1)%dirs.length; break; }
                    }
                    for (var i = 0; i < 2; i++) {
                        for (var j = 0; j < phs.length; j++) {
                            var idx = (phIdx + j) % phs.length;
                            var emp = phs[idx];
                            if (!busy.has(emp.id) && !assigned.includes(emp.id)) { assigned.push(emp.id); busy.add(emp.id); phIdx = (idx+1)%phs.length; break; }
                        }
                    }
                    for (var i = 0; i < crs.length; i++) {
                        var idx = (crIdx + i) % crs.length;
                        var emp = crs[idx];
                        if (!busy.has(emp.id)) { assigned.push(emp.id); busy.add(emp.id); crIdx = (idx+1)%crs.length; break; }
                    }
                }

                b.assignedEmployees = assigned;
            });
        });

        DataManager.updateEmployeeOrders();
        await DataManager.saveAllData();
        console.log('✅ التسوية اكتملت');
    }

    // جعل خلية "الأوردرات" قابلة للتعديل
    function enableEmployeeOrderEditing() {
        var table = document.querySelector('#content-area table');
        if (!table || table.dataset.empOrderEditEnabled) return;
        table.dataset.empOrderEditEnabled = 'true';

        // البحث عن فهرس العمود "الأوردرات" من العنوان
        var headerCells = table.querySelectorAll('thead th');
        var orderColumnIndex = -1;
        headerCells.forEach(function(th, i) {
            if (th.textContent.includes('الأوردرات')) {
                orderColumnIndex = i;
            }
        });
        if (orderColumnIndex === -1) {
            console.warn('لم يتم العثور على عمود "الأوردرات"');
            return;
        }
        console.log('فهرس عمود الأوردرات:', orderColumnIndex);

        table.addEventListener('click', function(e) {
            var target = e.target;
            // نتأكد أننا في الخلية الصحيحة وأنها تحتوي على رقم (نصيًا) وليس input
            if (target.tagName === 'TD' && target.cellIndex === orderColumnIndex && !target.querySelector('input') && /^\d+$/.test(target.textContent.trim())) {
                var row = target.closest('tr');
                var nameCell = row?.cells[0];
                if (!nameCell) return;
                var empName = nameCell.textContent.trim();
                var emp = state.employees.find(em => em.name === empName);
                if (!emp) return;

                var input = document.createElement('input');
                input.type = 'number';
                input.className = 'order-edit-input border-2 p-1 rounded text-sm';
                input.style.width = '60px';
                input.value = emp.totalOrders || 0;
                target.textContent = '';
                target.appendChild(input);
                input.focus();

                async function saveEdit() {
                    var newVal = parseInt(input.value) || 0;
                    if (newVal !== emp.totalOrders) {
                        console.log(`تغيير ${empName}: من ${emp.totalOrders} إلى ${newVal}`);
                        emp.totalOrders = newVal;
                        await equalizeOrders();           // التسوية التلقائية
                        AppRenderer.renderEmployees();    // إعادة رسم صفحة الموظفين
                        Utils.showMsg(`✅ تم تعديل أوردرات ${empName} وإعادة التسوية`);
                    } else {
                        target.textContent = newVal;
                    }
                }

                input.addEventListener('blur', saveEdit);
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        input.blur();
                    }
                });
            }
        });
    }

    // ربط التحسينات برسم الموظفين
    function init() {
        if (typeof AppRenderer !== 'undefined') {
            var origRenderEmployees = AppRenderer.renderEmployees;
            AppRenderer.renderEmployees = function() {
                origRenderEmployees.apply(this, arguments);
                setTimeout(enableEmployeeOrderEditing, 200);
            };
        }
        // تنفيذ فوري
        if (document.querySelector('#content-area table tbody')) {
            enableEmployeeOrderEditing();
        }
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(init); });
    if (document.readyState !== 'loading') waitForApp(init);
})();
// ====== تحديث: تجميع الحجوزات بالشهر + استيراد لشهر محدد ======
(function() {
    console.log('🟢 تحميل: تجميع الحجوزات بالشهر واستيراد شهري');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    // ---------- 1. فلتر الشهر ----------
    if (!state.filters) state.filters = {};
    // سنة/شهر افتراضي: الشهر الحالي
    if (!state.filters.bookingYear) state.filters.bookingYear = new Date().getFullYear();
    if (!state.filters.bookingMonth) state.filters.bookingMonth = new Date().getMonth() + 1; // 1-12

    // ---------- 2. حقن شريط اختيار الشهر في صفحة الحجوزات ----------
    function injectMonthFilter() {
        var container = document.querySelector('#content-area .bg-card .flex.justify-between.flex-wrap');
        if (!container || document.getElementById('monthFilterBar')) return;

        var monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                         'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

        var currentYear = state.filters.bookingYear;
        var currentMonth = state.filters.bookingMonth;

        var bar = document.createElement('div');
        bar.id = 'monthFilterBar';
        bar.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'btn-outline text-sm';
        prevBtn.textContent = '◀';
        prevBtn.onclick = function() {
            if (state.filters.bookingMonth === 1) {
                state.filters.bookingMonth = 12;
                state.filters.bookingYear--;
            } else {
                state.filters.bookingMonth--;
            }
            AppRenderer.renderBookings();
        };

        var nextBtn = document.createElement('button');
        nextBtn.className = 'btn-outline text-sm';
        nextBtn.textContent = '▶';
        nextBtn.onclick = function() {
            if (state.filters.bookingMonth === 12) {
                state.filters.bookingMonth = 1;
                state.filters.bookingYear++;
            } else {
                state.filters.bookingMonth++;
            }
            AppRenderer.renderBookings();
        };

        var label = document.createElement('span');
        label.style.cssText = 'font-weight:bold; min-width:120px; text-align:center;';
        label.textContent = monthNames[currentMonth-1] + ' ' + currentYear;

        var todayBtn = document.createElement('button');
        todayBtn.className = 'btn-outline text-sm';
        todayBtn.textContent = '📍 الشهر الحالي';
        todayBtn.onclick = function() {
            var now = new Date();
            state.filters.bookingYear = now.getFullYear();
            state.filters.bookingMonth = now.getMonth() + 1;
            AppRenderer.renderBookings();
        };

        bar.appendChild(prevBtn);
        bar.appendChild(label);
        bar.appendChild(nextBtn);
        bar.appendChild(todayBtn);

        // إدراج الشريط بعد سطر "الإيرادات"
        var revLine = document.querySelector('#content-area .text-sm.mb-2');
        if (revLine) {
            revLine.insertAdjacentElement('afterend', bar);
        } else {
            container.insertAdjacentElement('afterend', bar);
        }
    }

    // ---------- 3. تعديل renderBookings ليطبق فلتر الشهر ----------
    function patchRenderBookings() {
        var origRender = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            // حفظ الفلاتر الأصلية مؤقتاً
            var origFrom = state.filters.bookingDateFrom;
            var origTo = state.filters.bookingDateTo;
            var origStatus = state.filters.bookingStatus;
            var origHall = state.filters.bookingHall;

            // تطبيق فلتر الشهر
            var y = state.filters.bookingYear;
            var m = state.filters.bookingMonth;
            var lastDay = new Date(y, m, 0).getDate();
            state.filters.bookingDateFrom = `${y}-${String(m).padStart(2,'0')}-01`;
            state.filters.bookingDateTo = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

            origRender.apply(this, arguments);

            // استعادة القيم السابقة (كي لا تؤثر على التوزيع أو غيره)
            state.filters.bookingDateFrom = origFrom;
            state.filters.bookingDateTo = origTo;
            state.filters.bookingStatus = origStatus;
            state.filters.bookingHall = origHall;

            // حقن شريط الشهر بعد الرسم
            setTimeout(injectMonthFilter, 100);
        };
    }

    // ---------- 4. استيراد حجوزات إلى شهر محدد ----------
    function patchImport() {
        var origImport = BookingManager.importFromFile;
        BookingManager.importFromFile = function() {
            origImport.apply(this, arguments);

            // إضافة حقل "استيراد إلى شهر" بعد النافذة الأصلية تُفتح
            setTimeout(function() {
                var modalContent = document.getElementById('modalContent');
                if (!modalContent || modalContent.querySelector('#importTargetMonth')) return;

                var selectHTML = `
                <div id="importTargetMonth" style="margin-top:12px;">
                    <label class="text-sm font-semibold">🗓️ استيراد إلى شهر:</label>
                    <select id="importMonthSelect" class="w-full border-2 p-2 rounded-xl mt-1">
                        <option value="">الحفاظ على التواريخ الأصلية</option>
                        ${(() => {
                            var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                                         'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
                            var now = new Date();
                            var opts = '';
                            for (var y = now.getFullYear(); y <= now.getFullYear()+1; y++) {
                                for (var m = 1; m <= 12; m++) {
                                    var val = y + '-' + String(m).padStart(2,'0');
                                    var text = months[m-1] + ' ' + y;
                                    opts += `<option value="${val}">${text}</option>`;
                                }
                            }
                            return opts;
                        })()}
                    </select>
                </div>`;

                // إدراج قبل أزرار الاستيراد
                var btnContainer = modalContent.querySelector('.flex.gap-2');
                if (btnContainer) {
                    btnContainer.insertAdjacentHTML('beforebegin', selectHTML);
                }

                // تعديل دالة processImport لتأخذ الشهر بعين الاعتبار
                var origProcess = BookingManager.processImport;
                BookingManager.processImport = async function() {
                    var targetMonth = document.getElementById('importMonthSelect')?.value || '';
                    var rows = window._importedRows || [];
                    if (!rows.length) { Utils.showError('لا بيانات'); return; }

                    var sel = document.getElementById('importHallTypeSelect');
                    var selectedHallType = sel ? sel.value : '';
                    var added = 0;

                    for (var row of rows) {
                        var name = row['اسم العميل'] || row['client name'] || row['العميل'] || '';
                        if (!name || name.trim() === '' || name.trim() === '-') continue;
                        var date = Utils.parseDateString(row['التاريخ'] || row['date']);
                        var hallName = row['القاعة'] || row['hall'] || 'القاعة المفتوحة';
                        var hall = state.halls.find(h => h.name === hallName);
                        if (hall && selectedHallType) hall.type = selectedHallType;
                        if (!hall) { hall = { id: Utils.generateId('h_'), name: hallName, type: selectedHallType || row['نوع القاعة'] || 'open', basePrice:0, active:true }; state.halls.push(hall); }

                        // إذا اختار المستخدم شهراً محدداً، نعدل التاريخ
                        var finalDate = date;
                        if (targetMonth) {
                            var parts = targetMonth.split('-');
                            var y = parseInt(parts[0]), m = parseInt(parts[1]);
                            var day = new Date(date).getDate(); // نحتفظ باليوم الأصلي إن وجد
                            var maxDay = new Date(y, m, 0).getDate();
                            if (day > maxDay) day = maxDay;
                            finalDate = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        }

                        state.bookings.push({
                            id: Utils.generateId('b_'), clientName: name, clientId: null,
                            phone: row['الهاتف'] || row['phone'] || '',
                            hallId: hall.id, hallName: hall.name,
                            date: finalDate,
                            price: parseInt(row['السعر'] || row['price'] || 0) || 0,
                            status: 'pending', paymentStatus: 'pending',
                            assignedEmployees: [], notes: '',
                            packageType: row['نوع الباكدج'] || row['package'] || '',
                            totalPersons: parseInt(row['اجمالي عدد الافراد'] || row['total persons'] || 0) || 0
                        });
                        added++;
                    }

                    await DataManager.saveAllData();
                    AppRenderer.renderBookings();
                    Utils.closeModal();
                    Utils.showMsg(`✅ تم استيراد ${added} حجز`);
                    window._importedRows = [];
                };
            }, 300);
        };
    }

    // ---------- 5. بدء التعديلات ----------
    function init() {
        patchRenderBookings();
        patchImport();
        console.log('✅ تجميع الحجوزات بالشهر واستيراد شهري جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(init); });
    if (document.readyState !== 'loading') waitForApp(init);
})();
// ====== تحديث: فلتر الشهر والسنة لصفحة الفلاشات ======
(function() {
    console.log('🟢 تحميل: فلتر الشهر والسنة للفلاشات');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    // إعدادات افتراضية للشهر الحالي
    if (!state.flashFilters) {
        state.flashFilters = {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1 // 1-12
        };
    }

    var monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    // ---------- فلترة الفلاشات حسب الشهر المختار ----------
    function getFilteredFlashes() {
        return state.flashDrives.filter(function(f) {
            var b = state.bookings.find(function(bk) { return bk.id === f.bookingId; });
            if (!b) return false;
            var d = new Date(b.date);
            return d.getFullYear() === state.flashFilters.year &&
                   (d.getMonth() + 1) === state.flashFilters.month;
        });
    }

    // ---------- تحديث شريط التنقل ----------
    function updateFlashMonthBar() {
        var bar = document.getElementById('flashMonthBar');
        var label = bar?.querySelector('.month-label');
        if (label) {
            label.textContent = monthNames[state.flashFilters.month-1] + ' ' + state.flashFilters.year;
        }
    }

    // ---------- إنشاء شريط التنقل وإدراجه ----------
    function injectFlashMonthBar() {
        // ننتظر حتى تظهر عناصر صفحة الفلاشات
        var container = document.querySelector('#content-area .bg-card');
        if (!container || document.getElementById('flashMonthBar')) return;

        var bar = document.createElement('div');
        bar.id = 'flashMonthBar';
        bar.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:16px; flex-wrap:wrap;';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'btn-outline text-sm';
        prevBtn.textContent = '◀';
        prevBtn.onclick = function() {
            if (state.flashFilters.month === 1) {
                state.flashFilters.month = 12;
                state.flashFilters.year--;
            } else {
                state.flashFilters.month--;
            }
            AppRenderer.renderFlash();
        };

        var nextBtn = document.createElement('button');
        nextBtn.className = 'btn-outline text-sm';
        nextBtn.textContent = '▶';
        nextBtn.onclick = function() {
            if (state.flashFilters.month === 12) {
                state.flashFilters.month = 1;
                state.flashFilters.year++;
            } else {
                state.flashFilters.month++;
            }
            AppRenderer.renderFlash();
        };

        var label = document.createElement('span');
        label.className = 'month-label';
        label.style.cssText = 'font-weight:bold; min-width:120px; text-align:center;';
        label.textContent = monthNames[state.flashFilters.month-1] + ' ' + state.flashFilters.year;

        var todayBtn = document.createElement('button');
        todayBtn.className = 'btn-outline text-sm';
        todayBtn.textContent = '📍 الشهر الحالي';
        todayBtn.onclick = function() {
            var now = new Date();
            state.flashFilters.year = now.getFullYear();
            state.flashFilters.month = now.getMonth() + 1;
            AppRenderer.renderFlash();
        };

        bar.appendChild(prevBtn);
        bar.appendChild(label);
        bar.appendChild(nextBtn);
        bar.appendChild(todayBtn);

        // إدراج الشريط في أعلى البطاقة، قبل الجدول
        var tableWrapper = container.querySelector('.overflow-x-auto');
        if (tableWrapper) {
            container.insertBefore(bar, tableWrapper);
        } else {
            container.appendChild(bar);
        }
    }

    // ---------- تعديل renderFlash الأساسي ----------
    function patchRenderFlash() {
        var origRender = AppRenderer.renderFlash;
        AppRenderer.renderFlash = function() {
            // فلترة الفلاشات
            var originalFlash = state.flashDrives;
            state.flashDrives = getFilteredFlashes();

            // رسم الجدول بالفلاشات المفلترة
            origRender.apply(this, arguments);

            // استعادة القائمة الأصلية
            state.flashDrives = originalFlash;

            // حقن شريط التنقل وتحديثه
            injectFlashMonthBar();
        };
    }

    function init() {
        patchRenderFlash();
        console.log('✅ فلتر الشهر للفلاشات جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(init); });
    if (document.readyState !== 'loading') waitForApp(init);
})();
// ====== تحديث: إضافة فلتر الشهر والسنة لصفحة التوزيع ======
(function() {
    console.log('🟢 تحميل: فلتر الشهر والسنة للتوزيع');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    // ---------- 1. قيم افتراضية للتوزيع ----------
    if (!state.filters) state.filters = {};
    if (!state.filters.distYear) state.filters.distYear = new Date().getFullYear();
    if (!state.filters.distMonth) state.filters.distMonth = new Date().getMonth() + 1; // 1-12

    var monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    // ---------- 2. حقن شريط اختيار الشهر في صفحة التوزيع ----------
    function injectDistMonthBar() {
        if (document.getElementById('distMonthBar')) return;
        var container = document.querySelector('#content-area .bg-card .flex.flex-wrap');
        if (!container) return;

        var currentYear = state.filters.distYear;
        var currentMonth = state.filters.distMonth;

        var bar = document.createElement('div');
        bar.id = 'distMonthBar';
        bar.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'btn-outline text-sm';
        prevBtn.textContent = '◀';
        prevBtn.onclick = function() {
            if (state.filters.distMonth === 1) {
                state.filters.distMonth = 12;
                state.filters.distYear--;
            } else {
                state.filters.distMonth--;
            }
            AppRenderer.renderDistribution();
        };

        var nextBtn = document.createElement('button');
        nextBtn.className = 'btn-outline text-sm';
        nextBtn.textContent = '▶';
        nextBtn.onclick = function() {
            if (state.filters.distMonth === 12) {
                state.filters.distMonth = 1;
                state.filters.distYear++;
            } else {
                state.filters.distMonth++;
            }
            AppRenderer.renderDistribution();
        };

        var label = document.createElement('span');
        label.style.cssText = 'font-weight:bold; min-width:120px; text-align:center;';
        label.textContent = monthNames[currentMonth-1] + ' ' + currentYear;

        var todayBtn = document.createElement('button');
        todayBtn.className = 'btn-outline text-sm';
        todayBtn.textContent = '📍 الشهر الحالي';
        todayBtn.onclick = function() {
            var now = new Date();
            state.filters.distYear = now.getFullYear();
            state.filters.distMonth = now.getMonth() + 1;
            AppRenderer.renderDistribution();
        };

        bar.appendChild(prevBtn);
        bar.appendChild(label);
        bar.appendChild(nextBtn);
        bar.appendChild(todayBtn);

        // إدراج الشريط بعد العنوان أو بداية البطاقة
        var title = container.querySelector('h2');
        if (title) {
            title.insertAdjacentElement('afterend', bar);
        } else {
            container.insertAdjacentElement('afterbegin', bar);
        }
    }

    // ---------- 3. تعديل renderDistribution ليطبق الفلتر ----------
    function patchRenderDistribution() {
        var origRender = AppRenderer.renderDistribution;
        AppRenderer.renderDistribution = function() {
            // فلترة الحجوزات المعلقة حسب الشهر المختار
            var y = state.filters.distYear;
            var m = state.filters.distMonth;
            var allPending = state.bookings.filter(function(b) {
                return b.status === 'pending' && !b.deleted;
            });
            var filtered = allPending.filter(function(b) {
                var d = new Date(b.date);
                return d.getFullYear() === y && (d.getMonth() + 1) === m;
            });

            // حفظ المرجع الأصلي
            var originalBookings = state.bookings;
            // استبدال مؤقت بقائمة الحجوزات المعلقة المفلترة فقط (للتوزيع)
            // لكننا لا نريد تغيير state.bookings بالكامل، لذلك نمرر filtered كمتغير محلي عبر تعديل بسيط:
            // سنستخدم طريقة آمنة: نعدل الدالة مؤقتًا
            var origFilter = state.bookings.filter;
            state.bookings.filter = function(fn) {
                // إذا كانت الدالة fn تطابق فلترة status==='pending'، نرجع filtered
                // للحفاظ على الأمان، نفحص إذا كانت fn تشبه فلترة renderDistribution
                var testObj = {status:'pending', deleted:false};
                if (fn(testObj) === true) {
                    return filtered;
                }
                return origFilter.call(this, fn);
            };

            origRender.apply(this, arguments);

            // إعادة المرجع الأصلي
            state.bookings.filter = origFilter;

            // حقن الشريط
            setTimeout(injectDistMonthBar, 100);
        };
    }

    // ---------- 4. بدء التعديلات ----------
    function init() {
        patchRenderDistribution();
        console.log('✅ فلتر الشهر للتوزيع جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(init); });
    if (document.readyState !== 'loading') waitForApp(init);
})();
// ====== تحديث: شكل الواجهة الجديد (شبيه بالتصميم المطلوب) ======
(function() {
    console.log('🟢 تحميل: شكل الواجهة الجديد');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    function injectNewStyle() {
        if (document.getElementById('modern-style-drmedia')) return;

        var style = document.createElement('style');
        style.id = 'modern-style-drmedia';
        style.textContent = `
            /* ====== الأساسيات ====== */
            :root {
                --sidebar-bg: #1e293b;
                --sidebar-text: #cbd5e1;
                --sidebar-active-bg: #16a34a;
                --sidebar-active-text: #ffffff;
                --topbar-bg: #ffffff;
                --topbar-border: #e2e8f0;
                --card-bg: #ffffff;
                --card-border: #e2e8f0;
                --card-shadow: 0 4px 12px rgba(0,0,0,0.03);
                --btn-radius: 10px;
                --font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
            }

            body {
                font-family: var(--font-family);
                background: #f8fafc;
            }

            /* ====== الشريط الجانبي ====== */
            .sidebar {
                background: var(--sidebar-bg) !important;
                border-left: none !important;
                box-shadow: 2px 0 15px rgba(0,0,0,0.05);
            }
            .sidebar .footer-bar {
                color: #94a3b8 !important;
                border-top: 1px solid #334155 !important;
            }
            .sidebar-item {
                color: var(--sidebar-text) !important;
                border-right: none !important;
                margin: 4px 10px !important;
                border-radius: 12px !important;
                transition: all 0.2s !important;
            }
            .sidebar-item:hover {
                background: #334155 !important;
                color: white !important;
            }
            .sidebar-item.active {
                background: var(--sidebar-active-bg) !important;
                color: var(--sidebar-active-text) !important;
                font-weight: 600 !important;
                box-shadow: 0 4px 12px rgba(22,163,74,0.3);
            }

            /* ====== الشريط العلوي ====== */
            .topbar {
                background: var(--topbar-bg) !important;
                border-bottom: 1px solid var(--topbar-border) !important;
                box-shadow: none !important;
            }

            /* ====== البطاقات الإحصائية ====== */
            .stat-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 16px !important;
                padding: 20px 15px !important;
                box-shadow: var(--card-shadow) !important;
                transition: transform 0.2s;
            }
            .stat-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 25px rgba(0,0,0,0.08);
            }
            .stat-value {
                font-size: 1.8rem !important;
                margin-bottom: 4px;
            }
            .stat-label {
                font-size: 0.8rem !important;
                color: #64748b !important;
            }

            /* ====== البطاقات العامة ====== */
            .bg-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 18px !important;
                padding: 22px !important;
                box-shadow: var(--card-shadow) !important;
            }

            /* ====== الأزرار ====== */
            .btn, button {
                border-radius: var(--btn-radius) !important;
                font-weight: 500 !important;
                transition: all 0.2s !important;
            }
            .btn-primary {
                background: #16a34a !important;
                box-shadow: 0 4px 10px rgba(22,163,74,0.2);
            }
            .btn-primary:hover {
                background: #15803d !important;
            }
            .btn-outline {
                border: 1px solid #d1d5db !important;
                background: white !important;
            }
            .btn-outline:hover {
                background: #f9fafb !important;
                border-color: #9ca3af !important;
            }

            /* ====== الجداول ====== */
            table {
                border-collapse: separate;
                border-spacing: 0;
                border-radius: 14px;
                overflow: hidden;
                border: 1px solid #e2e8f0;
            }
            th {
                background: #f8fafc !important;
                font-weight: 600 !important;
                color: #334155 !important;
                border-bottom: 1px solid #e2e8f0 !important;
                padding: 14px 12px !important;
            }
            td {
                padding: 12px !important;
                border-bottom: 1px solid #f1f5f9 !important;
            }
            tbody tr:hover td {
                background: #f0fdf4 !important;
            }

            /* ====== الشارات ====== */
            .status-badge, .badge-active, .badge-inactive {
                border-radius: 20px !important;
                padding: 5px 14px !important;
                font-size: 0.7rem !important;
            }

            /* ====== النوافذ المنبثقة ====== */
            .modal-content {
                border-radius: 20px !important;
                padding: 28px !important;
                box-shadow: 0 25px 60px rgba(0,0,0,0.15);
            }

            /* ====== التواريخ والأوقات ====== */
            #liveDateTime, #liveDateTimeEmp {
                color: #16a34a !important;
                font-weight: 600 !important;
                background: #f0fdf4;
                padding: 4px 12px !important;
                border-radius: 20px;
                font-size: 0.85rem !important;
            }

            /* ====== الوضع الداكن (اختياري) ====== */
            body.dark {
                --sidebar-bg: #0f172a;
                --topbar-bg: #1e293b;
                --card-bg: #1e293b;
                --card-border: #334155;
                background: #0f172a;
            }
            body.dark .stat-card, body.dark .bg-card {
                background: var(--card-bg);
                border-color: var(--card-border);
            }
            body.dark th { background: #1e293b !important; color: #e2e8f0 !important; }
            body.dark td { border-bottom-color: #334155 !important; }
            body.dark tbody tr:hover td { background: #2d3a4a !important; }
        `;
        document.head.appendChild(style);
    }

    function init() {
        injectNewStyle();
        console.log('✅ شكل الواجهة الجديد جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() { waitForApp(init); });
    if (document.readyState !== 'loading') waitForApp(init);
})();