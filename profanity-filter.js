const fs = require('node:fs');
const path = require('node:path');

const defaultBadWords = [
  'fuck', 'fucker', 'satyam beta', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard',
  'asshole', 'dickhead', 'cunt', 'nigger', 'nigga', 'retard',
  'gaand', 'gand', 'madarchod', 'mc', 'behenchod', 'bhenchod', 'bc', 'chutiya',
  'chutiye', 'harami', 'kamina', 'randi', 'lund', 'bsdk', 'bhosdike', 'gandu',
];
const extras = (process.env.EXTRA_BAD_WORDS || '').split(',').map((word) => word.trim()).filter(Boolean);
let maxPhraseWords = 1;
let maxTermCharacters = 2;

function normalizeForMatch(value) {
  return value.normalize('NFKC').toLocaleLowerCase()
    .replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[7]/g, 't')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ');
}

function squeezeRepeatedLetters(value) {
  return value.replace(/(.)\1+/gu, '$1');
}

function isOneEditApart(left, right) {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  if (Math.abs(leftChars.length - rightChars.length) > 1) return false;

  if (leftChars.length === rightChars.length) {
    const differences = [];
    for (let index = 0; index < leftChars.length; index += 1) {
      if (leftChars[index] !== rightChars[index]) differences.push(index);
      if (differences.length > 2) return false;
    }
    if (differences.length === 1) return true;
    return differences.length === 2
      && differences[1] === differences[0] + 1
      && leftChars[differences[0]] === rightChars[differences[1]]
      && leftChars[differences[1]] === rightChars[differences[0]];
  }

  const shorter = leftChars.length < rightChars.length ? leftChars : rightChars;
  const longer = leftChars.length < rightChars.length ? rightChars : leftChars;
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      longIndex += 1;
    }
  }
  return true;
}

function addFuzzyTerm(deletionIndex, term) {
  const characters = Array.from(term);
  if (characters.length < 5 || characters.length > 16 || !/^\p{L}+$/u.test(term)) return;
  for (let index = 0; index < characters.length; index += 1) {
    const key = characters.slice(0, index).concat(characters.slice(index + 1)).join('');
    if (!deletionIndex.has(key)) deletionIndex.set(key, new Set());
    deletionIndex.get(key).add(term);
  }
}

function loadProfanityTerms() {
  const terms = new Set();
  const fuzzyDeletionIndex = new Map();
  const add = (value) => {
    const normalized = normalizeForMatch(value);
    if (!normalized || Array.from(normalized.replace(/ /g, '')).length < 2) return;

    const variants = [normalized, normalized.split(' ').map(squeezeRepeatedLetters).join(' ')];
    for (const variant of variants) {
      terms.add(variant);
      maxPhraseWords = Math.max(maxPhraseWords, Math.min(8, variant.split(' ').length));
      maxTermCharacters = Math.max(maxTermCharacters, Math.min(16, Array.from(variant.replace(/ /g, '')).length));
      if (!variant.includes(' ')) addFuzzyTerm(fuzzyDeletionIndex, variant);
    }
  };

  for (const word of [...defaultBadWords, ...extras]) add(word);

  const listPath = path.join(__dirname, 'data', 'profanity-terms.txt');
  try {
    for (const word of fs.readFileSync(listPath, 'utf8').split(/\r?\n/u)) add(word);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn('Offline profanity dataset not found; using only built-in and EXTRA_BAD_WORDS terms.');
  }
  return { terms, fuzzyDeletionIndex };
}

const { terms: profanityTerms, fuzzyDeletionIndex } = loadProfanityTerms();

function isLikelyMisspelling(token) {
  const characters = Array.from(token);
  if (characters.length < 5 || characters.length > 16 || !/^\p{L}+$/u.test(token)) return false;

  const candidates = new Set(fuzzyDeletionIndex.get(token) || []);
  for (let index = 0; index < characters.length; index += 1) {
    const key = characters.slice(0, index).concat(characters.slice(index + 1)).join('');
    for (const candidate of fuzzyDeletionIndex.get(key) || []) candidates.add(candidate);
  }
  for (const candidate of candidates) {
    if (candidate !== token && isOneEditApart(token, candidate)) return true;
  }
  return false;
}

function containsProfanity(content) {
  const normalized = normalizeForMatch(content);
  if (!normalized) return false;
  const tokens = normalized.split(' ');
  const squeezedTokens = tokens.map(squeezeRepeatedLetters);

  for (let start = 0; start < tokens.length; start += 1) {
    let phrase = '';
    let squeezedPhrase = '';
    for (let end = start; end < Math.min(tokens.length, start + maxPhraseWords); end += 1) {
      phrase = phrase ? phrase + ' ' + tokens[end] : tokens[end];
      squeezedPhrase = squeezedPhrase ? squeezedPhrase + ' ' + squeezedTokens[end] : squeezedTokens[end];
      if (profanityTerms.has(phrase) || profanityTerms.has(squeezedPhrase)) return true;
    }
  }

  for (const token of tokens) {
    if (isLikelyMisspelling(token) || isLikelyMisspelling(squeezeRepeatedLetters(token))) return true;
  }

  // Catch letters separated by spaces, such as "f u c k".
  for (let start = 0; start < tokens.length; start += 1) {
    if (Array.from(tokens[start]).length !== 1) continue;
    let joined = '';
    for (let end = start; end < tokens.length && end < start + maxTermCharacters; end += 1) {
      if (Array.from(tokens[end]).length !== 1) break;
      joined += tokens[end];
      if (profanityTerms.has(joined)) return true;
    }
  }

  // Chinese, Japanese, Korean, and Thai often omit spaces between words.
  for (const token of tokens) {
    if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u.test(token)) continue;
    const chars = Array.from(token);
    for (let start = 0; start < chars.length; start += 1) {
      for (let length = 2; length <= maxTermCharacters && start + length <= chars.length; length += 1) {
        if (profanityTerms.has(chars.slice(start, start + length).join(''))) return true;
      }
    }
  }
  return false;
}

module.exports = { containsProfanity, profanityTermCount: profanityTerms.size };
