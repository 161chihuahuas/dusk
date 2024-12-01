'use strict';

const constants = require('./constants');
const version = require('./version');
const utils = require('./utils');
const http = require('node:http');


/**
 * The Dusk daemon can be controlled by another process on the same host or
 * remotely via socket connection. By default, the daemon is configured to
 * listen on a UNIX domain socket located at $HOME/.config/dusk/dusk.sock.
 * Once connected to the daemon, you may send it control commands to build
 * networks in other languages. The controller understands newline terminated
 * JSON-RPC 2.0 payloads.
 */
class Control {

  /**
   * @constructor
   * @param {KademliaNode} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * @private
   */
  _parseMethodSignature(name) {
    const method = name;
    const func = this[method].toString();
    const args = func.split(`${method}(`)[1].split(')')[0];
    const params = args.split(', ').map(s => s.trim());

    params.pop();

    return { method, params };
  }

  help() {
    this.listrpcs.apply(this, arguments);
  }

  /**
   * Returns a list of the support methods from the controller
   * @param {Control~listMethodsCallback} callback
   */
  listrpcs(callback) {
    if (arguments.length > 1) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    callback(null, Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => {
        return method[0] !== '_' && method !== 'constructor' &&
          typeof this[method] === 'function';
      })
      .map(this._parseMethodSignature.bind(this))
      .sort((a, b) => b.method < a.method));
  }
  /**
   * @callback Control~listMethodsCallback
   * @param {error|null} error
   * @param {object[]} methods
   * @param {string} methods.method
   * @param {string[]} methods.params
   */

  /**
   * Returns basic informations about the running node
   * @param {Control~getProtocolInfoCallback} callback
   */
  getinfo(callback) {
    if (arguments.length > 1) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    const peers = [], dump = this.node.router.getClosestContactsToKey(
      this.node.identity,
      constants.K * constants.B
    );

    for (let peer of dump) {
      peers.push(peer);
    }

    callback(null, {
      versions: version,
      identity: this.node.identity.toString('hex'),
      contact: this.node.contact,
      dref: utils.getContactURL([this.node.identity, this.node.contact]),
      peers
    });
  }
  /**
   * @callback Control~getProtocolInfoCallback
   * @param {error|null} error
   * @param {object} info
   * @param {object} info.versions
   * @param {string} info.versions.software
   * @param {string} info.versions.protocol
   * @param {string} info.identity
   * @param {object} info.contact
   * @param {array[]} info.peers
   */

  /**
   * {@link KademliaNode#iterativeFindNode}
   */
  /* istanbul ignore next */
  findnode(hexKey, callback) {
    if (arguments.length !== 2) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    this.node.iterativeFindNode(hexKey, callback);
  }

  /**
   * {@link KademliaNode#iterativeFindValue}
   */
  /* istanbul ignore next */
  findvalue(hexKey, callback) {
    if (arguments.length !== 2) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }

    //TODO reedsol, merkle tree, recursion

    this.node.iterativeFindValue(Buffer.from(hexKey, 'hex'), callback);
  }

  /**
   * {@link KademliaNode#iterativeStore}
   */
  /* istanbul ignore next */
  storevalue(hexValue, callback) {
    if (arguments.length !== 2) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }

    let hexKey = utils.hash160(Buffer.from(hexValue, 'hex')).toString('hex');
    this.node.iterativeStore(hexKey, hexValue, function(err, count) {
      if (err) {
        return callback(err);
      }

      callback(null, count, hexKey);
    });
  }

  subscribe(hexKey, onionAddrHook, callback) {
    if (arguments.length !== 3) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    this.node.quasarSubscribe(hexKey, (contents, topic) => { 
      this.node.logger.info('sending onion hook for topic %s', topic);
      const agent = this.node.onion.createSocksAgent();
      const payload = JSON.stringify(contents);
      const webhook = http.request('http://' + onionAddrHook, {
        agent,
        method: 'POST',
        headers: {
          'Connection': 'keep-alive',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, resp => {
        resp.on('error', err => {
          this.node.logger.error('onion hook response error, %s', err.message);
        });
      });
      webhook.on('error', err => {
        this.node.logger.error('onion hook failed, %s', err.message);
      });
      webhook.write(payload);
      webhook.end();
    });
    callback(null, {
      topic: hexKey,
      onion: onionAddrHook,
      registered: Date.now()
    });
  }

  publish(hexValue, callback) {
    if (arguments.length !== 2) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    this.node.quasarPublish(Buffer.from(hexValue, 'hex'), callback);

  }

  replicate(callback) {
    if (arguments.length > 1) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    this.node.replicate(callback);
  }

  expire(callback) {
    if (arguments.length > 1) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    this.node.expire(callback);
  }

  refresh(callback) {
    if (arguments.length > 1) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }
    this.node.refresh(callback);
  }

  connect(seedString, callback) {
    if (arguments.length !== 2) {
      return arguments[arguments.length - 1](new Error('Invalid params'));
    }

    this.node.join(utils.parseContactURL(seedString), callback);
  }

}

module.exports = Control;
