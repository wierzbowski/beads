import { MAX_COLOURS, MAX_HEIGHT, MAX_WIDTH, type Pattern } from './pattern';
import type { CraftState } from './progress';

/**
 * Pattern Link payload (ADR-0003):
 *   [format version: u8] + deflate-raw(body), encoded as base64url.
 * The version byte stays outside the compressed body so future versions may change compression too.
 *
 * Body v1:
 *   u16 width, u16 height,
 *   u8 palette size, per colour: u8 r, u8 g, u8 b, str label,
 *   str name, u16 progress, u8 direction (0 = ltr, 1 = rtl),
 *   bead grid: palette indices bit-packed MSB-first, row-major from the top image row.
 *   str = u16 byte length + UTF-8 bytes.
 */
const FORMAT_VERSION = 1;

export class PatternLinkError extends Error {}

export interface DecodedLink {
  pattern: Pattern;
  state: CraftState;
}

class Writer {
  private bytes: number[] = [];
  private bitBuffer = 0;
  private bitCount = 0;

  u8(v: number) {
    this.bytes.push(v & 0xff);
  }

  u16(v: number) {
    this.u8(v >>> 8);
    this.u8(v);
  }

  str(s: string) {
    const encoded = new TextEncoder().encode(s);
    this.u16(encoded.length);
    for (const b of encoded) this.u8(b);
  }

  bits(v: number, count: number) {
    for (let i = count - 1; i >= 0; i--) {
      this.bitBuffer = (this.bitBuffer << 1) | ((v >>> i) & 1);
      this.bitCount++;
      if (this.bitCount === 8) this.flushBits();
    }
  }

  flushBits() {
    if (this.bitCount === 0) return;
    this.u8(this.bitBuffer << (8 - this.bitCount));
    this.bitBuffer = 0;
    this.bitCount = 0;
  }

  result(): Uint8Array<ArrayBuffer> {
    this.flushBits();
    return new Uint8Array(this.bytes);
  }
}

class Reader {
  private pos = 0;
  private bitPos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  u8(): number {
    if (this.pos >= this.bytes.length) throw new PatternLinkError('Link jest niekompletny.');
    return this.bytes[this.pos++];
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  str(): string {
    const length = this.u16();
    if (this.pos + length > this.bytes.length) throw new PatternLinkError('Link jest niekompletny.');
    const s = new TextDecoder().decode(this.bytes.subarray(this.pos, this.pos + length));
    this.pos += length;
    return s;
  }

  bits(count: number): number {
    let v = 0;
    for (let i = 0; i < count; i++) {
      if (this.pos >= this.bytes.length) throw new PatternLinkError('Link jest niekompletny.');
      const bit = (this.bytes[this.pos] >>> (7 - this.bitPos)) & 1;
      v = (v << 1) | bit;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.pos++;
      }
    }
    return v;
  }
}

function bitsPerBead(paletteSize: number): number {
  return paletteSize <= 1 ? 0 : Math.ceil(Math.log2(paletteSize));
}

async function pipe(data: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream) {
  const stream = new Blob([data]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new PatternLinkError('Link jest uszkodzony.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encodePattern(pattern: Pattern, state: CraftState): Promise<string> {
  const { width, height, palette, beads } = pattern;
  if (width < 1 || height < 1 || width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new PatternLinkError(`Wzór musi mieć najwyżej ${MAX_WIDTH} × ${MAX_HEIGHT} koralików.`);
  }
  if (palette.length < 1 || palette.length > MAX_COLOURS) {
    throw new PatternLinkError(`Wzór może mieć najwyżej ${MAX_COLOURS} kolorów.`);
  }

  const body = new Writer();
  body.u16(width);
  body.u16(height);
  body.u8(palette.length);
  for (const { rgb, label } of palette) {
    body.u8(rgb.r);
    body.u8(rgb.g);
    body.u8(rgb.b);
    body.str(label);
  }
  body.str(pattern.name);
  body.u16(state.progress);
  body.u8(state.direction === 'rtl' ? 1 : 0);
  const bits = bitsPerBead(palette.length);
  for (const colour of beads) body.bits(colour, bits);

  const compressed = await pipe(body.result(), new CompressionStream('deflate-raw'));
  const payload = new Uint8Array(compressed.length + 1);
  payload[0] = FORMAT_VERSION;
  payload.set(compressed, 1);
  return toBase64Url(payload);
}

export async function decodePattern(payload: string): Promise<DecodedLink> {
  const bytes = fromBase64Url(payload);
  if (bytes.length < 2) throw new PatternLinkError('Link jest uszkodzony.');
  const version = bytes[0];
  if (version !== FORMAT_VERSION) {
    throw new PatternLinkError('Ten link pochodzi z nowszej wersji aplikacji.');
  }

  let body: Uint8Array;
  try {
    body = await pipe(bytes.slice(1), new DecompressionStream('deflate-raw'));
  } catch {
    throw new PatternLinkError('Link jest uszkodzony.');
  }

  const r = new Reader(body);
  const width = r.u16();
  const height = r.u16();
  if (width < 1 || height < 1 || width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new PatternLinkError('Link zawiera nieprawidłowy rozmiar wzoru.');
  }
  const paletteSize = r.u8();
  if (paletteSize < 1 || paletteSize > MAX_COLOURS) {
    throw new PatternLinkError('Link zawiera nieprawidłową liczbę kolorów.');
  }
  const palette = [];
  for (let i = 0; i < paletteSize; i++) {
    const rgb = { r: r.u8(), g: r.u8(), b: r.u8() };
    palette.push({ rgb, label: r.str() });
  }
  const name = r.str();
  const progress = r.u16();
  const direction = r.u8() === 1 ? 'rtl' : 'ltr';
  if (progress > height) throw new PatternLinkError('Link zawiera nieprawidłowy postęp.');

  const bits = bitsPerBead(paletteSize);
  const beads = new Array<number>(width * height);
  for (let i = 0; i < beads.length; i++) {
    const colour = r.bits(bits);
    if (colour >= paletteSize) throw new PatternLinkError('Link jest uszkodzony.');
    beads[i] = colour;
  }

  return {
    pattern: { name, width, height, palette, beads },
    state: { progress, direction },
  };
}

export function patternLinkUrl(baseUrl: string, payload: string): string {
  return `${baseUrl}#p=${payload}`;
}

/** Extracts the payload from a location hash or a full Pattern Link; null if there is none. */
export function payloadFromLink(link: string): string | null {
  const hashIndex = link.indexOf('#');
  if (hashIndex < 0) return null;
  const payload = new URLSearchParams(link.slice(hashIndex + 1)).get('p');
  return payload ? payload.trim() : null;
}
