'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const crypto = require('node:crypto');
const MerkleTree = require('../lib/merkle-tree');

describe('MerkleTree', function(){

  describe('@constructor', function() {

    it('should feed the leaves and compute the tree', function() {
      var _feed = sinon.stub(MerkleTree.prototype, '_feed');
      var _compute = sinon.stub(MerkleTree.prototype, '_compute');
      let tree = new MerkleTree(['0', '1', '2']);
      expect(_feed.callCount).to.equal(3);
      expect(_compute.callCount).to.equal(1);
      _feed.restore();
      _compute.restore();
    });

    it('should use the custom hasher', function() {
      function hasher(input) {
        return crypto.createHash('ripemd160').update(input).digest('hex');
      }
      var tree = new MerkleTree([], hasher);
      expect(tree._hasher).to.equal(hasher);
    });

  });

  describe('#depth', function() {

    it('should return the expected depth', function() {
      var tree = new MerkleTree(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(function(input) {
          return MerkleTree.prototype._hasher(input);
        })
      );
      expect(tree.depth()).to.equal(3);
    });

  });

  describe('#levels', function() {

    it('should return the number of levels in the tree', function() {
      var tree = new MerkleTree(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(function(input) {
          return MerkleTree.prototype._hasher(input);
        })
      );
      expect(tree.levels()).to.equal(4);
    });

  });

  describe('#level', function() {

    it('should return the nodes at the given level', function() {
      var tree = new MerkleTree(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(function(input) {
          return MerkleTree.prototype._hasher(input);
        })
      );
      expect(tree.level(2).length).to.equal(4);
      expect(tree.level(2)[0].toString('hex')).to.eql(
        'e5a01fee14e0ed5c48714f22180f25ad8365b53f9779f79dc4a3d7e93963f94a'
      );
      expect(tree.level(2)[1].toString('hex')).to.eql(
        'bffe0b34dba16bc6fac17c08bac55d676cded5a4ade41fe2c9924a5dde8f3e5b'
      );
      expect(tree.level(2)[2].toString('hex')).to.eql(
        '04fa33f8b4bd3db545fa04cdd51b462509f611797c7bfe5c944ee2bb3b2ed908'
      );
      expect(tree.level(2)[3].toString('hex')).to.eql(
        '140257c1540113794d2ae3394879e586ca5caebca19663ff87417892cf36fd23'
      );
    });

  });

  describe('#root', function() {
    let h = 'bd7c8a900be9b67ba7df5c78a652a8474aedd78adb5083e80e49d9479138a23f';

    it('should return the root node', function() {
      var tree = new MerkleTree(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(function(input) {
          return MerkleTree.prototype._hasher(input);
        })
      );
      expect(tree.root()).to.eql(Buffer.from(h, 'hex'));
    });

  });

  describe('#nodes', function() {

    it('should return the number of nodes in the tree', function() {
      var tree = new MerkleTree(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j'].map(function(input) {
          return MerkleTree.prototype._hasher(input);
        })
      );
      expect(tree.nodes()).to.equal(11);
    });

  });

});
