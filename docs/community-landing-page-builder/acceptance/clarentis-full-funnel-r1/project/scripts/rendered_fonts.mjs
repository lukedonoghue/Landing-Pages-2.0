/** Chromium font evidence for the exact text samples, not just their CSS stacks. */
export async function readRenderedFonts(page, samples) {
  const result = {};
  let session;
  try {
    session = await page.context().newCDPSession(page);
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    for (const [role, sample] of Object.entries(samples)) {
      if (!sample?.selector || !sample.text) continue;
      const selector = await page.evaluate(({ selector, text }) => {
        const normalize = value => value.trim().replace(/\s+/g, ' ').slice(0, 180);
        const element = [...document.querySelectorAll(selector)].find(node =>
          normalize(node.textContent) === text && node.getBoundingClientRect().height > 0);
        if (!element) return null;
        const parts = [];
        for (let node = element; node?.nodeType === 1; node = node.parentElement) {
          const siblings = node.parentElement ? [...node.parentElement.children].filter(sibling => sibling.tagName === node.tagName) : [node];
          parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
        }
        return parts.join(' > ');
      }, sample);
      if (!selector) { result[role] = []; continue; }
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      result[role] = fonts.filter(font => font.glyphCount > 0).sort((a, b) => b.glyphCount - a.glyphCount);
    }
    return { fonts: result, error: null };
  } catch (error) {
    return { fonts: result, error: error.message };
  } finally {
    if (session) await session.detach();
  }
}
