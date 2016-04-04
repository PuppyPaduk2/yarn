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

import type { Manifest } from "./types.js";
import type PackageResolver from "./package-resolver.js";
import type { Reporter } from "kreporters";
import type Config from "./config.js";
import * as promise from "./util/promise.js";
import { entries } from "./util/misc.js";
import * as fs from "./util/fs.js";

let invariant = require("invariant");
let cmdShim   = promise.promisify(require("cmd-shim"));
let semver    = require("semver");
let path      = require("path");
let _         = require("lodash");

type DependencyPairs = Array<{
  dep: Manifest,
  loc: string
}>;

export default class PackageLinker {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config   = config;
  }

  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  async linkSelfDependencies(pkg: Manifest, pkgLoc: string, targetBinLoc: string): Promise<void> {
    for (let [scriptName, scriptCmd] of entries(pkg.bin)) {
      let dest = path.join(targetBinLoc, scriptName);
      let src  = path.join(pkgLoc, scriptCmd);

      if (process.platform === "win32") {
        await cmdShim(src, dest);
      } else {
        await fs.symlink(src, dest);
        await fs.chmod(dest, "755");
      }
    }
  }

  async linkBinDependencies(deps: DependencyPairs, pkg: Manifest, dir: string): Promise<void> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let remote = pkg.remote;
    invariant(remote, "Package remote is missing");

    // link up `bin scripts` in `dependencies`
    for (let pattern of ref.dependencies) {
      let dep = this.resolver.getResolvedPattern(pattern);
      if (!_.isEmpty(dep.bin)) {
        deps.push({ dep, loc: this.config.generateHardModulePath(dep.reference) });
      }
    }

    // link up the `bin` scripts in bundled dependencies
    if (pkg.bundleDependencies) {
      for (let depName of pkg.bundleDependencies) {
        let loc = path.join(this.config.generateHardModulePath(ref), await ref.getFolder(), depName);

        let dep = await this.config.readManifest(loc, remote.registry);

        if (!_.isEmpty(dep.bin)) {
          deps.push({ dep, loc });
        }
      }
    }

    // no deps to link
    if (!deps.length) return;

    // ensure our .bin file we're writing these to exists
    let binLoc = path.join(dir, ".bin");
    await fs.mkdirp(binLoc);

    // write the executables
    for (let { dep, loc } of deps) {
      await this.linkSelfDependencies(dep, loc, binLoc);
    }
  }

  async initCopyModules(patterns: Array<string>): Promise<void> {
    let tree = Object.create(null);
    let self = this;

    //
    function add(pattern, parentParts) {
      if (parentParts.length >= 100) {
        throw new Error("cause we're in too deep");
      }

      let pkg = self.resolver.getResolvedPattern(pattern);
      let loc = self.config.generateHardModulePath(pkg.reference);

      //
      let ownParts = parentParts.slice();
      for (let i = ownParts.length; i >= 0; i--) {
        let checkParts = ownParts.slice(0, i).concat(pkg.name);
        let checkKey = checkParts.join("#");
        let check = tree[checkKey];
        if (check && check.loc === loc) return;
      }
      ownParts.push(pkg.name);

      let key = ownParts.join("#");
      tree[key] = {
        loc,
        pkg,
      };

      // add dependencies
      for (let depPattern of pkg.reference.dependencies) {
        add(depPattern, ownParts);
      }
    }
    for (let pattern of this.resolver.dedupePatterns(patterns)) {
      add(pattern, []);
    }

    // hoist tree
    hoist: for (let key in tree) {
      let parts = key.split("#");
      let info  = tree[key];
      delete tree[key];

      let name = parts.pop();
      while (parts.length) {
        let key = parts.concat(name).join("#");

        let existing = tree[key];
        if (existing) {
          if (existing.loc === info.loc) {
            continue hoist;
          } else {
            break;
          }
        }

        parts.pop();
      }

      parts.push(name);

      tree[parts.join("#")] = info;
    }

    //
    let flatTree = [];
    for (let key in tree) {
      let info = tree[key];
      let loc  = path.join(this.config.cwd, "node_modules", key.replace(/#/g, "/node_modules/"));
      flatTree.push([loc, info]);
    }

    //
    let tickCopyModule = this.reporter.progress(flatTree.length);
    await promise.queue(flatTree, async function ([dest, { loc: src, pkg }]) {
      pkg.reference.setLocation(dest);

      await fs.mkdirp(dest);
      await fs.copy(src, dest);

      tickCopyModule(dest);
    }, 4);

    //
    let tickBin = this.reporter.progress(flatTree.length);
    await promise.queue(flatTree, async function ([dest, { pkg }]) {
      let binLoc = path.join(dest, "node_modules");
      await self.linkBinDependencies([], pkg, binLoc);
      tickBin(dest);
    }, 4);
  }

  async resolvePeerModules(pkg: Manifest): Promise<DependencyPairs> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let deps = [];

    if (!pkg.peerDependencies) return deps;

    for (let name in pkg.peerDependencies) {
      let range = pkg.peerDependencies[name];

      // find a dependency in the tree above us that matches
      let searchPatterns: Array<string> = [];
      for (let request of ref.requests) {
        do {
          // get resolved pattern for this request
          let dep = this.resolver.getResolvedPattern(request.pattern);
          if (!dep) continue;

          //
          searchPatterns = searchPatterns.concat(dep.reference.dependencies);
        } while (request = request.parentRequest);
      }

      // include root seed patterns last
      searchPatterns = searchPatterns.concat(this.resolver.seedPatterns);

      // find matching dep in search patterns
      let foundDep: ?{ pattern: string, version: string, package: Manifest };
      for (let pattern of searchPatterns) {
        let dep = this.resolver.getResolvedPattern(pattern);
        if (dep && dep.name === name) {
          foundDep = { pattern, version: dep.version, package: dep };
          break;
        }
      }

      // validate found peer dependency
      if (foundDep) {
        if (range === "*" || semver.satisfies(range, foundDep.version)) {
          deps.push({
            pattern: foundDep.pattern,
            dep: foundDep.package,
            loc: this.config.generateHardModulePath(foundDep.package.reference)
          });
        } else {
          this.reporter.warn("TODO not match");
        }
      } else {
        this.reporter.warn("TODO missing dep");
      }
    }

    return deps;
  }

  async init(patterns: Array<string>): Promise<void> {
    await this.initCopyModules(patterns);
    await this.saveAll(patterns);
  }

  async save(pattern: string): Promise<void> {
    let resolved = this.resolver.getResolvedPattern(pattern);
    invariant(resolved, `Couldn't find resolved name/version for ${pattern}`);

    let ref = resolved.reference;
    invariant(ref, "Missing reference");

    //
    let src = this.config.generateHardModulePath(ref);

    // link bins
    if (!_.isEmpty(resolved.bin)) {
      let binLoc = path.join(this.config.cwd, await ref.getFolder(), ".bin");
      await fs.mkdirp(binLoc);
      await this.linkSelfDependencies(resolved, src, binLoc);
    }
  }

  async saveAll(deps: Array<string>): Promise<void> {
    deps = this.resolver.dedupePatterns(deps);
    let self = this;
    await promise.queue(deps, (dep) => self.save(dep));
  }
}
