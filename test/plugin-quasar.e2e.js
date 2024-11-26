'use strict';

const async = require('async');
const dusk = require('..');
const quasar = require('../lib/plugin-quasar');
const spartacus = require('../lib/plugin-spartacus');
const network = require('./fixtures/node-generator');

dusk.constants.IDENTITY_DIFFICULTY = dusk.constants.TESTNET_DIFFICULTY;

const TOTAL_NODES = 12;

describe('@module dusk/quasar + @class HTTPTransport', function() {

  this.timeout(12000);

  let nodes, seed;

  let topics = {};

  before(function(done) {
    dusk.constants.T_RESPONSETIMEOUT = 4000;
    nodes = network(TOTAL_NODES, dusk.HTTPTransport);
    async.each(nodes, (node, done) => {
      node.spartacus = node.plugin(spartacus(null, { checkPublicKeyHash: false }));
      const identity = new dusk.eclipse.EclipseIdentity(Buffer.from(node.spartacus.publicKey));
      identity.solve().then(() => {
        node.plugin(dusk.eclipse(identity));
        node.plugin(quasar());
        node.listen(node.contact.port, node.contact.hostname, done);
      }, done);
    }, () => {
      seed = nodes.shift();
      nodes.forEach((node, i) => {
        if (i <= 3) {
          topics[node.identity.toString('hex')] = new Set();
        }
        seed.router.addContactByNodeId(
          node.identity.toString('hex'),
          node.contact
        );
      });
      async.each(nodes, (node, done) => {
        node.join([
          seed.identity.toString('hex'),
          seed.contact
        ], () => {
          done();
        });
      }, done);
    });
  });

  after(function() {
    nodes.forEach((node) => node.transport.server.close());
  });

  it('nodes subscribed to a topic should receive publication', function(done) {
    let topicCounter = 0;
    let subscribers = new Set();
    function getTopicName() {
      if (topicCounter === 0 || topicCounter < 4) {
        return nodes[topicCounter++].identity.toString('hex');
      } else {
        topicCounter = 0;
        return getTopicName();
      }
    }
    function confirmPublicationReceipt(topic, node) {
      subscribers.add(node.identity.toString('hex'));
      if (subscribers.size === TOTAL_NODES - 5) { // 5 because the seed gets shifted off
        done();
      }
    }
    async.eachLimit(nodes.slice(4), 4, (node, next) => {
      let topic = getTopicName();
      node.quasarSubscribe(topic, () => confirmPublicationReceipt(topic, node));
      setTimeout(next, 500);
    }, () => {
      let publishers = nodes.slice(0, 4);
      async.each(publishers, (node, done) => {
        node.quasarPublish(Buffer.from('000000', 'hex'), done);
      }, (err) => {
        if (err) {
          done(new Error(`Subscribers did not all receive publication: ${err.message}`));
        }
      });
    });
  });

});
