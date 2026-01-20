(function () {
  const DEFAULT_LANG = 'en';
  let translations = {};
  let currentLang = DEFAULT_LANG;

  async function loadTranslations() {
    try {
      const res = await fetch('translate.json', { cache: 'no-store' });
      translations = await res.json();
    } catch (e) {
      console.error('Failed to load translations', e);
      translations = { en: {}, fr: {} };
    }
  }

  function translatePage() {
    const dict = translations[currentLang] || {};
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      if (dict[key]) {
        if (el.placeholder !== undefined && el.tagName === 'INPUT') {
          el.placeholder = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });

    // titles/placeholders via data-i18n-title / data-i18n-placeholder
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (translations[currentLang] && translations[currentLang][key]) el.title = translations[currentLang][key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (translations[currentLang] && translations[currentLang][key]) el.placeholder = translations[currentLang][key];
    });

    // set lang attribute on html
    document.documentElement.lang = currentLang;
  }

  function setupSwitcher() {
    const sel = document.getElementById('lang-select');
    if (!sel) return;
    sel.value = currentLang;
    sel.addEventListener('change', (e) => {
      currentLang = e.target.value;
      localStorage.setItem('lang', currentLang);
      translatePage();
    });
  }

  async function init() {
    await loadTranslations();
    // default to English per request, prefer persisted choice
    currentLang = localStorage.getItem('lang') || 'en';
    translatePage();
    // create a floating switch only on index page when no inline switch exists
    const path = window.location.pathname.split('/').pop().toLowerCase();
    const isIndex = (path === '' || path === 'index.html');
    if (!document.getElementById('lang-select') && isIndex) {
      const container = document.createElement('div');
      container.id = 'lang-switcher-float';
      container.style.position = 'fixed';
      container.style.right = '12px';
      container.style.bottom = '12px';
      container.style.zIndex = '9999';
      container.style.background = 'rgba(255,255,255,0.95)';
      container.style.border = '1px solid #e5e7eb';
      container.style.padding = '6px';
      container.style.borderRadius = '6px';
      container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
      container.innerHTML = '<label style="font-size:12px; color:#374151; margin-right:6px;">Lang</label>' +
        '<select id="lang-select" aria-label="Language switch" style="padding:6px; border-radius:4px;">' +
        '<option value="en">EN</option><option value="fr">FR</option></select>';
      document.body.appendChild(container);
    }
    setupSwitcher();
  }

  // expose for console
  window.i18n = {
    setLang: (l) => { currentLang = l; translatePage(); },
    getLang: () => currentLang
  };

  document.addEventListener('DOMContentLoaded', init);
})();
