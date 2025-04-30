'use strict';

const constants = require('./constants');
const ReedSolomon = require('@ronomon/reed-solomon');


module.exports.encodeParity = function(shards) {
  return new Promise((resolve, reject) => {
    // Specify the size of each shard in bytes (must be a multiple of 8 bytes):
    const shardSize = constants.SHARD_SIZE;

    // Specify the number of data shards (<= ReedSolomon.MAX_K):
    const k = shards.length;

    // Specify the number of parity shards (<= ReedSolomon.MAX_M):
    const m = Math.floor(k / 2) || 1; // Protect against the loss of any 3 data or parity shards.

    // Create an encoding context (can be cached and re-used concurrently):
    const context = ReedSolomon.create(k, m);

    // Allocate the data buffer containing all data shards:
    const buffer = Buffer.concat(shards);

    // Specify the offset into the data buffer at which data shards begin:
    // This allows you to include a header.
    const bufferOffset = 0;

    // Specify the size after this offset of all data shards:
    // This allows you to include a footer.
    const bufferSize = shardSize * k;

    // Allocate the parity buffer containing all parity shards:
    const parity = Buffer.alloc(shardSize * m);

    // Specify the offset into the parity buffer at which parity shards begin:
    // This allows you to include a header.
    const parityOffset = 0;

    // Specify the size after this offset of all parity shards:
    // This allows you to include a footer.
    const paritySize = shardSize * m;

    // Specify the sources, present in buffer or parity (as bit flags):
    // We are encoding parity shards, so we mark all data shards as sources.
    let sources = 0;
    for (let i = 0; i < k; i++) {
      sources |= (1 << i);
    }

    // Specify the targets, missing in buffer or parity, which should be encoded:
    // We are encoding parity shards, so we mark all parity shards as targets:
    let targets = 0;
    for (let i = k; i < k + m; i++) {
      targets |= (1 << i);
    }

    // Encode all parity shards:
    ReedSolomon.encode(
      context,
      sources,
      targets,
      buffer,
      bufferOffset,
      bufferSize,
      parity,
      parityOffset,
      paritySize,
      function(err) {
        if (err) {
          return reject(err);
        }
        // Parity shards now contain parity data.
        resolve(parity);
      }
    );
  });
};


module.exports.encodeCorrupted = function(shards) {
  return new Promise((resolve, reject) => {
    const shardSize = constants.SHARD_SIZE;

    // Specify the number of data shards (<= ReedSolomon.MAX_K):
    const k = shards.length;

    // Specify the number of parity shards (<= ReedSolomon.MAX_M):
    const m = Math.floor(k / 2) || 1; // Protect against the loss of any 3 data or parity shards.

    // Create an encoding context (can be cached and re-used concurrently):
    const context = ReedSolomon.create(k, m);

    // Allocate the data buffer containing all data shards:
    const buffer = Buffer.concat(shards);

    // Specify the offset into the data buffer at which data shards begin:
    // This allows you to include a header.
    const bufferOffset = 0;

    // Specify the size after this offset of all data shards:
    // This allows you to include a footer.
    const bufferSize = shardSize * k;

    // Allocate the parity buffer containing all parity shards:
    const parity = Buffer.alloc(shardSize * m);

    // Specify the offset into the parity buffer at which parity shards begin:
    // This allows you to include a header.
    const parityOffset = 0;

    // Specify the size after this offset of all parity shards:
    // This allows you to include a footer.
    const paritySize = shardSize * m;
    
    // Specify the targets, missing in buffer or parity, which should be encoded:
    let targets = 0;
    for (let i = 0; i < shards.length; i++) {
      if (shards[i].compare(Buffer.alloc(shardSize)) === 0) {
        targets |= (1 << i);
      }
    }

    // Specify the sources, present in buffer or parity:
    // We need at least k sources.
    // For this example, we assume that a shard is a source if it is not a target.
    // An optimization is available here:
    // If a shard is not a source or target, it might not be encoded.
    // The shard may be encoded if needed to encode other shards, but otherwise not.
    let sources = 0;
    for (let i = 0; i < k + m; i++) {
      if (targets & (1 << i)) {
        continue;
      }
      sources |= (1 << i);
    }

    // Encode the corrupted data and parity shards:
    ReedSolomon.encode(
      context,
      sources,
      targets,
      buffer,
      bufferOffset,
      bufferSize,
      parity,
      parityOffset,
      paritySize,
      function(error) {
        if (error) {
          reject(error);
        }
        resolve(buffer);
        // Data shard at index 0 has been repaired.
        // Parity shard at index 6 has been repaired.
      }
    );
  });
};

module.exports.MAX_K = ReedSolomon.MAX_K;
module.exports.MAX_M = ReedSolomon.MAX_M;

