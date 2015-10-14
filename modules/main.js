/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var BASE = 'extensions.periodic-memory-usage-dumper@clear-code.com.';
var prefs = require('lib/prefs').prefs;

var MINUTE_IN_SECONDS = 60;
var HOUR_IN_MINUTES = 60;
var DAY_IN_HOURS = 24;
var DAY_IN_SECONDS = DAY_IN_HOURS * HOUR_IN_MINUTES * MINUTE_IN_SECONDS;
{
  if (prefs.getDefaultPref(BASE + 'debug') === null)
    prefs.setDefaultPref(BASE + 'debug', false);
  if (prefs.getDefaultPref(BASE + 'anonymize') === null)
    prefs.setDefaultPref(BASE + 'anonymize', false);
  if (prefs.getDefaultPref(BASE + 'intervalSeconds') === null)
    prefs.setDefaultPref(BASE + 'intervalSeconds', 5 * MINUTE_IN_SECONDS);
  if (prefs.getDefaultPref(BASE + 'idleSeconds') === null)
    prefs.setDefaultPref(BASE + 'idleSeconds', 3 * MINUTE_IN_SECONDS);
  // 5 days * 8 hours per a day * 60 minutes in one hour / every 5 minutes = 480 files per a week
  if (prefs.getDefaultPref(BASE + 'maxFiles') === null)
    prefs.setDefaultPref(BASE + 'maxFiles', 500);

  if (prefs.getDefaultPref(BASE + 'outputDirectory') === null) {
    prefs.setDefaultPref(BASE + 'outputDirectory', '[ProfD]memory-usage-dumps');
  }
}

var timer = Cu.import('resource://gre/modules/Timer.jsm', {});
var { Promise } = Cu.import('resource://gre/modules/Promise.jsm', {});
var { Services } = Cu.import('resource://gre/modules/Services.jsm', {});

var isWindows = /^win/i.test(Services.appinfo.OS);
var pathDelimiter = isWindows ? '\\' : '/' ;

var periodicDumper = {
  generateDumpFilename: function() {
    var now = new Date();
    var timestamp = now.toISOString().replace(/:/g, '-');
    return timestamp + '.json.gz';
  },

  prepareDirectory: function(aDir) {
    if (aDir.parent)
      this.prepareDirectory(aDir.parent);
    if (!aDir.exists())
      aDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0700);
  },

  getOutputDirectory: function() {
    var path = prefs.getPref(BASE + 'outputDirectory');
    var DIRService = Cc['@mozilla.org/file/directory_service;1']
                       .getService(Ci.nsIProperties)
    path = path.replace(/\[[\\]]+\]/g, function(matched) {
      var name = matched.replace(/^\[|\]$/g, '');
      try {
        let file = DIRService.get(name, Ci.nsIFile);
        return file.path + pathDelimiter;
      }
      catch(error) {
        return matched;
      }
    });
    var file = Cc['@mozilla.org/file/local;1']
                 .createInstance(Ci.nsILocalFile);
    file.initWithPath(path);
    return file;
  },

  dumpMemoryUsage: function() {
    if (prefs.getPref(BASE + 'debug'))
      console.log('dump start');
    return new Promise((function(resolve, reject) {
      var localName = this.generateDumpFilename();
      var file = this.getOutputDirectory();
      file.append(localName);
      this.prepareDirectory(file.parent);

      var anonymize = prefs.getPref(BASE + 'anonymize');
      var start = Date.now();
      var dumper = Cc['@mozilla.org/memory-info-dumper;1']
                     .getService(Ci.nsIMemoryInfoDumper);
      dumper.dumpMemoryReportsToNamedFile(file.path, function() {
        if (prefs.getPref(BASE + 'debug'))
          console.log('dump finish (' + ((Date.now() - start) / 1000) + 'sec.)');
        resolve();
      }, null, anonymize);
    }).bind(this));
  },

  clearTooManyFiles: function() {
    var dir = this.getOutputDirectory();
    if (!dir.exists())
      return;

    var files = dir.directoryEntries;
    var allFiles = [];
    while (files.hasMoreElements()) {
      let file = files.getNext().QueryInterface(Ci.nsIFile);
      allFiles.push(file);
    }

    var maxFiles = Math.max(10, prefs.getPref(BASE + 'maxFiles'));
    if (allFiles.length <= maxFiles)
      return;

    allFiles.sort(function(a, b) {
      return b.lastModifiedTime - a.lastModifiedTime;
    });
    var removedFiles = allFiles.slice(maxFiles);
    removedFiles.forEach(function(file) {
      file.remove(true);
    });
  },

  lastTimeout: null,

  onTimeout: function() {
    this.dumpMemoryUsage()
      .then((function() {
        this.clearTooManyFiles();
        var interval = Math.max(1, prefs.getPref(BASE + 'intervalSeconds'));
        this.lastTimeout = timer.setTimeout(this.onTimeout.bind(this), interval * 1000);
      }).bind(this))
      .catch(function(error) {
        Cu.reportError(error);
      });
  },

  start: function() {
    this.stop();
    this.onTimeout();
  },

  stop: function() {
    if (this.lastTimeout)
      timer.clearTimeout(this.lastTimeout);
    this.lastTimeout = null;
  },

  observe: function(aSubject, aTopic, aData) {
    // console.log([aSubject, aTopic, aData]);
    switch (aTopic) {
      case 'idle':
        if (prefs.getPref(BASE + 'debug'))
          console.log('idle: start to dump');
        this.start();
        break;

      case 'active':
        if (prefs.getPref(BASE + 'debug'))
          console.log('active: stop to dump');
        this.stop();
        break;
    }
  }
};

var idleService = Cc['@mozilla.org/widget/idleservice;1']
                    .getService(Ci.nsIIdleService);
var idleSeconds = Math.max(10, prefs.getPref(BASE + 'idleSeconds'));
idleService.addIdleObserver(periodicDumper, idleSeconds);

function shutdown() {
  idleService.removeIdleObserver(periodicDumper, idleSeconds);
  periodicDumper.stop();

  timer = Promise = prefs =
    idleService = periodicDumper =
      undefined;
}
