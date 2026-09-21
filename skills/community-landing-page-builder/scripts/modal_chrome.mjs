/** Check visible text against the complete close target, including icon-only buttons. */
export async function inspectModalChrome(page, dialog) {
  return dialog.evaluate(container => {
    const close = container.querySelector('[data-close-modal], [data-close], .modal-close, button[aria-label*="Close" i], .close');
    if (!close) return { present: false, conflicts: [] };
    const box = close.getBoundingClientRect();
    const conflicts = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || close.contains(node)) continue;
      const parent = node.parentElement;
      if (parent.closest('script,style,[hidden],[aria-hidden="true"]')) continue;
      const style = getComputedStyle(parent);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const paintedRects = [...range.getClientRects()].map(r => {
        let left = r.left, right = r.right, top = r.top, bottom = r.bottom;
        for (let ancestor = parent; ancestor && ancestor !== container.parentElement; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor), clip = ancestor.getBoundingClientRect();
          if (style.overflowX !== 'visible') { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
          if (style.overflowY !== 'visible') { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
        }
        return { left, right, top, bottom };
      });
      if (paintedRects.some(r => Math.min(r.right, box.right) - Math.max(r.left, box.left) > 1 && Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top) > 1)) {
        conflicts.push(node.textContent.trim().slice(0, 160));
      }
    }
    return { present: true, conflicts, box: { x: box.x, y: box.y, width: box.width, height: box.height } };
  });
}
