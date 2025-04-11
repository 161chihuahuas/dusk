'use strict';

const { FileSystem } = require('ftp-srv');

class VirtualFS extends FileSystem {
  constructor(config, secret) {
    super(...arguments);

  }

  currentDirectory() {

  }

  get(fileName) {
    
  }

  list(path) {

  }

  chdir(path) {

  }

  mkdir(path) {
    
  }

  write(filename, append, start) {

  }

  read(filename, start) {

  }

  delete(path) {

  }

  rename(from, to) {

  }

  chmod(path) {

  }

  getUniqueName(filename) {

  }
}

module.exports = VirtualFS;
