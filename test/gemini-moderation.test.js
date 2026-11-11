const test = require('node:test');
const assert = require('node:assert/strict');
const { containsAiProfanity } = require('../gemini-moderation');

function mockResponse(isProfane) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({ isProfane }) }],
        },
      }],
    }),
  };
}

test('asks Gemini for a structured moderation result', async () => {
  let request;
  const result = await containsAiProfanity('sample message', {
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return mockResponse(true);
    },
  });

  assert.equal(result, true);
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  assert.equal(JSON.parse(request.options.body).contents[0].parts[0].text.includes('sample message'), true);
});

test('accepts a harmless classification', async () => {
  const result = await containsAiProfanity('welcome everyone', {
    apiKey: 'test-key',
    fetchImpl: async () => mockResponse(false),
  });
  assert.equal(result, false);
});

test('reports API failures without exposing a response body', async () => {
  await assert.rejects(
    containsAiProfanity('sample', {
      apiKey: 'test-key',
      fetchImpl: async () => ({ ok: false, status: 429 }),
    }),
    /status 429/,
  );
});

test('rejects malformed moderation results', async () => {
  await assert.rejects(
    containsAiProfanity('sample', {
      apiKey: 'test-key',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"isProfane":"yes"}' }] } }],
        }),
      }),
    }),
    /invalid moderation result/,
  );
});
