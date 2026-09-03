'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getHttpUrl,
  getSafeClassName,
  convertDiskLink,
  hasExplicitQrContent,
  collectMutationRoots,
  PROCESSED_ATTRIBUTE,
  OBSERVER_OPTIONS,
} = require('../src/core.js');

class FakeElement {
  constructor(tagName, attributes = {}, textContent = '') {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.textContent = textContent;
    this.children = [];
    this.parentNode = null;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  replaceChildren(...children) {
    this.children = children;
    this.textContent = children.map((child) => (
      typeof child === 'string' ? child : child.textContent
    )).join('');
  }

  replaceWith(replacement) {
    this.replacement = replacement;
    replacement.parentNode = this.parentNode;
  }

  append(child) {
    this.children.push(child);
  }
}

const fakeDocument = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
};

test('只接受 http/https 绝对地址', () => {
  assert.equal(getHttpUrl('https://pan.example.com/s/abc?pwd=1234'), 'https://pan.example.com/s/abc?pwd=1234');
  assert.equal(getHttpUrl('http://example.com/file'), 'http://example.com/file');
});

test('拒绝 javascript、ftp 和相对地址', () => {
  assert.equal(getHttpUrl('javascript:alert(1)'), null);
  assert.equal(getHttpUrl('ftp://example.com/file'), null);
  assert.equal(getHttpUrl('/relative/path'), null);
  assert.equal(getHttpUrl(''), null);
});

test('新建干净链接，只复制展示属性并过滤 disk-link 类', () => {
  const original = new FakeElement('a', {
    class: 'disk-link button primary disk-link',
    style: 'color: red',
    title: '打开网盘',
    'aria-label': '夸克网盘直达',
    href: 'javascript:void(0)',
    onclick: 'steal()',
    ping: 'https://tracker.example.com/',
    download: 'secret.zip',
    'data-disk-url': 'https://pan.example.com/s/full?pwd=9x9x',
  }, '夸克网盘');

  const replacement = convertDiskLink(original, fakeDocument);

  assert.notEqual(replacement, original);
  assert.equal(original.replacement, replacement);
  assert.equal(replacement.getAttribute('class'), 'button primary');
  assert.equal(replacement.getAttribute('style'), 'color: red');
  assert.equal(replacement.getAttribute('title'), '打开网盘');
  assert.equal(replacement.getAttribute('aria-label'), '夸克网盘直达');
  assert.equal(replacement.getAttribute('href'), 'https://pan.example.com/s/full?pwd=9x9x');
  assert.equal(replacement.getAttribute('target'), '_blank');
  assert.equal(replacement.getAttribute('rel'), 'nofollow noopener noreferrer');
  assert.equal(replacement.getAttribute(PROCESSED_ATTRIBUTE), 'true');
  for (const name of ['onclick', 'ping', 'download', 'data-disk-url']) {
    assert.equal(replacement.getAttribute(name), null, `${name} 不应复制`);
  }
  assert.match(replacement.textContent, /^夸克网盘：https:\/\/pan\.example\.com\/s\/full\?pwd=9x9x/);
  assert.match(replacement.textContent, /已转为直达链接$/);
});

test('class 清理只移除完整的 disk-link 类名', () => {
  assert.equal(getSafeClassName(' disk-link button disk-link-extra primary '), 'button disk-link-extra primary');
  assert.equal(getSafeClassName('disk-link'), '');
  assert.equal(getSafeClassName(null), '');
});

test('无效地址不处理，已处理节点保持幂等', () => {
  const invalid = new FakeElement('a', {
    class: 'disk-link',
    'data-disk-url': 'javascript:alert(1)',
  }, '危险链接');
  assert.equal(convertDiskLink(invalid, fakeDocument), null);
  assert.equal(invalid.replacement, undefined);

  const done = new FakeElement('a', {
    class: 'disk-link',
    'data-disk-url': 'https://example.com/file',
    [PROCESSED_ATTRIBUTE]: 'true',
  }, '已经完成');
  assert.equal(convertDiskLink(done, fakeDocument), done);
  assert.equal(done.replacement, undefined);

  const original = new FakeElement('a', {
    class: 'disk-link button',
    'data-disk-url': 'https://example.com/file',
  }, '网盘');
  const replacement = convertDiskLink(original, fakeDocument);
  assert.equal(convertDiskLink(replacement, fakeDocument), replacement);
  assert.equal(replacement.replacement, undefined);
});

test('二维码识别要求明确的类名或图片特征，不把任意 canvas 当二维码', () => {
  const selectors = [];
  const canvasOnlyDialog = {
    querySelector(selector) {
      selectors.push(selector);
      return selector.includes('canvas') ? {} : null;
    },
  };
  assert.equal(hasExplicitQrContent(canvasOnlyDialog), false);
  assert.equal(selectors[0].includes('canvas'), false);

  const qrDialog = {
    querySelector(selector) {
      return selector.includes('.qrcode') ? { className: 'qrcode' } : null;
    },
  };
  assert.equal(hasExplicitQrContent(qrDialog), true);
});

test('观察器收集新增节点及后赋值 data-disk-url 的目标并去重', () => {
  const inserted = { nodeType: 1 };
  const assignedLater = { nodeType: 1 };
  const roots = collectMutationRoots([
    { type: 'childList', addedNodes: [inserted, { nodeType: 3 }] },
    { type: 'attributes', attributeName: 'data-disk-url', target: assignedLater },
    { type: 'attributes', attributeName: 'data-disk-url', target: inserted },
    { type: 'attributes', attributeName: 'class', target: assignedLater },
  ]);

  assert.deepEqual([...roots], [inserted, assignedLater]);
  assert.deepEqual(OBSERVER_OPTIONS, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-disk-url'],
  });
});
