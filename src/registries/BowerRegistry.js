/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import Registry from './Registry.js';
import * as fs from '../util/fs.js';

const userHome = require('user-home');
const path = require('path');
const _ = require('lodash');

export default class BowerRegistry extends Registry {
  static alwaysFlatten = true;
  static filenames = ['bower.json'];
  static directory = 'bower_components';

  async loadConfig(): Promise<void> {
    // docs: http://bower.io/docs/config/
    // spec: https://github.com/bower/spec/blob/master/config.md

    this.mergeEnv('bower_');

    // merge in configs
    const possibles = [
      path.join('/', '.bowerrc'),
      path.join(userHome, '.bowerrc'),
      // TODO all .bowerrc files upwards the directory tree
      path.join(this.cwd, '.bowerrc'),
    ];
    for (const loc of possibles) {
      if (await fs.exists(loc)) {
        Object.assign(this.config, await fs.readJson(loc));
      }
    }

    _.defaults(this.config, {
      registry: 'https://bower.herokuapp.com',
      directory: 'bower_components',
    });

    // TODO: warn on properties we do not support

    this.folder = this.config.directory;
  }
}
