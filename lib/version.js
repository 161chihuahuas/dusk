/**
 * @module dusk/version
 */

'use strict';

var semver = require('semver');
var assert = require('node:assert');

module.exports = {
  /**
   * @constant {string} protocol - The supported protocol version
   */
  protocol: '0.0.0',
  /**
   * @constant {string} software - The current software version
   */
  software: require('../package').version,
  /**
   * Returns human readable string of versions
   * @function
   * @returns {string}
   */
  toString: function() {
    let { software, protocol } = module.exports;
    return `dusk v${software} protocol v${protocol}`;
  }
};

assert(
  semver.valid(module.exports.protocol),
  'Invalid protocol version specified'
);
