const test = require('node:test');
const assert = require('node:assert/strict');
const { containsProfanity } = require('../profanity-filter');

test('detects existing exact and repeated-letter matches', () => {
  assert.equal(containsProfanity('fuck'), true);
  assert.equal(containsProfanity('fuuuuuck'), true);
});

test('detects single-character spelling errors in longer terms', () => {
  assert.equal(containsProfanity('fukker'), true);
  assert.equal(containsProfanity('fuckerx'), true);
});

test('detects adjacent transposed letters', () => {
  assert.equal(containsProfanity('fukcer'), true);
});

test('does not fuzzy-match a short benign word', () => {
  assert.equal(containsProfanity('cats'), false);
});

test('keeps matching unrelated normal messages false', () => {
  assert.equal(containsProfanity('Welcome everyone'), false);
});
