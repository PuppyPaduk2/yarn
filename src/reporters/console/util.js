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

import type {Stdout} from '../types.js';

const readline = require('readline');

export function clearLine(stdout: Stdout) {
  readline.clearLine(stdout, 0);
  readline.cursorTo(stdout, 0);
}

export function writeOnNthLine(stdout: Stdout, n: number, msg: string) {
  if (n == 0) {
    clearLine(stdout);
    stdout.write(msg);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  readline.clearLine(stdout, 0);
  stdout.write(msg);
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, n);
}

export function clearNthLine(stdout: Stdout, n: number) {
  if (n == 0) {
    clearLine(stdout);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  readline.clearLine(stdout, 0);
  readline.moveCursor(stdout, 0, n);
}
