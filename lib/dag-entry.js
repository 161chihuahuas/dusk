'use strict';

const crypto = require('node:crypto');
const MerkleTree = require('./merkle-tree');
const { hash160 } = require('./utils');
const { encodeParity } = require('./reed-solomon');
const { splitSync } = require('node-split');


class DAGEntry {
  /**
  * @constructor
  * @param {Array<Buffer>} shards - Uniform 512kib shards to compose an entry
  */
  constructor(shards, originalSize, actualSize, parity) {
    this.shards = shards;
    this.originalSize = originalSize;
    this.actualSize = actualSize;
    this.leaves = this.shards.map(hash160);
    this.merkle = new MerkleTree(this.leaves, hash160);
    this.entries = [];
    this.parity = parity;

    for (let i = 0; i < this.shards.length; i++) {
      this.entries.push([this.leaves[i], this.shards[i]]);
    }

    for (let i = 0; i < this.merkle.length; i++) {
      this.entries.push([this.leaves[i], this.shards[i]]);
    }
  }

  toArray() {
    return this.shards;
  }

  toMetadata(filename) {
    return JSON.stringify({
      n: filename || 'duskblob.bin',
      l: this.leaves.map(l => l.toString('hex')),
      r: this.merkle.root().toString('hex'),
      p: this.parity,
      s: { o: this.originalSize, a: this.actualSize }
    });
  }

  static get INPUT_SIZE() {
    return 524288; // 512kib - all entries are uniform
  }

  static fromBuffer(buffer, originalSize) {
    const actualSize = buffer.length;
    return new Promise(async (resolve) => {
      const shards = splitSync(buffer, {
        bytes: DAGEntry.INPUT_SIZE
      }).map(s => {
        let buf512 = Buffer.alloc(DAGEntry.INPUT_SIZE);
        buf512.fill(s);
        buf512.fill(DAGEntry.randomFill(DAGEntry.INPUT_SIZE - s.length), 
          s.length);
        return buf512;
      });
      const parity = splitSync(await encodeParity(shards), { 
        bytes: DAGEntry.INPUT_SIZE 
      });
      resolve(new DAGEntry(shards.concat(parity), 
        originalSize, actualSize, parity.length));
    });
  }

  static randomFill(numBytes) {
    const max = 65536;
    const buf = Buffer.alloc(numBytes);
    
    let offset = 0;

    while (offset < numBytes) {
      offset += buf.fill(crypto.getRandomValues(Buffer.alloc(max)), offset);
    }

    return buf;
  }
}

module.exports = DAGEntry;
