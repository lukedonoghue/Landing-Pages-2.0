import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function ctaTexts(html) {
  const code = `from scripts.validate_funnel import FunnelParser\nimport json,sys\np=FunnelParser();p.feed(sys.stdin.read());print(json.dumps(p.cta_texts))`;
  const result = spawnSync('python3', ['-c', code], { input: html, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('CTA parsing excludes explicitly decorative aria-hidden descendants', () => {
  assert.deepEqual(ctaTexts('<button data-open-modal>Request quote <span aria-hidden="true">-&gt;</span></button>'), ['Request quote']);
  assert.deepEqual(ctaTexts('<button data-open-modal>Request quote <span>-&gt;</span></button>'), ['Request quote ->']);
});
