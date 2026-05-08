// ====== تحديث: عرض التاريخ والوقت (نسخة محسنة مع MutationObserver) ======
(function() {
    console.log('🟢 updates.js: تم تحميل الملف بنجاح');

    function updateDateTime(element) {
        var now = new Date();
        var options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        var dateStr = now.toLocaleDateString('ar-EG', options);
        var timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        element.textContent = dateStr + ' - ' + timeStr;
    }

    function injectDateTime() {
        // للمدير - نبحث عن topbar بأي طريقة ممكنة
        var topbar = document.querySelector('.topbar') || document.querySelector('[class*="topbar"]');
        if (!topbar) {
            // ربما topbar لم يرسم بعد، نبحث داخل الـ app
            var app = document.getElementById('app');
            if (app) {
                topbar = app.querySelector('.topbar') || app.querySelector('[class*="topbar"]');
            }
        }
        console.log('🟢 updates.js: topbar بحث - ' + (topbar ? 'موجود' : 'غير موجود'));

        if (topbar && !document.getElementById('liveDateTime')) {
            var span = document.createElement('span');
            span.id = 'liveDateTime';
            span.style.cssText = 'margin:0 15px;font-weight:bold;color:#16a34a;white-space:nowrap;font-size:14px;';
            // نحاول وضعه قبل أي زر داخل topbar
            var btn = topbar.querySelector('button');
            if (btn) {
                btn.parentNode.insertBefore(span, btn);
            } else {
                topbar.appendChild(span);
            }
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
            console.log('🟢 updates.js: تم إدراج التاريخ في topbar');
        }

        // للموظف - نبحث عن header داخل app
        var empHeader = document.querySelector('#app header');
        console.log('🟢 updates.js: empHeader بحث - ' + (empHeader ? 'موجود' : 'غير موجود'));

        if (empHeader && !document.getElementById('liveDateTimeEmp')) {
            var span = document.createElement('span');
            span.id = 'liveDateTimeEmp';
            span.style.cssText = 'font-weight:bold;color:#16a34a;white-space:nowrap;font-size:14px;';
            // نضعه بعد العنوان مباشرة
            var h1 = empHeader.querySelector('h1');
            if (h1) {
                h1.insertAdjacentElement('afterend', span);
            } else {
                empHeader.appendChild(span);
            }
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
            console.log('🟢 updates.js: تم إدراج التاريخ في واجهة الموظف');
        }
    }

    // ====== MutationObserver للمراقبة ======
    function startObserving() {
        var target = document.getElementById('app') || document.body;
        var observer = new MutationObserver(function(mutations) {
            // كل ما يحصل تغيير في DOM، نحاول الحقن
            if (!document.getElementById('liveDateTime') || !document.getElementById('liveDateTimeEmp')) {
                injectDateTime();
            }
        });
        observer.observe(target, { childList: true, subtree: true });
    }

    // ====== البدء ======
    window.addEventListener('DOMContentLoaded', function() {
        console.log('🟢 updates.js: DOMContentLoaded');
        // محاولة أولى
        setTimeout(injectDateTime, 500);
        // محاولة ثانية
        setTimeout(injectDateTime, 1500);
        // محاولة ثالثة
        setTimeout(injectDateTime, 3000);
        // تشغيل المراقب
        startObserving();
    });

    // محاولة للحظة الحالية لو الحدث فات
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        injectDateTime();
        startObserving();
    }
})();
// ====== تحديث: قوائم منسدلة لتبديل الموظفين (نسخة خفيفة وآمنة) ======
(function() {
    'use strict';

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
            // عمود الموظفون هو السادس (index 5)
            var cell = cells[5];
            if (!cell || cell.querySelector('.emp-swap-select')) return;

            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            var assigned = booking.assignedEmployees || [];
            cell.innerHTML = '';

            assigned.forEach(function(empId) {
                var emp = state.employees.find(e => e.id === empId);
                if (!emp) return;
                var sameRole = state.employees.filter(e => e.role === emp.role && e.active);

                var select = document.createElement('select');
                select.className = 'emp-swap-select border p-1 rounded text-sm';
                select.style.cssText = 'margin-bottom:4px; width:100%;';
                select.setAttribute('data-booking-id', bookingId);
                select.setAttribute('data-old-emp-id', empId);

                sameRole.forEach(function(e) {
                    var opt = document.createElement('option');
                    opt.value = e.id;
                    opt.textContent = e.name;
                    if (e.id === empId) opt.selected = true;
                    select.appendChild(opt);
                });
                cell.appendChild(select);
            });

            // زر إضافة موظف
            var addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.className = 'btn-secondary text-xs';
            addBtn.style.cssText = 'margin-top:4px;';
            addBtn.setAttribute('data-booking-id', bookingId);
            addBtn.onclick = function() {
                var allEmployees = state.employees.filter(emp => emp.active);
                var roles = [...new Set(allEmployees.map(emp => emp.role))];
                var roleOpts = roles.map(r => `<option value="${r}">${r}</option>`).join('');

                Utils.openModal(`
                    <h3>إضافة موظف للحجز</h3>
                    <select id="newEmpRole" class="w-full border-2 p-2 my-2 rounded-xl">${roleOpts}</select>
                    <select id="newEmpSelect" class="w-full border-2 p-2 my-2 rounded-xl"></select>
                    <div class="flex gap-2"><button onclick="window._addEmpToBooking('${bookingId}')" class="btn-primary flex-1">إضافة</button><button onclick="Utils.closeModal()" class="btn-outline flex-1">إلغاء</button></div>
                `);

                var roleSelect = document.getElementById('newEmpRole');
                var empSelect = document.getElementById('newEmpSelect');
                function updateEmpList() {
                    var role = roleSelect.value;
                    var already = booking ? (booking.assignedEmployees || []) : [];
                    var emps = allEmployees.filter(e => e.role === role && !already.includes(e.id));
                    empSelect.innerHTML = emps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
                }
                roleSelect.addEventListener('change', updateEmpList);
                updateEmpList();
            };
            cell.appendChild(addBtn);
        });
    }

    // استبدال الموظف عند تغيير القائمة
    document.addEventListener('change', function(e) {
        if (!e.target.classList.contains('emp-swap-select')) return;
        var select = e.target;
        var bookingId = select.getAttribute('data-booking-id');
        var oldEmpId = select.getAttribute('data-old-emp-id');
        var booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) return;
        var idx = booking.assignedEmployees.indexOf(oldEmpId);
        if (idx !== -1) {
            booking.assignedEmployees[idx] = select.value;
            select.setAttribute('data-old-emp-id', select.value);
            DataManager.updateEmployeeOrders();
            DataManager.saveAllData();
            Utils.showMsg('✅ تم تغيير الموظف');
        }
    });

    // إضافة موظف (مكشوفة)
    window._addEmpToBooking = function(bookingId) {
        var empId = document.getElementById('newEmpSelect')?.value;
        if (!empId) return Utils.showError('اختر موظفاً');
        var booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) return;
        if (!booking.assignedEmployees) booking.assignedEmployees = [];
        booking.assignedEmployees.push(empId);
        DataManager.updateEmployeeOrders();
        DataManager.saveAllData();
        Utils.closeModal();
        AppRenderer.renderBookings();
    };

    // ====== ربط التعديل برسم جدول الحجوزات فقط ======
    function init() {
        var oldRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            oldRenderBookings.apply(this, arguments);
            // ننتظر حتى يكتمل الرسم ثم نضيف القوائم
            requestAnimationFrame(function() {
                enhanceBookingsTable();
            });
        };
        // تشغيل أولي إذا كان الجدول موجوداً
        if (document.querySelector('#content-area table tbody')) {
            enhanceBookingsTable();
        }
        console.log('✅ القوائم المنسدلة جاهزة');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    // في حال كان الحدث قد فات
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ====== تحديث: إظهار الحالة كـ checkbox + زر إلغاء في النوافذ المنبثقة ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    // ========== 1. إضافة أزرار إلغاء بجانب كل زر حفظ في النوافذ المنبثقة ==========
    function addCancelButtonsToModals() {
        // نستخدم MutationObserver لمشاهدة ظهور النوافذ المنبثقة
        var modalObserver = new MutationObserver(function(mutations) {
            var modal = document.getElementById('modal');
            if (!modal || !modal.classList.contains('show')) return;
            var modalContent = document.getElementById('modalContent');
            if (!modalContent) return;
            // نبحث عن أي زر يحتوي على "حفظ" أو 💾 وليس بجانبه زر إلغاء مسبقاً
            var saveButtons = modalContent.querySelectorAll('button');
            saveButtons.forEach(function(btn) {
                if ((btn.textContent.includes('حفظ') || btn.textContent.includes('💾')) &&
                    !btn.nextElementSibling?.classList.contains('cancel-btn-auto')) {
                    var cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'إلغاء';
                    cancelBtn.className = btn.className + ' cancel-btn-auto';
                    cancelBtn.style.marginRight = '8px';
                    cancelBtn.onclick = function(e) {
                        e.preventDefault();
                        Utils.closeModal();
                    };
                    btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
                }
            });
        });
        modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // ========== 2. تحويل عمود الحالة إلى checkbox ==========
    function enhanceStatusColumn() {
        var rows = document.querySelectorAll('#content-area table tbody tr');
        rows.forEach(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            // عمود الحالة هو الخامس (index 4)
            var statusCell = cells[4];
            if (!statusCell || statusCell.querySelector('.status-checkbox')) return;

            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            // نحفظ المرجع للـ span القديم (قد يكون موجوداً)
            var oldSpan = statusCell.querySelector('.status-badge');
            var oldSelect = statusCell.querySelector('select');

            // نزيل المحتوى القديم
            statusCell.innerHTML = '';

            // ننشئ checkbox
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'status-checkbox';
            cb.checked = (booking.status === 'completed');
            cb.setAttribute('data-booking-id', bookingId);
            cb.style.cssText = 'width:20px; height:20px; cursor:pointer;';
            cb.title = 'تحديد كمكتمل';

            // نضيف نص بجانبه (اختياري)
            var label = document.createElement('span');
            label.textContent = ' مكتمل';
            label.style.cssText = 'font-size:0.8rem; vertical-align:middle;';

            statusCell.appendChild(cb);
            statusCell.appendChild(label);

            // التعامل مع تغيير الـ checkbox
            cb.addEventListener('change', function() {
                var newStatus = this.checked ? 'completed' : 'pending';
                BookingManager.changeStatus(bookingId, newStatus);
                // تحديث النص إذا أردت
                label.textContent = this.checked ? ' مكتمل' : ' معلق';
            });
        });
    }

    // ========== 3. تشغيل التعديلات بعد تحميل AppRenderer ==========
    function init() {
        // إضافة أزرار الإلغاء
        addCancelButtonsToModals();

        // ربط تحسين حالة checkbox برسم الجدول
        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings.apply(this, arguments);
            requestAnimationFrame(function() {
                enhanceStatusColumn();
            });
        };

        // إذا كان الجدول موجوداً بالفعل
        if (document.querySelector('#content-area table tbody')) {
            enhanceStatusColumn();
        }

        console.log('✅ تم تفعيل checkbox الحالة وأزرار الإلغاء');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ====== تحديث: تحسين تنسيق صفحة الحجوزات (بدون مسح أي محتوى) ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    // ========== 1. حقن CSS مخصص لصفحة الحجوزات ==========
    function injectBookingStyles() {
        if (document.getElementById('booking-enhanced-styles')) return;
        var style = document.createElement('style');
        style.id = 'booking-enhanced-styles';
        style.textContent = `
            /* تحسينات عامة لجدول الحجوزات */
            #content-area .bg-card {
                padding: 18px !important;
                border-radius: 18px !important;
            }
            #content-area table {
                border-collapse: collapse;
                font-size: 0.85rem;
                width: 100%;
            }
            #content-area table th {
                background: var(--primary);
                color: white;
                font-weight: 600;
                padding: 12px 6px;
                white-space: nowrap;
            }
            #content-area table td {
                padding: 10px 6px;
                vertical-align: middle;
                border-bottom: 1px solid #e5e7eb;
            }
            #content-area table tbody tr:hover {
                background: #f0fdf4;
            }
            /* تحسين الأزرار داخل الجدول */
            #content-area table td .btn,
            #content-area table td button {
                margin: 2px;
                font-size: 0.75rem;
                padding: 6px 10px;
            }
            /* القوائم المنسدلة للموظفين */
            .emp-swap-select {
                font-size: 0.75rem;
                padding: 4px;
                border-radius: 6px;
                border: 1px solid #d1d5db;
                margin-bottom: 3px;
            }
            .add-emp-btn {
                font-size: 0.7rem;
                padding: 4px 8px;
            }
            /* مربع البحث والفلاتر */
            #content-area .grid.gap-2.mb-3 input,
            #content-area .grid.gap-2.mb-3 select {
                font-size: 0.8rem;
            }
            /* جعل قسم الأزرار العلوية أكثر تنظيماً */
            .flex.justify-between.flex-wrap.gap-2.mb-3 {
                align-items: center;
            }
            /* تحسين شكل checkbox الحالة */
            .status-checkbox {
                width: 18px;
                height: 18px;
                accent-color: var(--primary);
            }
            /* تنسيق عام للـ status-badge */
            .status-badge {
                font-size: 0.7rem;
                padding: 4px 10px;
            }
            /* الهوامش */
            #content-area .text-sm.mb-2 {
                font-size: 0.85rem;
                margin-bottom: 8px;
            }
            /* جعل الجدول قابل للتمرير بشكل أفضل */
            #content-area .overflow-x-auto {
                border-radius: 12px;
                border: 1px solid var(--border);
            }
            /* تحسينات للوضع الداكن */
            body.dark #content-area table th {
                background: #2d3a4a;
            }
            body.dark #content-area table tbody tr:hover {
                background: #2d3a3a;
            }
        `;
        document.head.appendChild(style);
    }

    // ========== 2. تحسين هيكلي بسيط (إضافة غلاف للجدول إن لم يوجد) ==========
    function enhanceTableStructure() {
        var table = document.querySelector('#content-area table');
        if (!table) return;
        var existingWrapper = table.closest('.booking-table-wrapper');
        if (!existingWrapper) {
            var wrapper = document.createElement('div');
            wrapper.className = 'booking-table-wrapper overflow-x-auto';
            wrapper.style.cssText = 'border-radius:12px; border:1px solid var(--border);';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    }

    // ========== 3. تنفيذ التنسيقات ==========
    function applyEnhancements() {
        injectBookingStyles();
        enhanceTableStructure();
    }

    function init() {
        // نطبق عند أول رسم للصفحة
        if (document.getElementById('content-area')) {
            applyEnhancements();
        }
        // نربط بـ renderBookings ليطبق كل مرة
        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings.apply(this, arguments);
            requestAnimationFrame(function() {
                applyEnhancements();
            });
        };
        console.log('✅ تم تحسين تنسيق صفحة الحجوزات');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ====== تحديث: تشيك بوكس للحالات الثلاث + زر إلغاء في المنبثقات ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    // ========== 1. أزرار إلغاء بجانب حفظ في النوافذ ==========
    function addCancelButtonsToModals() {
        var modalObserver = new MutationObserver(function() {
            var modal = document.getElementById('modal');
            if (!modal || !modal.classList.contains('show')) return;
            var modalContent = document.getElementById('modalContent');
            if (!modalContent) return;
            modalContent.querySelectorAll('button').forEach(function(btn) {
                if ((btn.textContent.includes('حفظ') || btn.textContent.includes('💾')) &&
                    !btn.nextElementSibling?.classList.contains('cancel-btn-auto')) {
                    var cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'إلغاء';
                    cancelBtn.className = btn.className + ' cancel-btn-auto';
                    cancelBtn.style.marginRight = '8px';
                    cancelBtn.onclick = function(e) {
                        e.preventDefault();
                        Utils.closeModal();
                    };
                    btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
                }
            });
        });
        modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // ========== 2. تحويل عمود الحالة إلى radio buttons أنيقة ==========
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
                radio.setAttribute('data-booking-id', bookingId);
                radio.classList.add('status-radio');

                radio.addEventListener('change', function() {
                    var newStatus = this.value;
                    BookingManager.changeStatus(bookingId, newStatus);
                    // تحديث ألوان المجموعة
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

    // ========== 3. تشغيل التعديلات ==========
    function init() {
        addCancelButtonsToModals();

        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            origRenderBookings.apply(this, arguments);
            requestAnimationFrame(function() {
                enhanceStatusColumn();
            });
        };

        if (document.querySelector('#content-area table tbody')) {
            enhanceStatusColumn();
        }
        console.log('✅ حالة ثلاثية + أزرار إلغاء جاهزة');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ====== تحديث: قائمة Styles في الإعدادات لتغيير شكل النظام ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    // تعريف الأنماط (Presets)
    var STYLES = {
        default: {
            name: 'Default',
            css: `
                :root {
                    --radius-btn: 30px;
                    --radius-lg: 20px;
                    --radius-xl: 24px;
                    --shadow-sm: 0 4px 6px -1px rgba(0,0,0,0.1);
                    --shadow-lg: 0 25px 50px -12px rgba(0,0,0,0.25);
                    --font-family: 'Segoe UI', Tahoma, sans-serif;
                    --font-size-base: 1rem;
                }
            `
        },
        rounded: {
            name: 'Rounded',
            css: `
                :root {
                    --radius-btn: 40px;
                    --radius-lg: 28px;
                    --radius-xl: 32px;
                    --shadow-sm: 0 6px 10px -2px rgba(0,0,0,0.1);
                    --shadow-lg: 0 30px 60px -15px rgba(0,0,0,0.3);
                    --font-family: 'Segoe UI', Tahoma, sans-serif;
                    --font-size-base: 1rem;
                }
                .btn, .stat-card, .bg-card { border-radius: var(--radius-lg) !important; }
                .modal-content { border-radius: var(--radius-xl) !important; }
            `
        },
        compact: {
            name: 'Compact',
            css: `
                :root {
                    --radius-btn: 10px;
                    --radius-lg: 10px;
                    --radius-xl: 12px;
                    --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
                    --shadow-lg: 0 10px 20px rgba(0,0,0,0.15);
                    --font-family: 'Segoe UI', Tahoma, sans-serif;
                    --font-size-base: 0.875rem;
                }
                .btn { padding: 6px 14px; font-size: 0.8rem; }
                table { font-size: 0.8rem; }
                .stat-card, .bg-card { padding: 12px; }
            `
        },
        spacious: {
            name: 'Spacious',
            css: `
                :root {
                    --radius-btn: 30px;
                    --radius-lg: 24px;
                    --radius-xl: 28px;
                    --shadow-sm: 0 8px 15px -3px rgba(0,0,0,0.1);
                    --shadow-lg: 0 35px 60px -15px rgba(0,0,0,0.3);
                    --font-family: 'Segoe UI', Tahoma, sans-serif;
                    --font-size-base: 1.1rem;
                }
                .main-content { padding: 40px; padding-top: calc(var(--topbar-height) + 40px); }
                .stat-card, .bg-card { padding: 30px; margin-bottom: 30px; }
                .btn { padding: 12px 28px; font-size: 1rem; }
            `
        },
        minimal: {
            name: 'Minimal',
            css: `
                :root {
                    --radius-btn: 6px;
                    --radius-lg: 8px;
                    --radius-xl: 10px;
                    --shadow-sm: none;
                    --shadow-lg: none;
                    --font-family: Arial, Helvetica, sans-serif;
                    --font-size-base: 0.9rem;
                }
                .btn, .stat-card, .bg-card { box-shadow: none !important; border: 1px solid var(--border); }
                .modal-content { box-shadow: none; border: 1px solid var(--border); }
                .sidebar { border-left: 1px solid var(--border); }
            `
        },
        elegant: {
            name: 'Elegant',
            css: `
                :root {
                    --radius-btn: 50px;
                    --radius-lg: 30px;
                    --radius-xl: 36px;
                    --shadow-sm: 0 10px 25px -5px rgba(0,0,0,0.15);
                    --shadow-lg: 0 40px 70px -20px rgba(0,0,0,0.3);
                    --font-family: 'Georgia', serif;
                    --font-size-base: 1rem;
                }
                .topbar { background: linear-gradient(135deg, var(--primary), #0d9488); color: white; }
                .sidebar-item.active { background: rgba(255,255,255,0.15); border-radius: 12px; }
                .btn { font-weight: 400; letter-spacing: 0.5px; }
            `
        }
    };

    // تطبيق النمط
    function applyStyle(styleName) {
        var styleId = 'dynamic-style-patch';
        var oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        if (styleName === 'default') {
            // العودة للقيم الأصلية في الـ CSS الأصلي (نزيل التعديلات)
            localStorage.setItem('drmedia_style', 'default');
            return;
        }

        var preset = STYLES[styleName];
        if (!preset) return;

        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = preset.css;
        document.head.appendChild(style);
        localStorage.setItem('drmedia_style', styleName);
    }

    // تحميل النمط المحفوظ عند بدء التشغيل
    var savedStyle = localStorage.getItem('drmedia_style') || 'default';
    applyStyle(savedStyle);

    // ====== إدراج قسم الأنماط في صفحة الإعدادات ======
    function injectStyleSelector() {
        // ننتظر حتى تظهر الإعدادات
        var checkInterval = setInterval(function() {
            var waTemplate = document.getElementById('waMsgTemplate');
            if (waTemplate && !document.getElementById('styleSelectContainer')) {
                clearInterval(checkInterval);

                var html = `
                <div id="styleSelectContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                    <label class="text-sm font-semibold">🎨 شكل الواجهة (Style)</label>
                    <select id="styleSelect" class="w-full border-2 p-2 rounded-xl mt-1" onchange="window._applyGlobalStyle(this.value)">
                        ${Object.keys(STYLES).map(function(key) {
                            var selected = (key === savedStyle) ? 'selected' : '';
                            return '<option value="' + key + '" ' + selected + '>' + STYLES[key].name + '</option>';
                        }).join('')}
                    </select>
                </div>`;
                waTemplate.insertAdjacentHTML('afterend', html);
            }
        }, 300);
        setTimeout(function() { clearInterval(checkInterval); }, 10000);
    }

    // دالة عامة لتبديل النمط
    window._applyGlobalStyle = function(styleName) {
        applyStyle(styleName);
        Utils.showMsg('✅ تم تغيير شكل الواجهة');
    };

    // ====== بدء التشغيل ======
    function init() {
        // مراقبة ظهور صفحة الإعدادات
        var appObserver = new MutationObserver(function() {
            if (document.getElementById('waMsgTemplate')) {
                injectStyleSelector();
            }
        });
        var appEl = document.getElementById('app');
        if (appEl) {
            appObserver.observe(appEl, { childList: true, subtree: true });
        }
        injectStyleSelector(); // محاولة أولى
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ====== تحديث: أنماط شاملة للواجهة (تغيير القوائم والأيقونات والتبويبات والمربعات) ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    var STYLES = {
        default: {
            name: 'الافتراضي',
            css: ''
        },
        rounded: {
            name: 'دائري ناعم',
            css: `
                :root {
                    --radius-btn: 40px;
                    --radius-lg: 28px;
                    --radius-xl: 32px;
                    --radius-sm: 16px;
                }
                .btn, .stat-card, .bg-card, .sidebar-item, .calendar-day,
                .status-badge, .modal-content, table, .badge-active, .badge-inactive {
                    border-radius: var(--radius-lg) !important;
                }
                .btn { border-radius: var(--radius-btn) !important; }
                .modal-content { border-radius: var(--radius-xl) !important; }
                .sidebar-item { margin: 4px 8px; border-radius: var(--radius-sm) !important; }
                .sidebar-item:hover { background: #f0fdf4; transform: translateX(-2px); }
                .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.12); }
                .topbar { border-bottom: none; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
            `
        },
        compact: {
            name: 'مدمج',
            css: `
                :root {
                    --radius-btn: 8px;
                    --radius-lg: 8px;
                    --radius-xl: 10px;
                    --radius-sm: 4px;
                }
                .btn { padding: 6px 14px; font-size: 0.8rem; border-radius: var(--radius-btn) !important; }
                table { font-size: 0.78rem; }
                th, td { padding: 6px 5px; }
                .stat-card, .bg-card { padding: 12px; border-radius: var(--radius-lg) !important; }
                .sidebar-item { padding: 8px 14px; font-size: 0.85rem; gap: 8px; }
                .sidebar { width: 220px; }
                .main-content { margin-right: 220px; padding: 16px; padding-top: calc(60px + 16px); }
                .topbar { height: 60px; padding: 10px 16px; right: 220px; }
                .modal-content { padding: 16px; border-radius: var(--radius-xl) !important; }
            `
        },
        spacious: {
            name: 'واسع',
            css: `
                :root {
                    --radius-btn: 30px;
                    --radius-lg: 24px;
                    --radius-xl: 28px;
                    --radius-sm: 18px;
                }
                .main-content { padding: 40px; padding-top: calc(80px + 40px); }
                .stat-card, .bg-card { padding: 30px; margin-bottom: 30px; border-radius: var(--radius-lg) !important; }
                .btn { padding: 12px 28px; font-size: 1rem; border-radius: var(--radius-btn) !important; }
                .sidebar-item { padding: 16px 22px; font-size: 1rem; gap: 14px; }
                .sidebar { width: 280px; }
                .main-content { margin-right: 280px; }
                .topbar { right: 280px; height: 80px; padding: 18px 28px; }
                th, td { padding: 14px 12px; }
                .modal-content { padding: 30px; border-radius: var(--radius-xl) !important; }
            `
        },
        minimal: {
            name: 'بسيط',
            css: `
                :root {
                    --radius-btn: 4px;
                    --radius-lg: 4px;
                    --radius-xl: 6px;
                    --radius-sm: 2px;
                }
                .btn, .stat-card, .bg-card, .sidebar-item, .calendar-day,
                .status-badge, .modal-content {
                    box-shadow: none !important;
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg) !important;
                }
                .btn { border-radius: var(--radius-btn) !important; }
                .modal-content { border-radius: var(--radius-xl) !important; }
                .sidebar { border-left: 1px solid var(--border); box-shadow: none; }
                .topbar { border-bottom: 1px solid var(--border); box-shadow: none; }
                .sidebar-item.active { background: #f0fdf4; font-weight: 600; }
            `
        },
        elegant: {
            name: 'أنيق',
            css: `
                :root {
                    --radius-btn: 50px;
                    --radius-lg: 30px;
                    --radius-xl: 36px;
                    --radius-sm: 20px;
                }
                .topbar { background: linear-gradient(135deg, var(--primary), #0d9488); color: white; border-bottom: none; }
                .topbar .btn { background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); }
                .sidebar-item { margin: 6px 10px; border-radius: var(--radius-sm) !important; font-weight: 400; }
                .sidebar-item.active { background: rgba(22,163,74,0.1); border-right: 4px solid var(--primary); font-weight: 600; }
                .sidebar-item:hover { background: rgba(0,0,0,0.03); }
                .stat-card { background: linear-gradient(145deg, #fff, #f8fafc); border: 1px solid rgba(0,0,0,0.05); }
                .btn { letter-spacing: 0.5px; border-radius: var(--radius-btn) !important; }
                .modal-content { border-radius: var(--radius-xl) !important; backdrop-filter: blur(10px); }
                body.dark .stat-card { background: linear-gradient(145deg, #2d3a4a, #1e293b); }
                body.dark .topbar { background: linear-gradient(135deg, #064e3b, #0f172a); }
            `
        },
        modern: {
            name: 'مودرن',
            css: `
                :root {
                    --radius-btn: 20px;
                    --radius-lg: 16px;
                    --radius-xl: 20px;
                    --radius-sm: 10px;
                }
                .sidebar { background: #1e293b; color: #e2e8f0; }
                .sidebar-item { color: #94a3b8; margin: 2px 6px; border-radius: var(--radius-sm) !important; }
                .sidebar-item:hover { background: #334155; color: white; }
                .sidebar-item.active { background: var(--primary); color: white; border-right: none; }
                .topbar { background: white; border-bottom: 2px solid var(--primary); }
                .btn { border-radius: var(--radius-btn) !important; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px; }
                .stat-card { border-left: 4px solid var(--primary); border-radius: var(--radius-lg) !important; }
                .bg-card { border-radius: var(--radius-lg) !important; }
                .modal-content { border-radius: var(--radius-xl) !important; }
                body.dark .sidebar { background: #0f172a; }
                body.dark .sidebar-item:hover { background: #1e293b; }
                body.dark .topbar { background: #1e293b; border-bottom-color: #22c55e; }
            `
        }
    };

    function applyStyle(styleName) {
        var styleId = 'dynamic-style-patch';
        var oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        if (styleName === 'default') {
            localStorage.setItem('drmedia_style', 'default');
            return;
        }

        var preset = STYLES[styleName];
        if (!preset || !preset.css) return;

        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = preset.css;
        document.head.appendChild(style);
        localStorage.setItem('drmedia_style', styleName);
    }

    var savedStyle = localStorage.getItem('drmedia_style') || 'default';
    applyStyle(savedStyle);

    function injectStyleSelector() {
        var checkInterval = setInterval(function() {
            var waTemplate = document.getElementById('waMsgTemplate');
            if (waTemplate && !document.getElementById('styleSelectContainer')) {
                clearInterval(checkInterval);

                var html = `
                <div id="styleSelectContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                    <label class="text-sm font-semibold">🎨 شكل الواجهة (Style)</label>
                    <select id="styleSelect" class="w-full border-2 p-2 rounded-xl mt-1" onchange="window._applyGlobalStyle(this.value)">
                        ${Object.keys(STYLES).map(function(key) {
                            var selected = (key === savedStyle) ? 'selected' : '';
                            return '<option value="' + key + '" ' + selected + '>' + STYLES[key].name + '</option>';
                        }).join('')}
                    </select>
                    <small class="text-gray-500">يؤثر على شكل القوائم والأيقونات والتبويبات والمربعات</small>
                </div>`;
                waTemplate.insertAdjacentHTML('afterend', html);
            }
        }, 300);
        setTimeout(function() { clearInterval(checkInterval); }, 10000);
    }

    window._applyGlobalStyle = function(styleName) {
        applyStyle(styleName);
        Utils.showMsg('✅ تم تغيير شكل الواجهة');
    };

    function init() {
        var appObserver = new MutationObserver(function() {
            if (document.getElementById('waMsgTemplate')) {
                injectStyleSelector();
            }
        });
        var appEl = document.getElementById('app');
        if (appEl) appObserver.observe(appEl, { childList: true, subtree: true });
        injectStyleSelector();
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ====== تحديث: لوحة مراقبة حية + 3 رسوم بيانية في صفحة تقارير متقدمة ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    // ======================= 1. لوحة المراقبة الحية =======================
    function injectLiveDashboard() {
        var origDashboard = AppRenderer.renderDashboard;
        AppRenderer.renderDashboard = function() {
            origDashboard.apply(this, arguments);
            setTimeout(injectCards, 200);
        };

        function injectCards() {
            var contentArea = document.getElementById('content-area');
            if (!contentArea || document.getElementById('liveMonitorCards')) return;

            var today = Utils.getTodayDateStr();
            var todayBookings = state.bookings.filter(b => b.date === today && !b.deleted && b.status !== 'cancelled');
            var activeEmployees = state.employees.filter(e => {
                var rec = state.attendanceRecords.find(a => a.empId === e.id && a.date === today);
                return rec && rec.checkIn && !rec.checkOut;
            });
            var busyHallIds = new Set(todayBookings.filter(b => b.status !== 'cancelled').map(b => b.hallId));
            var busyHalls = state.halls.filter(h => busyHallIds.has(h.id));

            var html = `
            <div id="liveMonitorCards" style="margin-top:20px;">
                <h3 style="font-weight:bold; margin-bottom:12px; font-size:1.1rem;">📡 لوحة المراقبة الحية</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px;">
                    <div class="stat-card" style="border-left:4px solid #3b82f6;">
                        <div class="stat-value" style="color:#3b82f6;">${todayBookings.length}</div>
                        <div class="stat-label">حجوزات اليوم</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #10b981;">
                        <div class="stat-value" style="color:#10b981;">${activeEmployees.length}</div>
                        <div class="stat-label">موظفون متواجدون</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #f59e0b;">
                        <div class="stat-value" style="color:#f59e0b;">${busyHalls.length}</div>
                        <div class="stat-label">قاعات مشغولة</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #8b5cf6;">
                        <div class="stat-value" style="color:#8b5cf6; font-size:1.2rem;">${state.attendanceRecords[0]?.checkIn || '—'}</div>
                        <div class="stat-label">آخر تسجيل حضور</div>
                    </div>
                </div>
            </div>`;

            var firstCard = contentArea.querySelector('.stat-card');
            if (firstCard) {
                var parentGrid = firstCard.closest('.grid');
                if (parentGrid) {
                    parentGrid.insertAdjacentHTML('afterend', html);
                }
            }
        }

        // تشغيل أولي
        if (document.getElementById('content-area') && document.querySelector('.stat-card')) {
            injectCards();
        }
    }

    // ======================= 2. صفحة تقارير متقدمة جديدة =======================
    function initAdvancedReportPage() {
        // إضافة الصفحة إلى القائمة الجانبية
        var sidebarContainer = document.querySelector('.sidebar .py-2');
        if (sidebarContainer && !document.querySelector('[data-page="advancedReportsNew"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-page', 'advancedReportsNew');
            item.onclick = function() { AppRenderer.navigateTo('advancedReportsNew'); };
            item.innerHTML = '<span>📈 تقارير متقدمة</span>';
            sidebarContainer.appendChild(item);
        }

        // إضافة التبويب إلى صفحات AppRenderer
        if (!AppRenderer.pages.includes('advancedReportsNew')) {
            AppRenderer.pages.push('advancedReportsNew');
        }

        // تعريف دالة العرض
        AppRenderer.renderAdvancedReportsNew = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = '📈 تقارير متقدمة';

            c.innerHTML = `
            <div class="bg-card">
                <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
                    <button onclick="window._showAdvancedChart('occupancy', this)" class="btn-primary active-chart-btn">إشغال القاعات</button>
                    <button onclick="window._showAdvancedChart('performance', this)" class="btn-outline">أداء الموظفين</button>
                    <button onclick="window._showAdvancedChart('revenue', this)" class="btn-outline">الإيرادات</button>
                </div>
                <div id="advancedChartContainer" style="position:relative; height:400px; width:100%;">
                    <canvas id="advancedChartCanvas" style="width:100%; height:100%;"></canvas>
                </div>
                <div class="footer-bar">${state.footerText || APP_CONFIG.footerText}</div>
            </div>`;

            window._showAdvancedChart('occupancy', document.querySelector('.active-chart-btn'));
        };

        // دالة عرض الرسم البياني المطلوب
        window._showAdvancedChart = function(type, btn) {
            // تنشيط الزر
            document.querySelectorAll('.active-chart-btn').forEach(b => b.className = 'btn-outline');
            if (btn) btn.className = 'btn-primary active-chart-btn';

            var ctx = document.getElementById('advancedChartCanvas');
            if (!ctx) return;

            // تدمير الرسم السابق
            var existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();

            var labels, data, title;

            if (type === 'occupancy') {
                // إشغال القاعات شهرياً
                labels = state.halls.map(h => h.name);
                var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
                var currentMonth = new Date().getMonth();
                data = state.halls.map(h => {
                    return state.bookings.filter(b => b.hallId === h.id && !b.deleted &&
                        new Date(b.date).getMonth() === currentMonth).length;
                });
                title = 'عدد الحجوزات لكل قاعة (الشهر الحالي)';
            } else if (type === 'performance') {
                // أداء الموظفين
                labels = state.employees.map(e => e.name);
                data = state.employees.map(e => e.totalOrders || 0);
                title = 'إجمالي الأوردرات المكتملة لكل موظف';
            } else if (type === 'revenue') {
                // الإيرادات الشهرية
                labels = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
                data = labels.map((_, i) => state.bookings.filter(b => {
                    var d = new Date(b.date);
                    return d.getMonth() === i && !b.deleted && b.status !== 'cancelled';
                }).reduce((sum, b) => sum + (b.price || 0), 0));
                title = 'الإيرادات الشهرية (بالجنيه)';
            }

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: title,
                        data: data,
                        backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'],
                        borderRadius: 8,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    }
                }
            });
        };
    }

    // ======================= 3. تشغيل الكل =======================
    function init() {
        injectLiveDashboard();
        initAdvancedReportPage();
        console.log('✅ لوحة المراقبة والتقارير المتقدمة جاهزة');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
// ==============================================
// تحديث شامل: 10 مميزات متقدمة
// ==============================================
(function() {
    'use strict';

    // انتظار AppRenderer
    function waitForApp(cb) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            cb();
        } else {
            setTimeout(() => waitForApp(cb), 50);
        }
    }

    // ==================== 1. تنبيهات ذكية ====================
    function initSmartAlerts() {
        function checkAlerts() {
            var today = Utils.getTodayDateStr();
            var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            var tomorrowStr = tomorrow.toISOString().slice(0,10);
            var warnings = [];
            state.bookings.forEach(b => {
                if (b.status === 'pending' && !b.deleted && (b.date === today || b.date === tomorrowStr)) {
                    if (!b.assignedEmployees || b.assignedEmployees.length === 0) {
                        warnings.push(`⚠️ حجز ${b.clientName} في ${b.date} بدون موظفين`);
                    }
                }
            });
            state.flashDrives.forEach(f => {
                var b = state.bookings.find(bk => bk.id === f.bookingId);
                if (b && f.currentHolder !== 'العريس') {
                    var daysSince = Math.floor((new Date() - new Date(b.date)) / (1000*60*60*24));
                    if (daysSince > 2 && f.status !== 'مكتملة') {
                        warnings.push(`⏰ فلاشة ${b.clientName} متأخرة منذ ${daysSince} يوم`);
                    }
                }
            });
            if (warnings.length > 0) {
                console.warn('تنبيهات:', warnings.join(' | '));
            }
        }
        setInterval(checkAlerts, 60000);
        checkAlerts();
    }

    // ==================== 2. جدول زمني يومي ====================
    function initTimelinePage() {
        if (!AppRenderer.pages.includes('timeline')) {
            AppRenderer.pages.push('timeline');
        }
        AppRenderer.renderTimeline = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = '⏱️ الجدول الزمني';
            var today = Utils.getTodayDateStr();
            var todayBookings = state.bookings.filter(b => b.date === today && !b.deleted && b.status !== 'cancelled');
            todayBookings.sort((a,b) => (a.time || '').localeCompare(b.time || ''));
            c.innerHTML = `<div class="bg-card"><h2 class="text-xl font-bold mb-4">حجوزات اليوم (${today})</h2>
                <div class="overflow-x-auto"><table><thead><tr><th>العميل</th><th>القاعة</th><th>السعر</th><th>الموظفون</th><th>الحالة</th></tr></thead><tbody>
                ${todayBookings.map(b => `<tr><td>${b.clientName}</td><td>${b.hallName}</td><td>${Utils.formatCurrency(b.price)}</td><td>${(b.assignedEmployees||[]).map(id=>state.employees.find(e=>e.id===id)?.name).join(', ')||'—'}</td><td>${b.status==='completed'?'✅':'⏳'}</td></tr>`).join('')}
                </tbody></table></div><div class="footer-bar">${APP_CONFIG.footerText}</div></div>`;
        };
        var sidebar = document.querySelector('.sidebar .py-2');
        if (sidebar && !document.querySelector('[data-page="timeline"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-page', 'timeline');
            item.onclick = function(){ AppRenderer.navigateTo('timeline'); };
            item.innerHTML = '<span>⏱️ الجدول الزمني</span>';
            sidebar.appendChild(item);
        }
    }

    // ==================== 3. صلاحيات متقدمة (مشرف قاعة) ====================
    function initSupervisorRole() {
        var origRenderBookings = AppRenderer.renderBookings;
        AppRenderer.renderBookings = function() {
            if (state.currentUser && state.currentUser.role === 'supervisor' && state.currentUser.supervisedHallId) {
                var hallId = state.currentUser.supervisedHallId;
                var origFilter = state.filters.bookingHall;
                state.filters.bookingHall = hallId;
                origRenderBookings.apply(this, arguments);
                state.filters.bookingHall = origFilter;
            } else {
                origRenderBookings.apply(this, arguments);
            }
        };
        if (!state.USERS.find(u => u.role === 'supervisor')) {
            state.USERS.push({ id:'sup1', username:'supervisor', password:'super123', role:'supervisor', name:'مشرف قاعة', employeeId:null, supervisedHallId:'h1' });
        }
    }

    // ==================== 4. دورة حياة الفلاشة ====================
    function enhanceFlashPage() {
        var origRenderFlash = AppRenderer.renderFlash;
        AppRenderer.renderFlash = function() {
            origRenderFlash.apply(this, arguments);
            setTimeout(() => {
                var rows = document.querySelectorAll('#content-area table tbody tr');
                rows.forEach(row => {
                    var cells = row.querySelectorAll('td');
                    if (cells.length > 6) {
                        var statusText = cells[5].textContent.trim();
                        if (statusText !== 'تم التسليم للعريس' && statusText !== 'مكتملة') {
                            var dateCell = cells[2];
                            var date = new Date(dateCell.textContent);
                            var daysDiff = Math.floor((new Date() - date) / (1000*60*60*24));
                            if (daysDiff > 2) {
                                row.style.backgroundColor = '#ffe0e0';
                            }
                        }
                    }
                });
            }, 200);
        };
    }

    // ==================== 5. أتمتة التوزيع الدوري ====================
    function initAutoDistribution() {
        var autoDistConfig = JSON.parse(localStorage.getItem('drmedia_auto_dist') || '{"enabled":false,"dayOfWeek":0}');
        function checkAutoDist() {
            if (!autoDistConfig.enabled) return;
            var now = new Date();
            if (now.getDay() === autoDistConfig.dayOfWeek && now.getHours() === 8) {
                DistributionManager.smartDistribute();
            }
        }
        setInterval(checkAutoDist, 3600000);
        var origRenderSettings = AppRenderer.renderSettings;
        AppRenderer.renderSettings = function() {
            origRenderSettings.apply(this, arguments);
            setTimeout(() => {
                var waTemplate = document.getElementById('waMsgTemplate');
                if (!waTemplate || document.getElementById('autoDistContainer')) return;
                var days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
                var html = `<div id="autoDistContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                    <h3 class="font-semibold mb-2">🔄 أتمتة التوزيع الأسبوعي</h3>
                    <div class="flex items-center gap-2 mb-2"><input type="checkbox" id="autoDistEnable" ${autoDistConfig.enabled?'checked':''} onchange="window._toggleAutoDist()"> <label>تفعيل</label></div>
                    <select id="autoDistDay" class="border-2 p-2 rounded-xl w-full" onchange="window._updateAutoDist()">
                        ${days.map((d,i) => `<option value="${i}" ${i===autoDistConfig.dayOfWeek?'selected':''}>${d}</option>`).join('')}
                    </select>
                </div>`;
                waTemplate.insertAdjacentHTML('afterend', html);
            }, 200);
        };
        window._toggleAutoDist = function() {
            autoDistConfig.enabled = document.getElementById('autoDistEnable').checked;
            localStorage.setItem('drmedia_auto_dist', JSON.stringify(autoDistConfig));
        };
        window._updateAutoDist = function() {
            autoDistConfig.dayOfWeek = parseInt(document.getElementById('autoDistDay').value);
            localStorage.setItem('drmedia_auto_dist', JSON.stringify(autoDistConfig));
        };
    }

    // ==================== 6. قوالب واتساب متعددة ====================
    function initWhatsAppTemplates() {
        var templates = JSON.parse(localStorage.getItem('drmedia_wa_templates') || '["مرحباً {name}، تم توزيع أوردر {client} في {date} بقاعة {hall}", "تذكير: لديك أوردر غداً {client} في قاعة {hall}"]');
        window._getWATemplates = function() { return templates; };
        var origRenderSettings = AppRenderer.renderSettings;
        AppRenderer.renderSettings = function() {
            origRenderSettings.apply(this, arguments);
            setTimeout(() => {
                var waMsg = document.getElementById('waMsgTemplate');
                if (!waMsg || document.getElementById('waTemplatesContainer')) return;
                var html = `<div id="waTemplatesContainer" style="margin-top:10px;">
                    <label class="text-sm font-semibold">قوالب إضافية (كل سطر قالب)</label>
                    <textarea id="waExtraTemplates" class="w-full border-2 p-2 rounded-xl" rows="3" onchange="window._saveWATemplates()">${templates.join('\n')}</textarea>
                </div>`;
                waMsg.insertAdjacentHTML('afterend', html);
            }, 200);
        };
        window._saveWATemplates = function() {
            var val = document.getElementById('waExtraTemplates').value;
            var lines = val.split('\n').filter(l => l.trim() !== '');
            localStorage.setItem('drmedia_wa_templates', JSON.stringify(lines));
            templates = lines;
        };
    }

    // ==================== 7. تصدير PDF للتقارير ====================
    function initPDFExport() {
        if (!window.jspdf) {
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.head.appendChild(script);
        }
        window.exportToPDF = function(tableId, filename) {
            if (!window.jspdf) {
                Utils.showError('مكتبة PDF غير محملة بعد');
                return;
            }
            var { jsPDF } = window.jspdf;
            var doc = new jsPDF();
            var table = document.getElementById(tableId) || document.querySelector('table');
            if (!table) return;
            var rows = table.querySelectorAll('tr');
            var y = 20;
            rows.forEach(row => {
                var cells = row.querySelectorAll('th, td');
                var text = Array.from(cells).map(c => c.textContent).join(' | ');
                doc.text(text, 10, y);
                y += 8;
                if (y > 280) { doc.addPage(); y = 20; }
            });
            doc.save(filename || 'report.pdf');
        };
        AppRenderer.renderReports = (function(old) {
            return function() {
                old.apply(this, arguments);
                setTimeout(() => {
                    var contentArea = document.getElementById('content-area');
                    if (contentArea && !document.getElementById('pdfExportBtn')) {
                        var btn = document.createElement('button');
                        btn.id = 'pdfExportBtn';
                        btn.className = 'btn-primary';
                        btn.textContent = '📄 تصدير PDF';
                        btn.onclick = function() { window.exportToPDF('bookingsTable', 'تقرير.pdf'); };
                        var card = contentArea.querySelector('.bg-card');
                        if (card) card.appendChild(btn);
                    }
                }, 200);
            };
        })(AppRenderer.renderReports);
    }

    // ==================== 8. وضع عدم الاتصال المحسن ====================
    function initOfflineMode() {
        var statusBar = document.createElement('div');
        statusBar.id = 'offlineStatusBar';
        statusBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:6px;text-align:center;font-weight:bold;z-index:9999;';
        document.body.appendChild(statusBar);
        function updateStatus() {
            if (navigator.onLine) {
                statusBar.style.background = '#10b981';
                statusBar.textContent = '🟢 متصل بالإنترنت';
            } else {
                statusBar.style.background = '#f59e0b';
                statusBar.textContent = '🟠 وضع عدم الاتصال - البيانات محفوظة محلياً';
            }
        }
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
    }

    // ==================== 9. شاشة عرض عامة ====================
    function initPublicView() {
        if (window.location.search.includes('public')) {
            document.body.innerHTML = '';
            var today = new Date().toISOString().slice(0,10);
            var bookings = JSON.parse(localStorage.getItem('drmedia_data')).bookings.filter(b => b.date === today && !b.deleted);
            var html = '<div style="padding:20px;font-family:Tahoma;text-align:center;"><h1>📋 حجوزات اليوم</h1><table style="margin:auto;border-collapse:collapse;"><tr><th>القاعة</th><th>العميل</th><th>الوقت</th></tr>';
            bookings.forEach(b => { html += `<tr><td>${b.hallName}</td><td>${b.clientName}</td><td>${b.time||'—'}</td></tr>`; });
            html += '</table></div>';
            document.body.innerHTML = html;
        }
    }

    // ==================== 10. نسخ احتياطي إلى Google Drive ====================
    function initGoogleDriveBackup() {
        window.uploadToDrive = function() {
            var data = JSON.stringify(state);
            var blob = new Blob([data], {type:'application/json'});
            var scriptURL = localStorage.getItem('drmedia_gdrive_script_url');
            if (!scriptURL) {
                Utils.showError('الرجاء إعداد رابط Google Apps Script في الإعدادات');
                return;
            }
            var formData = new FormData();
            formData.append('file', blob, 'backup.json');
            fetch(scriptURL, { method: 'POST', body: formData }).then(() => {
                Utils.showMsg('✅ تم رفع النسخ الاحتياطي إلى Google Drive');
            }).catch(() => Utils.showError('فشل الرفع'));
        };
        var origSettings = AppRenderer.renderSettings;
        AppRenderer.renderSettings = function() {
            origSettings.apply(this, arguments);
            setTimeout(() => {
                var wa = document.getElementById('waMsgTemplate');
                if (wa && !document.getElementById('gdriveContainer')) {
                    var html = `<div id="gdriveContainer" style="margin-top:20px; border-top:2px solid #eee; padding-top:15px;">
                        <label class="text-sm font-semibold">Google Drive Script URL</label>
                        <input id="gdriveURL" class="w-full border-2 p-2 rounded-xl" value="${localStorage.getItem('drmedia_gdrive_script_url')||''}" onchange="localStorage.setItem('drmedia_gdrive_script_url', this.value)">
                        <button onclick="window.uploadToDrive()" class="btn-primary w-full mt-2">📤 رفع نسخة احتياطية الآن</button>
                    </div>`;
                    wa.insertAdjacentHTML('afterend', html);
                }
            }, 200);
        };
    }

    // ==================== بدء جميع الميزات ====================
    function initAll() {
        initSmartAlerts();
        initTimelinePage();
        initSupervisorRole();
        enhanceFlashPage();
        initAutoDistribution();
        initWhatsAppTemplates();
        initPDFExport();
        initOfflineMode();
        initPublicView();
        initGoogleDriveBackup();
        console.log('✅ تم تحميل جميع الميزات العشر');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(initAll);
    });
    if (document.readyState !== 'loading') {
        waitForApp(initAll);
    }
})();
// ====== تحديث: تحسين واجهة الموظف وترتيب الأوردرات تصاعدياً ======
(function() {
    'use strict';

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    function enhanceEmpDash() {
        // نبحث عن حاوية جميع الأوردرات (آخر div مع max-h-60 في #app)
        var containers = document.querySelectorAll('#app .max-h-60.overflow-y-auto');
        if (containers.length === 0) return;
        var allBookingsContainer = containers[containers.length - 1];
        if (!allBookingsContainer) return;

        // نجلب عناصر الأوردرات (div.border-b)
        var items = Array.from(allBookingsContainer.querySelectorAll('.border-b'));
        if (items.length === 0) return;

        // استخراج التاريخ من نص العنصر
        function extractDate(item) {
            var match = item.textContent.match(/(\d{4}-\d{2}-\d{2})/);
            return match ? match[0] : '9999-99-99';
        }

        // ترتيب تصاعدي (الأقدم أولاً)
        items.sort(function(a, b) {
            return extractDate(a).localeCompare(extractDate(b));
        });

        // إفراغ الحاوية وإعادة إضافة العناصر بالترتيب الجديد
        while (allBookingsContainer.firstChild) {
            allBookingsContainer.removeChild(allBookingsContainer.firstChild);
        }
        items.forEach(function(item) {
            // إضافة بعض التنسيق الخفيف (اختياري)
            item.style.padding = '12px 8px';
            item.style.marginBottom = '2px';
            item.style.borderRadius = '8px';
            item.style.transition = 'background-color 0.2s';
            item.addEventListener('mouseenter', function() {
                this.style.backgroundColor = 'rgba(22,163,74,0.08)';
            });
            item.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '';
            });
            allBookingsContainer.appendChild(item);
        });
    }

    // تعديل دالة renderEmpDash لإضافة التحسين بعد الرسم
    function init() {
        var origRenderEmpDash = AppRenderer.renderEmpDash;
        AppRenderer.renderEmpDash = function() {
            origRenderEmpDash.apply(this, arguments);
            // انتظر حتى يتم رسم الواجهة ثم طبق التحسين
            setTimeout(enhanceEmpDash, 250);
            setTimeout(enhanceEmpDash, 600);
        };
        console.log('✅ تحسين واجهة الموظف وترتيب الأوردرات جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();