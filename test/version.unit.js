'use strict';

const { expect } = require('chai');
const version = require('../lib/version');


describe('@module dusk/version', function() {

  describe('@function toString', function() {

    it('should return the version string', function() {
      expect(version.toString()).to.equal(
        `dusk v${version.software} protocol v${version.protocol}`
      );
    });

  });

});
