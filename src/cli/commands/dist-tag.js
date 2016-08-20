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

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';

export let {run, setFlags} = buildSubCommands('dist-tag', {
  async add(): Promise<void> {
    throw new Error('TODO');
  },

  async rm(): Promise<void> {
    throw new Error('TODO');
  },

  async ls(): Promise<void> {
    throw new Error('TODO');
  },
});
