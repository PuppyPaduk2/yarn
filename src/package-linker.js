/* @flow */

import type { PackageInfo } from "./types.js";
import type PackageResolver from "./package-resolver.js";
import type Reporter from "./reporters/_base.js";
import type Config from "./config.js";
import normalisePackageInfo from "./util/normalise-package-info/index.js";
import * as promise from "./util/promise.js";
import * as fs from "./util/fs.js";

let invariant = require("invariant");
let cmdShim   = promise.promisify(require("cmd-shim"));
let path      = require("path");
let _         = require("lodash");

export default class PackageLinker {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config   = config;
  }

  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  async link(pkg: PackageInfo, linkBins: boolean): Promise<void> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let dir = path.join(this.config.generateHardModulePath(ref), await ref.getFolder());
    await fs.mkdirp(dir);

    await this.linkModules(pkg, dir);

    if (linkBins) {
      await this.linkBin(pkg, dir);
    }
  }

  async linkBin(pkg: PackageInfo, dir: string): Promise<void> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let remote = pkg.remote;
    invariant(remote, "Package remote is missing");

    // get all dependencies with bin scripts
    let deps = [];
    for (let pattern of ref.dependencies) {
      let dep = this.resolver.getResolvedPattern(pattern);
      if (!_.isEmpty(dep.bin)) {
        deps.push({ dep, loc: this.config.generateHardModulePath(dep.reference) });
      }
    }
    if (pkg.bundleDependencies) {
      for (let depName of pkg.bundleDependencies) {
        let loc = path.join(this.config.generateHardModulePath(ref), await ref.getFolder(), depName);

        let dep = await fs.readPackageJson(loc, remote.registry);
        dep = await normalisePackageInfo(dep, loc);

        if (!_.isEmpty(dep.bin)) {
          deps.push({ dep, loc });
        }
      }
    }
    if (!deps.length) return;

    // ensure our .bin file we're writing these to exists
    let binLoc = path.join(dir, ".bin");
    await fs.mkdirp(binLoc);

    // write the executables
    for (let { dep, loc } of deps) {
      for (let scriptName in dep.bin) {
        let scriptCmd = dep.bin[scriptName];
        let dest      = path.join(binLoc, scriptName);
        let src       = path.join(loc, scriptCmd);

        if (process.platform === "win32") {
          await cmdShim(src, dest);
        } else {
          await fs.symlink(src, dest);
          await fs.chmod(dest, "755");
        }
      }
    }
  }

  async linkModules(pkg: PackageInfo, dir: string): Promise<void> {
    let self = this;
    invariant(pkg.reference, "Package reference is missing");

    await promise.queue(pkg.reference.dependencies, (pattern) => {
      let dep  = self.resolver.getResolvedPattern(pattern);
      let src  = self.config.generateHardModulePath(dep.reference);
      let dest = path.join(dir, dep.name);

      return fs.symlink(src, dest);
    });
  }

  async init(linkBins?: boolean = true): Promise<void> {
    let self = this;
    let pkgs = this.resolver.getPackageInfos();
    let tick = this.reporter.progress(pkgs.length);

    await promise.queue(pkgs, (pkg) => {
      return self.link(pkg, linkBins).then(function () {
        tick(pkg.name);
      });
    });
  }
}
