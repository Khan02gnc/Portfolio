/* ============================================================
   MedySystem — Theme Manager
   Handles dark / light mode toggle with localStorage persistence
   and smooth CSS transitions.

   Usage:
     1. Include this script in every page (before </body>):
          <script src="assets/js/theme.js"></script>

     2. Add a toggle button anywhere with class="theme-toggle"
        (admin / portal pages) or class="login-theme-toggle"
        (login / register pages).

     3. The script reads saved preference on load and applies it
        immediately, preventing flash-of-wrong-theme (FOUT).
============================================================ */

(function () {
  'use strict';

  // ── Apply theme immediately on parse (prevents FOUT) ──────
  var saved = localStorage.getItem('medy-theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = saved || (prefersDark ? 'dark' : 'light');

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // ── Core toggle function ───────────────────────────────────
  function toggle() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';

    // Add transition class for smooth color switch
    document.documentElement.classList.add('theme-transitioning');

    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    localStorage.setItem('medy-theme', next);

    // Remove transition class after animation completes
    setTimeout(function () {
      document.documentElement.classList.remove('theme-transitioning');
    }, 300);
  }

  // ── Wire up buttons after DOM is ready ────────────────────
  function wireButtons() {
    var selectors = ['.theme-toggle', '.login-theme-toggle'];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (btn) {
        // Avoid double-binding
        if (btn.dataset.themeWired) return;
        btn.dataset.themeWired = '1';
        btn.addEventListener('click', toggle);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButtons);
  } else {
    wireButtons();
  }

  // ── Also re-wire when new buttons appear (SPA-friendly) ───
  if (window.MutationObserver) {
    var observer = new MutationObserver(function () {
      wireButtons();
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ── Sync with OS preference changes ───────────────────────
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      // Only follow OS if user hasn't explicitly chosen
      if (!localStorage.getItem('medy-theme')) {
        if (e.matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────
  window.ThemeManager = {
    toggle: toggle,
    get: function () {
      return document.documentElement.getAttribute('data-theme') || 'light';
    },
    set: function (t) {
      if (t === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem('medy-theme', t);
    }
  };

})();