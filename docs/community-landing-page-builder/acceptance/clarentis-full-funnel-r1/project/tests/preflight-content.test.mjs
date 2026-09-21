import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUnfinishedStarterContent} from '../scripts/preflight-content.mjs';

test('legitimate business-step legend is not starter content', () => {
  assert.equal(hasUnfinishedStarterContent('<fieldset><legend>Your business</legend></fieldset>'), false);
});

test('known starter copy and title remain blocked', () => {
  assert.equal(hasUnfinishedStarterContent('<p>Replace this starter with your approved client content</p>'), true);
  assert.equal(hasUnfinishedStarterContent('<title>Your business</title>'), true);
  assert.equal(hasUnfinishedStarterContent('<h1 class="hero-title">Your business</h1>'), true);
});
