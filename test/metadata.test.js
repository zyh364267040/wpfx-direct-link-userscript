'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const userscript = fs.readFileSync(
  path.join(root, 'WPFX网盘链接直达.user.js'),
  'utf8'
);
const metadata = userscript.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);

test('发布元数据完整且版本固定为 1.0.1', () => {
  assert.ok(metadata, '缺少用户脚本元数据块');

  for (const line of [
    '// @version      1.0.1',
    '// @author       zyh364267040',
    '// @license      MIT',
    '// @homepageURL  https://github.com/zyh364267040/wpfx-direct-link-userscript',
    '// @supportURL   https://github.com/zyh364267040/wpfx-direct-link-userscript/issues',
  ]) {
    assert.match(metadata[0], new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('站点范围和权限保持严格', () => {
  assert.deepEqual(
    [...metadata[0].matchAll(/^\/\/ @match\s+(.+)$/gm)].map((match) => match[1]),
    ['https://wpfx.org/ziyuan/*', 'https://wpfx.org.cn/ziyuan/*']
  );
  assert.match(metadata[0], /^\/\/ @grant\s+none$/m);

  for (const forbidden of ['require', 'connect', 'downloadURL', 'updateURL']) {
    assert.doesNotMatch(metadata[0], new RegExp(`^// @${forbidden}\\b`, 'm'));
  }
});
