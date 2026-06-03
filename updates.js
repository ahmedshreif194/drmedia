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

    // مؤشر الاتصال في الأعلى
    function updateConnectionIndicator() {
        var indicator = document.getElementById('connectionIndicator');
        if (!indicator) return;
        var online = navigator.onLine;
        indicator.innerHTML = (online ? '🟢 متصل' : '🟠 غير متصل');
        indicator.style.color = online ? '#16a34a' : '#f59e0b';
    }
    function injectConnectionIndicator() {
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

    if (document.querySelector('.topbar')) {
        injectConnectionIndicator();
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

// ====== تحديث: تجميع الحجوزات بالشهر + استيراد لشهر محدد ======
(function() {
    console.log('🟢 تحميل: تجميع الحجوزات بالشهر واستيراد شهري');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    if (!state.filters) state.filters = {};
    if (!state.filters.bookingYear) state.filters.bookingYear = new Date().getFullYear();
    if (!state.filters.bookingMonth) state.filters.bookingMonth = new Date().getMonth() + 1;

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

        var revLine = document.querySelector('#content-area .text-sm.mb-2');
        if (revLine) {
            revLine.insertAdjacentElement('afterend', bar);
        } else {
            container.insertAdjacentElement('afterend', bar);
        }
    }

    function patchRenderBookings() {
        var origRender = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            var origFrom = state.filters.bookingDateFrom;
            var origTo = state.filters.bookingDateTo;
            var origStatus = state.filters.bookingStatus;
            var origHall = state.filters.bookingHall;

            var y = state.filters.bookingYear;
            var m = state.filters.bookingMonth;
            var lastDay = new Date(y, m, 0).getDate();
            state.filters.bookingDateFrom = `${y}-${String(m).padStart(2,'0')}-01`;
            state.filters.bookingDateTo = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

            origRender.apply(this, arguments);

            state.filters.bookingDateFrom = origFrom;
            state.filters.bookingDateTo = origTo;
            state.filters.bookingStatus = origStatus;
            state.filters.bookingHall = origHall;

            setTimeout(injectMonthFilter, 100);
        };
    }

    function init() {
        patchRenderBookings();
        console.log('✅ تجميع الحجوزات بالشهر جاهز');
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

    if (!state.flashFilters) {
        state.flashFilters = {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1
        };
    }

    var monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    function getFilteredFlashes() {
        return state.flashDrives.filter(function(f) {
            var b = state.bookings.find(function(bk) { return bk.id === f.bookingId; });
            if (!b) return false;
            var d = new Date(b.date);
            return d.getFullYear() === state.flashFilters.year &&
                   (d.getMonth() + 1) === state.flashFilters.month;
        });
    }

    function injectFlashMonthBar() {
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

        var tableWrapper = container.querySelector('.overflow-x-auto');
        if (tableWrapper) {
            container.insertBefore(bar, tableWrapper);
        } else {
            container.appendChild(bar);
        }
    }

    function patchRenderFlash() {
        var origRender = AppRenderer.renderFlash;
        AppRenderer.renderFlash = function() {
            var originalFlash = state.flashDrives;
            state.flashDrives = getFilteredFlashes();
            origRender.apply(this, arguments);
            state.flashDrives = originalFlash;
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

// ====== تحديث: شكل الواجهة الجديد + أيقونات حديثة (نسخة قوية) ======
(function() {
    console.log('🟢 تحميل: شكل الواجهة الجديد');

    const modernCSS = `
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
        body { font-family: var(--font-family); background: #f8fafc; }
        .sidebar { background: var(--sidebar-bg) !important; border-left: none !important; box-shadow: 2px 0 15px rgba(0,0,0,0.05); }
        .sidebar .footer-bar { color: #94a3b8 !important; border-top: 1px solid #334155 !important; }
        .sidebar-item { color: var(--sidebar-text) !important; border-right: none !important; margin: 4px 10px !important; border-radius: 12px !important; transition: all 0.2s !important; }
        .sidebar-item:hover { background: #334155 !important; color: white !important; }
        .sidebar-item.active { background: var(--sidebar-active-bg) !important; color: var(--sidebar-active-text) !important; font-weight: 600 !important; box-shadow: 0 4px 12px rgba(22,163,74,0.3); }
        .topbar { background: var(--topbar-bg) !important; border-bottom: 1px solid var(--topbar-border) !important; box-shadow: none !important; }
        .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px !important; padding: 20px 15px !important; box-shadow: var(--card-shadow) !important; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
        .stat-value { font-size: 1.8rem !important; margin-bottom: 4px; }
        .stat-label { font-size: 0.8rem !important; color: #64748b !important; }
        .bg-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 18px !important; padding: 22px !important; box-shadow: var(--card-shadow) !important; }
        .btn, button { border-radius: var(--btn-radius) !important; font-weight: 500 !important; transition: all 0.2s !important; }
        .btn-primary { background: #16a34a !important; box-shadow: 0 4px 10px rgba(22,163,74,0.2); }
        .btn-primary:hover { background: #15803d !important; }
        .btn-outline { border: 1px solid #d1d5db !important; background: white !important; }
        .btn-outline:hover { background: #f9fafb !important; border-color: #9ca3af !important; }
        table { border-collapse: separate; border-spacing: 0; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; }
        th { background: #f8fafc !important; font-weight: 600 !important; color: #334155 !important; border-bottom: 1px solid #e2e8f0 !important; padding: 14px 12px !important; }
        td { padding: 12px !important; border-bottom: 1px solid #f1f5f9 !important; }
        tbody tr:hover td { background: #f0fdf4 !important; }
        .status-badge, .badge-active, .badge-inactive { border-radius: 20px !important; padding: 5px 14px !important; font-size: 0.7rem !important; }
        .modal-content { border-radius: 20px !important; padding: 28px !important; box-shadow: 0 25px 60px rgba(0,0,0,0.15); }
        #liveDateTime, #liveDateTimeEmp { color: #16a34a !important; font-weight: 600 !important; background: #f0fdf4; padding: 4px 12px !important; border-radius: 20px; font-size: 0.85rem !important; }
        body.dark { --sidebar-bg: #0f172a; --topbar-bg: #1e293b; --card-bg: #1e293b; --card-border: #334155; background: #0f172a; }
        body.dark .stat-card, body.dark .bg-card { background: var(--card-bg); border-color: var(--card-border); }
        body.dark th { background: #1e293b !important; color: #e2e8f0 !important; }
        body.dark td { border-bottom-color: #334155 !important; }
        body.dark tbody tr:hover td { background: #2d3a4a !important; }
    `;

    function injectCSS() {
        if (document.getElementById('modern-style-drmedia')) return;
        var style = document.createElement('style');
        style.id = 'modern-style-drmedia';
        style.textContent = modernCSS;
        document.head.appendChild(style);
        console.log('✅ CSS الحديث محقون');
    }

    function startObserving() {
        if (document.body) injectCSS();
        var observer = new MutationObserver(function(mutations) {
            if (!document.getElementById('modern-style-drmedia')) injectCSS();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    startObserving();
    window.addEventListener('load', function() { injectCSS(); });
    console.log('✅ التنسيقات الحديثة والأيقونات المحسنة جاهزة');
})();

// ====== تحديث: تكامل Textbee Cloud API ======
(function() {
    console.log('🟢 تحميل: تكامل Textbee Cloud API');

    if (!window.TextbeeCloudConfig) {
        window.TextbeeCloudConfig = JSON.parse(localStorage.getItem('drmedia_textbee_cloud') || '{"apiKey":"","deviceId":"","baseUrl":"https://api.textbee.dev/api/v1"}');
    }

    window.sendSMS = async function(to, message) {
        var config = window.TextbeeCloudConfig;
        if (!config.apiKey || !config.deviceId) {
            Utils.showError('⚠️ يرجى إعداد Textbee Cloud (API Key & Device ID) في صفحة الإعدادات');
            return false;
        }
        try {
            var phone = to.replace(/[^0-9+]/g, '');
            if (!phone.startsWith('+')) {
                if (phone.startsWith('0')) phone = '2' + phone.substring(1);
                phone = '+' + phone;
            }
            const url = `https://api.textbee.dev/api/v1/gateway/devices/${config.deviceId}/send-sms`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({ recipients: [phone], message: message })
            });
            const result = await response.json();
            if (response.ok && result.success !== false) {
                Utils.showMsg('✅ تم إرسال الرسالة بنجاح');
                return true;
            } else {
                Utils.showError('❌ فشل الإرسال: ' + (result.message || result.error || 'خطأ غير معروف'));
                return false;
            }
        } catch(e) {
            console.error('خطأ في إرسال SMS:', e);
            Utils.showError('فشل الاتصال بـ Textbee');
            return false;
        }
    };

    function injectSettings() {
        var check = setInterval(function() {
            var waTemplate = document.getElementById('waMsgTemplate');
            if (waTemplate && !document.getElementById('textbeeCloudContainer')) {
                clearInterval(check);
                var config = window.TextbeeCloudConfig;
                var html = `
                <div id="textbeeCloudContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                    <h3 class="font-semibold mb-2">☁️ إعدادات Textbee Cloud</h3>
                    <p class="text-sm text-gray-500 mb-2">احصل على API Key و Device ID من <a href="https://textbee.dev" target="_blank" class="text-blue-600 underline">textbee.dev</a></p>
                    <label class="text-xs">API Key</label>
                    <input id="textbeeApiKey" value="${config.apiKey}" class="w-full border-2 p-2 rounded-xl mb-2" placeholder="TB_API_...">
                    <label class="text-xs">Device ID</label>
                    <input id="textbeeDeviceId" value="${config.deviceId}" class="w-full border-2 p-2 rounded-xl mb-2" placeholder="dev_...">
                    <div class="flex gap-2">
                        <button onclick="window._saveTextbeeSettings()" class="btn-primary flex-1">💾 حفظ الإعدادات</button>
                        <button onclick="window._testTextbeeSMS()" class="btn-secondary">🧪 اختبار SMS</button>
                    </div>
                </div>`;
                waTemplate.insertAdjacentHTML('afterend', html);
            }
        }, 300);
        setTimeout(function() { clearInterval(check); }, 10000);
    }

    window._saveTextbeeSettings = function() {
        window.TextbeeCloudConfig.apiKey = document.getElementById('textbeeApiKey').value.trim();
        window.TextbeeCloudConfig.deviceId = document.getElementById('textbeeDeviceId').value.trim();
        localStorage.setItem('drmedia_textbee_cloud', JSON.stringify(window.TextbeeCloudConfig));
        Utils.showMsg('✅ تم حفظ إعدادات Textbee');
    };

    window._testTextbeeSMS = function() {
        var phone = prompt('أدخل رقم الهاتف للاختبار (دولي):', '+201012345678');
        if (!phone) return;
        var msg = prompt('أدخل رسالة الاختبار:', 'مرحباً من Dr Media Pro');
        if (!msg) return;
        window.sendSMS(phone, msg);
    };

    function init() {
        var appObserver = new MutationObserver(function() {
            if (document.getElementById('waMsgTemplate')) injectSettings();
        });
        var appEl = document.getElementById('app');
        if (appEl) appObserver.observe(appEl, { childList: true, subtree: true });
        injectSettings();
        console.log('✅ تكامل Textbee Cloud جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        var wait = setInterval(function() {
            if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
                clearInterval(wait);
                init();
            }
        }, 50);
    });
    if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') init();
})();

// ====== تحديث: الإرسال التلقائي للرسائل + تبويب الرسائل ======
(function() {
    console.log('🟢 تحميل: نظام الرسائل المتكامل');

    if (!state.messageLog) state.messageLog = [];

    function logMessage(type, recipient, message, status) {
        state.messageLog.unshift({
            id: Utils.generateId('msg_'),
            type: type,
            recipient: recipient,
            message: message,
            status: status,
            time: new Date().toLocaleString('ar-EG')
        });
        if (state.messageLog.length > 200) state.messageLog.length = 200;
        DataManager.saveAllData();
    }

    if (!state.autoMessageSettings) {
        state.autoMessageSettings = JSON.parse(localStorage.getItem('drmedia_auto_msg') || '{"distribute":true,"reminder":true,"attendance":false}');
    }

    function saveAutoMessageSettings() {
        localStorage.setItem('drmedia_auto_msg', JSON.stringify(state.autoMessageSettings));
    }

    async function autoSendSMS(phone, message) {
        if (typeof window.sendSMS === 'function') {
            var success = await window.sendSMS(phone, message);
            logMessage('sms', phone, message, success ? 'sent' : 'failed');
        } else {
            console.warn('دالة sendSMS غير موجودة');
        }
    }

    function autoSendWhatsApp(phone, message) {
        if (typeof window.sendWhatsAppReliable === 'function') {
            window.sendWhatsAppReliable(phone, message);
            logMessage('whatsapp', phone, message, 'sent');
        } else if (typeof window.sendWhatsAppAuto === 'function') {
            window.sendWhatsAppAuto(phone, message);
            logMessage('whatsapp', phone, message, 'sent');
        } else if (typeof NotificationManager !== 'undefined' && NotificationManager.sendWhatsApp) {
            NotificationManager.sendWhatsApp(phone, message);
            logMessage('whatsapp', phone, message, 'sent');
        } else {
            var cleaned = phone.replace(/[^0-9+]/g,'');
            if (cleaned.startsWith('0')) cleaned = '20' + cleaned.substring(1);
            if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
            window.open('https://wa.me/' + cleaned + '?text=' + encodeURIComponent(message), '_blank');
            logMessage('whatsapp', phone, message, 'sent');
        }
    }

    function createMessageTab() {
        if (!AppRenderer.pages.includes('messages')) {
            AppRenderer.pages.push('messages');
        }
        AppRenderer.renderMessages = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = '📨 إدارة الرسائل';

            var settings = state.autoMessageSettings;
            c.innerHTML = `
            <div class="bg-card">
                <h2 class="text-xl font-bold mb-4">📨 إدارة الرسائل والإرسال التلقائي</h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="border p-4 rounded-xl">
                        <h3 class="font-semibold mb-2">⚙️ الإرسال التلقائي</h3>
                        <label class="flex items-center gap-2 mb-2">
                            <input type="checkbox" id="autoDistribute" ${settings.distribute ? 'checked' : ''} onchange="window._toggleAutoMsg('distribute')"> عند التوزيع
                        </label>
                        <label class="flex items-center gap-2 mb-2">
                            <input type="checkbox" id="autoReminder" ${settings.reminder ? 'checked' : ''} onchange="window._toggleAutoMsg('reminder')"> تذكير يوم الأوردر
                        </label>
                        <label class="flex items-center gap-2 mb-2">
                            <input type="checkbox" id="autoAttendance" ${settings.attendance ? 'checked' : ''} onchange="window._toggleAutoMsg('attendance')"> عند تسجيل الحضور
                        </label>
                    </div>
                    <div class="border p-4 rounded-xl">
                        <h3 class="font-semibold mb-2">📤 إرسال يدوي</h3>
                        <select id="msgEmpSelect" class="w-full border-2 p-2 rounded-xl mb-2">
                            ${state.employees.map(e => `<option value="${e.id}">${e.name} (${e.phone||'لا يوجد رقم'})</option>`).join('')}
                        </select>
                        <textarea id="msgText" class="w-full border-2 p-2 rounded-xl mb-2" rows="2" placeholder="نص الرسالة..."></textarea>
                        <div class="flex gap-2">
                            <button onclick="window._sendManualSMS()" class="btn-secondary flex-1">📱 SMS</button>
                            <button onclick="window._sendManualWA()" class="btn-primary flex-1">💬 واتساب</button>
                        </div>
                    </div>
                </div>

                <h3 class="font-semibold mb-2">📋 سجل الرسائل (آخر 50)</h3>
                <div class="overflow-x-auto max-h-96 overflow-y-auto">
                    <table>
                        <thead><tr><th>الوقت</th><th>النوع</th><th>المستلم</th><th>الرسالة</th><th>الحالة</th></tr></thead>
                        <tbody>
                            ${state.messageLog.slice(0,50).map(m => `
                                <tr>
                                    <td class="text-sm">${m.time}</td>
                                    <td>${m.type === 'sms' ? '📱' : '💬'}</td>
                                    <td>${m.recipient}</td>
                                    <td class="text-sm">${m.message}</td>
                                    <td>${m.status === 'sent' ? '✅' : '❌'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="footer-bar">${APP_CONFIG.footerText}</div>
            </div>`;

            window._toggleAutoMsg = function(key) {
                state.autoMessageSettings[key] = !state.autoMessageSettings[key];
                saveAutoMessageSettings();
            };
            window._sendManualSMS = function() {
                var empId = document.getElementById('msgEmpSelect').value;
                var text = document.getElementById('msgText').value.trim();
                if (!text) return Utils.showError('اكتب رسالة');
                var emp = state.employees.find(e => e.id === empId);
                if (!emp || !emp.phone) return Utils.showError('الموظف ليس له رقم هاتف');
                autoSendSMS(emp.phone, text);
            };
            window._sendManualWA = function() {
                var empId = document.getElementById('msgEmpSelect').value;
                var text = document.getElementById('msgText').value.trim();
                if (!text) return Utils.showError('اكتب رسالة');
                var emp = state.employees.find(e => e.id === empId);
                if (!emp || !emp.phone) return Utils.showError('الموظف ليس له رقم هاتف');
                autoSendWhatsApp(emp.phone, text);
            };
        };

        var sidebar = document.querySelector('.sidebar .py-2');
        if (sidebar && !document.querySelector('[data-page="messages"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-page', 'messages');
            item.onclick = function() { AppRenderer.navigateTo('messages'); };
            item.innerHTML = '<span>📨 الرسائل</span>';
            sidebar.appendChild(item);
        }
    }

    function init() {
        createMessageTab();
        console.log('✅ نظام الرسائل المتكامل جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        var wait = setInterval(function() {
            if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
                clearInterval(wait);
                init();
            }
        }, 50);
    });
    if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') init();
})();

// ====== تحديث: زر حجز مجمع مع تقويم شهري ======
(function() {
    console.log('🟢 تحميل: نظام الحجز المجمع الشهري');

    function createCalendar(year, month, selectedDays) {
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var today = new Date();
        var html = '<table class="w-full text-center border-collapse"><thead><tr>';
        var dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
        dayNames.forEach(d => html += `<th class="p-1 text-xs bg-gray-100">${d}</th>`);
        html += '</tr></thead><tbody><tr>';

        for (var i = 0; i < firstDay; i++) html += '<td class="p-1"></td>';

        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            var isSelected = selectedDays.includes(dateStr);
            var isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day);
            var bgClass = isSelected ? 'bg-blue-500 text-white' : (isToday ? 'bg-yellow-100' : 'hover:bg-gray-100');
            html += `<td class="p-1">
                <div class="cursor-pointer rounded-full w-8 h-8 flex items-center justify-center mx-auto text-sm ${bgClass}"
                     data-date="${dateStr}">${day}</div>
            </td>`;
            if ((firstDay + day) % 7 === 0) html += '</tr><tr>';
        }
        html += '</tr></tbody></table>';
        return html;
    }

    function openBulkModal() {
        var oldModal = document.getElementById('bulkBookingModal');
        if (oldModal) oldModal.remove();

        var now = new Date();
        var currentYear = now.getFullYear();
        var currentMonth = now.getMonth();
        var selectedDays = [];
        var halls = state.halls || [];

        var modalHTML = `
        <div id="bulkBookingModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
                <h3 class="text-lg font-bold mb-4">📅 حجز مجمّع - اختر الأيام</h3>
                <div class="flex justify-between items-center mb-2">
                    <button id="prevMonth" class="px-2 py-1 bg-gray-200 rounded">◀</button>
                    <span id="monthYearLabel" class="font-semibold"></span>
                    <button id="nextMonth" class="px-2 py-1 bg-gray-200 rounded">▶</button>
                </div>
                <div id="calendarContainer" class="mb-3"></div>
                <div class="flex gap-2 mb-3">
                    <button id="selectAllBtn" class="text-xs bg-gray-200 px-2 py-1 rounded">تحديد الكل</button>
                    <button id="deselectAllBtn" class="text-xs bg-gray-200 px-2 py-1 rounded">إلغاء الكل</button>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-1">نوع القاعة</label>
                    <select id="hallTypeSelect" class="w-full border-2 p-2 rounded-xl">
                        ${halls.map(h => `<option value="${h.name || h.type || ''}">${h.name || h.type || ''}</option>`).join('')}
                    </select>
                </div>
                <div class="flex justify-end gap-2">
                    <button id="cancelBulk" class="btn-secondary px-4 py-2 rounded-xl">إلغاء</button>
                    <button id="saveBulk" class="btn-primary px-4 py-2 rounded-xl">✅ حفظ الحجوزات</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        var year = currentYear, month = currentMonth;
        var calendarDiv = document.getElementById('calendarContainer');
        var monthYearLabel = document.getElementById('monthYearLabel');

        function render() {
            monthYearLabel.textContent = `${year}-${String(month+1).padStart(2,'0')}`;
            calendarDiv.innerHTML = createCalendar(year, month, selectedDays);
            calendarDiv.querySelectorAll('[data-date]').forEach(function(dayDiv) {
                dayDiv.onclick = function() {
                    var date = this.getAttribute('data-date');
                    var index = selectedDays.indexOf(date);
                    if (index > -1) selectedDays.splice(index, 1);
                    else selectedDays.push(date);
                    render();
                };
            });
        }

        document.getElementById('prevMonth').onclick = function() {
            if (month === 0) { year--; month = 11; } else month--;
            render();
        };
        document.getElementById('nextMonth').onclick = function() {
            if (month === 11) { year++; month = 0; } else month++;
            render();
        };
        document.getElementById('selectAllBtn').onclick = function() {
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            for (var d = 1; d <= daysInMonth; d++) {
                var dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                if (!selectedDays.includes(dateStr)) selectedDays.push(dateStr);
            }
            render();
        };
        document.getElementById('deselectAllBtn').onclick = function() {
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            for (var d = 1; d <= daysInMonth; d++) {
                var dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                var idx = selectedDays.indexOf(dateStr);
                if (idx > -1) selectedDays.splice(idx, 1);
            }
            render();
        };
        document.getElementById('cancelBulk').onclick = function() { document.getElementById('bulkBookingModal').remove(); };
        document.getElementById('saveBulk').onclick = function() {
            var hallType = document.getElementById('hallTypeSelect').value;
            if (!hallType) { Utils.showError('الرجاء اختيار نوع القاعة'); return; }
            if (selectedDays.length === 0) { Utils.showError('الرجاء تحديد يوم واحد على الأقل'); return; }
            selectedDays.forEach(function(dateStr) {
                state.bookings.push({
                    id: Utils.generateId('book_'),
                    clientName: 'حجز مجمّع',
                    hallName: hallType,
                    date: dateStr,
                    time: '00:00',
                    status: 'pending',
                    assignedEmployees: [],
                    deleted: false
                });
            });
            if (typeof DataManager !== 'undefined' && DataManager.saveAllData) DataManager.saveAllData();
            Utils.showSuccess(`تم إضافة ${selectedDays.length} حجز بنجاح`);
            document.getElementById('bulkBookingModal').remove();
            if (typeof AppRenderer !== 'undefined' && AppRenderer.renderBookings) AppRenderer.renderBookings();
        };

        render();
    }

    function addBulkButton() {
        if (!document.getElementById('pageTitle') || !document.getElementById('pageTitle').textContent.includes('الحجوزات')) return;
        if (document.getElementById('bulkBookingBtn')) return;

        var header = document.querySelector('#content-area .bg-card h2') || document.querySelector('#content-area .bg-card > h3');
        if (header) {
            var btn = document.createElement('button');
            btn.id = 'bulkBookingBtn';
            btn.className = 'btn-primary ml-4 text-sm';
            btn.textContent = '📅 حجز مجمّع';
            btn.onclick = openBulkModal;
            header.parentNode.insertBefore(btn, header.nextSibling);
        }
    }

    if (typeof AppRenderer !== 'undefined' && AppRenderer.renderBookings) {
        var originalRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            originalRenderBookings.apply(this, arguments);
            addBulkButton();
        };
    }

    console.log('✅ نظام الحجز المجمع جاهز');
})();

// ====== تحديث: مزامنة آمنة ومتوافقة مع Firebase (بدون Proxy) ======
(function() {
    console.log('🔄 تحميل: نظام المزامنة الآمنة مع Firebase');

    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase غير موجود، تعطيل المزامنة');
        return;
    }

    try {
        firebase.database().setPersistenceEnabled(true)
            .then(function() { console.log('💾 التخزين المؤقت مفعّل'); })
            .catch(function(err) { console.warn('تعذر تفعيل التخزين المؤقت:', err.message); });
    } catch(e) {}

    function syncToFirebase() {
        if (typeof state === 'undefined') return;
        var branchId = state.branchId || 'default';
        var dataToSave = {
            bookings: JSON.parse(JSON.stringify(state.bookings || [])),
            employees: JSON.parse(JSON.stringify(state.employees || [])),
            halls: JSON.parse(JSON.stringify(state.halls || [])),
            clients: JSON.parse(JSON.stringify(state.clients || [])),
            equipmentInventory: JSON.parse(JSON.stringify(state.equipmentInventory || {})),
            attendanceRecords: JSON.parse(JSON.stringify(state.attendanceRecords || [])),
            employeeLoans: JSON.parse(JSON.stringify(state.employeeLoans || {})),
            notifications: JSON.parse(JSON.stringify(state.notifications || [])),
            trashBin: JSON.parse(JSON.stringify(state.trashBin || [])),
            activityLog: JSON.parse(JSON.stringify(state.activityLog || [])),
            flashDrives: JSON.parse(JSON.stringify(state.flashDrives || [])),
            holidays: JSON.parse(JSON.stringify(state.holidays || [])),
            companyName: state.companyName,
            companyLogo: state.companyLogoBase64 || state.companyLogo,
            USERS: state.USERS,
            rotationCounters: state.rotationCounters,
            whatsappEnabled: state.whatsapp?.enabled,
            whatsappBusinessNumber: state.whatsapp?.businessNumber,
            whatsappMessageTemplate: state.whatsapp?.messageTemplate,
            appTheme: state.appTheme,
            appLanguage: state.appLanguage,
            systemOfflineMode: state.systemOfflineMode,
            branchId: branchId
        };

        firebase.database().ref('drmedia/' + branchId).set(dataToSave)
            .then(function() { console.log('✅ تمت المزامنة مع Firebase'); })
            .catch(function(error) { console.error('❌ فشلت المزامنة:', error.message); });
    }

    function integrateWithDataManager() {
        if (typeof DataManager === 'undefined') return;
        var originalSave = DataManager.saveAllData;
        DataManager.saveAllData = async function() {
            if (originalSave) {
                try { await originalSave.apply(this, arguments); } catch(e) { console.warn('saveAllData الأصلية فشلت:', e); }
            }
            syncToFirebase();
        };
        console.log('🔗 DataManager مدمج مع المزامنة الآمنة');
    }

    function init() {
        if (typeof state !== 'undefined' && typeof firebase !== 'undefined') {
            integrateWithDataManager();
            console.log('✅ المزامنة الآمنة جاهزة');
        } else {
            setTimeout(init, 100);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
// ====== تحديث: نظام التوزيع المتساوي الذكي (يحافظ على اليدوي) ======
(function() {
    console.log('🟢 تحميل: نظام التوزيع المتساوي الذكي');

    if (typeof DistributionManager === 'undefined') {
        console.warn('DistributionManager غير موجود');
        return;
    }

    // دالة مساعدة: فلترة الحجوزات حسب النطاق إن وجد
    function getFilteredPending() {
        var pending = state.bookings.filter(function(b) {
            return b.status === 'pending' && !b.deleted;
        });
        if (state.distSettings && state.distSettings.dateRangeEnabled &&
            state.distSettings.dateFrom && state.distSettings.dateTo) {
            pending = pending.filter(function(b) {
                return b.date >= state.distSettings.dateFrom && b.date <= state.distSettings.dateTo;
            });
        }
        return pending;
    }

    // دالة التوزيع العادل الموحدة
    async function fairDistribute(unassignedOnly) {
        var pending = getFilteredPending();
        var targetBookings = unassignedOnly ?
            pending.filter(function(b) { return !b.assignedEmployees || b.assignedEmployees.length === 0; }) :
            pending;

        if (!targetBookings.length) {
            Utils.showMsg('✅ لا توجد حجوزات لتوزيعها');
            return;
        }

        // تجميع الموظفين حسب الدور (نشطين فقط)
        var byRole = {};
        state.employees.filter(function(e) { return e.active; }).forEach(function(e) {
            var role = (e.role || '').trim();
            if (!byRole[role]) byRole[role] = [];
            byRole[role].push(e);
        });

        // دالة لحساب إجمالي الأوردرات الحالية للموظف (كل الحجوزات غير الملغية)
        function getCurrentOrderCount(empId) {
            return state.bookings.filter(function(b) {
                return !b.deleted && b.status !== 'cancelled' &&
                       (b.assignedEmployees || []).indexOf(empId) !== -1;
            }).length;
        }

        // ترتيب الحجوزات حسب التاريخ
        targetBookings.sort(function(a, b) { return a.date.localeCompare(b.date); });

        // تجميع حسب اليوم لتجنب تعارض الموظف في نفس اليوم
        var byDate = {};
        targetBookings.forEach(function(b) {
            if (!byDate[b.date]) byDate[b.date] = [];
            byDate[b.date].push(b);
        });

        var dates = Object.keys(byDate).sort();
        for (var d = 0; d < dates.length; d++) {
            var date = dates[d];
            var dayBookings = byDate[date];

            // الموظفون المشغولون في هذا اليوم (من التوزيعات السابقة)
            var busyToday = new Set();
            state.bookings.forEach(function(b) {
                if (b.date === date && !b.deleted) {
                    (b.assignedEmployees || []).forEach(function(eid) { busyToday.add(eid); });
                }
            });

            // توزيع كل حجز في هذا اليوم
            for (var i = 0; i < dayBookings.length; i++) {
                var booking = dayBookings[i];
                var hall = state.halls.find(function(h) { return h.id === booking.hallId; });
                var isCafe = hall && hall.type === 'cafe';
                var requirements = isCafe ?
                    [{ role: 'مصور', count: 1 }] :
                    [
                        { role: 'مخرج', count: 1 },
                        { role: 'مصور', count: 2 },
                        { role: 'كرين', count: 1 }
                    ];

                // إذا كنا في وضع "غير المعينين فقط"، نتأكد أن الحجز فارغ
                if (unassignedOnly && booking.assignedEmployees && booking.assignedEmployees.length > 0) continue;

                booking.assignedEmployees = booking.assignedEmployees || [];

                for (var r = 0; r < requirements.length; r++) {
                    var req = requirements[r];
                    var role = req.role;
                    var needed = req.count;

                    // المرشحون حسب الدور، غير مشغولين اليوم، غير معينين في نفس الحجز
                    var candidates = (byRole[role] || []).filter(function(emp) {
                        if (busyToday.has(emp.id)) return false;
                        if (booking.assignedEmployees.indexOf(emp.id) !== -1) return false;
                        return true;
                    });

                    // ترتيب صارم: الأقل أوردرات إجماليًا أولاً (لتحقيق أقصى مساواة)
                    candidates.sort(function(a, b) {
                        return getCurrentOrderCount(a.id) - getCurrentOrderCount(b.id);
                    });

                    // تعيين العدد المطلوب
                    for (var j = 0; j < needed && j < candidates.length; j++) {
                        var chosen = candidates[j];
                        booking.assignedEmployees.push(chosen.id);
                        busyToday.add(chosen.id);
                    }

                    if (candidates.length < needed) {
                        console.warn('⚠️ عدد غير كاف من ' + role + ' للحجز ' + booking.clientName + ' بتاريخ ' + date);
                    }
                }

                // حماية إضافية للكافيه: إذا حدث خطأ وتجاوز عدد المصورين 1، نصحح
                if (isCafe) {
                    var photographers = booking.assignedEmployees.filter(function(eid) {
                        var emp = state.employees.find(function(e) { return e.id === eid; });
                        return emp && emp.role === 'مصور';
                    });
                    if (photographers.length > 1) {
                        photographers.sort(function(a, b) {
                            return getCurrentOrderCount(a) - getCurrentOrderCount(b);
                        });
                        booking.assignedEmployees = booking.assignedEmployees.filter(function(eid) {
                            var emp = state.employees.find(function(e) { return e.id === eid; });
                            return !(emp && emp.role === 'مصور') || eid === photographers[0];
                        });
                    }
                }
            }
        }

        DataManager.updateEmployeeOrders();
        await DataManager.saveAllData();

        var stillUnassigned = state.bookings.filter(function(b) {
            return b.status === 'pending' && !b.deleted &&
                   (!b.assignedEmployees || b.assignedEmployees.length === 0);
        }).length;

        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();

        var mode = unassignedOnly ? 'غير المعينين' : 'استكمال متساوي';
        Utils.showMsg('✅ تم ' + mode + '. متبقي: ' + stillUnassigned + ' حجز غير موزع');

        // رسائل ما بعد التوزيع (حسب الإعدادات)
        if (state.distSettings && state.distSettings.messageMode === 'manual') {
            showManualMessagePrompt(targetBookings.filter(b => (b.assignedEmployees || []).length > 0));
        } else if (state.distSettings && state.distSettings.messageMode === 'auto') {
            // إرسال تلقائي لمن تم تعيينهم
            sendAutoMessages(targetBookings.filter(b => (b.assignedEmployees || []).length > 0));
        }
    }

    // إرسال الرسائل التلقائية
    async function sendAutoMessages(bookings) {
        for (var i = 0; i < bookings.length; i++) {
            var b = bookings[i];
            for (var j = 0; j < (b.assignedEmployees || []).length; j++) {
                var emp = state.employees.find(e => e.id === b.assignedEmployees[j]);
                if (!emp || !emp.phone) continue;
                var msg = `تم تعيينك في أوردر: ${b.clientName} – ${b.hallName} – ${b.date}`;
                if (typeof window.sendSMS === 'function') {
                    await window.sendSMS(emp.phone, msg);
                }
                if (typeof window.sendWhatsAppReliable === 'function') {
                    window.sendWhatsAppReliable(emp.phone, msg);
                } else if (typeof window.sendWhatsAppAuto === 'function') {
                    window.sendWhatsAppAuto(emp.phone, msg);
                } else {
                    var cleaned = emp.phone.replace(/[^0-9+]/g,'');
                    if (cleaned.startsWith('0')) cleaned = '20' + cleaned.substring(1);
                    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
                    window.open('https://wa.me/' + cleaned + '?text=' + encodeURIComponent(msg), '_blank');
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    // نافذة التأكيد اليدوية للرسائل (نفس السابقة)
    function showManualMessagePrompt(bookings) {
        var messages = [];
        bookings.forEach(function(b) {
            (b.assignedEmployees || []).forEach(function(eid) {
                var emp = state.employees.find(e => e.id === eid);
                if (!emp || !emp.phone) return;
                messages.push({ emp: emp, booking: b, defaultMsg: `تم تعيينك في أوردر: ${b.clientName} – ${b.hallName} – ${b.date}`, sendSMS: true, sendWA: true, customMsg: '' });
            });
        });

        if (messages.length === 0) {
            Utils.showMsg('ℹ️ لا توجد أرقام هواتف لإرسال رسائل');
            return;
        }

        var unique = {};
        messages.forEach(function(m) {
            var key = m.emp.id;
            if (!unique[key]) {
                unique[key] = { emp: m.emp, bookings: [m.booking], defaultMsg: m.defaultMsg, sendSMS: true, sendWA: true, customMsg: m.defaultMsg };
            } else {
                unique[key].bookings.push(m.booking);
                unique[key].defaultMsg = unique[key].bookings.map(function(b) {
                    return `أوردر: ${b.clientName} – ${b.hallName} – ${b.date}`;
                }).join('\n');
                unique[key].customMsg = unique[key].defaultMsg;
            }
        });

        var employeeList = Object.values(unique);
        var html = `<h3 class="text-xl font-bold mb-4">📤 تأكيد إرسال رسائل التوزيع</h3>
        <p class="text-sm text-gray-500 mb-2">يمكنك تعديل النص أو تعطيل الإرسال لكل موظف</p>
        <div class="max-h-96 overflow-y-auto">`;

        employeeList.forEach(function(item, index) {
            html += `
            <div class="border rounded-xl p-3 mb-3 bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center gap-2 mb-2">
                    <strong>${item.emp.name}</strong> <small>(${item.emp.phone})</small>
                </div>
                <textarea id="manualMsg_${index}" class="w-full border p-2 rounded-lg text-sm" rows="2">${item.customMsg}</textarea>
                <div class="flex gap-4 mt-2 text-sm">
                    <label><input type="checkbox" class="manualWA_${index}" checked> 💬 واتساب</label>
                    <label><input type="checkbox" class="manualSMS_${index}" checked> 📱 SMS</label>
                </div>
            </div>`;
        });

        html += `</div>
        <div class="flex gap-2 mt-4">
            <button onclick="window._confirmManualSend()" class="btn-primary flex-1">✅ إرسال المحدد</button>
            <button onclick="Utils.closeModal()" class="btn-outline flex-1">تخطي الإرسال</button>
        </div>`;

        Utils.openModal(html);
        window._manualSendData = { employeeList: employeeList };
    }

    window._confirmManualSend = async function() {
        var data = window._manualSendData;
        if (!data) return;
        for (var i = 0; i < data.employeeList.length; i++) {
            var item = data.employeeList[i];
            var sendWA = document.querySelector('.manualWA_' + i)?.checked;
            var sendSMS = document.querySelector('.manualSMS_' + i)?.checked;
            var customMsg = document.getElementById('manualMsg_' + i)?.value || item.defaultMsg;
            if (sendWA) {
                if (typeof window.sendWhatsAppReliable === 'function') {
                    window.sendWhatsAppReliable(item.emp.phone, customMsg);
                } else if (typeof window.sendWhatsAppAuto === 'function') {
                    window.sendWhatsAppAuto(item.emp.phone, customMsg);
                } else {
                    var cleaned = item.emp.phone.replace(/[^0-9+]/g,'');
                    if (cleaned.startsWith('0')) cleaned = '20' + cleaned.substring(1);
                    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
                    window.open('https://wa.me/' + cleaned + '?text=' + encodeURIComponent(customMsg), '_blank');
                }
            }
            if (sendSMS && typeof window.sendSMS === 'function') {
                await window.sendSMS(item.emp.phone, customMsg);
            }
            await new Promise(function(resolve) { setTimeout(resolve, 150); });
        }
        Utils.closeModal();
        Utils.showMsg('✅ تم إرسال الرسائل');
    };

    // تعيين الدوال الجديدة
    DistributionManager.distributeRemainingFairly = function() { return fairDistribute(false); };
    DistributionManager.distributeUnassigned = function() { return fairDistribute(true); };

    // حقن الأزرار في الواجهة
    function injectButtons() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (!container) return;

            if (!document.getElementById('fairCompleteBtn')) {
                var btn1 = document.createElement('button');
                btn1.id = 'fairCompleteBtn';
                btn1.className = 'btn-secondary';
                btn1.style.cssText = 'background:#8b5cf6; color:white;';
                btn1.textContent = '⚖️ استكمال توزيع متساوي';
                btn1.onclick = function() { DistributionManager.distributeRemainingFairly(); };
                container.appendChild(btn1);
            }

            if (!document.getElementById('distributeUnassignedBtn')) {
                var btn2 = document.createElement('button');
                btn2.id = 'distributeUnassignedBtn';
                btn2.className = 'btn-secondary';
                btn2.style.cssText = 'background:#f97316; color:white;';
                btn2.textContent = '⚡ توزيع غير المعينين';
                btn2.onclick = function() { DistributionManager.distributeUnassigned(); };
                container.appendChild(btn2);
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    if (typeof AppRenderer !== 'undefined') {
        injectButtons();
    } else {
        window.addEventListener('DOMContentLoaded', function() {
            var wait = setInterval(function() {
                if (typeof AppRenderer !== 'undefined') {
                    clearInterval(wait);
                    injectButtons();
                }
            }, 50);
        });
    }

    console.log('✅ نظام التوزيع المتساوي الذكي جاهز');
})();
// ====== تحديث: التحكم في إرسال رسائل التوزيع + نطاق التاريخ ======
(function() {
    console.log('🟢 تحميل: نظام التحكم في إرسال رسائل التوزيع ونطاق التاريخ');

    // إعدادات افتراضية
    if (!state.distSettings) {
        state.distSettings = JSON.parse(localStorage.getItem('drmedia_dist_settings') || '{"messageMode":"auto","dateRangeEnabled":false,"dateFrom":"","dateTo":""}');
    }

    function saveDistSettings() {
        localStorage.setItem('drmedia_dist_settings', JSON.stringify(state.distSettings));
    }

    // دالة مساعدة: فلترة الحجوزات حسب النطاق إن وجد
    function getFilteredPending() {
        var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
        if (state.distSettings.dateRangeEnabled && state.distSettings.dateFrom && state.distSettings.dateTo) {
            pending = pending.filter(b => b.date >= state.distSettings.dateFrom && b.date <= state.distSettings.dateTo);
        }
        return pending;
    }

    // دالة إرسال رسائل التأكيد اليدوية
    function showManualMessagePrompt(bookings) {
        // تجميع كل الموظفين المعينين والرسائل المخصصة
        var messages = [];
        bookings.forEach(function(b) {
            (b.assignedEmployees || []).forEach(function(eid) {
                var emp = state.employees.find(e => e.id === eid);
                if (!emp || !emp.phone) return;
                var hallType = (state.halls.find(h => h.id === b.hallId) || {}).type || '';
                var msg = `تم تعيينك في أوردر: ${b.clientName} – ${b.hallName} – ${b.date}`;
                messages.push({ emp: emp, booking: b, defaultMsg: msg, sendSMS: true, sendWA: true, customMsg: msg });
            });
        });

        if (messages.length === 0) {
            Utils.showMsg('ℹ️ لا توجد أرقام هواتف لإرسال رسائل');
            return;
        }

        // إزالة التكرار لنفس الموظف (قد يكون لديه أكثر من حجز في اليوم، ندمج)
        var unique = {};
        messages.forEach(function(m) {
            if (!unique[m.emp.id]) {
                unique[m.emp.id] = { emp: m.emp, bookings: [m.booking], defaultMsg: m.defaultMsg, sendSMS: true, sendWA: true, customMsg: m.defaultMsg };
            } else {
                unique[m.emp.id].bookings.push(m.booking);
                // دمج الأوردرات في رسالة واحدة
                unique[m.emp.id].defaultMsg = unique[m.emp.id].bookings.map(function(b) {
                    return `أوردر: ${b.clientName} – ${b.hallName} – ${b.date}`;
                }).join('\n');
                unique[m.emp.id].customMsg = unique[m.emp.id].defaultMsg;
            }
        });

        var employeeList = Object.values(unique);
        var html = `<h3 class="text-xl font-bold mb-4">📤 تأكيد إرسال رسائل التوزيع</h3>
        <p class="text-sm text-gray-500 mb-2">يمكنك تعديل النص أو تعطيل الإرسال لكل موظف</p>
        <div class="max-h-96 overflow-y-auto">`;

        employeeList.forEach(function(item, index) {
            html += `
            <div class="border rounded-xl p-3 mb-3 bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center gap-2 mb-2">
                    <strong>${item.emp.name}</strong> <small>(${item.emp.phone})</small>
                </div>
                <textarea id="msg_${index}" class="w-full border p-2 rounded-lg text-sm" rows="2">${item.customMsg}</textarea>
                <div class="flex gap-4 mt-2 text-sm">
                    <label><input type="checkbox" class="sendWA_${index}" checked> 💬 واتساب</label>
                    <label><input type="checkbox" class="sendSMS_${index}" checked> 📱 SMS</label>
                </div>
            </div>`;
        });

        html += `</div>
        <div class="flex gap-2 mt-4">
            <button onclick="window._confirmManualSend()" class="btn-primary flex-1">✅ إرسال المحدد</button>
            <button onclick="Utils.closeModal()" class="btn-outline flex-1">تخطي الإرسال</button>
        </div>`;

        Utils.openModal(html);

        // تخزين البيانات مؤقتاً لاستخدامها عند التأكيد
        window._manualSendData = { employeeList: employeeList };
    }

    window._confirmManualSend = async function() {
        var data = window._manualSendData;
        if (!data) return;
        var totalSent = 0;
        for (var i = 0; i < data.employeeList.length; i++) {
            var item = data.employeeList[i];
            var sendWA = document.querySelector('.sendWA_' + i)?.checked;
            var sendSMS = document.querySelector('.sendSMS_' + i)?.checked;
            var customMsg = document.getElementById('msg_' + i)?.value || item.defaultMsg;
            if (sendWA) {
                if (typeof window.sendWhatsAppReliable === 'function') {
                    window.sendWhatsAppReliable(item.emp.phone, customMsg);
                } else if (typeof window.sendWhatsAppAuto === 'function') {
                    window.sendWhatsAppAuto(item.emp.phone, customMsg);
                } else {
                    var cleaned = item.emp.phone.replace(/[^0-9+]/g,'');
                    if (cleaned.startsWith('0')) cleaned = '20' + cleaned.substring(1);
                    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
                    window.open('https://wa.me/' + cleaned + '?text=' + encodeURIComponent(customMsg), '_blank');
                }
                totalSent++;
            }
            if (sendSMS && typeof window.sendSMS === 'function') {
                await window.sendSMS(item.emp.phone, customMsg);
            }
            // تأخير بسيط
            await new Promise(function(resolve) { setTimeout(resolve, 200); });
        }
        Utils.closeModal();
        Utils.showMsg('✅ تم إرسال ' + totalSent + ' رسالة');
    };

    // استبدال دوال التوزيع لتراعي النطاق ووضع الرسائل
    function patchDistributeFunctions() {
        if (typeof DistributionManager === 'undefined') return;

        // تجاوز distributeRemainingFairly
        var origRemaining = DistributionManager.distributeRemainingFairly;
        DistributionManager.distributeRemainingFairly = async function() {
            await origRemaining.apply(this, arguments);
            if (state.distSettings.messageMode === 'manual') {
                var pending = getFilteredPending();
                showManualMessagePrompt(pending.filter(b => (b.assignedEmployees || []).length > 0));
            }
        };

        // تجاوز distributeUnassigned
        var origUnassigned = DistributionManager.distributeUnassigned;
        DistributionManager.distributeUnassigned = async function() {
            await origUnassigned.apply(this, arguments);
            if (state.distSettings.messageMode === 'manual') {
                var pending = getFilteredPending();
                showManualMessagePrompt(pending.filter(b => (b.assignedEmployees || []).length > 0));
            }
        };
    }

    // إضافة إعدادات التحكم في تبويب الرسائل
    function injectSettingsInMessagesTab() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .bg-card .grid');
            if (container && !document.getElementById('distControlSection')) {
                observer.disconnect();
                var section = document.createElement('div');
                section.id = 'distControlSection';
                section.className = 'border p-4 rounded-xl mt-4';
                section.innerHTML = `
                    <h3 class="font-semibold mb-2">⚙️ إعدادات التوزيع والرسائل</h3>
                    <label class="flex items-center gap-2 mb-2">
                        <select id="distMessageMode" class="border p-1 rounded text-sm">
                            <option value="auto" ${state.distSettings.messageMode === 'auto' ? 'selected' : ''}>📨 إرسال تلقائي</option>
                            <option value="manual" ${state.distSettings.messageMode === 'manual' ? 'selected' : ''}>✋ يسأل قبل الإرسال</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-2 mb-2">
                        <input type="checkbox" id="distDateRangeEnabled" ${state.distSettings.dateRangeEnabled ? 'checked' : ''} onchange="window._toggleDistDateRange()"> تحديد نطاق تاريخ للتوزيع
                    </label>
                    <div id="distDateRangeFields" style="display:${state.distSettings.dateRangeEnabled ? 'block' : 'none'};" class="flex gap-2 items-center mb-2">
                        <input type="date" id="distDateFrom" class="border p-2 rounded-xl text-sm flex-1" value="${state.distSettings.dateFrom || ''}">
                        <span>إلى</span>
                        <input type="date" id="distDateTo" class="border p-2 rounded-xl text-sm flex-1" value="${state.distSettings.dateTo || ''}">
                    </div>
                    <button onclick="window._saveDistSettings()" class="btn-primary text-sm w-full">💾 حفظ الإعدادات</button>
                `;
                container.parentNode.insertBefore(section, container.nextSibling);
            }
        });
        observer.observe(document.getElementById('content-area'), { childList: true, subtree: true });
    }

    window._toggleDistDateRange = function() {
        var enabled = document.getElementById('distDateRangeEnabled').checked;
        document.getElementById('distDateRangeFields').style.display = enabled ? 'block' : 'none';
    };

    window._saveDistSettings = function() {
        state.distSettings.messageMode = document.getElementById('distMessageMode').value;
        state.distSettings.dateRangeEnabled = document.getElementById('distDateRangeEnabled').checked;
        state.distSettings.dateFrom = document.getElementById('distDateFrom').value;
        state.distSettings.dateTo = document.getElementById('distDateTo').value;
        saveDistSettings();
        Utils.showMsg('✅ تم حفظ إعدادات التوزيع والرسائل');
    };

    // بدء التعديلات بعد الجاهزية
    function init() {
        patchDistributeFunctions();
        // ننتظر حتى يتم رسم تبويب الرسائل لإضافة الإعدادات
        var checkTab = setInterval(function() {
            if (document.querySelector('#content-area .bg-card .grid')) {
                injectSettingsInMessagesTab();
                clearInterval(checkTab);
            }
        }, 500);
        console.log('✅ نظام التحكم في رسائل التوزيع ونطاق التاريخ جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        var wait = setInterval(function() {
            if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
                clearInterval(wait);
                init();
            }
        }, 50);
    });
    if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') init();
})();
// ====== تحديث: زر التوزيع العادل الكامل (Round‑Robin) ======
(function() {
    console.log('🟢 تحميل: زر التوزيع العادل الكامل');

    if (typeof DistributionManager === 'undefined') {
        console.warn('DistributionManager غير موجود');
        return;
    }

    // دالة التوزيع العادل الكامل (Round‑Robin لكل دور)
    DistributionManager.forceFullFairDistribution = async function() {
        var pending = state.bookings.filter(function(b) {
            return b.status === 'pending' && !b.deleted;
        });

        if (!pending.length) {
            Utils.showWarning('لا توجد حجوزات معلقة');
            return;
        }

        // 1. مسح جميع التوزيعات السابقة
        pending.forEach(function(b) { b.assignedEmployees = []; });

        // 2. تجميع الموظفين النشطين حسب الدور
        var roles = {};
        state.employees.filter(function(e) { return e.active; }).forEach(function(e) {
            var role = (e.role || '').trim();
            if (!roles[role]) roles[role] = [];
            roles[role].push(e);
        });

        // 3. تحضير قائمة "الفتحات" المطلوبة لكل يوم
        var slotsByDate = {};
        pending.forEach(function(b) {
            var hall = state.halls.find(function(h) { return h.id === b.hallId; });
            var isCafe = hall && hall.type === 'cafe';
            var neededRoles = isCafe ? [{ role: 'مصور', count: 1 }] : [
                { role: 'مخرج', count: 1 },
                { role: 'مصور', count: 2 },
                { role: 'كرين', count: 1 }
            ];
            if (!slotsByDate[b.date]) slotsByDate[b.date] = [];
            neededRoles.forEach(function(req) {
                for (var i = 0; i < req.count; i++) {
                    slotsByDate[b.date].push({ booking: b, role: req.role });
                }
            });
        });

        // 4. لكل دور، نوزع الفتحات بالترتيب الدائري عبر كل الأيام
        var busyPerDay = {}; // { date: Set(empId) }
        var allDates = Object.keys(slotsByDate).sort();

        // دالة لتوزيع فتحات دور معين
        function assignRole(role) {
            var employees = roles[role];
            if (!employees || employees.length === 0) return;

            // جمع كل فتحات هذا الدور عبر كل الأيام (مرتبة حسب التاريخ)
            var allSlots = [];
            allDates.forEach(function(date) {
                slotsByDate[date].forEach(function(slot) {
                    if (slot.role === role) allSlots.push({ date: date, booking: slot.booking });
                });
            });

            // ترتيب الفتحات حسب التاريخ
            allSlots.sort(function(a, b) { return a.date.localeCompare(b.date); });

            // مؤشر دائري
            var idx = 0;
            // حساب عدد الأوردرات الحالية لكل موظف (قبل التوزيع)
            var orderCounts = {};
            employees.forEach(function(e) { orderCounts[e.id] = 0; });

            for (var s = 0; s < allSlots.length; s++) {
                var slot = allSlots[s];
                var date = slot.date;
                if (!busyPerDay[date]) busyPerDay[date] = new Set();

                // البحث عن موظف متاح بدءاً من المؤشر الحالي
                var assigned = false;
                for (var attempt = 0; attempt < employees.length; attempt++) {
                    var candidate = employees[(idx + attempt) % employees.length];
                    if (!busyPerDay[date].has(candidate.id) && !slot.booking.assignedEmployees.includes(candidate.id)) {
                        slot.booking.assignedEmployees.push(candidate.id);
                        busyPerDay[date].add(candidate.id);
                        orderCounts[candidate.id]++;
                        idx = (idx + attempt + 1) % employees.length; // تحريك المؤشر بعد من تم اختياره
                        assigned = true;
                        break;
                    }
                }
                // إذا لم نجد أحداً (نادر جداً)، نبحث عن أي موظف غير مشغول
                if (!assigned) {
                    for (var a = 0; a < employees.length; a++) {
                        var emp = employees[a];
                        if (!busyPerDay[date].has(emp.id) && !slot.booking.assignedEmployees.includes(emp.id)) {
                            slot.booking.assignedEmployees.push(emp.id);
                            busyPerDay[date].add(emp.id);
                            orderCounts[emp.id]++;
                            break;
                        }
                    }
                }
            }
        }

        // تنفيذ التوزيع لكل دور (الترتيب: مخرج، كرين، مصور لتقليل التعارض)
        assignRole('مخرج');
        assignRole('كرين');
        assignRole('مصور');

        DataManager.updateEmployeeOrders();
        await DataManager.saveAllData();

        // إظهار إحصائية سريعة
        var stats = {};
        state.employees.forEach(function(e) {
            var count = state.bookings.filter(function(b) {
                return !b.deleted && b.status !== 'cancelled' &&
                       (b.assignedEmployees || []).indexOf(e.id) !== -1;
            }).length;
            stats[e.name] = count;
        });

        var report = Object.entries(stats).map(function(entry) {
            return entry[0] + ': ' + entry[1];
        }).join('، ');

        Utils.openModal(`
            <h3 class="font-bold mb-2">✅ توزيع عادل كامل</h3>
            <p class="text-sm text-gray-500 mb-2">تم توزيع ${pending.length} حجز</p>
            <p class="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">${report}</p>
            <button onclick="Utils.closeModal()" class="btn-primary mt-3 w-full">حسناً</button>
        `);

        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
    };

    // إضافة الزر للواجهة
    function injectButton() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('fullFairDistBtn')) {
                var btn = document.createElement('button');
                btn.id = 'fullFairDistBtn';
                btn.className = 'btn-primary';
                btn.style.cssText = 'background:#0d9488; color:white;';
                btn.textContent = '⚖️ توزيع عادل كامل';
                btn.onclick = function() {
                    if (confirm('سيتم مسح جميع التوزيعات الحالية وإعادة توزيع كل الحجوزات المعلقة بعدالة تامة. هل تريد المتابعة؟')) {
                        DistributionManager.forceFullFairDistribution();
                    }
                };
                container.appendChild(btn);
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    if (typeof AppRenderer !== 'undefined') {
        injectButton();
    } else {
        window.addEventListener('DOMContentLoaded', function() {
            var wait = setInterval(function() {
                if (typeof AppRenderer !== 'undefined') {
                    clearInterval(wait);
                    injectButton();
                }
            }, 50);
        });
    }

    console.log('✅ زر التوزيع العادل الكامل جاهز');
})();