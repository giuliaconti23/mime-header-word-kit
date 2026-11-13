const ENCODED_WORD = /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g;

/**
 * RFC 2047 encoded-words can be split across folded header lines.
 * Unfolding removes the CRLF (or LF) that follows a line break and the
 * leading whitespace on the continuation line, but only when the header
 * is actually folded. A lone newline that is not followed by whitespace
 * is left alone so we do not silently merge two headers.
 */
export function unfoldHeader(input) {
  if (typeof input !== 'string') {
    throw new TypeError('header must be a string');
  }
  return input.replace(/\r?\n[ \t]+/g, ' ');
}

/**
 * Decode a single RFC 2047 encoded-word. Returns null when the input is
 * not exactly one encoded-word (no surrounding text, no adjacent words).
 * The caller is responsible for scanning a full header.
 */
export function parseEncodedWord(word) {
  if (typeof word !== 'string') {
    throw new TypeError('word must be a string');
  }
  ENCODED_WORD.lastIndex = 0;
  const match = ENCODED_WORD.exec(word);
  if (!match || match.index !== 0 || match[0].length !== word.length) {
    return null;
  }
  const [, charset, encoding, payload] = match;
  return decodePayload(charset, encoding, payload);
}

function decodePayload(charset, encoding, payload) {
  const normalized = charset.toLowerCase();
  let bytes;
  if (encoding === 'B' || encoding === 'b') {
    bytes = decodeBase64(payload);
  } else if (encoding === 'Q' || encoding === 'q') {
    bytes = decodeQuotedPrintable(payload);
  } else {
    return null;
  }
  if (bytes === null) {
    return null;
  }
  return decodeCharset(normalized, bytes);
}

/**
 * Base64 in RFC 2047 is the standard alphabet with padding. We reject
 * anything that is not a clean multiple after stripping whitespace,
 * because silently dropping bad characters hides corrupt messages.
 */
function decodeBase64(input) {
  const cleaned = input.replace(/[\s]/g, '');
  if (cleaned.length % 4 !== 0) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    return null;
  }
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Quoted-Printable in RFC 2047 differs from body QP: underscores map to
 * spaces (0x20) and only =XX escapes are recognised. A trailing '=' is
 * not a soft line break here; it is malformed and we reject the word.
 */
function decodeQuotedPrintable(input) {
  const out = [];
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '_') {
      out.push(0x20);
    } else if (ch === '=') {
      if (i + 2 >= input.length) {
        return null;
      }
      const hex = input.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
        return null;
      }
      out.push(parseInt(hex, 16));
      i += 2;
    } else {
      const code = ch.charCodeAt(0);
      if (code > 0x7e) {
        return null;
      }
      out.push(code);
    }
  }
  return Uint8Array.from(out);
}

/**
 * Only the charsets we can decode without a dependency are accepted.
 * Unknown charsets fall back to latin1 so bytes survive, which is the
 * least surprising behaviour for a header that is already broken.
 */
function decodeCharset(charset, bytes) {
  if (charset === 'utf-8' || charset === 'utf8') {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }
  if (charset === 'us-ascii' || charset === 'ascii') {
    return bytesToLatin1(bytes);
  }
  return bytesToLatin1(bytes);
}

function bytesToLatin1(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/**
 * Decode every encoded-word in a header. Plain runs between encoded-words
 * are preserved, and whitespace between two adjacent encoded-words is
 * dropped per RFC 2047 section 6.2. Non-encoded text is returned as-is.
 */
export function decodeWords(input) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }
  const unfolded = unfoldHeader(input);
  ENCODED_WORD.lastIndex = 0;
  let result = '';
  let cursor = 0;
  let match;
  let previousWasEncoded = false;
  while ((match = ENCODED_WORD.exec(unfolded)) !== null) {
    const before = unfolded.slice(cursor, match.index);
    if (previousWasEncoded && /^[ \t]*$/.test(before)) {
      // Whitespace separating two encoded-words is not significant.
    } else {
      result += before;
    }
    const decoded = decodePayload(match[1], match[2], match[3]);
    if (decoded === null) {
      result += match[0];
      previousWasEncoded = false;
    } else {
      result += decoded;
      previousWasEncoded = true;
    }
    cursor = match.index + match[0].length;
  }
  result += unfolded.slice(cursor);
  return result;
}

/**
 * Convenience wrapper: unfold, then decode every encoded-word. This is
 * what callers want for a single header value such as Subject or From.
 */
export function decodeHeader(input) {
  return decodeWords(input);
}
