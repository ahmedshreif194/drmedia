// ============================================================
// ملف التحديثات الموحد - Dr Media Pro
// تم التنظيف والمراجعة - لا يوجد تكرار - التوزيع عادل
// ============================================================

// ====== ١. التاريخ والوقت ======
(function() {
    console.log('🟢 تحميل: التاريخ والوقت');
    function updateDateTime(el) {
        var now = new Date();
        var opts = { year:'numeric', month:'long', day:'numeric', weekday:'long' };
        var d = now.toLocaleDateString('ar-EG', opts);
        var t = now.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        el.textContent = d + ' - ' + t;
    }
    function inject() {
        var topbar = document.querySelector('.topbar');
        if (topbar && !document.getElementById('liveDateTime')) {
            var span = document.createElement('span');
            span.id = 'liveDateTime';
            span.style.cssText = 'margin:0 15px;font-weight:bold;color:#16a34a;white-space:nowrap;font-size:14px;';
            var btn = topbar.querySelector('button');
            if (btn) btn.parentNode.insertBefore(span, btn);
            else topbar.appendChild(span);
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
        }
        var empHeader = document.querySelector('#app header');
        if (empHeader && !document.getElementById('liveDateTimeEmp')) {
            var span = document.createElement('span');
            span.id = 'liveDateTimeEmp';
            span.style.cssText = 'font-weight:bold;color:#16a34a;white-space:nowrap;font-size:14px;margin-right:20px;';
            var h1 = empHeader.querySelector('h1');
            if (h1) h1.insertAdjacentElement('afterend', span);
            else empHeader.appendChild(span);
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
        }
    }
    inject();
    new MutationObserver(inject).observe(document.body, { childList:true, subtree:true });
})();

// ====== ٢. قوائم منسدلة للموظفين ======
(function() {
    console.log('🟢 تحميل: قوائم منسدلة للموظفين');
    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb();
        else setTimeout(function() { waitForApp(cb); }, 50);
    }
    function enhance() {
        var rows = document.querySelectorAll('#content-area table tbody tr');
        rows.forEach(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 6) return;
            var cell = cells[5];
            if (!cell || cell.querySelector('.emp-swap-select')) return;
            var cb = row.querySelector('input.booking-check');
            if (!cb) return;
            var bookingId = cb.value;
            var booking = state.bookings.find(function(b) { return b.id === bookingId; });
            if (!booking) return;
            var assigned = booking.assignedEmployees || [];
            cell.innerHTML = '';
            var allEmp = state.employees.filter(function(e) { return e.active; });
            assigned.forEach(function(empId) {
                var emp = state.employees.find(function(e) { return e.id === empId; });
                if (!emp) return;
                var sel = document.createElement('select');
                sel.className = 'emp-swap-select border p-1 rounded text-sm';
                sel.style.cssText = 'margin-bottom:4px; width:100%;';
                var emptyOpt = document.createElement('option');
                emptyOpt.value = ''; emptyOpt.textContent = '-- إزالة --';
                sel.appendChild(emptyOpt);
                allEmp.forEach(function(e) {
                    var opt = document.createElement('option');
                    opt.value = e.id; opt.textContent = e.name + ' (' + e.role + ')';
                    if (e.id === empId) opt.selected = true;
                    sel.appendChild(opt);
                });
                sel.addEventListener('change', function() {
                    var newId = this.value, oldId = empId;
                    var bk = state.bookings.find(function(b) { return b.id === bookingId; });
                    if (!bk) return;
                    if (!newId) {
                        bk.assignedEmployees = bk.assignedEmployees.filter(function(id) { return id !== oldId; });
                    } else {
                        var idx = bk.assignedEmployees.indexOf(oldId);
                        if (idx !== -1) bk.assignedEmployees[idx] = newId;
                        else if (!bk.assignedEmployees.includes(newId)) bk.assignedEmployees.push(newId);
                    }
                    DataManager.updateEmployeeOrders();
                    DataManager.saveAllData();
                    Utils.showMsg('✅ تم تغيير الموظف');
                    AppRenderer.renderBookings();
                });
                cell.appendChild(sel);
            });
            var addBtn = document.createElement('button');
            addBtn.textContent = '+'; addBtn.className = 'btn-secondary text-xs';
            addBtn.style.cssText = 'margin-top:6px;';
            addBtn.onclick = function() {
                var bk = state.bookings.find(function(b) { return b.id === bookingId; });
                if (!bk) return;
                var assignedSet = new Set(bk.assignedEmployees || []);
                var available = allEmp.filter(function(e) { return !assignedSet.has(e.id); });
                if (!available.length) { Utils.showWarning('جميع الموظفين معينون'); return; }
                var opts = available.map(function(e) { return '<option value="'+e.id+'">'+e.name+' ('+e.role+')</option>'; }).join('');
                Utils.openModal('<h3>إضافة موظف</h3><select id="addEmpSelect" class="w-full border-2 p-2 my-2 rounded-xl">'+opts+'</select><div class="flex gap-2 mt-4"><button onclick="window._addEmpToBooking(\''+bookingId+'\')" class="btn-primary flex-1">💾 حفظ</button><button onclick="Utils.closeModal()" class="btn-outline flex-1">إلغاء</button></div>');
            };
            cell.appendChild(addBtn);
        });
    }
    window._addEmpToBooking = function(bookingId) {
        var empId = document.getElementById('addEmpSelect')?.value;
        if (!empId) return Utils.showError('اختر موظفاً');
        var bk = state.bookings.find(function(b) { return b.id === bookingId; });
        if (!bk) return;
        if (!bk.assignedEmployees) bk.assignedEmployees = [];
        if (bk.assignedEmployees.includes(empId)) { Utils.showWarning('الموظف مضاف بالفعل'); return; }
        bk.assignedEmployees.push(empId);
        DataManager.updateEmployeeOrders(); DataManager.saveAllData();
        Utils.closeModal(); AppRenderer.renderBookings();
    };
    waitForApp(function() {
        var orig = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            orig.apply(this, arguments);
            requestAnimationFrame(enhance);
        };
        if (document.querySelector('#content-area table tbody')) enhance();
    });
})();

