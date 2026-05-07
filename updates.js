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
