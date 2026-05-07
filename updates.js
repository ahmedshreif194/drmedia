// ====== تحديث: عرض التاريخ والوقت (لاختبار الرابط) ======
(function() {
    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
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

    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(function() {
            // شاشة المدير
            var topbar = document.querySelector('.topbar');
            if (topbar && !document.getElementById('liveDateTime')) {
                var span = document.createElement('span');
                span.id = 'liveDateTime';
                span.style.cssText = 'margin:0 15px;font-weight:bold;color:var(--primary);white-space:nowrap;';
                var userSpan = topbar.querySelector('.text-sm');
                if (userSpan) {
                    userSpan.parentNode.insertBefore(span, userSpan);
                } else {
                    topbar.appendChild(span);
                }
                updateDateTime(span);
                setInterval(function() { updateDateTime(span); }, 1000);
            }

            // شاشة الموظف
            var empHeader = document.querySelector('#app header.bg-white');
            if (empHeader && !document.getElementById('liveDateTimeEmp')) {
                var span = document.createElement('span');
                span.id = 'liveDateTimeEmp';
                span.style.cssText = 'font-weight:bold;color:var(--primary);white-space:nowrap;';
                var title = empHeader.querySelector('h1');
                if (title) {
                    title.insertAdjacentElement('afterend', span);
                } else {
                    empHeader.appendChild(span);
                }
                updateDateTime(span);
                setInterval(function() { updateDateTime(span); }, 1000);
            }
        });
    });
})();
