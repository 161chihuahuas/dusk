/**
 * @module dusk/version
 */

'use strict';

module.exports = {
  /**
   * @constant {string} protocol - The supported protocol version
   */
  protocol: 'voltairine', 
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
    return `dusk v${software}-${protocol}`;
  }
};
