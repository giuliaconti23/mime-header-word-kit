# mime-header-word-kit

Decodes RFC 2047 encoded-word headers, including UTF-8 Base64 and Quoted-Printable variants.

```js
import { decodeHeader, decodeWords, parseEncodedWord } from 'mime-header-word-kit';

decodeHeader('=?UTF-8?Q?Hello,_World!?=');
// => 'Hello, World!'

decodeWords('=?UTF-8?Q?Hello?= =?UTF-8?Q?World?=');
// => 'HelloWorld'

parseEncodedWord('=?UTF-8?B?SGVsbG8sIFdvcmxkIQ==?=');
// => 'Hello, World!'
```

## Why this exists

Mail headers arrive folded and encoded, and the two encodings that matter
in practice are Base64 and Quoted-Printable. The awkward part is that
Quoted-Printable in a header is not the same as Quoted-Printable in a body:
underscores mean spaces and there are no soft line breaks. This library
keeps the two separate instead of trying to share one decoder, because
sharing them produces subtly wrong output on real messages. The trade-off
is that unknown charsets fall back to latin1 rather than failing, so bytes
survive even when the declared charset is one we cannot name.

## The edge you will hit

Whitespace between two adjacent encoded-words is not significant and is
removed, while whitespace between an encoded-word and plain text is kept.
That rule is easy to get wrong when you write your own scanner, and it is
the behaviour this library tests explicitly.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

