import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeHeader, decodeWords, parseEncodedWord } from '../src/core.js';

test('decodes a UTF-8 Base64 encoded-word', () => {
  assert.equal(parseEncodedWord('=?UTF-8?B?SGVsbG8sIFdvcmxkIQ==?='), 'Hello, World!');
});

test('decodes a UTF-8 Quoted-Printable encoded-word with underscore space', () => {
  assert.equal(parseEncodedWord('=?UTF-8?Q?Hello,_World!?='), 'Hello, World!');
});

test('decodes mixed encoded-words and plain text in a header', () => {
  const header = '=?UTF-8?Q?Hello?= plain =?UTF-8?B?V29ybGQ=?=';
  assert.equal(decodeWords(header), 'Hello plain World');
});

test('drops whitespace between adjacent encoded-words', () => {
  const header = '=?UTF-8?Q?Hello?= =?UTF-8?Q?World?=';
  assert.equal(decodeWords(header), 'HelloWorld');
});

test('preserves whitespace between encoded-word and plain text', () => {
  const header = '=?UTF-8?Q?Hello?= World';
  assert.equal(decodeWords(header), 'Hello World');
});

test('unfolds a folded header before decoding', () => {
  const header = '=?UTF-8?Q?Hello?=\r\n =?UTF-8?Q?World?=';
  assert.equal(decodeWords(header), 'HelloWorld');
});

test('leaves malformed encoded-words untouched', () => {
  const header = '=?UTF-8?B?not-base64?=';
  assert.equal(decodeWords(header), header);
});

test('returns literal text when there are no encoded-words', () => {
  assert.equal(decodeHeader('just a subject'), 'just a subject');
});

test('returns null for a word that is not exactly one encoded-word', () => {
  assert.equal(parseEncodedWord('prefix =?UTF-8?Q?Hi?='), null);
  assert.equal(parseEncodedWord('=?UTF-8?Q?Hi?= suffix'), null);
});

test('decodes an ISO-8859-1 encoded-word as latin1 bytes', () => {
  // 0xE9 is 'é' in latin1.
  assert.equal(parseEncodedWord('=?ISO-8859-1?Q?caf=E9?='), 'café');
});

test('rejects a Q encoded-word with an invalid escape', () => {
  assert.equal(parseEncodedWord('=?UTF-8?Q?bad=ZZ?='), null);
});

test('rejects a Base64 encoded-word with bad padding', () => {
  assert.equal(parseEncodedWord('=?UTF-8?B?SGVsbG8?='), null);
});

test('throws a TypeError for non-string input', () => {
  assert.throws(() => decodeWords(42), TypeError);
  assert.throws(() => parseEncodedWord(null), TypeError);
});
