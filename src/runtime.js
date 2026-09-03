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
