/* =========================================================
   Dr Media Pro — UPDATE PACK
   File: update.js
   Purpose: Fix login in sandboxed iframes + ready for future
   Version: 1.1.0
   =========================================================
   ⚠️ DO NOT edit index.html — everything lives here.
   ========================================================= */

(function () {
  'use strict';

  console.log('%c[DrMedia Update] Loading…', 'color:#7c3aed;font-weight:bold');

  /* =========================================================
     1. LOGIN SANDBOX FIX
     ---------------------------------------------------------
     Problem:  Browser sandbox blocks <form> submission.
     Solution: Convert submit button to plain button + handle
               click directly. No form submission at all.
     ========================================================= */
  function patchLogin() {
    const form      = document.getElementById('login-form');
    const btn       = document.querySelector('.btn-login');
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-pass');

    if (!form || !btn || !userInput || !passInput) {
      console.warn('[DrMedia] Login elements not found');
      return false;
    }

    // --- Defensive: kill the form's submit event entirely ---
    form.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      },
      true // capture phase — runs before any other listener
    );
    form.onsubmit = function () { return false; };

    // --- The actual login handler ---
    function doLogin(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const u = userInput.value.trim();
      const p = passInput.value;

      // Safety check — app must be fully booted
      if (typeof window.attemptLogin !== 'function') {
        console.error('[DrMedia] attemptLogin not available');
        alert('System not ready. Please refresh the page.');
        return false;
      }

      let ok = false;
      try {
        ok = window.attemptLogin(u, p);
      } catch (err) {
        console.error('[DrMedia] Login error:', err);
        if (typeof window.showToast === 'function') {
          window.showToast('خطأ في تسجيل الدخول', 'error');
        }
        return false;
      }

      if (ok) {
        if (typeof window.showToast === 'function') {
          window.showToast('تم تسجيل الدخول بنجاح', 'success');
        }
        if (typeof window.startApp === 'function') {
          window.startApp();
        }
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast('بيانات الدخول غير صحيحة', 'error');
        } else {
          alert('Invalid credentials — try admin / admin');
        }
      }
      return false;
    }

    // --- Replace button with a clean clone (removes old listeners) ---
    const newBtn = btn.cloneNode(true);
    newBtn.setAttribute('type', 'button');
    newBtn.removeAttribute('type');
    newBtn.setAttribute('type', 'button'); // ensure it's a plain button
    newBtn.id = 'login-btn-patched';
    btn.parentNode.replaceChild(newBtn, btn);

    // Attach our click handler
    newBtn.addEventListener('click', doLogin);

    // --- Enter key in password → login ---
    passInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLogin(e);
      }
    });

    // --- Enter key in username → login (nicer UX) ---
    userInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLogin(e);
      }
    });

    console.log(
      '%c[DrMedia] ✓ Login patched — sandbox-safe',
      'color:#10b981;font-weight:bold'
    );
    return true;
  }

  /* =========================================================
     2. WAIT FOR THE APP TO BOOT, THEN PATCH
     ========================================================= */
  function waitForAppAndPatch() {
    let tries = 0;
    const MAX_TRIES = 60; // 6 seconds max

    const interval = setInterval(function () {
      tries++;

      const btnExists = !!document.querySelector('.btn-login');
      const funcsReady =
        typeof window.attemptLogin === 'function' &&
        typeof window.startApp === 'function';

      if (btnExists && funcsReady) {
        clearInterval(interval);
        // Small delay so index.html's own boot() runs first
        setTimeout(patchLogin, 50);
      } else if (tries >= MAX_TRIES) {
        clearInterval(interval);
        console.warn(
          '[DrMedia] Timeout waiting for app boot. attemptLogin:',
          typeof window.attemptLogin,
          'startApp:',
          typeof window.startApp,
          'btn:',
          btnExists
        );
      }
    }, 100);
  }

  /* =========================================================
     3. BOOT — run after DOM is ready
     ========================================================= */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Delay slightly to let index.html's DOMContentLoaded handler run first
      setTimeout(waitForAppAndPatch, 100);
    });
  } else {
    // DOM already loaded (update.js loaded dynamically)
    setTimeout(waitForAppAndPatch, 100);
  }

  /* =========================================================
     FUTURE FEATURES GO BELOW
     (Firebase, Counters tab, etc. — added in later versions)
     ========================================================= */

})();
