import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path, encoding = 'utf8') => readFileSync(join(root, path), encoding);
const html = read('public/index.html');
const css = read('public/styles.css');
const copy = JSON.parse(read('build/page-copy.json'));

test('canonical offer, modal CTAs, demo phone, and PDF delivery stay aligned', () => {
  assert.match(html, new RegExp(`<h1 id="hero-title">${copy.h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`));

  const modalCtas = [...html.matchAll(/<button\b[^>]*data-open-modal[^>]*>([^<]+)<\/button>/g)].map((match) => match[1].trim());
  assert.equal(modalCtas.length, 5);
  assert.deepEqual(new Set(modalCtas), new Set([copy.primary_cta]));
  assert.equal(copy.primary_cta, 'Try the Consultation Form');
  assert.match(html, /<h2 id="lead-modal-title">Consultation Form Demo<\/h2>/);
  assert.match(html, /<button type="submit" data-submit hidden>Save Demo Request<\/button>/);

  assert.match(html, /class="hero-phone"[^>]*>Business phone <span>\(demo only\)<\/span>: \(785\) 760-7663<\/p>/);
  assert.doesNotMatch(html, /href=["']tel:/i);
  assert.match(html, /href="\/assets\/bookkeeping-month-end-clarity-checklist\.pdf" download>Download the Month-End Checklist<\/a>/);
});

test('Lora is locally bundled with matching provenance and no viewport-sized fonts', () => {
  assert.match(css, /@font-face\s*{[^}]*font-family:\s*"Lora";[^}]*lora-latin-400-700\.woff2[^}]*font-weight:\s*400 700;/s);
  assert.doesNotMatch(css, /font-size\s*:[^;}]+(?:vw|vh|vmin|vmax)/i);

  const provenance = JSON.parse(read('public/assets/fonts/lora/provenance.json'));
  const font = read('public/assets/fonts/lora/lora-latin-400-700.woff2', null);
  const digest = createHash('sha256').update(font).digest('hex');
  assert.equal(digest, provenance.bundled_font_sha256);
  assert.equal(provenance.family, 'Lora');
  assert.equal(provenance.license, 'SIL Open Font License 1.1');
  assert.match(read('public/assets/fonts/lora/OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
});

test('responsive image frames preserve the guide and cleanup source ratios', () => {
  assert.match(css, /\.section-figure img\s*{[^}]*height:\s*auto;[^}]*aspect-ratio:\s*4 \/ 3;[^}]*object-fit:\s*cover;/s);
  assert.match(css, /\.guide-preview img\s*{[^}]*height:\s*auto;[^}]*aspect-ratio:\s*auto;[^}]*object-fit:\s*contain;/s);
  assert.match(css, /\.dashboard-figure\s*{[^}]*min-height:\s*0;[^}]*aspect-ratio:\s*3 \/ 2;[^}]*align-self:\s*center;/s);
  assert.match(css, /\.dashboard-figure img\s*{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*object-fit:\s*cover;/s);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*?\.dashboard-section\s*{\s*grid-template-columns:\s*1fr;\s*}[\s\S]*?\.dashboard-figure\s*{\s*order:\s*-1;\s*align-self:\s*stretch;\s*}/);

  const imageRoles = new Set([...`${html}\n${css}`.matchAll(/(?:hero-ledger-workspace|cleanup-organized-records|dashboard-conversation|guide-cover)/g)].map((match) => match[0]));
  assert.deepEqual(imageRoles, new Set(['hero-ledger-workspace', 'cleanup-organized-records', 'dashboard-conversation', 'guide-cover']));
});

test('mobile hero disclosure stays in flow below the phone', () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.hero\s*{[^}]*flex-direction:\s*column;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.hero-disclosure\s*{[^}]*position:\s*static;[^}]*align-self:\s*stretch;[^}]*margin:\s*14px 0 0;/);
});

test('modal heading space and visitor-facing copy regressions remain fixed', () => {
  assert.match(css, /\.modal \.eyebrow, \.modal h2\s*{\s*padding-right:\s*52px;\s*}/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*\.modal \.eyebrow, \.modal h2\s*{\s*padding-right:\s*58px;/);

  for (const phrase of [
    'Bookkeeping first.',
    'If you later need',
    'Define the bookkeeping need first',
    'included by default',
    'Those published roles support',
    'publicly identifies as its preference',
    'also publishes custom KPI',
    'The official site also names',
    'published service set'
  ]) {
    assert.equal(html.includes(phrase), false, `research narration returned: ${phrase}`);
  }

  assert.match(html, /The Lawrence Chamber directory lists Bookkeeping by Beks as a Custom KPI Dashboard Builder, Strategic Advisor, and QuickBooks Online ProAdvisor\./);
  assert.match(html, /These are directory-listed service roles, not performance results or certification claims\./);
});
