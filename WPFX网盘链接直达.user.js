// ==UserScript==
// @name         WPFX 网盘链接直达
// @namespace    https://wpfx.org/
// @version      1.0.0
// @description  将 WPFX 资源页的网盘按钮转换为经过校验的真实直达链接
// @author       zyh364267040
// @license      MIT
// @homepageURL  https://github.com/zyh364267040/wpfx-direct-link-userscript
// @supportURL   https://github.com/zyh364267040/wpfx-direct-link-userscript/issues
// @match        https://wpfx.org/ziyuan/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
'use strict';

const PROCESSED_ATTRIBUTE = 'data-wpfx-direct-link-processed';
const DISK_URL_ATTRIBUTE = 'data-disk-url';
const LINK_SELECTOR = `a.disk-link[${DISK_URL_ATTRIBUTE}]:not([${PROCESSED_ATTRIBUTE}])`;
const OBSERVER_OPTIONS = Object.freeze({
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [DISK_URL_ATTRIBUTE],
});
const QR_CONTENT_SELECTOR = [
  '.qrcode',
  '.qr-code',
  'img[src*="qrcode" i]',
  'img[src*="qr-code" i]',
  'img[alt*="二维码"]',
  'img[title*="二维码"]',
  'img[alt*="qr code" i]',
  'img[title*="qr code" i]',
].join(',');

function getHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function getDiskName(anchor) {
  const label = (anchor.textContent || '').trim();
  return label || '网盘';
}

function getSafeClassName(value) {
  if (typeof value !== 'string') return '';

  return value
    .split(/\s+/)
    .filter((className) => className && className !== 'disk-link')
    .join(' ');
}

function copySafePresentationAttributes(source, target) {
  const className = getSafeClassName(source.getAttribute('class'));
  if (className) target.setAttribute('class', className);

  for (const name of ['style', 'title', 'aria-label']) {
    const value = source.getAttribute(name);
    if (value !== null) target.setAttribute(name, value);
  }
}

function convertDiskLink(anchor, documentRef) {
  if (!anchor || anchor.tagName !== 'A') return null;
  if (anchor.hasAttribute(PROCESSED_ATTRIBUTE)) return anchor;

  const url = getHttpUrl(anchor.getAttribute(DISK_URL_ATTRIBUTE));
  if (!url) return null;

  const diskName = getDiskName(anchor);
  const replacement = documentRef.createElement('a');
  copySafePresentationAttributes(anchor, replacement);
  replacement.setAttribute('href', url);
  replacement.setAttribute('target', '_blank');
  replacement.setAttribute('rel', 'nofollow noopener noreferrer');
  replacement.setAttribute(PROCESSED_ATTRIBUTE, 'true');

  const badge = documentRef.createElement('span');
  badge.setAttribute('data-wpfx-direct-link-badge', 'true');
  badge.setAttribute(
    'style',
    'font-size:.75em;opacity:.65;margin-left:.55em;font-weight:normal;white-space:nowrap;'
  );
  badge.textContent = '已转为直达链接';
  replacement.replaceChildren(`${diskName}：${url} `, badge);

  anchor.replaceWith(replacement);
  return replacement;
}

function hasExplicitQrContent(element) {
  return Boolean(
    element
    && typeof element.querySelector === 'function'
    && element.querySelector(QR_CONTENT_SELECTOR)
  );
}

function collectMutationRoots(records, elementNodeType = 1) {
  const roots = new Set();

  for (const record of records) {
    if (
      record.type === 'attributes'
      && record.attributeName === DISK_URL_ATTRIBUTE
      && record.target?.nodeType === elementNodeType
    ) {
      roots.add(record.target);
    }

    if (record.type !== 'childList') continue;
    for (const node of record.addedNodes || []) {
      if (node.nodeType === elementNodeType) roots.add(node);
    }
  }

  return roots;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PROCESSED_ATTRIBUTE,
    DISK_URL_ATTRIBUTE,
    LINK_SELECTOR,
    OBSERVER_OPTIONS,
    QR_CONTENT_SELECTOR,
    getHttpUrl,
    getSafeClassName,
    copySafePresentationAttributes,
    convertDiskLink,
    hasExplicitQrContent,
    collectMutationRoots,
  };
}

function removeQrDialogs(root = document) {
  const selectors = [
    '.qrcode-modal-overlay',
    '.qrcode-modal',
    '.qr-code-modal',
    '.qr-modal',
    '#qrcode-modal',
    '#qr-code-modal',
    '[role="dialog"][class*="qrcode" i]',
    '[role="dialog"][class*="qr-code" i]',
  ];

  for (const dialog of root.querySelectorAll(selectors.join(','))) {
    dialog.remove();
  }

  // WPFX 的二维码层若使用通用 modal 类，只在其中确有二维码节点时移除。
  for (const dialog of root.querySelectorAll('.modal, .popup, .dialog, [role="dialog"]')) {
    if (hasExplicitQrContent(dialog)) dialog.remove();
  }
}

function processRoot(root) {
  const anchors = [];
  if (root.nodeType === Node.ELEMENT_NODE && root.matches(LINK_SELECTOR)) {
    anchors.push(root);
  }
  if (typeof root.querySelectorAll === 'function') {
    anchors.push(...root.querySelectorAll(LINK_SELECTOR));
  }

  for (const anchor of anchors) {
    convertDiskLink(anchor, document);
  }
}

function start() {
  processRoot(document);
  removeQrDialogs();

  const pendingRoots = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const roots = [...pendingRoots];
    pendingRoots.clear();
    for (const root of roots) processRoot(root);
    removeQrDialogs();
  };

  const observer = new MutationObserver((records) => {
    for (const root of collectMutationRoots(records, Node.ELEMENT_NODE)) pendingRoots.add(root);
    if (pendingRoots.size > 0 && !scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });

  observer.observe(document.documentElement, OBSERVER_OPTIONS);
}

start();

})();
