'use strict';

const crypto = require('node:crypto');
const MerkleTree = require('./merkle-tree');
const { hash160 } = require('./utils');
const { extname } = require('path');
const { encodeParity } = require('./reed-solomon');


class DAGEntry {
  /**
  * @constructor
  * @param {Array<Buffer>} shards - Uniform 512kib shards to compose an entry
  */
  constructor(shards, parityM) {
    this.shards = shards;
    this.leaves = this.shards.map(hash160);
    this.merkle = new MerkleTree(this.leaves, hash160);
    this.entries = [];
    this.parity = parityM;

    for (let i = 0; i < this.shards.length; i++) {
      this.entries.push([this.leaves[i], this.shards[i]]);
    }

    for (let i = 0; i < this.merkle.length; i++) {
      this.entries.push([this.leaves[i], this.shards[i]]);
    }
  }

  toMetadata(filename) {
    return JSON.stringify({
      extname: extname(filename) || '.bin',
      leaves: this.leaves.map(l => l.toString('hex')),
      root: this.merkle.root().toString('hex'),
      parity: this.parity
    });
  }

  static get INPUT_SIZE() {
    return 524288; // 512kib - all entries are uniform
  }

  static fromBuffer(buffer) {
    return new Promise((resolve) => {
      const shards = [];
      let parityEncoded = false;
      let parityM = 0;

      /** eslint ignore */
      async function buildShard(buffer) {
        let block512 = Buffer.alloc(DAGEntry.INPUT_SIZE);

        if (buffer.length + 4 <= DAGEntry.INPUT_SIZE) {
          const cuttoffIndex = DAGEntry.INPUT_SIZE - buffer.length;
          const indexEncoded = Buffer.alloc(4).writeInt32LE(cuttoffIndex);

          block512.fill(indexEncoded, 0, 4);
          block512.fill(buffer, 4, buffer.length);

          const noise = DAGEntry.randomFill(
            DAGEntry.INPUT_SIZE - buffer.length - 4
          );
          block512.fill(noise, buffer.length + 4);
          shards.push(block512);
        
          if (parityEncoded) {
            return new DAGEntry(shards, parityM);
          }

          parityM = Math.floor(shards.length / 2) || 1;
          const parity = await encodeParity(shards);
          buffer = Buffer.concat([buffer, parity]);
          parityEncoded = true;
          return buildShard(buffer);
        }

        block512.writeUInt32LE(DAGEntry.INPUT_SIZE);
        block512.fill(buffer.subarray(0, DAGEntry.INPUT_SIZE - 4), 4);
        shards.push(block512);
        return buildShard(buffer.subarray(DAGEntry.INPUT_SIZE));
      }

      resolve(buildShard(buffer));
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
