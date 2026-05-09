// ====== تحديث: محرك التحديثات الذكي Pro Plus ======
(function() {
    console.log('🟢 Pro Plus: محرك التحديثات الذكي');

    // ---------- 1. نظام الحماية من الأعطال ----------
    // إذا تعطلت التحديثات، يعيد النظام لآخر حالة مستقرة
    let lastStableCode = '';
    let updateAppliedSuccessfully = false;

    window.addEventListener('error', function(e) {
        if (e.filename && e.filename.includes('updates.js')) {
            console.error('❌ خطأ في ملف التحديثات!', e.message);
            localStorage.setItem('drmedia_updates_failed', 'true');
            if (lastStableCode) {
                localStorage.setItem('drmedia_safe_code', lastStableCode);
            }
        }
    });

    // ---------- 2. محرر التحديثات المدمج ----------
    function initUpdateEditor() {
        // إضافة تبويب "محرر التحديثات" إلى القائمة
        if (!AppRenderer.pages.includes('updateEditor')) {
            AppRenderer.pages.push('updateEditor');
        }

        var sidebarContainer = document.querySelector('.sidebar .py-2');
        if (sidebarContainer && !document.querySelector('[data-page="updateEditor"]')) {
            var item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-page', 'updateEditor');
            item.onclick = function() { AppRenderer.navigateTo('updateEditor'); };
            item.innerHTML = '<span>🚀 محرر التحديثات</span>';
            sidebarContainer.appendChild(item);
        }

        AppRenderer.renderUpdateEditor = function() {
            var c = document.getElementById('content-area');
            if (!c) return;
            document.getElementById('pageTitle').textContent = '🚀 محرر التحديثات';

            // جلب الكود الحالي من localStorage أو من GitHub
            var currentCode = localStorage.getItem('drmedia_updates_code') || '';
            
            c.innerHTML = `
            <div class="bg-card">
                <h2 class="text-xl font-bold mb-4">🚀 محرر التحديثات المباشر</h2>
                <p class="text-sm text-gray-500 mb-4">اكتب كود JavaScript هنا وسيتم تطبيقه مباشرة على النظام</p>
                
                <div style="display:flex; gap:12px; margin-bottom:15px;">
                    <button onclick="window._testUpdateFromEditor()" class="btn-secondary">🧪 اختبار</button>
                    <button onclick="window._applyUpdateFromEditor()" class="btn-primary">💾 حفظ وتطبيق</button>
                    <button onclick="window._rollbackUpdate()" class="btn-danger">⏪ تراجع</button>
                </div>

                <textarea id="updateEditorCode" class="w-full border-2 p-3 rounded-xl font-mono text-sm" 
                rows="15" placeholder="// اكتب كود JavaScript هنا...">${currentCode}</textarea>
                
                <div id="updateEditorStatus" style="margin-top:10px;"></div>
            </div>`;

            // دوال عمومية
            window._testUpdateFromEditor = function() {
                var code = document.getElementById('updateEditorCode').value;
                try {
                    eval(code);
                    document.getElementById('updateEditorStatus').innerHTML = 
                        '<span style="color:green;">✅ تم الاختبار بنجاح - الكود يعمل</span>';
                } catch(e) {
                    document.getElementById('updateEditorStatus').innerHTML = 
                        `<span style="color:red;">❌ خطأ: ${e.message}</span>`;
                }
            };

            window._applyUpdateFromEditor = function() {
                var code = document.getElementById('updateEditorCode').value;
                localStorage.setItem('drmedia_updates_code', code);
                lastStableCode = code;
                
                var script = document.createElement('script');
                script.textContent = code;
                document.body.appendChild(script);
                
                document.getElementById('updateEditorStatus').innerHTML = 
                    '<span style="color:green;">✅ تم تطبيق التحديث وحفظه محلياً</span>';
                
                // محاولة رفعه إلى GitHub إذا كانت الإعدادات موجودة
                var ghSettings = JSON.parse(localStorage.getItem('drmedia_github_push') || '{}');
                if (ghSettings.token && ghSettings.repoOwner) {
                    uploadToGitHub(code, ghSettings);
                }
            };

            window._rollbackUpdate = function() {
                var safeCode = localStorage.getItem('drmedia_safe_code');
                if (safeCode) {
                    var script = document.createElement('script');
                    script.textContent = safeCode;
                    document.body.appendChild(script);
                    document.getElementById('updateEditorStatus').innerHTML = 
                        '<span style="color:orange;">⏪ تم التراجع لآخر نسخة مستقرة</span>';
                } else {
                    document.getElementById('updateEditorStatus').innerHTML = 
                        '<span style="color:gray;">لا توجد نسخة مستقرة محفوظة</span>';
                }
            };
        };
    }

    // ---------- 3. الرفع التلقائي إلى GitHub ----------
    async function uploadToGitHub(code, settings) {
        var apiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName || 'drmedia'}/contents/${settings.filePath || 'updates.js'}`;
        try {
            var getRes = await fetch(apiUrl, {
                headers: { 'Authorization': `token ${settings.token}` }
            });
            var sha = null;
            if (getRes.ok) {
                var fileData = await getRes.json();
                sha = fileData.sha;
            }
            var contentEncoded = btoa(unescape(encodeURIComponent(code)));
            var body = {
                message: 'تحديث ذكي من محرر النظام',
                content: contentEncoded,
                branch: 'main'
            };
            if (sha) body.sha = sha;
            await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${settings.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } catch(e) {}
    }

    // ---------- 4. التحديث التلقائي عند بدء التشغيل ----------
    function autoApplySavedUpdates() {
        var savedCode = localStorage.getItem('drmedia_updates_code');
        var failed = localStorage.getItem('drmedia_updates_failed');
        
        if (failed === 'true') {
            // استخدام آخر نسخة مستقرة
            savedCode = localStorage.getItem('drmedia_safe_code');
            localStorage.removeItem('drmedia_updates_failed');
        }

        if (savedCode) {
            var script = document.createElement('script');
            script.textContent = savedCode;
            document.body.appendChild(script);
            lastStableCode = savedCode;
        }
    }

    // ====== بدء التشغيل ======
    function init() {
        initUpdateEditor();
        autoApplySavedUpdates();
        console.log('✅ Pro Plus: محرك التحديثات الذكي جاهز');
    }

    window.addEventListener('DOMContentLoaded', function() {
        if (typeof AppRenderer !== 'undefined') {
            setTimeout(init, 1000);
        }
    });
})();