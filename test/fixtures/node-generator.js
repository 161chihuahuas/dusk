'use strict';

const bunyan = require('bunyan');
const levelup = require('levelup');
const memdown = require('memdown');
const dusk = require('../..');
const encoding = require('encoding-down');

let startPort = 65000;


module.exports = function(numNodes, Transport) {

  const nodes = [];

  const logger = bunyan.createLogger({
    name: 'node-kademlia'
  });
  const storage = levelup(encoding(memdown()));

  function createNode() {
    let transport = new Transport({ allowLoopbackAddresses: true });
    let contact = { hostname: '127.0.0.1', port: startPort-- };

    return new dusk.KademliaNode({
      transport: transport,
      contact: contact,
      storage: storage,
      logger: logger
    });
  }

  for (let i = 0; i < numNodes; i++) {
    nodes.push(createNode());
  }

  return nodes;
};
