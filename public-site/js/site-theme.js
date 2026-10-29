/**
 * site-theme.js — dark/light toggle shared by index.html and tools.html.
 * Preference is remembered in localStorage and stored with the attribute
 * [data-bs-theme] so Bootstrap 5's color modes keep everything consistent.
 */
(function (window, document) {
  'use strict';

  const STORAGE_KEY = 'clinictrack-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      const icon = btn.querySelector('.ct-theme-icon');
      const label = btn.querySelector('.ct-theme-label');
      if (icon) {
        icon.className = `bi ${theme === 'dark' ? 'bi-moon-stars-fill' : 'bi-sun-fill'} ct-theme-icon`;
      }
      if (label) {
        label.textContent = theme === 'dark' ? 'Dark' : 'Light';
      }
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-bs-theme') || 'light';
  }

  window.ClinicSiteTheme = {
    init: function () {
      const saved = localStorage.getItem(STORAGE_KEY);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(saved || (prefersDark ? 'dark' : 'light'));

      document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.addEventListener('click', function () {
          const next = currentTheme() === 'dark' ? 'light' : 'dark';
          localStorage.setItem(STORAGE_KEY, next);
          applyTheme(next);
        });
      });
    },
  };

  // Run on DOMContentLoaded when loaded as a plain page script.
  document.addEventListener('DOMContentLoaded', function () {
    window.ClinicSiteTheme.init();
  });
})(window, document);
