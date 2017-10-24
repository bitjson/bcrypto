/*!
 * sha1.js - SHA1 implementation for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 * Parts of this software based on hash.js.
 */

/* eslint camelcase: "off" */

'use strict';

const assert = require('assert');
const HMAC = require('../hmac');

/*
 * Constants
 */

const DESC = Buffer.allocUnsafe(8);
const PADDING = Buffer.allocUnsafe(64);

const K = [
  0x5a827999,
  0x6ed9eba1,
  0x8f1bbcdc,
  0xca62c1d6
];

PADDING.fill(0);
PADDING[0] = 0x80;

let ctx = null;

/**
 * SHA1
 */

class SHA1 {
  /**
   * Create a SHA1 context.
   * @constructor
   */

  constructor() {
    this.s = new Array(5);
    this.w = new Array(80);
    this.block = Buffer.allocUnsafe(64);
    this.bytes = 0;
  }

  /**
   * Initialize SHA1 context.
   * @returns {SHA1}
   */

  init() {
    this.s[0] = 0x67452301;
    this.s[1] = 0xefcdab89;
    this.s[2] = 0x98badcfe;
    this.s[3] = 0x10325476;
    this.s[4] = 0xc3d2e1f0;
    this.bytes = 0;
    return this;
  }

  /**
   * Update SHA1 context.
   * @param {Buffer} data
   * @returns {SHA1}
   */

  update(data) {
    assert(Buffer.isBuffer(data));
    this._update(data, data.length);
    return this;
  }

  /**
   * Finalize SHA1 context.
   * @returns {Buffer}
   */

  final() {
    return this._final(Buffer.allocUnsafe(20));
  }

  /**
   * Update SHA1 context.
   * @private
   * @param {Buffer} data
   * @param {Number} len
   */

  _update(data, len) {
    let size = this.bytes & 0x3f;
    let pos = 0;

    this.bytes += len;

    if (size > 0) {
      let want = 64 - size;

      if (want > len)
        want = len;

      for (let i = 0; i < want; i++)
        this.block[size + i] = data[i];

      size += want;
      len -= want;
      pos += want;

      if (size < 64)
        return;

      this.transform(this.block, 0);
    }

    while (len >= 64) {
      this.transform(data, pos);
      pos += 64;
      len -= 64;
    }

    for (let i = 0; i < len; i++)
      this.block[i] = data[pos + i];
  }

  /**
   * Finalize SHA1 context.
   * @private
   * @param {Buffer} out
   * @returns {Buffer}
   */

  _final(out) {
    const len = this.bytes * 8;

    writeU32(DESC, len * (1 / 0x100000000), 0);
    writeU32(DESC, len, 4);

    this._update(PADDING, 1 + ((119 - (this.bytes % 64)) % 64));
    this._update(DESC, 8);

    for (let i = 0; i < 5; i++) {
      writeU32(out, this.s[i], i * 4);
      this.s[i] = 0;
    }

    return out;
  }

  /**
   * Transform SHA1 block.
   * @param {Buffer} chunk
   * @param {Number} pos
   */

  transform(chunk, pos) {
    const w = this.w;

    let a = this.s[0];
    let b = this.s[1];
    let c = this.s[2];
    let d = this.s[3];
    let e = this.s[4];
    let i = 0;

    for (; i < 16; i++)
      w[i] = readU32(chunk, pos + i * 4);

    for(; i < w.length; i++)
      w[i] = rotl32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    for (i = 0; i < w.length; i++) {
      const s = i / 20 | 0;

      let t = rotl32(a, 5);
      t += ft_1(s, b, c, d);
      t += e;
      t += w[i];
      t += K[s];

      e = d;
      d = c;
      c = rotl32(b, 30);
      b = a;
      a = t;
    }

    this.s[0] += a;
    this.s[1] += b;
    this.s[2] += c;
    this.s[3] += d;
    this.s[4] += e;

    this.s[0] >>>= 0;
    this.s[1] >>>= 0;
    this.s[2] >>>= 0;
    this.s[3] >>>= 0;
    this.s[4] >>>= 0;
  }

  static hash() {
    return new SHA1();
  }

  static hmac() {
    return new HMAC(SHA1, 64);
  }

  static digest(data) {
    return ctx.init().update(data).final();
  }

  static root(left, right) {
    assert(Buffer.isBuffer(left) && left.length === 20);
    assert(Buffer.isBuffer(right) && right.length === 20);
    return ctx.init().update(left).update(right).final();
  }

  static mac(data, key) {
    return this.hmac().init(key).update(data).final();
  }
}

ctx = new SHA1();

function rotl32(w, b) {
  return (w << b) | (w >>> (32 - b));
}

function ft_1(s, x, y, z) {
  if (s === 0)
    return ch32(x, y, z);

  if (s === 1 || s === 3)
    return p32(x, y, z);

  if (s === 2)
    return maj32(x, y, z);

  return 0;
}

function ch32(x, y, z) {
  return (x & y) ^ ((~x) & z);
}

function maj32(x, y, z) {
  return (x & y) ^ (x & z) ^ (y & z);
}

function p32(x, y, z) {
  return x ^ y ^ z;
}

function writeU32(buf, value, offset) {
  buf[offset] = value >>> 24;
  buf[offset + 1] = (value >> 16) & 0xff;
  buf[offset + 2] = (value >> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function readU32(buf, offset) {
  return ((buf[offset] & 0xff) * 0x1000000)
    + ((buf[offset + 1] & 0xff) << 16)
    | ((buf[offset + 2] & 0xff) << 8)
    | (buf[offset + 3] & 0xff);
}

/*
 * Expose
 */

module.exports = SHA1;