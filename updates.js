// =============================================
// Dr Media Pro - ÙÙÙ Ø§ÙØªØ­Ø¯ÙØ«Ø§Øª Ø§ÙÙÙØ­Ø¯ (ÙØ´ÙÙ Ø¬ÙÙØ¹ Ø§ÙØªØ­Ø³ÙÙØ§Øª + ØªØ¨ÙÙØ¨ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù)
// =============================================

// ====== ØªØ­Ø¯ÙØ«: Ø¹Ø±Ø¶ Ø§ÙØªØ§Ø±ÙØ® ÙØ§ÙÙÙØª (Ø§ÙÙØ¯ÙØ± + Ø§ÙÙÙØ¸Ù) ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø§ÙØªØ§Ø±ÙØ® ÙØ§ÙÙÙØª');
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
        // Ø§ÙÙØ¯ÙØ±
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
        // Ø§ÙÙÙØ¸Ù
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
    // ÙØ­Ø§ÙÙØ© ÙÙØ±ÙØ©
    injectDateTime();
})();

// ====== ØªØ­Ø¯ÙØ«: ÙÙØ§Ø¦Ù ÙÙØ³Ø¯ÙØ© Ø´Ø§ÙÙØ© ÙÙÙÙØ¸ÙÙÙ (ÙÙ Ø§ÙÙÙØ¸ÙÙÙ Ø¨Ø¯ÙÙ ØªÙÙÙØ¯ Ø§ÙØ¯ÙØ±) ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: ÙÙØ§Ø¦Ù ÙÙØ³Ø¯ÙØ© Ø´Ø§ÙÙØ© ÙÙÙÙØ¸ÙÙÙ');

    // Ø§ÙØªØ¸Ø§Ø± ØªØ¹Ø±ÙÙ AppRenderer Ù state
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
            var cell = cells[5]; // Ø¹ÙÙØ¯ Ø§ÙÙÙØ¸ÙÙÙ
            if (!cell || cell.querySelector('.emp-swap-select')) return;

            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            var assigned = booking.assignedEmployees || [];
            cell.innerHTML = '';

            // ÙØ§Ø¦ÙØ© Ø¬ÙÙØ¹ Ø§ÙÙÙØ¸ÙÙÙ Ø§ÙÙØ´Ø·ÙÙ (ÙØ±Ø© ÙØ§Ø­Ø¯Ø© ÙÙÙ Ø§ÙØ®ÙÙØ©)
            var allEmployees = state.employees.filter(e => e.active);

            assigned.forEach(function(empId) {
                var emp = state.employees.find(e => e.id === empId);
                if (!emp) return;

                var select = document.createElement('select');
                select.className = 'emp-swap-select border p-1 rounded text-sm';
                select.style.cssText = 'margin-bottom:4px; width:100%;';

                // Ø¥Ø¶Ø§ÙØ© Ø®ÙØ§Ø± ÙØ§Ø±Øº ÙÙØ¥Ø²Ø§ÙØ© (Ø§Ø®ØªÙØ§Ø±Ù)
                var emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '-- Ø¥Ø²Ø§ÙØ© --';
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

                    // Ø¥Ø°Ø§ Ø§Ø®ØªØ§Ø± "Ø¥Ø²Ø§ÙØ©" (ÙØ§Ø±Øº)Ø ÙØ­Ø°Ù Ø§ÙÙÙØ¸Ù
                    if (!newEmpId) {
                        booking.assignedEmployees = booking.assignedEmployees.filter(id => id !== oldEmpId);
                    } else {
                        // Ø§Ø³ØªØ¨Ø¯Ø§Ù Ø§ÙÙØ¯ÙÙ Ø¨Ø§ÙØ¬Ø¯ÙØ¯ (Ø¥Ø°Ø§ ÙÙ ÙÙÙ ÙÙØ¬ÙØ¯Ø§Ù ÙØ¹ÙØ§Ù)
                        var idx = booking.assignedEmployees.indexOf(oldEmpId);
                        if (idx !== -1) {
                            booking.assignedEmployees[idx] = newEmpId;
                        } else {
                            // Ø¥Ø°Ø§ Ø­ÙØ°Ù Ø§ÙÙØ¯ÙÙ Ø¨Ø·Ø±ÙÙØ© ÙØ§Ø ÙØ¶ÙÙ Ø§ÙØ¬Ø¯ÙØ¯
                            if (!booking.assignedEmployees.includes(newEmpId)) {
                                booking.assignedEmployees.push(newEmpId);
                            }
                        }
                    }
                    DataManager.updateEmployeeOrders();
                    DataManager.saveAllData();
                    Utils.showMsg('â ØªÙ ØªØºÙÙØ± Ø§ÙÙÙØ¸Ù');
                    // Ø¥Ø¹Ø§Ø¯Ø© Ø±Ø³Ù Ø§ÙØµÙ ÙÙØ¸ÙØ± Ø§ÙØªØ±ØªÙØ¨ Ø§ÙØ¬Ø¯ÙØ¯ (Ø§Ø®ØªÙØ§Ø±Ù)
                    AppRenderer.renderBookings();
                });

                cell.appendChild(select);
            });

            // Ø²Ø± Ø¥Ø¶Ø§ÙØ© ÙÙØ¸Ù Ø¬Ø¯ÙØ¯ (ÙØ¸ÙØ± Ø¬ÙÙØ¹ Ø§ÙÙÙØ¸ÙÙÙ ØºÙØ± Ø§ÙÙØ¹ÙÙÙÙ)
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
                    Utils.showWarning('Ø¬ÙÙØ¹ Ø§ÙÙÙØ¸ÙÙÙ ÙØ¹ÙÙÙÙ Ø¨Ø§ÙÙØ¹Ù');
                    return;
                }
                var options = available.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
                Utils.openModal(`
                    <h3>Ø¥Ø¶Ø§ÙØ© ÙÙØ¸Ù ÙÙØ­Ø¬Ø²</h3>
                    <select id="addEmpSelect" class="w-full border-2 p-2 my-2 rounded-xl">${options}</select>
                    <div class="flex gap-2 mt-4">
                        <button onclick="window._addEmpToBooking('${bookingId}')" class="btn-primary flex-1">ð¾ Ø­ÙØ¸</button>
                        <button onclick="Utils.closeModal()" class="btn-outline flex-1">Ø¥ÙØºØ§Ø¡</button>
                    </div>
                `);
            };
            cell.appendChild(addBtn);
        });
    }

    // Ø¯Ø§ÙØ© Ø§ÙØ¥Ø¶Ø§ÙØ© (Ø¹Ø§ÙØ©)
    window._addEmpToBooking = function(bookingId) {
        var empId = document.getElementById('addEmpSelect')?.value;
        if (!empId) return Utils.showError('Ø§Ø®ØªØ± ÙÙØ¸ÙØ§Ù');
        var booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) return;
        if (!booking.assignedEmployees) booking.assignedEmployees = [];
        if (booking.assignedEmployees.includes(empId)) {
            Utils.showWarning('Ø§ÙÙÙØ¸Ù ÙØ¶Ø§Ù Ø¨Ø§ÙÙØ¹Ù');
            return;
        }
        booking.assignedEmployees.push(empId);
        DataManager.updateEmployeeOrders();
        DataManager.saveAllData();
        Utils.closeModal();
        AppRenderer.renderBookings();
    };

    // Ø±Ø¨Ø· Ø§ÙØªØ­Ø³ÙÙ Ø¨Ø±Ø³Ù Ø¬Ø¯ÙÙ Ø§ÙØ­Ø¬ÙØ²Ø§Øª
    function init() {
        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings.apply(this, arguments);
            requestAnimationFrame(function() {
                enhanceBookingsTable();
            });
        };
        // ØªØ­Ø³ÙÙ Ø£ÙÙÙ Ø¥Ù ÙØ¬Ø¯ Ø§ÙØ¬Ø¯ÙÙ
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

