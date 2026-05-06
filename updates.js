// ====== تحديث: عرض التاريخ والوقت ======
(function() {
    function waitForApp(callback) {
        if (typeof AppRenderer !== 'undefined' && typeof state !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForApp(callback), 50);
        }
    }
    function updateDateTime(element) {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        const dateStr = now.toLocaleDateString('ar-EG', options);
        const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        element.textContent = `${dateStr} - ${timeStr}`;
    }
    window.addEventListener('DOMContentLoaded', function() {
        waitForApp(function() {
            // للمدير
            const topbar = document.querySelector('.topbar');
            if (topbar && !document.getElementById('liveDateTime')) {
                const span = document.createElement('span');
                span.id = 'liveDateTime';
                span.style.cssText = 'margin:0 15px;font-weight:bold;color:var(--primary);white-space:nowrap;';
                const userSpan = topbar.querySelector('.text-sm');
                if (userSpan) {
                    userSpan.parentNode.insertBefore(span, userSpan);
                } else {
                    topbar.appendChild(span);
                }
                updateDateTime(span);
                setInterval(() => updateDateTime(span), 1000);
            }

            // للموظف
            const empHeader = document.querySelector('#app header.bg-white');
            if (empHeader && !document.getElementById('liveDateTimeEmp')) {
                const span = document.createElement('span');
                span.id = 'liveDateTimeEmp';
                span.style.cssText = 'font-weight:bold;color:var(--primary);white-space:nowrap;';
                const title = empHeader.querySelector('h1');
                if (title) {
                    title.insertAdjacentElement('afterend', span);
                } else {
                    empHeader.appendChild(span);
                }
                updateDateTime(span);
                setInterval(() => updateDateTime(span), 1000);
            }
        });
    });
})();
