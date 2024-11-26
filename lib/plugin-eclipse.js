/**
 * @module dusk/eclipse
 */

'use strict';

const assert = require('node:assert');
const utils = require('./utils');
const constants = require('./constants');
const { EventEmitter } = require('node:events');


/**
 * Generates an identity for use with the
 * {@link module:dusk/spartacus~SpartacusPlugin} that satisfies a proof of
 * work
 */
class EclipseIdentity extends EventEmitter {

  /**
   * @constructor
   * @param {string} publicKey - SECP256K1 public key
   * @param {number} [nonce] - Equihash proof nonce
   * @param {buffer} [proof] - Equihash proof value
   */
  constructor(publicKey, nonce, proof) {
    super();

    this.pubkey = publicKey;
    this.nonce = nonce || 0;
    this.proof = proof || Buffer.from([]);
    this.fingerprint = utils.hash160(this.proof);
  }

  /**
   * Returns a equihash proof and resulting fingerprint
   * @returns {Promise<EclipseIdentity>}
   */
  solve() {
    return new Promise((resolve, reject) => {
      utils.eqsolve(
        utils.hash256(this.pubkey),
        constants.IDENTITY_DIFFICULTY.n,
        constants.IDENTITY_DIFFICULTY.k
      ).then(solution => {
        this.nonce = solution.nonce;
        this.proof = solution.proof;
        this.fingerprint = utils.hash160(this.proof);
        resolve(this);
      }, reject);
    });
  }

  /**
   * Validates the
   * @returns {Promise<boolean>}
   */
  validate() {
    return utils.eqverify(utils.hash256(this.pubkey),
      this.proof,
      this.nonce,
      constants.IDENTITY_DIFFICULTY.n,
      constants.IDENTITY_DIFFICULTY.k
    );
  }

}

/**
 * Enforces identities that satisfy a proof of work
 */
class EclipseRules {

  /**
   * @constructor
   * @param {Node} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * Validates all incoming RPC messages
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   */
  validate(request, response, next) {
    const [fingerprint, contact] = request.contact;
    const identity = new EclipseIdentity(
      Buffer.from(contact.pubkey || '', 'hex'),
      contact.nonce,
      Buffer.from(contact.proof || '', 'hex')
    );

    try {
      assert(identity.fingerprint.toString('hex') === fingerprint,
        'Fingerprint does not match the proof hash');
    } catch (err) {
      return next(err);
    }

    return identity.validate().then(() => next(), next);
  }

}

/**
 * Enforces proof of work difficulty for entering the routing table and ensures
 * a high degree of randomness in resulting node identity
 */
class EclipsePlugin {

  /**
   * @constructor
   * @param {KademliaNode} node
   * @param {EclipseIdentity} identity
   */
  constructor(node, identity) {
    assert(identity instanceof EclipseIdentity, 'No eclipse identity supplied');

    this.node = node;
    this.rules = new EclipseRules(this.node);
    this.identity = identity;
    this.node.contact.pubkey = identity.pubkey.toString('hex');
    this.node.contact.nonce = identity.nonce;
    this.node.contact.proof = identity.proof.toString('hex');
    this.node.identity = identity.fingerprint;

    this.node.use(this.rules.validate.bind(this.rules));
  }

}

/**
 * Registers a {@link module:dusk/eclipse~EclipsePlugin} with a
 * {@link KademliaNode}
 * @param {EclipseIdentity} identity
 */
module.exports = function(identity) {
  return function(node) {
    return new EclipsePlugin(node, identity);
  }
};

module.exports.EclipsePlugin = EclipsePlugin;
module.exports.EclipseRules = EclipseRules;
module.exports.EclipseIdentity = EclipseIdentity;
