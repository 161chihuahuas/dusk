'use strict';

const { expect } = require('chai');
const dusk = require('..');
const network = require('./fixtures/node-generator');
const spartacus = require('../lib/plugin-spartacus');


describe('@module dusk/spartacus + @class HTTPTransport)', function() {
  this.timeout(10000);
  dusk.constants.T_RESPONSETIMEOUT = 4000;

  let [node1, node2, node3, node4] = network(4, dusk.HTTPTransport);
  let node3pub = null;

  before(function(done) {
    [node1, node2, node3].forEach((node) => {
      node.spartacus = node.plugin(spartacus(null, { checkPublicKeyHash: false }));
      node.listen(node.contact.port);
    });
    setTimeout(() => {
      node4.listen(node4.contact.port, done); // NB: Not a spartacus node
    })
  });

  it('should sign and verify messages', function(done) {
    node1.ping([node2.identity.toString('hex'), node2.contact], (err) => {
      expect(err).to.equal(null);
      done();
    });
  });

  it('should sign and verify messages', function(done) {
    node2.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(err).to.equal(null);
      done();
    });
  });

  it('should fail to validate if reflection attack', function(done) {
    node3pub = node3.contact.pubkey;
    node3.contact.pubkey = node1.contact.pubkey;
    node3.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(err.message).to.equal('Timed out waiting for response');
      done();
    });
  });

  it('should fail to validate if no response', function(done) {
    node3.contact.pubkey = node3pub;
    node3.contact.port = 6666;
    node1.spartacus.setValidationPeriod(0);
    node3.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(['Gateway Timeout', 
        'Timed out waiting for response'].includes(err.message)).to.equal(true);
      done();
    });
  });

  it('should timeout and not crash if no auth payload', function(done) {
    node4.ping([node2.identity.toString('hex'), node2.contact], (err) => {
       expect(['Gateway Timeout', 
        'Timed out waiting for response'].includes(err.message)).to.equal(true);
      done();
    });
  });

});
