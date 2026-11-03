/* ==========================================================================
   叫我城南好不好 · 站点脚本
   纯原生 JS，无外部依赖。
   功能：移动端导航、页脚年份、复制校验值、下载页更新检测（/zhiren/update.json）
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    initNav();
    initYear();
    initCopy();
    initUpdatePanel();
  }

  /* --------------------------- 移动端导航 --------------------------- */
  function initNav() {
    var toggle = doc.querySelector('[data-nav-toggle]');
    var nav = doc.querySelector('#site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (event) {
      if (event.target && event.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --------------------------- 页脚年份 ---------------------------- */
  function initYear() {
    var nodes = doc.querySelectorAll('[data-year]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = String(new Date().getFullYear());
    }
  }

  /* --------------------------- 复制校验值 --------------------------- */
  function initCopy() {
    var buttons = doc.querySelectorAll('[data-copy]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          var selector = btn.getAttribute('data-copy');
          var target = selector ? doc.querySelector(selector) : null;
          if (!target) return;
          var text = (target.textContent || '').trim();
          if (!text) return;
          copyText(text).then(function (ok) {
            btn.textContent = ok ? '已复制' : '复制失败';
            btn.classList.toggle('is-copied', ok);
            window.setTimeout(function () {
              btn.textContent = btn.getAttribute('data-copy-label') || '复制';
              btn.classList.remove('is-copied');
            }, 1600);
          });
        });
      })(buttons[i]);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(text);
        }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var area = doc.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'absolute';
      area.style.left = '-9999px';
      doc.body.appendChild(area);
      area.select();
      var ok = doc.execCommand('copy');
      doc.body.removeChild(area);
      return ok;
    } catch (error) {
      return false;
    }
  }

  /* --------------------------- 更新检测 ---------------------------- */
  /* 站点部署在 /zhiren/download/ 下，故 ../update.json => /zhiren/update.json。
     纯静态托管时无法在运行时写文件，发布新版本只需更新该 JSON。
     兼容三种写法：
       1) 应用内更新检测使用字符串 URL： "windows_zip": "https://..."
       2) 站点下载页需要展示文件名/大小/SHA256：额外读 "windows_zip_meta": {...}
       3) 旧版单对象写法： "windows_zip": {"url": "...", "size": 0, "sha256": ""} */
  var UPDATE_URL = '../update.json';

  function initUpdatePanel() {
    var panel = doc.querySelector('[data-update-panel]');
    if (!panel) return;
    var statusEl = doc.querySelector('[data-update-status]');
    var latestEl = doc.querySelector('[data-latest-version]');
    var releasedEl = doc.querySelector('[data-latest-released]');
    var checkBtn = doc.querySelector('[data-check-update]');
    var currentVersion = panel.getAttribute('data-current-version') || '';

    function load(isManual) {
      setStatus(isManual ? '正在检查更新…' : '正在获取最新版本信息…', '');
      if (checkBtn) checkBtn.disabled = true;
      fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          applyUpdate(data, currentVersion, {
            latestEl: latestEl,
            releasedEl: releasedEl,
            statusEl: statusEl
          });
        })
        .catch(function (error) {
          if (latestEl) latestEl.textContent = '获取失败';
          if (releasedEl) releasedEl.textContent = '—';
          setStatus(
            '暂时无法获取更新信息（' +
              (error && error.message ? error.message : '网络异常') +
              '）。上方下载按钮仍可用；也可以去 GitHub Releases 看看。',
            'warn'
          );
        })
        .then(function () {
          if (checkBtn) checkBtn.disabled = false;
        });
    }

    if (checkBtn) {
      checkBtn.addEventListener('click', function () {
        load(true);
      });
    }
    load(false);

    function setStatus(text, kind) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className = 'update-status' + (kind ? ' is-' + kind : '');
    }
  }

  function applyUpdate(data, currentVersion, refs) {
    if (!data || typeof data !== 'object') return;
    var version = String(data.version || '').trim();
    if (refs.latestEl) refs.latestEl.textContent = version ? 'v' + version : '未知';
    if (refs.releasedEl) refs.releasedEl.textContent = data.released_at || '—';

    var statusEl = refs.statusEl;
    if (statusEl) {
      if (!version) {
        statusEl.textContent = '更新信息缺少版本号，请稍后再试。';
        statusEl.className = 'update-status is-warn';
      } else if (!currentVersion || compareVersion(version, currentVersion) <= 0) {
        statusEl.textContent = '已是最新版本（v' + currentVersion + '），不用更新。';
        statusEl.className = 'update-status is-ok';
      } else {
        statusEl.textContent =
          '发现新版本 v' + version + '，建议下载覆盖安装（升级前先导出备份更稳妥）。';
        statusEl.className = 'update-status is-ok';
      }
    }

    fillAsset('windows_setup', assetOf(data, 'windows_setup'), '安装版');
    fillAsset('windows_zip', assetOf(data, 'windows_zip'), '绿色版');
    fillAsset('android_apk', assetOf(data, 'android_apk'), 'Android APK');

    var versionRows = doc.querySelectorAll('[data-version-row]');
    for (var i = 0; i < versionRows.length; i++) {
      if (versionRows[i].getAttribute('data-version-row') === version) {
        versionRows[i].setAttribute('data-latest', 'true');
      }
    }
  }

  function assetOf(data, key) {
    var direct = data[key];
    var meta = data[key + '_meta'];
    if (direct && typeof direct === 'object') {
      return {
        url: direct.url || '',
        filename: direct.filename || (meta && meta.filename) || '',
        size: Number(direct.size || (meta && meta.size) || 0),
        sha256: direct.sha256 || (meta && meta.sha256) || ''
      };
    }
    return {
      url: typeof direct === 'string' ? direct : '',
      filename: (meta && meta.filename) || '',
      size: Number((meta && meta.size) || 0),
      sha256: (meta && meta.sha256) || ''
    };
  }

  function fillAsset(key, asset, label) {
    var available = !!asset.url;
    var buttons = doc.querySelectorAll('[data-download="' + key + '"]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (available) {
        btn.setAttribute('href', asset.url);
        btn.removeAttribute('aria-disabled');
        btn.classList.remove('is-disabled');
        btn.textContent = btn.getAttribute('data-label-default') || '下载' + label;
      } else {
        btn.removeAttribute('href');
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('is-disabled');
        btn.textContent = btn.getAttribute('data-label-empty') || '暂未提供';
      }
    }
    setText('[data-size-for="' + key + '"]', available ? formatBytes(asset.size) : '—');
    setText('[data-file-for="' + key + '"]', available ? asset.filename || '—' : '—');
    setText(
      '[data-sha-for="' + key + '"]',
      available ? (asset.sha256 || '发布后更新') : '—'
    );

    var copyButtons = doc.querySelectorAll('[data-copy]');
    for (var j = 0; j < copyButtons.length; j++) {
      if (copyButtons[j].getAttribute('data-copy') === '[data-sha-for="' + key + '"]') {
        var canCopy = available && !!asset.sha256;
        copyButtons[j].disabled = !canCopy;
        if (!canCopy) copyButtons[j].textContent = '待更新';
      }
    }
  }

  function setText(selector, text) {
    var nodes = doc.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = text;
    }
  }

  function formatBytes(bytes) {
    var value = Number(bytes) || 0;
    if (value <= 0) return '—';
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    return (value / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function compareVersion(a, b) {
    var pa = String(a).split('.');
    var pb = String(b).split('.');
    var length = Math.max(pa.length, pb.length);
    for (var i = 0; i < length; i++) {
      var na = parseInt(pa[i] || '0', 10) || 0;
      var nb = parseInt(pb[i] || '0', 10) || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
})();
