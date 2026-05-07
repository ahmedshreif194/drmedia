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

// ====== تحديث: قائمة منسدلة لتبديل الموظفين في صفحة الحجوزات ======
(function() {
    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    function renderEmployeeDropdowns() {
        // نبحث عن الصفوف في جدول الحجوزات (الموجودة داخل tbody)
        var rows = document.querySelectorAll('#content-area table tbody tr');
        rows.forEach(function(row) {
            // الخلية التي تحتوي على أسماء الموظفين (العمود قبل الأخير عادة، نعتمد على أنه يحوي span)
            var cell = row.querySelector('td:nth-child(6)'); // عمود الموظفون
            if (!cell || cell.querySelector('.custom-emp-select')) return; // تم التعديل مسبقاً

            // البحث عن booking id من checkbox
            var checkbox = row.querySelector('input.booking-check');
            if (!checkbox) return;
            var bookingId = checkbox.value;
            var booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            // تجهيز قائمة الموظفين حسب الدور
            var allEmployees = state.employees.filter(e => e.active);
            var assigned = booking.assignedEmployees || [];

            // نمسح المحتوى القديم
            cell.innerHTML = '';

            // نضيف قائمة منسدلة لكل موظف معين حالياً
            assigned.forEach(function(empId) {
                var emp = state.employees.find(e => e.id === empId);
                if (!emp) return;
                // الموظفون من نفس الدور
                var sameRole = allEmployees.filter(e => e.role === emp.role);
                var select = document.createElement('select');
                select.className = 'custom-emp-select border p-1 rounded text-sm w-full mb-1';
                select.style.cssText = 'margin-bottom:4px;';
                sameRole.forEach(function(e) {
                    var opt = document.createElement('option');
                    opt.value = e.id;
                    opt.textContent = e.name;
                    if (e.id === empId) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', function() {
                    // استبدال الموظف في المصفوفة
                    var idx = booking.assignedEmployees.indexOf(empId);
                    if (idx !== -1) {
                        booking.assignedEmployees[idx] = this.value;
                        DataManager.updateEmployeeOrders();
                        DataManager.saveAllData();
                        Utils.showMsg('✅ تم تغيير الموظف');
                    }
                });
                cell.appendChild(select);
            });

            // زر إضافة موظف جديد (من أي دور)
            var addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.className = 'btn-secondary text-xs';
            addBtn.style.cssText = 'margin-top:4px;';
            addBtn.onclick = function() {
                // نافذة صغيرة لاختيار دور ثم موظف
                var roles = [...new Set(allEmployees.map(e => e.role))];
                var roleOpts = roles.map(r => `<option value="${r}">${r}</option>`).join('');
                Utils.openModal(`
                    <h3>إضافة موظف للحجز</h3>
                    <select id="newEmpRole" class="w-full border-2 p-2 my-2 rounded-xl">${roleOpts}</select>
                    <select id="newEmpSelect" class="w-full border-2 p-2 my-2 rounded-xl"></select>
                    <button onclick="window._addEmpToBooking('${bookingId}')" class="btn-primary mt-2 w-full">إضافة</button>
                `);
                var roleSelect = document.getElementById('newEmpRole');
                var empSelect = document.getElementById('newEmpSelect');
                function updateEmpList() {
                    var role = roleSelect.value;
                    var emps = allEmployees.filter(e => e.role === role && !(booking.assignedEmployees||[]).includes(e.id));
                    empSelect.innerHTML = emps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
                }
                roleSelect.addEventListener('change', updateEmpList);
                updateEmpList();
            };
            cell.appendChild(addBtn);
        });

        // دالة الإضافة (معرفة على window)
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
            AppRenderer.renderBookings(); // إعادة رسم الجدول
        };
    }

    // ====== تنفيذ ======
    function init() {
        // بعد تحميل الصفحة، نراقب التغييرات
        var observer = new MutationObserver(function(mutations) {
            if (document.getElementById('content-area') && document.querySelector('#content-area table')) {
                renderEmployeeDropdowns();
            }
        });
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

        // محاولة أولى
        setTimeout(renderEmployeeDropdowns, 500);
        setTimeout(renderEmployeeDropdowns, 1500);
    }

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(init);
    });

    // لو الحدث فات
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        waitForApp(init);
    }
})();
