'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'src/core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/runtime.js'), 'utf8'),
].join('\n');

class RuntimeElement {
  constructor(tagName, attributes = {}, textContent = '') {
    this.nodeType = 1;
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

  matches(selector) {
    const classes = (this.getAttribute('class') || '').split(/\s+/);
    return selector.startsWith('a.disk-link[')
      && this.tagName === 'A'
      && classes.includes('disk-link')
      && this.hasAttribute('data-disk-url')
      && !this.hasAttribute('data-wpfx-direct-link-processed');
  }

  querySelectorAll(selector) {
    if (!selector.startsWith('a.disk-link[')) return [];

    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  querySelector() {
    return null;
  }

  replaceChildren(...children) {
    this.children = children.filter((child) => typeof child !== 'string');
    this.textContent = children.map((child) => (
      typeof child === 'string' ? child : child.textContent
    )).join('');
  }

  replaceWith(replacement) {
    this.replacement = replacement;
    replacement.parentNode = this.parentNode;
    if (!this.parentNode) return;

    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) this.parentNode.children[index] = replacement;
  }

  append(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  remove() {}
}

test('运行时处理先插入后赋值的链接，替换节点不会触发重复转换', () => {
  const documentElement = new RuntimeElement('html');
  const documentRef = {
    nodeType: 9,
    documentElement,
    createElement(tagName) {
      return new RuntimeElement(tagName);
    },
    querySelectorAll(selector) {
      return documentElement.querySelectorAll(selector);
    },
  };
  let observerInstance;

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      observerInstance = this;
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
    }
  }

  vm.runInNewContext(source, {
    document: documentRef,
    MutationObserver: FakeMutationObserver,
    Node: { ELEMENT_NODE: 1 },
    URL,
    queueMicrotask(callback) {
      callback();
    },
  });

  assert.equal(observerInstance.target, documentElement);
  assert.deepEqual(JSON.parse(JSON.stringify(observerInstance.options)), {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-disk-url'],
  });

  const anchor = new RuntimeElement('a', { class: 'disk-link button' }, '百度网盘');
  documentElement.append(anchor);
  observerInstance.callback([{
    type: 'childList',
    addedNodes: [anchor],
  }]);
  assert.equal(anchor.replacement, undefined);

  anchor.setAttribute('data-disk-url', 'https://pan.example.com/s/late');
  observerInstance.callback([{
    type: 'attributes',
    attributeName: 'data-disk-url',
    target: anchor,
  }]);

  const replacement = anchor.replacement;
  assert.ok(replacement);
  assert.equal(documentElement.children[0], replacement);
  assert.equal(replacement.getAttribute('class'), 'button');
  assert.equal(replacement.getAttribute('data-disk-url'), null);
  assert.equal(replacement.getAttribute('data-wpfx-direct-link-processed'), 'true');

  observerInstance.callback([{
    type: 'childList',
    addedNodes: [replacement],
  }]);
  assert.equal(documentElement.children[0], replacement);
  assert.equal(replacement.replacement, undefined);
});
