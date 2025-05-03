'use strict';

const { URL } = require('node:url');
const utils = require('./utils');
const assert = require('node:assert');


class Link {

  constructor(dref) {
    this.dref = dref;
    this.type = null;
    this.key = null;
    this.path = '/';
    this.pubkey = null;
    this.nonce = null;
    this.onion = null;
    this.port = 80;
    this.protocol = 'dusk:'
    this.priv = null;
  } 

  static get TYPES() {
    return [
      'node',
      'blob',
      'drop',
      'wdav',
      'link'
    ];
  }

  static fromContact([id, contact]) {
    const link = new Link(null);
    link.type = 'link';
    link.key = Buffer.isBuffer(id) ? id.toString('hex') : id;
    link.pubkey = contact.pubkey;
    link.proof = contact.proof;
    link.nonce = contact.nonce;
    link.onion = contact.hostname.split('.onion')[0];
    link.path = '/' + [
      contact.pubkey, 
      contact.proof, 
      contact.nonce, 
      link.onion
    ].join('/');
    link.dref = link.toString();
    link.port = 80;

    link.parse();
    
    return link;
  }

  parse() {
    const parsedUrl = new URL(this.dref);
    this.priv = parsedUrl.hash;
    const [key, type] = parsedUrl.hostname.split('.');
    this.key = key;
    this.type = type;
    this.path = parsedUrl.pathname;

    if (type === 'link') {
      const [, pubkey, proof, nonce, onion] = this.path.split('/');
      this.pubkey = pubkey;
      this.proof = proof;
      this.nonce = parseInt(nonce);
      this.onion = onion;
    }

    if (type === 'blob') {
      if (parsedUrl.hash) {
        this.priv = parsedUrl.hash.substring(1);
      }
    }
  }

  toString() {
    return [
      this.protocol,
      '//',
      this.key,
      '.',
      this.type,
      this.path,
      this.priv ? '#' : '',
      this.priv || ''
    ].join('');
  }

  validate() {
    assert(Link.TYPES.includes(this.type), 
      'Invalid link type');
    assert(utils.isHexaString(this.key), 
      'Key is not a valid hex string');
    
    if (this.type === 'link') {
      assert(utils.isHexaString(this.proof), 
        'Proof is not a valid hex string');
      assert(Number.isInteger(this.nonce), 
        'Nonce is not a valid integer');
      assert(utils.isHexaString(this.pubkey), 
        'Public key is not a valid hex string');
    }
    
    if (this.type === 'blob' && this.priv) {
      assert(utils.isHexaString(this.priv), 
        'Private key is not a valid hex string');
    }
  }

}

class Resolver {

  constructor(rpc) {
    this.rpc = rpc;
  }

  resolve(link) {
    if (typeof link === 'string') {
      link = new Link(link);
    } else if (!(link instanceof Link)) {
      throw new TypeError('Invalid link provided to resolver');
    }

    switch (link.type) {
      case 'node':
        return this._resolveNode(link);
      case 'blob':
        return this._resolveBlob(link);
      case 'drop':
        return this._resolveDrop(link);
      case 'wdav':
        return this._resolveWdav(link);
      case 'link':
        return this._resolveLink(link);
      default:
        throw new Error('Cannot resolve link type ' + link.type);
    }
  }

  _resolveNode(link) {
    function checkLocalRouter() {
      return new Promise((resolve, reject) => {
        this.rpc.invoke('getinfo', [], (err, info) => {
          if (err) {
            return reject(err);
          }

          for (let p = 0; p < info.peers.length; p++) {
            let [id, contact] = info.peers[p];

            if (link.key === id) {
              return resolve(contact);
            }
          }

          resolve(null);
        });
      });
    }

    function iterativeFindNode() {
      return new Promise((resolve, reject) => {
        this.rpc.invoke('findnode', [link.key], (err, list) => {
          if (err) {
            return reject(err);
          }

          for (let p = 0; p < list.length; p++) {
            let [id, contact] = list[p];

            if (link.key === id) {
              return resolve(contact);
            }
          }

          resolve(null);
        });
      });
    }

    return new Promise(async (resolve, reject) => {
      let node;

      try {
        node = await checkLocalRouter();
      } catch (err) {
        return reject(err);
      }

      if (!node) {
        try {
          node = await iterativeFindNode();
        } catch (err) {
          return reject(err);
        }
      }

      if (!node) {
        return reject(new Error('Node not found'));
      }

      resolve(node);
    });
  }

  _resolveBlob(link) {
    function checkLocalDatabase() {
      return new Promise((resolve, reject) => {
        this.rpc.invoke('getlocal', [link.key], (err, blob) => {
          if (err) {
            return reject(err);
          }

          resolve(blob);
        });
      });
    }

    function iterativeFindValue() {
      return new Promise((resolve, reject) => {
        this.rpc.invoke('findvalue', [link.key], (err, blob) => {
          if (err) {
            return reject(err);
          }

          if (Array.isArray(blob)) {
            return reject(new Error('Blob not found'));
          }

          resolve(blob);
        });
      });
    }

    return new Promise(async (resolve, reject) => {
      let blob;

      try {
        blob = await checkLocalDatabase();
      } catch (err) {
        return reject(err);
      }

      if (!blob) {
        try {
          blob = await iterativeFindValue();
        } catch (err) {
          return reject(err);
        }
      }

      if (!blob) {
        return reject(new Error('Node not found'));
      }

      resolve(blob);
    });
  }

  _resolveDrop(link) {
    return new Promise((resolve, reject) => {
      this._resolveNode(link.key).then((node) => {
        if (!node.drphost) {
          return reject(new Error('Node does not advertise a dropbox'));
        }

        resolve('http://' + node.drphost + '.onion');
      }, reject);
    });    
  }

  _resolveWdav(link) {
    return new Promise((resolve, reject) => {
      this._resolveNode(link.key).then((node) => {
        if (!node.davhost) {
          return reject(new Error('Node does not advertise a public DAV'));
        }

        resolve('dav://' + node.davhost + '.onion/Public');
      }, reject);
    });
  }
  
  _resolveLink(link) {
    return new Promise((resolve, reject) => {
      this.rpc.invoke('connect', [link.toString()], (err) => {
        if (err) {
          return reject(err);
        }

        resolve(link);
      });
    });
  }

}

module.exports = Link;
module.exports.Resolver = Resolver;
