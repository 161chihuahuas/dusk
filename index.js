'use strict';

/**
 * Returns a new {@link KademliaNode}
 */
module.exports = function(options) {
  return new module.exports.KademliaNode(options);
};

/** {@link KademliaNode} */
module.exports.KademliaNode = require('./lib/node-kademlia');

/** {@link KademliaRules} */
module.exports.KademliaRules = require('./lib/rules-kademlia');

/** {@link AbstractNode} */
module.exports.AbstractNode = require('./lib/node-abstract');

/** {@link ErrorRules} */
module.exports.ErrorRules = require('./lib/rules-errors');

/** {@link Bucket} */
module.exports.Bucket = require('./lib/bucket');

/** {@link Control} */
module.exports.Control = require('./lib/control');

/** {@link Messenger} */
module.exports.Messenger = require('./lib/messenger');

/** {@link RoutingTable} */
module.exports.RoutingTable = require('./lib/routing-table');

/** {@link HTTPTransport} */
module.exports.HTTPTransport = require('./lib/transport-http');

/** { @link DAGEntry } */
module.exports.DAGEntry = require('./lib/dag-entry');

/** {@link MerkleTree } */
module.exports.MerkleTree = require('./lib/merkle-tree');

/** {@link module:ftp} */
module.exports.ftp = require('ftp-srv');

/** {@link VirtualFS } */
module.exports.VirtualFS = require('./lib/virtual-fs');

/** {@link module.reedsol } */
module.exports.reedsol = require('./lib/reed-solomon');

/** {@link module:dusk/onion} */
module.exports.onion = require('./lib/plugin-onion');

/** {@link module:dusk/quasar} */
module.exports.quasar = require('./lib/plugin-quasar');

/** {@link module:dusk/spartacus} */
module.exports.spartacus = require('./lib/plugin-spartacus');

/** {@link module:dusk/eclipse} */
module.exports.eclipse = require('./lib/plugin-eclipse');

/** {@link module:dusk/contentaddress} */
module.exports.contentaddress = require('./lib/plugin-contentaddress');

/** {@link module:dusk/logger} */
module.exports.logger = require('./lib/plugin-logger');

/** {@link module:dusk/constants} */
module.exports.constants = require('./lib/constants');

/** {@link module:dusk/version} */
module.exports.version = require('./lib/version');

/** {@link module:dusk/utils} */
module.exports.utils = require('./lib/utils');