// ====== ØªØ­Ø¯ÙØ«: Ø£Ø²Ø±Ø§Ø± Ø§ÙØ­Ø§ÙØ© Ø§ÙØ«ÙØ§Ø«ÙØ© (ÙØ¹ÙÙ/ÙÙØªÙÙ/ÙÙØºÙ) + Ø£Ø²Ø±Ø§Ø± Ø¥ÙØºØ§Ø¡ ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø£Ø²Ø±Ø§Ø± Ø§ÙØ­Ø§ÙØ© Ø§ÙØ«ÙØ§Ø«ÙØ©');
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
                { value: 'pending', label: 'ÙØ¹ÙÙ', color: '#f59e0b' },
                { value: 'completed', label: 'ÙÙØªÙÙ', color: '#10b981' },
                { value: 'cancelled', label: 'ÙÙØºÙ', color: '#ef4444' }
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

        // Ø£Ø²Ø±Ø§Ø± Ø¥ÙØºØ§Ø¡ ÙÙ Ø§ÙÙÙØ§ÙØ° Ø§ÙÙÙØ¨Ø«ÙØ©
        new MutationObserver(function() {
            var modal = document.getElementById('modal');
            if (modal && modal.classList.contains('show')) {
                var content = document.getElementById('modalContent');
                if (content) {
                    content.querySelectorAll('button').forEach(function(btn) {
                        if ((btn.textContent.includes('Ø­ÙØ¸') || btn.textContent.includes('ð¾')) &&
                            !btn.nextElementSibling?.classList.contains('cancel-btn-auto')) {
                            var cancelBtn = document.createElement('button');
                            cancelBtn.textContent = 'Ø¥ÙØºØ§Ø¡';
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

// ====== ØªØ­Ø¯ÙØ«: ØªØ­Ø³ÙÙ ØªÙØ³ÙÙ ØµÙØ­Ø© Ø§ÙØ­Ø¬ÙØ²Ø§Øª (CSS) ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: ØªÙØ³ÙÙØ§Øª Ø¬Ø¯ÙÙ Ø§ÙØ­Ø¬ÙØ²Ø§Øª');
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

// ====== ØªØ­Ø¯ÙØ«: ÙØ§Ø¦ÙØ© Styles (Ø´ÙÙ Ø§ÙÙØ§Ø¬ÙØ©) ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø£ÙÙØ§Ø· Ø§ÙØ´ÙÙ (Styles)');
    var STYLES = {
        default: { name: 'Ø§ÙØ§ÙØªØ±Ø§Ø¶Ù', css: '' },
        rounded: { name: 'Ø¯Ø§Ø¦Ø±Ù ÙØ§Ø¹Ù', css: `
            :root { --radius-btn: 40px; --radius-lg: 28px; --radius-xl: 32px; }
            .btn, .stat-card, .bg-card, .sidebar-item, .modal-content { border-radius: var(--radius-lg) !important; }
            .btn { border-radius: var(--radius-btn) !important; }
            .modal-content { border-radius: var(--radius-xl) !important; }
        `},
        compact: { name: 'ÙØ¯ÙØ¬', css: `
            :root { --radius-btn: 8px; --radius-lg: 8px; --radius-xl: 10px; }
            .btn { padding: 6px 14px; font-size: 0.8rem; }
            table { font-size: 0.78rem; }
            th, td { padding: 6px 5px; }
            .stat-card, .bg-card { padding: 12px; }
            .sidebar { width: 220px; }
            .main-content { margin-right: 220px; padding: 16px; padding-top: calc(60px + 16px); }
            .topbar { height: 60px; padding: 10px 16px; right: 220px; }
        `},
        spacious: { name: 'ÙØ§Ø³Ø¹', css: `
            :root { --radius-btn: 30px; --radius-lg: 24px; --radius-xl: 28px; }
            .main-content { padding: 40px; padding-top: calc(80px + 40px); }
            .stat-card, .bg-card { padding: 30px; margin-bottom: 30px; }
            .btn { padding: 12px 28px; font-size: 1rem; }
            .sidebar { width: 280px; }
            .main-content { margin-right: 280px; }
            .topbar { right: 280px; height: 80px; padding: 18px 28px; }
        `},
        modern: { name: 'ÙÙØ¯Ø±Ù', css: `
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
        Utils.showMsg('â ØªÙ ØªØºÙÙØ± Ø´ÙÙ Ø§ÙÙØ§Ø¬ÙØ©');
    };

    // Ø­ÙÙ Ø§ÙÙØ§Ø¦ÙØ© ÙÙ Ø§ÙØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª
    var checkInterval = setInterval(function() {
        var wa = document.getElementById('waMsgTemplate');
        if (wa && !document.getElementById('styleSelectContainer')) {
            clearInterval(checkInterval);
            var html = `<div id="styleSelectContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                <label class="text-sm font-semibold">ð¨ Ø´ÙÙ Ø§ÙÙØ§Ø¬ÙØ© (Style)</label>
                <select id="styleSelect" class="w-full border-2 p-2 rounded-xl mt-1" onchange="window._applyGlobalStyle(this.value)">
                    ${Object.keys(STYLES).map(k => `<option value="${k}" ${savedStyle===k?'selected':''}>${STYLES[k].name}</option>`).join('')}
                </select>
            </div>`;
            wa.insertAdjacentHTML('afterend', html);
        }
    }, 300);
})();

// ====== ØªØ­Ø¯ÙØ«: ÙÙØ­Ø© ÙØ±Ø§ÙØ¨Ø© Ø­ÙØ© + ØµÙØ­Ø© ØªÙØ§Ø±ÙØ± ÙØªÙØ¯ÙØ© ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: ÙÙØ­Ø© ÙØ±Ø§ÙØ¨Ø© ÙØªÙØ§Ø±ÙØ± ÙØªÙØ¯ÙØ©');
    // ÙÙØ­Ø© Ø§ÙÙØ±Ø§ÙØ¨Ø©
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
                    <h3 style="font-weight:bold;">ð¡ ÙÙØ­Ø© Ø§ÙÙØ±Ø§ÙØ¨Ø© Ø§ÙØ­ÙØ©</h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:12px;">
                        <div class="stat-card" style="border-left:4px solid #3b82f6;"><div class="stat-value" style="color:#3b82f6;">${todayBookings}</div><div class="stat-label">Ø­Ø¬ÙØ²Ø§Øª Ø§ÙÙÙÙ</div></div>
                        <div class="stat-card" style="border-left:4px solid #10b981;"><div class="stat-value" style="color:#10b981;">${activeEmps}</div><div class="stat-label">ÙÙØ¸ÙÙÙ ÙØªÙØ§Ø¬Ø¯ÙÙ</div></div>
                        <div class="stat-card" style="border-left:4px solid #f59e0b;"><div class="stat-value" style="color:#f59e0b;">${busyHalls}</div><div class="stat-label">ÙØ§Ø¹Ø§Øª ÙØ´ØºÙÙØ©</div></div>
                    </div></div>`;
                var grid = document.querySelector('#content-area .grid');
                if (grid) grid.insertAdjacentHTML('afterend', html);
            }, 200);
        };
    }
})();

// ====== ØªØ­Ø¯ÙØ«: 10 ÙÙÙØ²Ø§Øª ÙØªÙØ¯ÙØ© (ÙØ¯ÙØ¬Ø© Ø¨Ø´ÙÙ Ø¢ÙÙ) ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø§ÙÙÙÙØ²Ø§Øª Ø§ÙØ¹Ø´Ø±');
    // 1. ØªÙØ¨ÙÙØ§Øª Ø°ÙÙØ© (ÙÙ Ø§ÙØ®ÙÙÙØ©)
    setInterval(function() {
        var today = Utils.getTodayDateStr();
        var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
        state.bookings.forEach(function(b) {
            if (b.status === 'pending' && !b.deleted && (b.date === today || b.date === tomorrow)) {
                if (!b.assignedEmployees || b.assignedEmployees.length === 0) {
                    console.warn('â ï¸ Ø­Ø¬Ø² Ø¨Ø¯ÙÙ ÙÙØ¸ÙÙÙ:', b.clientName);
                }
            }
        });
    }, 60000);
    // 2. Ø§ÙØ¬Ø¯ÙÙ Ø§ÙØ²ÙÙÙ (ØªÙØª Ø¥Ø¶Ø§ÙØªÙ Ø³Ø§Ø¨ÙØ§Ù)
    // 3. ÙØ´Ø±Ù ÙØ§Ø¹Ø© (Ø§Ø®ØªÙØ§Ø±Ù)
    // 4. ØªØ­Ø³ÙÙ Ø§ÙÙÙØ§Ø´Ø§Øª
    if (typeof AppRenderer !== 'undefined') {
        var origFlash = AppRenderer.renderFlash;
        AppRenderer.renderFlash = function() {
            origFlash.apply(this, arguments);
            setTimeout(function() {
                document.querySelectorAll('#content-area table tbody tr').forEach(function(row) {
                    var cells = row.querySelectorAll('td');
                    if (cells.length > 6) {
                        var date = new Date(cells[2]?.textContent);
                        if (!isNaN(date) && (new Date() - date) > 2*86400000 && cells[5]?.textContent.trim() !== 'Ø§ÙØ¹Ø±ÙØ³') {
                            row.style.backgroundColor = '#ffe0e0';
                        }
                    }
                });
            }, 200);
        };
    }
    // 5. Ø£ØªÙØªØ© Ø§ÙØªÙØ²ÙØ¹ (ÙÙØ¬ÙØ¯ ÙÙ Ø§ÙØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª)
    // 6. ÙÙØ§ÙØ¨ ÙØ§ØªØ³Ø§Ø¨ (ÙÙØ¬ÙØ¯)
    // 7. ØªØµØ¯ÙØ± PDF (Ø§Ø®ØªÙØ§Ø±Ù)
    // 8. ÙØ¶Ø¹ Ø¹Ø¯Ù Ø§ÙØ§ØªØµØ§Ù
    var statusBar = document.createElement('div');
    statusBar.id = 'offlineStatusBar';
    statusBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:6px;text-align:center;font-weight:bold;z-index:9999;';
    document.body.appendChild(statusBar);
    function updateOnlineStatus() {
        statusBar.style.background = navigator.onLine ? '#10b981' : '#f59e0b';
        statusBar.textContent = navigator.onLine ? 'ð¢ ÙØªØµÙ' : 'ð  ØºÙØ± ÙØªØµÙ - Ø§ÙØ¨ÙØ§ÙØ§Øª ÙØ­ÙÙØ¸Ø© ÙØ­ÙÙØ§Ù';
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    // 9. Ø´Ø§Ø´Ø© Ø¹Ø±Ø¶ Ø¹Ø§ÙØ© (Ø¹ÙØ¯ Ø¥Ø¶Ø§ÙØ© ?public ÙÙØ±Ø§Ø¨Ø·)
    if (window.location.search.includes('public')) {
        document.body.innerHTML = '<div style="padding:20px;font-family:Tahoma;text-align:center;"><h1>ð Ø­Ø¬ÙØ²Ø§Øª Ø§ÙÙÙÙ</h1>' +
        state.bookings.filter(b => b.date === Utils.getTodayDateStr() && !b.deleted).map(b => `<p>${b.hallName} - ${b.clientName}</p>`).join('') + '</div>';
    }
    // 10. Google Drive (Ø§ÙØ²Ø± ÙÙØ¬ÙØ¯ ÙÙ Ø§ÙØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª)
})();

// ====== ØªØ­Ø¯ÙØ«: ØªØ±ØªÙØ¨ ØªØµØ§Ø¹Ø¯Ù ÙÙØ£ÙØ±Ø¯Ø±Ø§Øª ÙÙ ÙØ§Ø¬ÙØ© Ø§ÙÙÙØ¸Ù ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: ØªØ±ØªÙØ¨ Ø§ÙØ£ÙØ±Ø¯Ø±Ø§Øª ÙÙ ÙØ§Ø¬ÙØ© Ø§ÙÙÙØ¸Ù');
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

// ====== ØªØ­Ø¯ÙØ«: Ø¥ØµÙØ§Ø­ Ø§ÙØªØ²Ø§ÙÙ + ØªØ­Ø³ÙÙ Ø§ÙÙÙØ¨Ø§ÙÙ ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø¥ØµÙØ§Ø­ Ø§ÙØªØ²Ø§ÙÙ ÙØªØ­Ø³ÙÙ Ø§ÙÙÙØ¨Ø§ÙÙ');
    // Ø¥ØµÙØ§Ø­ Ø§ÙØªØ²Ø§ÙÙ
    window._manualSync = async function() {
        if (!state.useFirebase || !state.db) return Utils.showError('Firebase ØºÙØ± ÙÙÙØ£');
        try {
            var s = await state.db.ref('/').once('value');
            if (s.exists()) {
                DataManager._loadDataObject(s.val());
                DataManager._ensureMinimumData();
                DataManager.updateEmployeeOrders();
                await DataManager.saveAllData();
                Utils.showMsg('â ØªÙØª Ø§ÙÙØ²Ø§ÙÙØ©');
            }
        } catch(e) { Utils.showError('ÙØ´ÙØª Ø§ÙÙØ²Ø§ÙÙØ©'); }
    };
    // ØªØ­Ø³ÙÙØ§Øª Ø§ÙÙÙØ¨Ø§ÙÙ
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

// ====== ØªØ­Ø¯ÙØ«: Ø­Ø¶ÙØ± Ø³Ø§Ø¨Ù ÙØªØ¹Ø¯Ø¯ Ø§ÙÙÙØ¸ÙÙÙ + Ø²Ø± "Ø­Ø¶ÙØ± ÙØ§ÙØµØ±Ø§Ù" ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø­Ø¶ÙØ± Ø³Ø§Ø¨Ù ÙØªØ¹Ø¯Ø¯');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined') cb();
        else setTimeout(() => waitForApp(cb), 50);
    }

    function init() {
        // 1. Ø§Ø³ØªØ¨Ø¯Ø§Ù ÙØ§ÙØ°Ø© Ø§ÙØ­Ø¶ÙØ± Ø§ÙØ³Ø§Ø¨Ù
        AppRenderer.showPastAttendanceModal = function() {
            var empOpts = state.employees.map(e => 
                `<option value="${e.id}">${e.name} (${e.role})</option>`
            ).join('');
            
            Utils.openModal(`
                <h3 class="text-xl font-bold mb-4">ð ØªØ³Ø¬ÙÙ Ø­Ø¶ÙØ± / Ø§ÙØµØ±Ø§Ù (ÙØªØ¹Ø¯Ø¯)</h3>
                <p class="text-sm mb-2">Ø§Ø®ØªØ± Ø§ÙÙÙØ¸ÙÙÙ (ÙÙÙÙÙ ØªØ­Ø¯ÙØ¯ Ø£ÙØ«Ø± ÙÙ ÙØ§Ø­Ø¯):</p>
                <select id="pastEmpSelect" multiple class="w-full border-2 p-2 my-2 rounded-xl h-40">
                    ${empOpts}
                </select>
                <p class="text-sm mt-2 mb-1">Ø§ÙØªØ§Ø±ÙØ®:</p>
                <input type="date" id="pastDate" class="w-full border-2 p-2 my-2 rounded-xl" 
                       value="${Utils.getTodayDateStr()}">
                <div class="flex gap-2 mt-4">
                    <button onclick="AppRenderer.recordPastAttendanceMulti()" class="btn-primary flex-1">
                        â Ø­Ø¶ÙØ± ÙØ§ÙØµØ±Ø§Ù
                    </button>
                    <button onclick="Utils.closeModal()" class="btn-outline flex-1">Ø¥ÙØºØ§Ø¡</button>
                </div>
            `);
        };

        // 2. Ø§ÙØ¯Ø§ÙØ© Ø§ÙØ¬Ø¯ÙØ¯Ø© ÙÙØ¹Ø§ÙØ¬Ø© Ø§ÙØ·ÙØ¨
        AppRenderer.recordPastAttendanceMulti = function() {
            var empSelect = document.getElementById('pastEmpSelect');
            var dateInput = document.getElementById('pastDate');
            if (!empSelect || !dateInput) return;

            var selectedOptions = Array.from(empSelect.selectedOptions);
            if (selectedOptions.length === 0) {
                Utils.showError('â ï¸ Ø§Ø®ØªØ± ÙÙØ¸ÙÙØ§ ÙØ§Ø­Ø¯ÙØ§ Ø¹ÙÙ Ø§ÙØ£ÙÙ');
                return;
            }
            var date = dateInput.value;
            if (!date) {
                Utils.showError('â ï¸ Ø§Ø®ØªØ± ØªØ§Ø±ÙØ®ÙØ§');
                return;
            }

            // ØªØ³Ø¬ÙÙ Ø­Ø¶ÙØ± Ø«Ù Ø§ÙØµØ±Ø§Ù ÙÙÙ ÙÙØ¸Ù ÙØ®ØªØ§Ø±
            selectedOptions.forEach(function(option) {
                var empId = option.value;
                AttendanceManager.recordAttendanceForDate(empId, date, 'checkIn');
                AttendanceManager.recordAttendanceForDate(empId, date, 'checkOut');
            });

            Utils.closeModal();
            AppRenderer.renderAttendance(); // ØªØ­Ø¯ÙØ« ØµÙØ­Ø© Ø§ÙØ­Ø¶ÙØ±
            Utils.showMsg(`â ØªÙ ØªØ³Ø¬ÙÙ Ø­Ø¶ÙØ± ÙØ§ÙØµØ±Ø§Ù ÙÙ ${selectedOptions.length} ÙÙØ¸Ù`);
        };

        console.log('â ØªØ­Ø¯ÙØ« Ø§ÙØ­Ø¶ÙØ± Ø§ÙØ³Ø§Ø¨Ù Ø¬Ø§ÙØ²');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== ØªØ­Ø¯ÙØ«: Ø²Ø± ØªÙØ²ÙØ¹ Ø¹Ø§Ø¯Ù ÙÙØ­Ø¶ÙØ± ÙÙØ· ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: ØªÙØ²ÙØ¹ Ø¹Ø§Ø¯Ù ÙÙØ­Ø¶ÙØ±');

    // Ø§ÙØªØ¸Ø§Ø± ØªØ¹Ø±ÙÙ DistributionManager Ù AppRenderer
    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // Ø¯Ø§ÙØ© Ø§ÙØªÙØ²ÙØ¹ Ø§ÙØ¹Ø§Ø¯Ù Ø¹ÙÙ Ø§ÙØ­Ø¶ÙØ± ÙÙØ·
    async function distributeFairlyAmongPresent() {
        var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
        if (!pending.length) {
            Utils.showWarning('ÙØ§ ØªÙØ¬Ø¯ Ø­Ø¬ÙØ²Ø§Øª ÙØ¹ÙÙØ©');
            return;
        }

        // Ø§ÙÙÙØ¸ÙÙÙ Ø§ÙÙØ´Ø·ÙÙ
        var allEmployees = state.employees.filter(e => e.active);
        var dirs = allEmployees.filter(e => e.role === 'ÙØ®Ø±Ø¬');
        var phs  = allEmployees.filter(e => e.role === 'ÙØµÙØ±');
        var crs  = allEmployees.filter(e => e.role === 'ÙØ±ÙÙ');

        // ØªÙØ±ÙØº Ø§ÙØªÙØ²ÙØ¹Ø§Øª Ø§ÙØ³Ø§Ø¨ÙØ© ÙÙØ­Ø¬ÙØ²Ø§Øª Ø§ÙÙØ¹ÙÙØ©
        pending.forEach(b => b.assignedEmployees = []);

        // ÙÙÙ Ø­Ø¬Ø²Ø ÙØ­Ø¯Ø¯ Ø§ÙÙÙØ¸ÙÙÙ Ø§ÙØ­Ø§Ø¶Ø±ÙÙ ÙÙ Ø°ÙÙ Ø§ÙÙÙÙ
        pending.forEach(function(b) {
            var date = b.date;
            // Ø§ÙÙÙØ¸ÙÙÙ Ø§ÙØ°ÙÙ Ø³Ø¬ÙÙØ§ Ø­Ø¶ÙØ±ÙØ§ ÙÙ ÙØ°Ø§ Ø§ÙØªØ§Ø±ÙØ®
            var presentIds = state.attendanceRecords
                .filter(a => a.date === date && a.checkIn)
                .map(a => a.empId);
            
            // Ø¯ÙØ§Ù ÙØ³Ø§Ø¹Ø¯Ø© ÙØ§Ø®ØªÙØ§Ø± Ø§ÙØ£ÙØ¶Ù ÙÙ Ø¨ÙÙ Ø§ÙØ­Ø¶ÙØ± ÙÙØ·
            function pickBest(emps) {
                var available = emps.filter(e => presentIds.includes(e.id));
                if (!available.length) return null;
                // ØªØ±ØªÙØ¨ ØªØµØ§Ø¹Ø¯Ù Ø­Ø³Ø¨ Ø¹Ø¯Ø¯ Ø§ÙØ£ÙØ±Ø¯Ø±Ø§Øª Ø§ÙØ­Ø§ÙÙØ©
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
                
                // ÙØµÙØ±ÙÙ (Ø­ØªÙ 2)
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

        // Ø¥Ø´Ø¹Ø§Ø±Ø§Øª (Ø§Ø®ØªÙØ§Ø±Ù)
        for (var b of pending) {
            for (var eid of (b.assignedEmployees || [])) {
                var emp = state.employees.find(e => e.id === eid);
                if (emp) {
                    NotificationManager.notifyEmployee(
                        emp,
                        'ØªÙ ØªÙØ²ÙØ¹ Ø£ÙØ±Ø¯Ø± (ÙÙØ­Ø¶ÙØ±)',
                        `ÙØ¯ÙÙ Ø£ÙØ±Ø¯Ø± ÙÙ ${b.clientName} ÙÙÙ ${b.date} Ø¨ÙØ§Ø¹Ø© ${b.hallName}`,
                        true
                    );
                }
            }
        }

        DataManager.addActivity('ØªÙØ²ÙØ¹ Ø¹Ø§Ø¯Ù ÙÙØ­Ø¶ÙØ±', `ØªÙ ØªÙØ²ÙØ¹ ${pending.length} Ø­Ø¬Ø² Ø¹ÙÙ Ø§ÙØ­Ø¶ÙØ± ÙÙØ·`);
        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
        Utils.showMsg(`â ØªÙ ØªÙØ²ÙØ¹ ${pending.length} Ø­Ø¬Ø² Ø¨Ø¹Ø¯Ø§ÙØ© Ø¨ÙÙ Ø§ÙØ­Ø¶ÙØ±`);
    }

    // Ø¯Ø§ÙØ© ÙØ­ÙÙ Ø§ÙØ²Ø± ÙÙ ØµÙØ­Ø© Ø§ÙØªÙØ²ÙØ¹
    function injectButtonInDistribution() {
        // ÙØ±Ø§ÙØ¨ Ø¸ÙÙØ± ØµÙØ­Ø© Ø§ÙØªÙØ²ÙØ¹
        var observer = new MutationObserver(function(mutations) {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('fairDistributeBtn')) {
                var btn = document.createElement('button');
                btn.id = 'fairDistributeBtn';
                btn.className = 'btn-secondary'; // ÙÙÙ ÙØ®ØªÙÙ ÙØªÙÙÙØ²Ù
                btn.textContent = 'ð§âð¤âð§ ØªÙØ²ÙØ¹ Ø¹Ø§Ø¯Ù ÙÙØ­Ø¶ÙØ±';
                btn.onclick = distributeFairlyAmongPresent;
                container.appendChild(btn);
                observer.disconnect(); // Ø§ÙØªÙÙÙØ§
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    // Ø¨Ø¯Ø¡ Ø§ÙØªØ´ØºÙÙ
    function init() {
        injectButtonInDistribution();
        console.log('â Ø²Ø± ØªÙØ²ÙØ¹ Ø§ÙØ­Ø¶ÙØ± Ø¬Ø§ÙØ²');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== ØªØ­Ø¯ÙØ«: Ø²Ø± ØªÙØ²ÙØ¹ ØºÙØ± Ø§ÙÙØ¹ÙÙÙÙ ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø²Ø± ØªÙØ²ÙØ¹ ØºÙØ± Ø§ÙÙØ¹ÙÙÙÙ');

    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // Ø§ÙØ¯Ø§ÙØ© Ø§ÙØªÙ ØªÙØ²Ø¹ Ø§ÙØ­Ø¬ÙØ²Ø§Øª Ø§ÙØªÙ ÙÙØ³ ÙÙØ§ ÙÙØ¸ÙÙÙ
    async function distributeUnassignedBookings() {
        // ÙØ¬ÙØ¨ Ø§ÙØ­Ø¬ÙØ²Ø§Øª Ø§ÙÙØ¹ÙÙØ© Ø§ÙØªÙ ÙÙØ³ ÙÙØ§ ÙÙØ¸ÙÙÙ ÙØ¹ÙÙÙÙ
        var unassigned = state.bookings.filter(b => 
            b.status === 'pending' && !b.deleted && (!b.assignedEmployees || b.assignedEmployees.length === 0)
        );
        if (!unassigned.length) {
            Utils.showWarning('ÙØ§ ØªÙØ¬Ø¯ Ø­Ø¬ÙØ²Ø§Øª ØºÙØ± ÙØ¹ÙÙØ©');
            return;
        }

        var allEmployees = state.employees.filter(e => e.active);
        var dirs = allEmployees.filter(e => e.role === 'ÙØ®Ø±Ø¬');
        var phs  = allEmployees.filter(e => e.role === 'ÙØµÙØ±');
        var crs  = allEmployees.filter(e => e.role === 'ÙØ±ÙÙ');

        unassigned.forEach(function(b) {
            var date = b.date;
            // Ø§ÙÙÙØ¸ÙÙÙ Ø§ÙØ°ÙÙ Ø³Ø¬ÙÙØ§ Ø­Ø¶ÙØ±ÙØ§ ÙÙ ÙØ°Ø§ Ø§ÙØªØ§Ø±ÙØ®
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

        DataManager.addActivity('ØªÙØ²ÙØ¹ ØºÙØ± Ø§ÙÙØ¹ÙÙÙÙ', `ØªÙ ØªÙØ²ÙØ¹ ${unassigned.length} Ø­Ø¬Ø² ØºÙØ± ÙØ¹ÙÙ`);
        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
        Utils.showMsg(`â ØªÙ ØªÙØ²ÙØ¹ ${unassigned.length} Ø­Ø¬Ø² ØºÙØ± ÙØ¹ÙÙ Ø¹ÙÙ Ø§ÙØ­Ø¶ÙØ±`);
    }

    // Ø­ÙÙ Ø§ÙØ²Ø± ÙÙ ØµÙØ­Ø© Ø§ÙØªÙØ²ÙØ¹
    function injectButton() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('distributeUnassignedBtn')) {
                var btn = document.createElement('button');
                btn.id = 'distributeUnassignedBtn';
                btn.className = 'btn-secondary';
                btn.style.backgroundColor = '#f97316'; // ÙÙÙ Ø¨Ø±ØªÙØ§ÙÙ ÙÙÙØ²
                btn.style.color = 'white';
                btn.textContent = 'â¡ ØªÙØ²ÙØ¹ ØºÙØ± Ø§ÙÙØ¹ÙÙÙÙ';
                btn.onclick = distributeUnassignedBookings;
                container.appendChild(btn);
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    function init() {
        injectButton();
        console.log('â Ø²Ø± ØªÙØ²ÙØ¹ ØºÙØ± Ø§ÙÙØ¹ÙÙÙÙ Ø¬Ø§ÙØ²');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== ØªØ­Ø¯ÙØ«: Ø²Ø± Ø§Ø³ØªÙÙØ§Ù / ØªÙØ²ÙØ¹ ÙØªØ³Ø§ÙÙ ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: Ø²Ø± Ø§Ø³ØªÙÙØ§Ù Ø§ÙØªÙØ²ÙØ¹ Ø§ÙÙØªØ³Ø§ÙÙ');

    function waitForApp(cb) {
        if (typeof DistributionManager !== 'undefined' && typeof AppRenderer !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // Ø¯Ø§ÙØ© Ø§ÙØªÙØ²ÙØ¹ Ø§ÙÙØªØ³Ø§ÙÙ (Ø§Ø³ØªÙÙØ§Ù)
    async function equalizeDistribution() {
        // Ø¬ÙÙØ¹ Ø§ÙØ­Ø¬ÙØ²Ø§Øª Ø§ÙÙØ¹ÙÙØ©
        var pending = state.bookings.filter(b => b.status === 'pending' && !b.deleted);
        if (!pending.length) {
            Utils.showWarning('ÙØ§ ØªÙØ¬Ø¯ Ø­Ø¬ÙØ²Ø§Øª ÙØ¹ÙÙØ©');
            return;
        }

        // ÙØ³Ø­ Ø¬ÙÙØ¹ Ø§ÙØªØ¹ÙÙÙØ§Øª Ø§ÙØ­Ø§ÙÙØ©
        pending.forEach(b => b.assignedEmployees = []);

        var allEmployees = state.employees.filter(e => e.active);
        var dirs = allEmployees.filter(e => e.role === 'ÙØ®Ø±Ø¬');
        var phs  = allEmployees.filter(e => e.role === 'ÙØµÙØ±');
        var crs  = allEmployees.filter(e => e.role === 'ÙØ±ÙÙ');

        // ØªØ±ØªÙØ¨ Ø§ÙÙÙØ¸ÙÙÙ ØªØµØ§Ø¹Ø¯ÙØ§Ù Ø­Ø³Ø¨ totalOrders (Ø§ÙØ£ÙÙ Ø£ÙÙØ§Ù)
        dirs.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
        phs.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));
        crs.sort((a, b) => (a.totalOrders || 0) - (b.totalOrders || 0));

        // ÙØ¤Ø´Ø±Ø§Øª Ø¯Ø§Ø¦Ø±ÙØ© ÙÙÙ Ø¯ÙØ±
        var dirIdx = 0, phIdx = 0, crIdx = 0;

        // ØªØ¬ÙÙØ¹ Ø§ÙØ­Ø¬ÙØ²Ø§Øª Ø­Ø³Ø¨ Ø§ÙØªØ§Ø±ÙØ® ÙØªØ¬ÙØ¨ ØªØ¹Ø§Ø±Ø¶ ÙÙØ¸Ù ÙÙ ÙÙØ³ Ø§ÙÙÙÙ
        var byDate = {};
        pending.forEach(b => {
            if (!byDate[b.date]) byDate[b.date] = [];
            byDate[b.date].push(b);
        });

        // ÙØ¹Ø§ÙØ¬Ø© ÙÙ ÙÙÙ Ø¹ÙÙ Ø­Ø¯Ø©
        Object.keys(byDate).sort().forEach(function(date) {
            var dayBookings = byDate[date];
            var busySet = new Set(); // ÙÙØ¸ÙÙÙ ÙØ´ØºÙÙÙÙ ÙÙ ÙØ°Ø§ Ø§ÙÙÙÙ

            dayBookings.forEach(function(b) {
                var hallType = state.halls.find(h => h.id === b.hallId)?.type || 'closed';
                var assigned = [];

                if (hallType === 'cafe') {
                    // ÙØ¨Ø­Ø« Ø¹Ù Ø£ÙÙ ÙØµÙØ± ÙØªØ§Ø­ (ØºÙØ± ÙØ´ØºÙÙ Ø§ÙÙÙÙ)
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
                        // Ø¥Ø°Ø§ ÙÙ ÙØ¬Ø¯Ø ÙØ£Ø®Ø° Ø£ÙÙ ÙØµÙØ± (Ø­ØªÙ ÙÙ ÙØ´ØºÙÙ) ÙØ­Ù Ø£Ø®ÙØ±
                        if (phs.length) assigned.push(phs[phIdx % phs.length].id);
                    }
                } else {
                    // ÙØ®Ø±Ø¬
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
                    // ÙØµÙØ±ÙÙ (Ø­ØªÙ 2)
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
                    // ÙØ±ÙÙ
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

        DataManager.addActivity('ØªÙØ²ÙØ¹ ÙØªØ³Ø§ÙÙ', 'ØªÙ Ø¥Ø¹Ø§Ø¯Ø© ØªÙØ²ÙØ¹ Ø¬ÙÙØ¹ Ø§ÙØ­Ø¬ÙØ²Ø§Øª Ø§ÙÙØ¹ÙÙØ© Ø¨ØªØ³Ø§ÙÙ');
        AppRenderer.renderBookings();
        AppRenderer.renderDistribution();
        Utils.showMsg('â ØªÙ ØªÙØ²ÙØ¹ Ø§ÙØ­Ø¬ÙØ²Ø§Øª Ø¨Ø§ÙØªØ³Ø§ÙÙ (Ø§Ø³ØªÙÙØ§Ù)');
    }

    // Ø­ÙÙ Ø§ÙØ²Ø± ÙÙ ØµÙØ­Ø© Ø§ÙØªÙØ²ÙØ¹
    function injectButton() {
        var observer = new MutationObserver(function() {
            var container = document.querySelector('#content-area .flex.gap-2.mb-4.flex-wrap');
            if (container && !document.getElementById('equalizeDistBtn')) {
                var btn = document.createElement('button');
                btn.id = 'equalizeDistBtn';
                btn.className = 'btn-secondary';
                btn.style.backgroundColor = '#8b5cf6'; // Ø¨ÙÙØ³Ø¬Ù
                btn.style.color = 'white';
                btn.textContent = 'ð Ø§Ø³ØªÙÙØ§Ù / ØªÙØ²ÙØ¹ ÙØªØ³Ø§ÙÙ';
                btn.onclick = equalizeDistribution;
                container.appendChild(btn);
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }

    function init() {
        injectButton();
        console.log('â Ø²Ø± Ø§Ø³ØªÙÙØ§Ù Ø§ÙØªÙØ²ÙØ¹ Ø§ÙÙØªØ³Ø§ÙÙ Ø¬Ø§ÙØ²');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });
    if (document.readyState !== 'loading') waitForApp(init);
})();

// ====== ØªØ­Ø¯ÙØ«: ØªØ¨ÙÙØ¨ "ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù" ÙØ±ÙØ¹ Ø§ÙÙÙØ¯ Ø¥ÙÙ GitHub Ø¯ÙÙ ÙØ³Ø­ Ø§ÙÙØ¯ÙÙ ======
(function() {
    console.log('ð¢ ØªØ­ÙÙÙ: ØªØ¨ÙÙØ¨ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù (Ø¢ÙÙ)');

    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    function initSystemUpdater() {
        // ====== 1. Ø¥Ø¶Ø§ÙØ© Ø§ÙØªØ¨ÙÙØ¨ Ø¥ÙÙ Ø§ÙÙØ§Ø¦ÙØ© Ø§ÙØ¬Ø§ÙØ¨ÙØ© ======
        if (!AppRenderer.pages.includes('systemUpdater')) {
            AppRenderer.pages.push('systemUpdater');
        }

        var sidebarContainer = document.querySelector('.sidebar .py-2');
        if (sidebarContainer && !document.querySelector('[data-page="systemUpdater"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-page', 'systemUpdater');
            item.onclick = function() { AppRenderer.navigateTo('systemUpdater'); };
            item.innerHTML = '<span>ð§ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù</span>';
            sidebarContainer.appendChild(item);
        }

        // ====== 2. ØªØ¹Ø±ÙÙ ØµÙØ­Ø© Ø§ÙØªØ­Ø¯ÙØ« ======
        AppRenderer.renderSystemUpdater = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = 'ð§ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù';

            // Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙØ®Ø²ÙØ©
            var settings = JSON.parse(localStorage.getItem('drmedia_github_push') || '{}');
            var token = settings.token || '';
            var repoOwner = settings.repoOwner || '';
            var repoName = settings.repoName || '';
            var filePath = settings.filePath || 'updates.js';

            c.innerHTML = `
            <div class="bg-card">
                <h2 class="text-xl font-bold mb-4">ð§ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù Ø¹Ø¨Ø± GitHub</h2>
                <p class="text-sm text-gray-500 mb-4">Ø§ÙØµÙ ÙÙØ¯ JavaScript ÙÙØ§ ÙØ§Ø¶ØºØ· "Ø±ÙØ¹ Ø¥ÙÙ GitHub" ÙØªØ­Ø¯ÙØ« ÙÙÙ Ø§ÙØªØ­Ø¯ÙØ«Ø§Øª ØªÙÙØ§Ø¦ÙØ§Ù. <b style="color:red;">Ø³ÙØªÙ Ø¥Ø¶Ø§ÙØ© Ø§ÙÙÙØ¯ Ø¥ÙÙ ÙÙØ§ÙØ© Ø§ÙÙÙÙ Ø§ÙØ­Ø§ÙÙØ ÙÙÙØ³ ÙØ³Ø­Ù.</b></p>

                <div style="margin-bottom:20px; border:1px solid #e5e7eb; border-radius:12px; padding:15px;">
                    <h3 class="font-semibold mb-2">âï¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§ÙØ§ØªØµØ§Ù Ø¨Ù GitHub</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <div>
                            <label class="text-xs">Ø§Ø³Ù Ø§ÙÙØ³ØªØ®Ø¯Ù (Owner)</label>
                            <input id="repoOwner" value="${repoOwner}" class="w-full border-2 p-2 rounded-xl">
                        </div>
                        <div>
                            <label class="text-xs">Ø§Ø³Ù Ø§ÙÙØ³ØªÙØ¯Ø¹ (Repo)</label>
                            <input id="repoName" value="${repoName}" class="w-full border-2 p-2 rounded-xl">
                        </div>
                        <div>
                            <label class="text-xs">ÙØ³Ø§Ø± Ø§ÙÙÙÙ</label>
                            <input id="filePath" value="${filePath}" class="w-full border-2 p-2 rounded-xl">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs">GitHub Token (Ø¨ØµÙØ§Ø­ÙØ© repo)</label>
                        <input id="githubToken" type="password" value="${token}" class="w-full border-2 p-2 rounded-xl" placeholder="ghp_xxxxx">
                        <small class="text-gray-500">Ø£ÙØ´Ø¦ token ÙÙ 
                            <a href="https://github.com/settings/tokens" target="_blank" class="text-blue-600 underline">ÙÙØ§</a>
                            (Ø­Ø¯Ø¯ ØµÙØ§Ø­ÙØ© repo)
                        </small>
                    </div>
                </div>

                <div style="margin-bottom:10px;">
                    <label class="font-semibold">ð ÙÙØ¯ JavaScript ÙÙØªØ­Ø¯ÙØ«:</label>
                    <textarea id="updateCode" class="w-full border-2 p-3 rounded-xl font-mono text-sm" rows="12" placeholder="Ø§ÙØµÙ ÙÙØ¯ Ø§ÙØªØ­Ø¯ÙØ« ÙÙØ§..."></textarea>
                </div>

                <button id="pushToGitHubBtn" class="btn-primary w-full">ð Ø±ÙØ¹ Ø¥ÙÙ GitHub</button>
                <button id="saveSettingsBtn" class="btn-secondary w-full mt-2">ð¾ Ø­ÙØ¸ Ø§ÙØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª</button>
                <div id="pushStatus" class="mt-3 text-center"></div>

                <div class="footer-bar">${APP_CONFIG.footerText}</div>
            </div>`;

            // ====== 3. Ø£Ø­Ø¯Ø§Ø« Ø§ÙØ£Ø²Ø±Ø§Ø± ======
            document.getElementById('saveSettingsBtn').onclick = function() {
                var newSettings = {
                    token: document.getElementById('githubToken').value.trim(),
                    repoOwner: document.getElementById('repoOwner').value.trim(),
                    repoName: document.getElementById('repoName').value.trim(),
                    filePath: document.getElementById('filePath').value.trim() || 'updates.js'
                };
                localStorage.setItem('drmedia_github_push', JSON.stringify(newSettings));
                Utils.showMsg('â ØªÙ Ø­ÙØ¸ Ø§ÙØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª');
            };

            document.getElementById('pushToGitHubBtn').onclick = async function() {
                var newCode = document.getElementById('updateCode').value.trim();
                if (!newCode) {
                    Utils.showError('â ï¸ Ø§ÙØ±Ø¬Ø§Ø¡ ÙØµÙ ÙÙØ¯ Ø§ÙØªØ­Ø¯ÙØ«');
                    return;
                }
                var settings = JSON.parse(localStorage.getItem('drmedia_github_push') || '{}');
                if (!settings.token || !settings.repoOwner || !settings.repoName) {
                    Utils.showError('â ï¸ Ø§ÙØ±Ø¬Ø§Ø¡ ÙÙØ¡ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§ÙØ§ØªØµØ§Ù Ø¨Ù GitHub Ø£ÙÙØ§Ù');
                    return;
                }

                var statusDiv = document.getElementById('pushStatus');
                statusDiv.innerHTML = '<span style="color:blue;">ð Ø¬Ø§Ø±Ù Ø¬ÙØ¨ Ø§ÙÙÙÙ Ø§ÙØ­Ø§ÙÙ...</span>';

                var apiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${settings.filePath}`;
                try {
                    // Ø£ÙÙØ§Ù: Ø¬ÙØ¨ Ø§ÙÙÙÙ Ø§ÙØ­Ø§ÙÙ ÙÙØ­ØµÙÙ Ø¹ÙÙ sha ÙØ§ÙÙØ­ØªÙÙ Ø§ÙÙØ¯ÙÙ
                    var getRes = await fetch(apiUrl, {
                        headers: { 'Authorization': `token ${settings.token}` }
                    });
                    var sha = null;
                    var oldContent = '';
                    if (getRes.ok) {
                        var fileData = await getRes.json();
                        sha = fileData.sha;
                        // ÙÙ ØªØ±ÙÙØ² base64 ÙÙØ­ØµÙÙ Ø¹ÙÙ Ø§ÙÙØ­ØªÙÙ Ø§ÙÙØ¯ÙÙ
                        oldContent = atob(fileData.content);
                    }

                    // Ø¥Ø¶Ø§ÙØ© Ø§ÙÙÙØ¯ Ø§ÙØ¬Ø¯ÙØ¯ Ø¥ÙÙ ÙÙØ§ÙØ© Ø§ÙÙØ­ØªÙÙ Ø§ÙÙØ¯ÙÙ
                    var updatedContent = oldContent + '\n\n' + newCode;
                    var contentEncoded = btoa(unescape(encodeURIComponent(updatedContent)));

                    var body = {
                        message: 'ØªØ­Ø¯ÙØ« ÙÙ ØªØ¨ÙÙØ¨ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù - Ø£Ø¶Ø§Ù ÙÙØ¯ Ø¬Ø¯ÙØ¯',
                        content: contentEncoded,
                        branch: 'main'
                    };
                    if (sha) body.sha = sha; // ÙØ·ÙÙØ¨ Ø¹ÙØ¯ Ø§ÙØªØ­Ø¯ÙØ«

                    statusDiv.innerHTML = '<span style="color:blue;">ð Ø¬Ø§Ø±Ù Ø±ÙØ¹ Ø§ÙØªØ­Ø¯ÙØ«...</span>';

                    var putRes = await fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${settings.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });

                    if (putRes.ok) {
                        statusDiv.innerHTML = '<span style="color:green;">â ØªÙ Ø±ÙØ¹ Ø§ÙØªØ­Ø¯ÙØ« Ø¨ÙØ¬Ø§Ø­ Ø¥ÙÙ GitHub! Ø³ÙØªÙ ØªØ·Ø¨ÙÙÙ Ø®ÙØ§Ù 30 Ø«Ø§ÙÙØ©.</span>';
                    } else {
                        var err = await putRes.json();
                        throw new Error(err.message || 'ÙØ´Ù Ø§ÙØ±ÙØ¹');
                    }
                } catch(e) {
                    statusDiv.innerHTML = `<span style="color:red;">â Ø®Ø·Ø£: ${e.message}</span>`;
                }
            };
        };

        console.log('â ØªØ¨ÙÙØ¨ ØªØ­Ø¯ÙØ« Ø§ÙÙØ¸Ø§Ù (Ø§ÙØ¢ÙÙ) Ø¬Ø§ÙØ²');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(initSystemUpdater);
    });

    if (document.readyState !== 'loading') {
        waitForApp(initSystemUpdater);
    }
})();


alert('مرحباً! التحديث يعمل 🎉');