// ====== ٣. أزرار الحالة الثلاثية ======
(function() {
    console.log('🟢 تحميل: أزرار الحالة');
    function enhanceStatus() {
        var rows = document.querySelectorAll('#content-area table tbody tr');
        rows.forEach(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            var statusCell = cells[4];
            if (!statusCell || statusCell.querySelector('.status-radio-group')) return;
            var cb = row.querySelector('input.booking-check');
            if (!cb) return;
            var bookingId = cb.value;
            var booking = state.bookings.find(function(b) { return b.id === bookingId; });
            if (!booking) return;
            var current = booking.status || 'pending';
            var statuses = [
                { value:'pending', label:'معلق', color:'#f59e0b' },
                { value:'completed', label:'مكتمل', color:'#10b981' },
                { value:'cancelled', label:'ملغي', color:'#ef4444' }
            ];
            statusCell.innerHTML = '';
            var container = document.createElement('div');
            container.className = 'status-radio-group';
            container.style.cssText = 'display:flex; gap:6px; align-items:center;';
            statuses.forEach(function(st) {
                var label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; gap:4px; cursor:pointer; font-size:0.75rem; padding:4px 8px; border-radius:20px; transition:0.2s;';
                label.style.backgroundColor = current === st.value ? st.color : '#f3f4f6';
                label.style.color = current === st.value ? '#fff' : '#374151';
                label.style.border = '1px solid ' + st.color;
                var radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'status-'+bookingId;
                radio.value = st.value; radio.checked = (current === st.value);
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
    }
    if (typeof AppRenderer !== 'undefined') {
        var orig = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            orig.apply(this, arguments);
            setTimeout(enhanceStatus, 200);
        };
    }
})();

// ====== ٤. تنسيقات الجدول ======
(function() {
    if (document.getElementById('booking-enhanced-styles')) return;
    var style = document.createElement('style');
    style.id = 'booking-enhanced-styles';
    style.textContent = '#content-area .bg-card { padding:18px!important; border-radius:18px!important; } #content-area table { font-size:0.85rem; } #content-area table th { background:var(--primary); color:white; padding:12px 6px; } #content-area table td { padding:10px 6px; vertical-align:middle; } #content-area table tbody tr:hover { background:#f0fdf4; } #content-area .overflow-x-auto { border-radius:12px; border:1px solid var(--border); } body.dark #content-area table th { background:#2d3a4a; } body.dark #content-area table tbody tr:hover { background:#2d3a3a; }';
    document.head.appendChild(style);
})();

// ====== ٥. أنماط الشكل ======
(function() {
    var STYLES = {
        default:{name:'الافتراضي',css:''},
        rounded:{name:'دائري ناعم',css:':root{--radius-btn:40px;--radius-lg:28px;--radius-xl:32px;}.btn,.stat-card,.bg-card,.sidebar-item,.modal-content{border-radius:var(--radius-lg)!important;}.btn{border-radius:var(--radius-btn)!important;}.modal-content{border-radius:var(--radius-xl)!important;}'},
        compact:{name:'مدمج',css:':root{--radius-btn:8px;--radius-lg:8px;--radius-xl:10px;}.btn{padding:6px 14px;font-size:0.8rem;}table{font-size:0.78rem;}th,td{padding:6px 5px;}.stat-card,.bg-card{padding:12px;}.sidebar{width:220px;}.main-content{margin-right:220px;padding:16px;padding-top:calc(60px + 16px);}.topbar{height:60px;padding:10px 16px;right:220px;}'},
        spacious:{name:'واسع',css:':root{--radius-btn:30px;--radius-lg:24px;--radius-xl:28px;}.main-content{padding:40px;padding-top:calc(80px + 40px);}.stat-card,.bg-card{padding:30px;margin-bottom:30px;}.btn{padding:12px 28px;font-size:1rem;}.sidebar{width:280px;}.main-content{margin-right:280px;}.topbar{right:280px;height:80px;padding:18px 28px;}'},
        modern:{name:'مودرن',css:':root{--radius-btn:20px;--radius-lg:16px;--radius-xl:20px;}.sidebar{background:#1e293b;color:#e2e8f0;}.sidebar-item{color:#94a3b8;}.sidebar-item:hover{background:#334155;color:white;}.sidebar-item.active{background:var(--primary);color:white;}.topbar{border-bottom:2px solid var(--primary);}.btn{text-transform:uppercase;font-size:0.8rem;letter-spacing:0.5px;}'}
    };
    var saved = localStorage.getItem('drmedia_style') || 'default';
    function apply(name) {
        var old = document.getElementById('dynamic-style-patch');
        if (old) old.remove();
        if (name !== 'default' && STYLES[name]) {
            var s = document.createElement('style');
            s.id = 'dynamic-style-patch';
            s.textContent = STYLES[name].css;
            document.head.appendChild(s);
        }
        localStorage.setItem('drmedia_style', name);
    }
    apply(saved);
    window._applyGlobalStyle = function(name) { apply(name); Utils.showMsg('✅ تم تغيير شكل الواجهة'); };
    var check = setInterval(function() {
        var wa = document.getElementById('waMsgTemplate');
        if (wa && !document.getElementById('styleSelectContainer')) {
            clearInterval(check);
            var html = '<div id="styleSelectContainer" style="margin-top:20px;border-top:2px solid #eee;padding-top:15px;"><label class="text-sm font-semibold">🎨 شكل الواجهة</label><select id="styleSelect" class="w-full border-2 p-2 rounded-xl mt-1" onchange="window._applyGlobalStyle(this.value)">'+Object.keys(STYLES).map(function(k){return '<option value="'+k+'" '+(saved===k?'selected':'')+'>'+STYLES[k].name+'</option>';}).join('')+'</select></div>';
            wa.insertAdjacentHTML('afterend', html);
        }
    }, 300);
})();

// ====== ٦. لوحة المراقبة الحية ======
(function() {
    if (typeof AppRenderer !== 'undefined') {
        var orig = AppRenderer.renderDashboard;
        AppRenderer.renderDashboard = function() {
            orig.apply(this, arguments);
            setTimeout(function() {
                if (document.getElementById('liveMonitorCards')) return;
                var today = Utils.getTodayDateStr();
                var todayB = state.bookings.filter(function(b) { return b.date===today && !b.deleted && b.status!=='cancelled'; }).length;
                var activeE = state.employees.filter(function(e) { return state.attendanceRecords.some(function(a) { return a.empId===e.id && a.date===today && a.checkIn && !a.checkOut; }); }).length;
                var busyH = new Set(state.bookings.filter(function(b) { return b.date===today && !b.deleted && b.status!=='cancelled'; }).map(function(b) { return b.hallId; })).size;
                var container = document.createElement('div');
                container.id = 'liveMonitorCards';
                container.style.marginTop = '20px';
                var title = document.createElement('h3');
                title.style.fontWeight = 'bold';
                title.textContent = '📡 لوحة المراقبة الحية';
                container.appendChild(title);
                var grid = document.createElement('div');
                grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px;';
                function addCard(val, lab, col) {
                    var card = document.createElement('div');
                    card.className = 'stat-card';
                    card.style.borderLeft = '4px solid '+col;
                    var v = document.createElement('div');
                    v.className = 'stat-value'; v.style.color = col; v.textContent = val;
                    var l = document.createElement('div');
                    l.className = 'stat-label'; l.textContent = lab;
                    card.appendChild(v); card.appendChild(l); grid.appendChild(card);
                }
                addCard(todayB, 'حجوزات اليوم', '#3b82f6');
                addCard(activeE, 'موظفون متواجدون', '#10b981');
                addCard(busyH, 'قاعات مشغولة', '#f59e0b');
                container.appendChild(grid);
                var ca = document.getElementById('content-area');
                if (ca) {
                    var fg = ca.querySelector('.grid');
                    if (fg) fg.parentNode.insertBefore(container, fg.nextSibling);
                }
            }, 200);
        };
    }
})();

// ====== ٧. مؤشر الاتصال ======
(function() {
    function updateIndicator() {
        var ind = document.getElementById('connectionIndicator');
        if (!ind) return;
        var online = navigator.onLine;
        ind.innerHTML = online ? '🟢 متصل' : '🟠 غير متصل';
        ind.style.color = online ? '#16a34a' : '#f59e0b';
    }
    function inject() {
        var oldBar = document.getElementById('offlineStatusBar');
        if (oldBar) oldBar.style.display = 'none';
        var topbar = document.querySelector('.topbar');
        if (!topbar || document.getElementById('connectionIndicator')) return;
        var span = document.createElement('span');
        span.id = 'connectionIndicator';
        span.style.cssText = 'margin-right:15px;font-weight:bold;font-size:14px;';
        updateIndicator();
        var btn = topbar.querySelector('button');
        if (btn) btn.parentNode.insertBefore(span, btn);
        else topbar.appendChild(span);
        window.addEventListener('online', updateIndicator);
        window.addEventListener('offline', updateIndicator);
    }
    if (document.querySelector('.topbar')) inject();
    window.addEventListener('DOMContentLoaded', function() {
        var check = setInterval(function() { if (document.querySelector('.topbar')) { inject(); clearInterval(check); } }, 200);
    });
})();

// ====== ٨. ترتيب الأوردرات في واجهة الموظف ======
(function() {
    if (typeof AppRenderer !== 'undefined') {
        var orig = AppRenderer.renderEmpDash;
        AppRenderer.renderEmpDash = function() {
            orig.apply(this, arguments);
            setTimeout(function() {
                var container = document.querySelector('#app .max-h-60.overflow-y-auto');
                if (!container) return;
                var items = Array.from(container.querySelectorAll('.border-b'));
                if (!items.length) return;
                items.sort(function(a, b) {
                    var da = (a.textContent.match(/\d{4}-\d{2}-\d{2}/) || ['9999'])[0];
                    var db = (b.textContent.match(/\d{4}-\d{2}-\d{2}/) || ['9999'])[0];
                    return da.localeCompare(db);
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

// ====== ٩. تحسين الموبايل ======
(function() {
    if (!document.getElementById('mobile-responsive-fix')) {
        var style = document.createElement('style');
        style.id = 'mobile-responsive-fix';
        style.textContent = '@media (max-width:768px){.main-content{padding:12px!important;padding-top:60px!important;}.topbar{padding:10px 12px!important;height:60px!important;right:0!important;}.btn,button{min-height:44px;padding:10px 16px;font-size:0.9rem;}select,input{font-size:16px!important;}.modal-content{width:95%!important;margin:10px;border-radius:16px;}}';
        document.head.appendChild(style);
    }
})();

// ====== ١٠. حضور سابق متعدد ======
(function() {
    function wait(cb) { if (typeof AppRenderer !== 'undefined') cb(); else setTimeout(function() { wait(cb); }, 50); }
    wait(function() {
        AppRenderer.showPastAttendanceModal = function() {
            var opts = state.employees.map(function(e) { return '<option value="'+e.id+'">'+e.name+' ('+e.role+')</option>'; }).join('');
            Utils.openModal('<h3 class="text-xl font-bold mb-4">📅 تسجيل حضور / انصراف (متعدد)</h3><p class="text-sm mb-2">اختر الموظفين:</p><select id="pastEmpSelect" multiple class="w-full border-2 p-2 my-2 rounded-xl h-40">'+opts+'</select><input type="date" id="pastDate" class="w-full border-2 p-2 my-2 rounded-xl" value="'+Utils.getTodayDateStr()+'"><div class="flex gap-2 mt-4"><button onclick="AppRenderer.recordPastAttendanceMulti()" class="btn-primary flex-1">✅ حضور وانصراف</button><button onclick="Utils.closeModal()" class="btn-outline flex-1">إلغاء</button></div>');
        };
        AppRenderer.recordPastAttendanceMulti = function() {
            var sel = document.getElementById('pastEmpSelect');
            var date = document.getElementById('pastDate');
            if (!sel || !date) return;
            var selected = Array.from(sel.selectedOptions);
            if (!selected.length) return Utils.showError('اختر موظفًا واحدًا على الأقل');
            selected.forEach(function(opt) {
                AttendanceManager.recordAttendanceForDate(opt.value, date.value, 'checkIn');
                AttendanceManager.recordAttendanceForDate(opt.value, date.value, 'checkOut');
            });
            Utils.closeModal(); AppRenderer.renderAttendance();
            Utils.showMsg('✅ تم تسجيل '+selected.length+' موظف');
        };
    });
})();

// ====== ١١. تجميع الحجوزات بالشهر ======
(function() {
    function wait(cb) { if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb(); else setTimeout(function() { wait(cb); }, 50); }
    if (!state.filters) state.filters = {};
    if (!state.filters.bookingYear) state.filters.bookingYear = new Date().getFullYear();
    if (!state.filters.bookingMonth) state.filters.bookingMonth = new Date().getMonth() + 1;
    var monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    function injectMonthFilter() {
        var container = document.querySelector('#content-area .bg-card .flex.justify-between.flex-wrap');
        if (!container || document.getElementById('monthFilterBar')) return;
        var bar = document.createElement('div');
        bar.id = 'monthFilterBar';
        bar.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;';
        var prev = document.createElement('button'); prev.className='btn-outline text-sm'; prev.textContent='◀';
        prev.onclick = function() { if (state.filters.bookingMonth===1) { state.filters.bookingMonth=12; state.filters.bookingYear--; } else state.filters.bookingMonth--; AppRenderer.renderBookings(); };
        var next = document.createElement('button'); next.className='btn-outline text-sm'; next.textContent='▶';
        next.onclick = function() { if (state.filters.bookingMonth===12) { state.filters.bookingMonth=1; state.filters.bookingYear++; } else state.filters.bookingMonth++; AppRenderer.renderBookings(); };
        var label = document.createElement('span');
        label.style.cssText = 'font-weight:bold;min-width:120px;text-align:center;';
        label.textContent = monthNames[state.filters.bookingMonth-1]+' '+state.filters.bookingYear;
        var todayBtn = document.createElement('button'); todayBtn.className='btn-outline text-sm'; todayBtn.textContent='📍 الشهر الحالي';
        todayBtn.onclick = function() { var now=new Date(); state.filters.bookingYear=now.getFullYear(); state.filters.bookingMonth=now.getMonth()+1; AppRenderer.renderBookings(); };
        bar.appendChild(prev); bar.appendChild(label); bar.appendChild(next); bar.appendChild(todayBtn);
        var revLine = document.querySelector('#content-area .text-sm.mb-2');
        if (revLine) revLine.insertAdjacentElement('afterend', bar);
        else container.insertAdjacentElement('afterend', bar);
    }
    wait(function() {
        var orig = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            var origFrom = state.filters.bookingDateFrom, origTo = state.filters.bookingDateTo;
            var origStatus = state.filters.bookingStatus, origHall = state.filters.bookingHall;
            var y = state.filters.bookingYear, m = state.filters.bookingMonth;
            var lastDay = new Date(y, m, 0).getDate();
            state.filters.bookingDateFrom = y+'-'+String(m).padStart(2,'0')+'-01';
            state.filters.bookingDateTo = y+'-'+String(m).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
            orig.apply(this, arguments);
            state.filters.bookingDateFrom = origFrom; state.filters.bookingDateTo = origTo;
            state.filters.bookingStatus = origStatus; state.filters.bookingHall = origHall;
            setTimeout(injectMonthFilter, 100);
        };
    });
})();

// ====== ١٢. فلتر الشهر للفلاشات ======
(function() {
    function wait(cb) { if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') cb(); else setTimeout(function() { wait(cb); }, 50); }
    if (!state.flashFilters) state.flashFilters = { year: new Date().getFullYear(), month: new Date().getMonth()+1 };
    var monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    function getFiltered() {
        return state.flashDrives.filter(function(f) {
            var b = state.bookings.find(function(bk) { return bk.id === f.bookingId; });
            if (!b) return false;
            var d = new Date(b.date);
            return d.getFullYear() === state.flashFilters.year && (d.getMonth()+1) === state.flashFilters.month;
        });
    }
    function injectBar() {
        var container = document.querySelector('#content-area .bg-card');
        if (!container || document.getElementById('flashMonthBar')) return;
        var bar = document.createElement('div');
        bar.id = 'flashMonthBar';
        bar.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;';
        var prev = document.createElement('button'); prev.className='btn-outline text-sm'; prev.textContent='◀';
        prev.onclick = function() { if (state.flashFilters.month===1) { state.flashFilters.month=12; state.flashFilters.year--; } else state.flashFilters.month--; AppRenderer.renderFlash(); };
        var next = document.createElement('button'); next.className='btn-outline text-sm'; next.textContent='▶';
        next.onclick = function() { if (state.flashFilters.month===12) { state.flashFilters.month=1; state.flashFilters.year++; } else state.flashFilters.month++; AppRenderer.renderFlash(); };
        var label = document.createElement('span');
        label.style.cssText = 'font-weight:bold;min-width:120px;text-align:center;';
        label.textContent = monthNames[state.flashFilters.month-1]+' '+state.flashFilters.year;
        var todayBtn = document.createElement('button'); todayBtn.className='btn-outline text-sm'; todayBtn.textContent='📍 الشهر الحالي';
        todayBtn.onclick = function() { var now=new Date(); state.flashFilters.year=now.getFullYear(); state.flashFilters.month=now.getMonth()+1; AppRenderer.renderFlash(); };
        bar.appendChild(prev); bar.appendChild(label); bar.appendChild(next); bar.appendChild(todayBtn);
        var tableW = container.querySelector('.overflow-x-auto');
        if (tableW) container.insertBefore(bar, tableW);
        else container.appendChild(bar);
    }
    wait(function() {
        var orig = AppRenderer.renderFlash;
        AppRenderer.renderFlash = function() {
            var origFlash = state.flashDrives;
            state.flashDrives = getFiltered();
            orig.apply(this, arguments);
            state.flashDrives = origFlash;
            injectBar();
        };
    });
})();

// ====== ١٣. شكل الواجهة الحديث ======
(function() {
    var css = ':root{--sidebar-bg:#1e293b;--sidebar-text:#cbd5e1;--sidebar-active-bg:#16a34a;--sidebar-active-text:#fff;--topbar-bg:#fff;--topbar-border:#e2e8f0;--card-bg:#fff;--card-border:#e2e8f0;--card-shadow:0 4px 12px rgba(0,0,0,0.03);--btn-radius:10px;--font-family:"Inter","Segoe UI",Tahoma,sans-serif;}body{font-family:var(--font-family);background:#f8fafc;}.sidebar{background:var(--sidebar-bg)!important;border-left:none!important;box-shadow:2px 0 15px rgba(0,0,0,0.05);}.sidebar .footer-bar{color:#94a3b8!important;border-top:1px solid #334155!important;}.sidebar-item{color:var(--sidebar-text)!important;border-right:none!important;margin:4px 10px!important;border-radius:12px!important;transition:all 0.2s!important;}.sidebar-item:hover{background:#334155!important;color:white!important;}.sidebar-item.active{background:var(--sidebar-active-bg)!important;color:var(--sidebar-active-text)!important;font-weight:600!important;box-shadow:0 4px 12px rgba(22,163,74,0.3);}.topbar{background:var(--topbar-bg)!important;border-bottom:1px solid var(--topbar-border)!important;box-shadow:none!important;}.stat-card{background:var(--card-bg);border:1px solid var(--card-border);border-radius:16px!important;padding:20px 15px!important;box-shadow:var(--card-shadow)!important;transition:transform 0.2s;}.stat-card:hover{transform:translateY(-3px);box-shadow:0 10px 25px rgba(0,0,0,0.08);}.stat-value{font-size:1.8rem!important;margin-bottom:4px;}.stat-label{font-size:0.8rem!important;color:#64748b!important;}.bg-card{background:var(--card-bg);border:1px solid var(--card-border);border-radius:18px!important;padding:22px!important;box-shadow:var(--card-shadow)!important;}.btn,button{border-radius:var(--btn-radius)!important;font-weight:500!important;transition:all 0.2s!important;}.btn-primary{background:#16a34a!important;box-shadow:0 4px 10px rgba(22,163,74,0.2);}.btn-primary:hover{background:#15803d!important;}.btn-outline{border:1px solid #d1d5db!important;background:white!important;}.btn-outline:hover{background:#f9fafb!important;border-color:#9ca3af!important;}table{border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;}th{background:#f8fafc!important;font-weight:600!important;color:#334155!important;border-bottom:1px solid #e2e8f0!important;padding:14px 12px!important;}td{padding:12px!important;border-bottom:1px solid #f1f5f9!important;}tbody tr:hover td{background:#f0fdf4!important;}.status-badge,.badge-active,.badge-inactive{border-radius:20px!important;padding:5px 14px!important;font-size:0.7rem!important;}.modal-content{border-radius:20px!important;padding:28px!important;box-shadow:0 25px 60px rgba(0,0,0,0.15);}#liveDateTime,#liveDateTimeEmp{color:#16a34a!important;font-weight:600!important;background:#f0fdf4;padding:4px 12px!important;border-radius:20px;font-size:0.85rem!important;}body.dark{--sidebar-bg:#0f172a;--topbar-bg:#1e293b;--card-bg:#1e293b;--card-border:#334155;background:#0f172a;}body.dark .stat-card,body.dark .bg-card{background:var(--card-bg);border-color:var(--card-border);}body.dark th{background:#1e293b!important;color:#e2e8f0!important;}body.dark td{border-bottom-color:#334155!important;}body.dark tbody tr:hover td{background:#2d3a4a!important;}';
    if (!document.getElementById('modern-style-drmedia')) {
        var style = document.createElement('style');
        style.id = 'modern-style-drmedia';
        style.textContent = css;
        document.head.appendChild(style);
    }
})();

// ====== ١٤. Textbee Cloud API ======
(function() {
    if (!window.TextbeeCloudConfig) window.TextbeeCloudConfig = JSON.parse(localStorage.getItem('drmedia_textbee_cloud') || '{"apiKey":"","deviceId":"","baseUrl":"https://api.textbee.dev/api/v1"}');
    window.sendSMS = async function(to, message) {
        var cfg = window.TextbeeCloudConfig;
        if (!cfg.apiKey || !cfg.deviceId) { Utils.showError('يرجى إعداد Textbee Cloud'); return false; }
        try {
            var phone = to.replace(/[^0-9+]/g, '');
            if (!phone.startsWith('+')) { if (phone.startsWith('0')) phone = '2'+phone.substring(1); phone = '+'+phone; }
            var resp = await fetch(cfg.baseUrl+'/gateway/devices/'+cfg.deviceId+'/send-sms', {
                method:'POST', headers:{'Content-Type':'application/json','x-api-key':cfg.apiKey},
                body:JSON.stringify({recipients:[phone], message:message})
            });
            var result = await resp.json();
            if (resp.ok && result.success !== false) { Utils.showMsg('✅ تم الإرسال'); return true; }
            else { Utils.showError('❌ فشل: '+(result.message||result.error||'خطأ')); return false; }
        } catch(e) { Utils.showError('فشل الاتصال بـ Textbee'); return false; }
    };
    function injectSettings() {
        var check = setInterval(function() {
            var wa = document.getElementById('waMsgTemplate');
            if (wa && !document.getElementById('textbeeCloudContainer')) {
                clearInterval(check);
                var cfg = window.TextbeeCloudConfig;
                var html = '<div id="textbeeCloudContainer" style="margin-top:20px;border-top:2px solid #eee;padding-top:15px;"><h3 class="font-semibold mb-2">☁️ إعدادات Textbee Cloud</h3><p class="text-sm text-gray-500 mb-2">احصل على المفاتيح من <a href="https://textbee.dev" target="_blank" class="text-blue-600 underline">textbee.dev</a></p><input id="textbeeApiKey" value="'+cfg.apiKey+'" class="w-full border-2 p-2 rounded-xl mb-2" placeholder="TB_API_..."><input id="textbeeDeviceId" value="'+cfg.deviceId+'" class="w-full border-2 p-2 rounded-xl mb-2" placeholder="dev_..."><div class="flex gap-2"><button onclick="window._saveTextbeeSettings()" class="btn-primary flex-1">💾 حفظ</button><button onclick="window._testTextbeeSMS()" class="btn-secondary">🧪 اختبار</button></div></div>';
                wa.insertAdjacentHTML('afterend', html);
            }
        }, 300);
        setTimeout(function() { clearInterval(check); }, 10000);
    }
    window._saveTextbeeSettings = function() {
        window.TextbeeCloudConfig.apiKey = document.getElementById('textbeeApiKey').value.trim();
        window.TextbeeCloudConfig.deviceId = document.getElementById('textbeeDeviceId').value.trim();
        localStorage.setItem('drmedia_textbee_cloud', JSON.stringify(window.TextbeeCloudConfig));
        Utils.showMsg('✅ تم الحفظ');
    };
    window._testTextbeeSMS = function() {
        var phone = prompt('رقم الهاتف للاختبار (دولي):','+201012345678');
        if (!phone) return;
        var msg = prompt('رسالة الاختبار:','مرحباً من Dr Media Pro');
        if (msg) window.sendSMS(phone, msg);
    };
    function init() {
        injectSettings();
        var obs = new MutationObserver(function() { if (document.getElementById('waMsgTemplate')) injectSettings(); });
        var app = document.getElementById('app');
        if (app) obs.observe(app, { childList:true, subtree:true });
    }
    if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') init();
    else window.addEventListener('DOMContentLoaded', function() { var w = setInterval(function() { if (typeof AppRenderer !== 'undefined') { clearInterval(w); init(); } }, 50); });
})();

// ====== ١٥. نظام الرسائل + تبويب الرسائل ======
(function() {
    if (!state.messageLog) state.messageLog = [];
    function logMessage(type, recipient, message, status) {
        state.messageLog.unshift({ id:Utils.generateId('msg_'), type:type, recipient:recipient, message:message, status:status, time:new Date().toLocaleString('ar-EG') });
        if (state.messageLog.length > 200) state.messageLog.length = 200;
        DataManager.saveAllData();
    }
    if (!state.autoMessageSettings) state.autoMessageSettings = JSON.parse(localStorage.getItem('drmedia_auto_msg') || '{"distribute":true,"reminder":true,"attendance":false}');
    function saveAutoMsg() { localStorage.setItem('drmedia_auto_msg', JSON.stringify(state.autoMessageSettings)); }
    async function autoSendSMS(phone, message) {
        if (typeof window.sendSMS === 'function') { var success = await window.sendSMS(phone, message); logMessage('sms', phone, message, success?'sent':'failed'); }
        else console.warn('sendSMS غير موجودة');
    }
    function autoSendWhatsApp(phone, message) {
        if (typeof window.sendWhatsAppReliable === 'function') { window.sendWhatsAppReliable(phone, message); logMessage('whatsapp', phone, message, 'sent'); }
        else if (typeof window.sendWhatsAppAuto === 'function') { window.sendWhatsAppAuto(phone, message); logMessage('whatsapp', phone, message, 'sent'); }
        else if (typeof NotificationManager !== 'undefined' && NotificationManager.sendWhatsApp) { NotificationManager.sendWhatsApp(phone, message); logMessage('whatsapp', phone, message, 'sent'); }
        else { var cleaned = phone.replace(/[^0-9+]/g,''); if (cleaned.startsWith('0')) cleaned = '20'+cleaned.substring(1); if (!cleaned.startsWith('+')) cleaned = '+'+cleaned; window.open('https://wa.me/'+cleaned+'?text='+encodeURIComponent(message), '_blank'); logMessage('whatsapp', phone, message, 'sent'); }
    }
    function createMessageTab() {
        if (!AppRenderer.pages.includes('messages')) AppRenderer.pages.push('messages');
        AppRenderer.renderMessages = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = '📨 إدارة الرسائل';
            var settings = state.autoMessageSettings;
            c.innerHTML = '<div class="bg-card"><h2 class="text-xl font-bold mb-4">📨 إدارة الرسائل والإرسال التلقائي</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><div class="border p-4 rounded-xl"><h3 class="font-semibold mb-2">⚙️ الإرسال التلقائي</h3><label class="flex items-center gap-2 mb-2"><input type="checkbox" id="autoDistribute" '+(settings.distribute?'checked':'')+' onchange="window._toggleAutoMsg(\'distribute\')"> عند التوزيع</label><label class="flex items-center gap-2 mb-2"><input type="checkbox" id="autoReminder" '+(settings.reminder?'checked':'')+' onchange="window._toggleAutoMsg(\'reminder\')"> تذكير يوم الأوردر</label><label class="flex items-center gap-2 mb-2"><input type="checkbox" id="autoAttendance" '+(settings.attendance?'checked':'')+' onchange="window._toggleAutoMsg(\'attendance\')"> عند تسجيل الحضور</label></div><div class="border p-4 rounded-xl"><h3 class="font-semibold mb-2">📤 إرسال يدوي</h3><select id="msgEmpSelect" class="w-full border-2 p-2 rounded-xl mb-2">'+state.employees.map(function(e){return '<option value="'+e.id+'">'+e.name+' ('+(e.phone||'لا يوجد رقم')+')</option>';}).join('')+'</select><textarea id="msgText" class="w-full border-2 p-2 rounded-xl mb-2" rows="2" placeholder="نص الرسالة..."></textarea><div class="flex gap-2"><button onclick="window._sendManualSMS()" class="btn-secondary flex-1">📱 SMS</button><button onclick="window._sendManualWA()" class="btn-primary flex-1">💬 واتساب</button></div></div></div><h3 class="font-semibold mb-2">📋 سجل الرسائل (آخر 50)</h3><div class="overflow-x-auto max-h-96 overflow-y-auto"><table><thead><tr><th>الوقت</th><th>النوع</th><th>المستلم</th><th>الرسالة</th><th>الحالة</th></tr></thead><tbody>'+state.messageLog.slice(0,50).map(function(m){return '<tr><td class="text-sm">'+m.time+'</td><td>'+(m.type==='sms'?'📱':'💬')+'</td><td>'+m.recipient+'</td><td class="text-sm">'+m.message+'</td><td>'+(m.status==='sent'?'✅':'❌')+'</td></tr>';}).join('')+'</tbody></table></div><div class="footer-bar">'+APP_CONFIG.footerText+'</div></div>';
            window._toggleAutoMsg = function(key) { state.autoMessageSettings[key] = !state.autoMessageSettings[key]; saveAutoMsg(); };
            window._sendManualSMS = function() { var empId = document.getElementById('msgEmpSelect').value; var text = document.getElementById('msgText').value.trim(); if (!text) return Utils.showError('اكتب رسالة'); var emp = state.employees.find(function(e){return e.id===empId}); if (!emp||!emp.phone) return Utils.showError('الموظف ليس له رقم'); autoSendSMS(emp.phone, text); };
            window._sendManualWA = function() { var empId = document.getElementById('msgEmpSelect').value; var text = document.getElementById('msgText').value.trim(); if (!text) return Utils.showError('اكتب رسالة'); var emp = state.employees.find(function(e){return e.id===empId}); if (!emp||!emp.phone) return Utils.showError('الموظف ليس له رقم'); autoSendWhatsApp(emp.phone, text); };
        };
        var sidebar = document.querySelector('.sidebar .py-2');
        if (sidebar && !document.querySelector('[data-page="messages"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item'; item.setAttribute('data-page','messages');
            item.onclick = function() { AppRenderer.navigateTo('messages'); };
            item.innerHTML = '<span>📨 الرسائل</span>';
            sidebar.appendChild(item);
        }
    }
    function init() { createMessageTab(); }
    if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') init();
    else window.addEventListener('DOMContentLoaded', function() { var w = setInterval(function() { if (typeof AppRenderer !== 'undefined') { clearInterval(w); init(); } }, 50); });
})();

// ====== ١٦. حجز مجمع ======
(function() {
    function createCalendar(year, month, selectedDays) {
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month+1, 0).getDate();
        var today = new Date();
        var html = '<table class="w-full text-center border-collapse"><thead><tr>';
        var dayNames = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
        dayNames.forEach(function(d) { html += '<th class="p-1 text-xs bg-gray-100">'+d+'</th>'; });
        html += '</tr></thead><tbody><tr>';
        for (var i = 0; i < firstDay; i++) html += '<td class="p-1"></td>';
        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
            var isSelected = selectedDays.includes(dateStr);
            var isToday = (today.getFullYear()===year && today.getMonth()===month && today.getDate()===day);
            var bgClass = isSelected ? 'bg-blue-500 text-white' : (isToday ? 'bg-yellow-100' : 'hover:bg-gray-100');
            html += '<td class="p-1"><div class="cursor-pointer rounded-full w-8 h-8 flex items-center justify-center mx-auto text-sm '+bgClass+'" data-date="'+dateStr+'">'+day+'</div></td>';
            if ((firstDay+day)%7===0) html += '</tr><tr>';
        }
        html += '</tr></tbody></table>';
        return html;
    }
    function openBulkModal() {
        var old = document.getElementById('bulkBookingModal');
        if (old) old.remove();
        var now = new Date(), year = now.getFullYear(), month = now.getMonth();
        var selectedDays = [];
        var halls = state.halls || [];
        var modalHTML = '<div id="bulkBookingModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"><h3 class="text-lg font-bold mb-4">📅 حجز مجمّع</h3><div class="flex justify-between items-center mb-2"><button id="prevMonth" class="px-2 py-1 bg-gray-200 rounded">◀</button><span id="monthYearLabel" class="font-semibold"></span><button id="nextMonth" class="px-2 py-1 bg-gray-200 rounded">▶</button></div><div id="calendarContainer" class="mb-3"></div><div class="flex gap-2 mb-3"><button id="selectAllBtn" class="text-xs bg-gray-200 px-2 py-1 rounded">تحديد الكل</button><button id="deselectAllBtn" class="text-xs bg-gray-200 px-2 py-1 rounded">إلغاء الكل</button></div><div class="mb-4"><label class="block text-sm font-medium mb-1">نوع القاعة</label><select id="hallTypeSelect" class="w-full border-2 p-2 rounded-xl">'+halls.map(function(h){return '<option value="'+(h.name||h.type||'')+'">'+(h.name||h.type||'')+'</option>';}).join('')+'</select></div><div class="flex justify-end gap-2"><button id="cancelBulk" class="btn-secondary px-4 py-2 rounded-xl">إلغاء</button><button id="saveBulk" class="btn-primary px-4 py-2 rounded-xl">✅ حفظ</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        function render() {
            document.getElementById('monthYearLabel').textContent = year+'-'+String(month+1).padStart(2,'0');
            document.getElementById('calendarContainer').innerHTML = createCalendar(year, month, selectedDays);
            document.querySelectorAll('#calendarContainer [data-date]').forEach(function(div) {
                div.onclick = function() {
                    var date = this.getAttribute('data-date');
                    var idx = selectedDays.indexOf(date);
                    if (idx > -1) selectedDays.splice(idx, 1);
                    else selectedDays.push(date);
                    render();
                };
            });
        }
        document.getElementById('prevMonth').onclick = function() { if (month===0) { year--; month=11; } else month--; render(); };
        document.getElementById('nextMonth').onclick = function() { if (month===11) { year++; month=0; } else month++; render(); };
        document.getElementById('selectAllBtn').onclick = function() { var dim = new Date(year, month+1, 0).getDate(); for (var d=1; d<=dim; d++) { var ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); if (!selectedDays.includes(ds)) selectedDays.push(ds); } render(); };
        document.getElementById('deselectAllBtn').onclick = function() { var dim = new Date(year, month+1, 0).getDate(); for (var d=1; d<=dim; d++) { var ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); var idx = selectedDays.indexOf(ds); if (idx>-1) selectedDays.splice(idx,1); } render(); };
        document.getElementById('cancelBulk').onclick = function() { document.getElementById('bulkBookingModal').remove(); };
        document.getElementById('saveBulk').onclick = function() {
            var hallType = document.getElementById('hallTypeSelect').value;
            if (!hallType) { Utils.showError('اختر نوع القاعة'); return; }
            if (!selectedDays.length) { Utils.showError('حدد يوم واحد على الأقل'); return; }
            selectedDays.forEach(function(ds) {
                state.bookings.push({ id:Utils.generateId('book_'), clientName:'حجز مجمّع', hallName:hallType, date:ds, time:'00:00', status:'pending', assignedEmployees:[], deleted:false });
            });
            DataManager.saveAllData();
            Utils.showSuccess('تم إضافة '+selectedDays.length+' حجز');
            document.getElementById('bulkBookingModal').remove();
            AppRenderer.renderBookings();
        };
        render();
    }
    function addBulkButton() {
        if (!document.getElementById('pageTitle') || !document.getElementById('pageTitle').textContent.includes('الحجوزات')) return;
        if (document.getElementById('bulkBookingBtn')) return;
        var header = document.querySelector('#content-area .bg-card h2') || document.querySelector('#content-area .bg-card > h3');
        if (header) {
            var btn = document.createElement('button');
            btn.id = 'bulkBookingBtn'; btn.className = 'btn-primary ml-4 text-sm';
            btn.textContent = '📅 حجز مجمّع'; btn.onclick = openBulkModal;
            header.parentNode.insertBefore(btn, header.nextSibling);
        }
    }
    if (typeof AppRenderer !== 'undefined') {
        var orig = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() { orig.apply(this, arguments); addBulkButton(); };
    }
})();

// ====== ١٧. المزامنة الآمنة (محلي فوري + Firebase صامت) ======
(function() {
    if (typeof firebase === 'undefined' || typeof DataManager === 'undefined') return;
    try { firebase.database().setPersistenceEnabled(true).catch(function(){}); } catch(e) {}
    DataManager.saveAllData = async function() {
        var data = {
            bookings: state.bookings || [], employees: state.employees || [], halls: state.halls || [],
            clients: state.clients || [], equipmentInventory: state.equipmentInventory || {},
            attendanceRecords: state.attendanceRecords || [], employeeLoans: state.employeeLoans || {},
            notifications: state.notifications || [], trashBin: state.trashBin || [], activityLog: state.activityLog || [],
            flashDrives: state.flashDrives || [], holidays: state.holidays || [],
            companyName: state.companyName, companyLogo: state.companyLogoBase64 || state.companyLogo,
            USERS: state.USERS, rotationCounters: state.rotationCounters,
            whatsappEnabled: state.whatsapp?.enabled, whatsappBusinessNumber: state.whatsapp?.businessNumber,
            whatsappMessageTemplate: state.whatsapp?.messageTemplate,
            appTheme: state.appTheme, appLanguage: state.appLanguage,
            systemOfflineMode: state.systemOfflineMode, branchId: state.branchId || 'default'
        };
        try { localStorage.setItem('drmedia_data', JSON.stringify(data)); } catch(e) {}
        if (state.useFirebase && state.db && !state.systemOfflineMode) {
            var branchId = state.branchId || 'default';
            firebase.database().ref('drmedia/'+branchId).set(JSON.parse(JSON.stringify(data))).then(function() { state.lastSync = new Date(); }).catch(function(){});
        }
    };
    DataManager.loadAllData = async function() {
        var loaded = false;
        try {
            var raw = localStorage.getItem('drmedia_data');
            if (raw) { DataManager._loadDataObject(JSON.parse(raw)); DataManager._ensureMinimumData(); DataManager.updateEmployeeOrders(); loaded = true; }
        } catch(e) {}
        if (!loaded) {
            if (state.useFirebase && state.db) {
                try { var snap = await state.db.ref('/').once('value'); if (snap.exists()) { DataManager._loadDataObject(snap.val()); DataManager._ensureMinimumData(); DataManager.updateEmployeeOrders(); loaded = true; } } catch(e) { state.online = false; }
            }
            if (!loaded) DataManager._initializeDefaultData();
        } else if (state.useFirebase && state.db && !state.systemOfflineMode) {
            try { await DataManager.saveAllData(); } catch(e) {}
        }
        Utils.applyTheme(state.appTheme);
    };
})();

// ====== ١٨. التوزيع (جميع الدوال) ======
(function() {
    if (typeof DistributionManager === 'undefined') return;

    // --- دوال مساعدة ---
    function getRoleRequirements(hallId) {
        var hall = state.halls.find(function(h) { return h.id === hallId; });
        if (hall && hall.type === 'cafe') return [{ role:'مصور', count:1 }];
        return [{ role:'مخرج', count:1 }, { role:'مصور', count:2 }, { role:'كرين', count:1 }];
    }
    function getOrderCount(empId) {
        return state.bookings.filter(function(b) { return !b.deleted && b.status!=='cancelled' && (b.assignedEmployees||[]).includes(empId); }).length;
    }
    function getFilteredPending() {
        var pending = state.bookings.filter(function(b) { return b.status==='pending' && !b.deleted; });
        if (state.distSettings && state.distSettings.dateRangeEnabled && state.distSettings.dateFrom && state.distSettings.dateTo) {
            pending = pending.filter(function(b) { return b.date >= state.distSettings.dateFrom && b.date <= state.distSettings.dateTo; });
        }
        return pending;
    }

    // --- التوزيع المتساوي تماماً (Round‑Robin مع إصلاح التعارض) ---
    DistributionManager.perfectFairDistribution = async function() {
        var pending = getFilteredPending();
        if (!pending.length) { Utils.showWarning('لا توجد حجوزات معلقة'); return; }
        pending.forEach(function(b) { b.assignedEmployees = []; });

        var byRole = {};
        state.employees.filter(function(e) { return e.active; }).forEach(function(e) {
            var r = (e.role||'').trim();
            if (!byRole[r]) byRole[r] = [];
            byRole[r].push(e);
        });

        var byDate = {};
        pending.forEach(function(b) {
            if (!byDate[b.date]) byDate[b.date] = [];
            byDate[b.date].push(b);
        });

        var dates = Object.keys(byDate).sort();
        for (var d = 0; d < dates.length; d++) {
            var date = dates[d];
            var dayBookings = byDate[date];
            var busy = new Set();
            var slots = [];
            dayBookings.forEach(function(b) {
                var reqs = getRoleRequirements(b.hallId);
                reqs.forEach(function(req) {
                    for (var i = 0; i < req.count; i++) slots.push({ booking:b, role:req.role });
                });
            });

            ['مخرج','كرين','مصور'].forEach(function(role) {
                var emps = byRole[role];
                if (!emps || !emps.length) return;
                var roleSlots = slots.filter(function(s) { return s.role === role; });
                if (!roleSlots.length) return;

                var sortedEmps = emps.slice().sort(function(a,b) { return getOrderCount(a.id) - getOrderCount(b.id); });
                var empIndex = 0;

                roleSlots.forEach(function(slot) {
                    var assigned = false;
                    for (var attempt = 0; attempt < sortedEmps.length; attempt++) {
                        var emp = sortedEmps[(empIndex + attempt) % sortedEmps.length];
                        if (!busy.has(emp.id) && !slot.booking.assignedEmployees.includes(emp.id)) {
                            slot.booking.assignedEmployees.push(emp.id);
                            busy.add(emp.id);
                            empIndex = (empIndex + attempt + 1) % sortedEmps.length;
                            assigned = true;
                            break;
                        }
                    }
                    if (!assigned) {
                        for (var a = 0; a < emps.length; a++) {
                            var emp = emps[a];
                            if (!busy.has(emp.id) && !slot.booking.assignedEmployees.includes(emp.id)) {
                                slot.booking.assignedEmployees.push(emp.id);
                                busy.add(emp.id);
                                break;
                            }
                        }
                    }
                });
            });
        }

        DataManager.updateEmployeeOrders(); await DataManager.saveAllData();
        var stats = {};
        state.employees.forEach(function(e) { stats[e.name+' ('+e.role+')'] = getOrderCount(e.id); });
        var report = Object.entries(stats).map(function(e) { return e[0]+': '+e[1]; }).join('\n');
        Utils.openModal('<h3>✅ توزيع متساوٍ تماماً</h3><pre class="text-sm bg-gray-100 p-2">'+report+'</pre><button onclick="Utils.closeModal()" class="btn-primary mt-2 w-full">حسناً</button>');
        AppRenderer.renderBookings(); AppRenderer.renderDistribution();
    };

    // --- استكمال التوزيع بالتساوي (يحافظ على اليدوي) ---
    DistributionManager.distributeRemainingFairly = async function() {
        var pending = getFilteredPending();
        var unassigned = pending.filter(function(b) { return !b.assignedEmployees || !b.assignedEmployees.length; });
        if (!unassigned.length) { Utils.showMsg('✅ جميع الحجوزات موزعة'); return; }

        var byRole = {};
        state.employees.filter(function(e) { return e.active; }).forEach(function(e) {
            var r = (e.role||'').trim();
            if (!byRole[r]) byRole[r] = [];
            byRole[r].push(e);
        });

        unassigned.sort(function(a,b) { return a.date.localeCompare(b.date); });
        var byDate = {};
        unassigned.forEach(function(b) { if (!byDate[b.date]) byDate[b.date]=[]; byDate[b.date].push(b); });

        Object.keys(byDate).sort().forEach(function(date) {
            var busy = new Set();
            state.bookings.forEach(function(b) { if (b.date===date && !b.deleted) (b.assignedEmployees||[]).forEach(function(eid) { busy.add(eid); }); });
            byDate[date].forEach(function(b) {
                var reqs = getRoleRequirements(b.hallId);
                b.assignedEmployees = b.assignedEmployees || [];
                reqs.forEach(function(req) {
                    var candidates = (byRole[req.role]||[]).filter(function(e) { return !busy.has(e.id) && !b.assignedEmployees.includes(e.id); });
                    candidates.sort(function(a,b) { return getOrderCount(a.id) - getOrderCount(b.id); });
                    for (var i = 0; i < req.count && i < candidates.length; i++) {
                        b.assignedEmployees.push(candidates[i].id);
                        busy.add(candidates[i].id);
                    }
                });
            });
        });

        DataManager.updateEmployeeOrders(); await DataManager.saveAllData();
        AppRenderer.renderBookings(); AppRenderer.renderDistribution();
        Utils.showMsg('✅ استكمال التوزيع بالتساوي');
    };

    // --- توزيع غير المعينين ---
    DistributionManager.distributeUnassigned = async function() {
        var pending = getFilteredPending();
        var unassigned = pending.filter(function(b) { return !b.assignedEmployees || !b.assignedEmployees.length; });
        if (!unassigned.length) { Utils.showMsg('✅ لا يوجد غير معينين'); return; }
        await DistributionManager.distributeRemainingFairly();
    };

    // --- توزيع ذكي (الأصلي) ---
    DistributionManager.smartDistribute = async function() {
        await DistributionManager.perfectFairDistribution();
    };
    DistributionManager.rotateDistribution = async function() {
        await DistributionManager.smartDistribute();
    };
    DistributionManager.resetAndDistribute = async function() {
        var pending = state.bookings.filter(function(b) { return b.status==='pending' && !b.deleted; });
        pending.forEach(function(b) { b.assignedEmployees = []; });
        await DataManager.saveAllData();
        await DistributionManager.smartDistribute();
    };
})();

// ====== ١٩. إعدادات التوزيع والرسائل (تبويب الرسائل) ======
(function() {
    if (!state.distSettings) state.distSettings = JSON.parse(localStorage.getItem('drmedia_dist_settings') || '{"messageMode":"auto","dateRangeEnabled":false,"dateFrom":"","dateTo":""}');
    function saveDistSettings() { localStorage.setItem('drmedia_dist_settings', JSON.stringify(state.distSettings)); }
    function injectSettings() {
        var obs = new MutationObserver(function() {
            var container = document.querySelector('#content-area .bg-card .grid');
            if (container && !document.getElementById('distControlSection')) {
                obs.disconnect();
                var section = document.createElement('div');
                section.id = 'distControlSection'; section.className = 'border p-4 rounded-xl mt-4';
                section.innerHTML = '<h3 class="font-semibold mb-2">⚙️ إعدادات التوزيع والرسائل</h3><select id="distMessageMode" class="border p-1 rounded text-sm mb-2"><option value="auto" '+(state.distSettings.messageMode==='auto'?'selected':'')+'>📨 إرسال تلقائي</option><option value="manual" '+(state.distSettings.messageMode==='manual'?'selected':'')+'>✋ يسأل قبل الإرسال</option></select><label class="flex items-center gap-2 mb-2"><input type="checkbox" id="distDateRangeEnabled" '+(state.distSettings.dateRangeEnabled?'checked':'')+'> تحديد نطاق تاريخ</label><div id="distDateRangeFields" style="display:'+(state.distSettings.dateRangeEnabled?'block':'none')+';" class="flex gap-2 items-center mb-2"><input type="date" id="distDateFrom" class="border p-2 rounded-xl text-sm flex-1" value="'+(state.distSettings.dateFrom||'')+'"><span>إلى</span><input type="date" id="distDateTo" class="border p-2 rounded-xl text-sm flex-1" value="'+(state.distSettings.dateTo||'')+'"></div><button onclick="window._saveDistSettings()" class="btn-primary text-sm w-full">💾 حفظ الإعدادات</button>';
                container.parentNode.insertBefore(section, container.nextSibling);
            }
        });
        obs.observe(document.getElementById('content-area'), { childList:true, subtree:true });
        document.getElementById('distDateRangeEnabled')?.addEventListener('change', function() {
            document.getElementById('distDateRangeFields').style.display = this.checked ? 'block' : 'none';
        });
    }
    window._saveDistSettings = function() {
        state.distSettings.messageMode = document.getElementById('distMessageMode').value;
        state.distSettings.dateRangeEnabled = document.getElementById('distDateRangeEnabled').checked;
        state.distSettings.dateFrom = document.getElementById('distDateFrom').value;
        state.distSettings.dateTo = document.getElementById('distDateTo').value;
        saveDistSettings();
        Utils.showMsg('✅ تم حفظ الإعدادات');
    };
    var checkTab = setInterval(function() {
        if (document.querySelector('#content-area .bg-card .grid')) { injectSettings(); clearInterval(checkTab); }
    }, 500);
})();

// ====== ٢٠. حقن الأزرار (مرة واحدة) ======
(function() {
    function copySummary() {
        var s = '📋 ملخص Dr Media Pro\n👤 '+(state.currentUser?.name||'')+' | '+new Date().toLocaleString('ar-EG')+'\n';
        s += '📅 حجوزات: '+state.bookings.filter(function(b){return !b.deleted}).length+' (معلق: '+state.bookings.filter(function(b){return b.status==='pending'&&!b.deleted}).length+')\n';
        s += '👥 موظفين: '+state.employees.length+' | قاعات: '+state.halls.length+'\n';
        navigator.clipboard.writeText(s).then(function() { Utils.showMsg('✅ تم نسخ الملخص'); });
    }
    function openPrintModal() {
        var today = Utils.getTodayDateStr();
        var next = new Date(); next.setMonth(next.getMonth()+1);
        Utils.openModal('<h3>🖨️ طباعة توزيع الحجوزات</h3><input type="date" id="pFrom" class="w-full border-2 p-2 my-2 rounded-xl" value="'+today+'"><input type="date" id="pTo" class="w-full border-2 p-2 my-2 rounded-xl" value="'+next.toISOString().slice(0,10)+'"><button onclick="window._printDistNow()" class="btn-primary w-full">🖨️ طباعة</button>');
    }
    window._printDistNow = function() {
        var from = document.getElementById('pFrom')?.value, to = document.getElementById('pTo')?.value;
        if (!from||!to) return Utils.showError('اختر التاريخ');
        var filtered = state.bookings.filter(function(b) { return !b.deleted && b.status!=='cancelled' && b.date>=from && b.date<=to; });
        if (!filtered.length) { Utils.showError('لا توجد حجوزات'); return; }
        var win = window.open('','_blank');
        var html = '<html dir="rtl"><head><meta charset="UTF-8"><title>توزيع</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:4px}th{background:#16a34a;color:#fff}@media print{body{margin:0}}</style></head><body><h2>توزيع من '+from+' إلى '+to+'</h2>';
        var byDate = {};
        filtered.forEach(function(b) { if(!byDate[b.date]) byDate[b.date]=[]; byDate[b.date].push(b); });
        Object.keys(byDate).sort().forEach(function(d) {
            html += '<h3>'+d+'</h3><table><tr><th>القاعة</th><th>النوع</th><th>الموظفون</th></tr>';
            byDate[d].forEach(function(b) {
                var hall = state.halls.find(function(h) { return h.id===b.hallId; });
                var type = hall ? (hall.type==='cafe'?'كافيه':hall.type==='open'?'مفتوحة':'مغلقة') : '—';
                var emps = (b.assignedEmployees||[]).map(function(eid) { var e = state.employees.find(function(emp) { return emp.id===eid; }); return e?e.name:eid; }).join('، ') || '—';
                html += '<tr><td>'+b.hallName+'</td><td>'+type+'</td><td>'+emps+'</td></tr>';
            });
            html += '</table>';
        });
        html += '<script>window.onload=function(){window.print()}</script></body></html>';
        win.document.write(html); win.document.close();
        Utils.closeModal();
    };

    function injectButtons() {
        // زر نسخ الملخص في التوبار
        if (!document.getElementById('copySummaryBtn')) {
            var topbar = document.querySelector('.topbar');
            if (topbar) {
                var btn = document.createElement('button');
                btn.id = 'copySummaryBtn'; btn.className = 'btn-outline text-xs';
                btn.textContent = '📋 نسخ ملخص'; btn.style.cssText = 'margin:0 8px;';
                btn.onclick = copySummary;
                var logoutBtn = topbar.querySelector('button');
                if (logoutBtn) logoutBtn.parentNode.insertBefore(btn, logoutBtn);
                else topbar.appendChild(btn);
            }
        }

        var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap') ||
                        document.querySelector('#content-area .flex.justify-between.flex-wrap');
        if (!container) return;
        var pageTitle = document.getElementById('pageTitle')?.textContent || '';
        if (!pageTitle.includes('الحجوزات') && !pageTitle.includes('التوزيع')) return;

        var buttons = [
            { id:'perfectFairBtn', text:'⚖️ توزيع متساوٍ تماماً', style:'background:#0d9488;color:white;', action:function() { if(confirm('مسح الكل وإعادة توزيع عادل؟')) DistributionManager.perfectFairDistribution(); } },
            { id:'fairCompleteBtn', text:'⚖️ استكمال توزيع متساوي', style:'background:#8b5cf6;color:white;', action:function() { DistributionManager.distributeRemainingFairly(); } },
            { id:'distributeUnassignedBtn', text:'⚡ توزيع غير المعينين', style:'background:#f97316;color:white;', action:function() { DistributionManager.distributeUnassigned(); } },
            { id:'printBookingsBtn', text:'🖨️ طباعة التوزيع', style:'background:#059669;color:white;', action:openPrintModal }
        ];

        buttons.forEach(function(b) {
            if (!document.getElementById(b.id)) {
                var btn = document.createElement('button');
                btn.id = b.id; btn.className = 'btn-secondary';
                btn.style.cssText = b.style;
                btn.textContent = b.text;
                btn.onclick = b.action;
                container.appendChild(btn);
            }
        });
    }

    // حقن مرة واحدة بعد تحميل الصفحة
    window.addEventListener('DOMContentLoaded', function() {
        setTimeout(injectButtons, 600);
    });
    // أيضاً عند التنقل
    if (typeof AppRenderer !== 'undefined') {
        var origNav = AppRenderer.navigateTo;
        AppRenderer.navigateTo = function(page) {
            origNav.call(this, page);
            setTimeout(injectButtons, 400);
        };
    }
})();

console.log('✅ ملف التحديثات النظيف يعمل');
