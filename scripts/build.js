'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'src/core.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/runtime.js'), 'utf8');
const output = `// ==UserScript==
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
${core}
${runtime}
})();
`;

fs.writeFileSync(path.join(root, 'WPFX网盘链接直达.user.js'), output, 'utf8');
console.log('Built WPFX网盘链接直达.user.js');
