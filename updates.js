// ====== تحديث: عرض التاريخ والوقت (مع تشخيص) ======
(function() {
    console.log('🟢 updates.js: تم تحميل الملف بنجاح');

    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            console.log('🟢 updates.js: AppRenderer & state متاحان');
            callback();
        } else {
            console.log('⏳ updates.js: انتظار AppRenderer...');
            setTimeout(() => waitForApp(callback), 50);
        }
    }

    function updateDateTime(element) {
        var now = new Date();
        var options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        var dateStr = now.toLocaleDateString('ar-EG', options);
        var timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        element.textContent = dateStr + ' - ' + timeStr;
    }

    function injectDateTime() {
        // شاشة المدير
        var topbar = document.querySelector('.topbar');
        console.log('🟢 updates.js: topbar موجود؟ ' + (topbar ? 'نعم' : 'لا'));
        if (topbar && !document.getElementById('liveDateTime')) {
            var span = document.createElement('span');
            span.id = 'liveDateTime';
            span.style.cssText = 'margin:0 15px;font-weight:bold;color:#16a34a;white-space:nowrap;';
            var userSpan = topbar.querySelector('.text-sm');
            if (userSpan) {
                userSpan.parentNode.insertBefore(span, userSpan);
            } else {
                topbar.appendChild(span);
            }
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
            console.log('🟢 updates.js: تم إدراج التاريخ في topbar');
        }

        // شاشة الموظف
        var empHeader = document.querySelector('#app header.bg-white');
        console.log('🟢 updates.js: empHeader موجود؟ ' + (empHeader ? 'نعم' : 'لا'));
        if (empHeader && !document.getElementById('liveDateTimeEmp')) {
            var span = document.createElement('span');
            span.id = 'liveDateTimeEmp';
            span.style.cssText = 'font-weight:bold;color:#16a34a;white-space:nowrap;';
            var title = empHeader.querySelector('h1');
            if (title) {
                title.insertAdjacentElement('afterend', span);
            } else {
                empHeader.appendChild(span);
            }
            updateDateTime(span);
            setInterval(function() { updateDateTime(span); }, 1000);
            console.log('🟢 updates.js: تم إدراج التاريخ في واجهة الموظف');
        }
    }

    window.addEventListener('DOMContentLoaded', function() {
        console.log('🟢 updates.js: DOMContentLoaded حدث');
        waitForApp(function() {
            // نحاول الحقن فوراً
            injectDateTime();
            // وأيضاً بعد قليل في حال تأخر رسم الواجهة
            setTimeout(injectDateTime, 1000);
            setTimeout(injectDateTime, 3000);
        });
    });
})();
