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
