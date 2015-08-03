var BASE = 'extensions.periodic-memory-usage-dumper@piro.sakura.ne.jp.';
var prefs = require('lib/prefs').prefs;

{
  prefs.setDefaultPref(BASE + 'anonymize', false);
  prefs.setDefaultPref(BASE + 'intervalSeconds', 60);

  let dir = Cc['@mozilla.org/file/directory_service;1']
               .getService(Components.interfaces.nsIProperties)
               .get('Home', Components.interfaces.nsIFile);
  dir.append('firefox-memory-usage');
  prefs.setDefaultPref(BASE + 'outputDirectory', dir.path);
}

var timer = Cu.import('resource://gre/modules/Timer.jsm');
var { Promise } = Cu.import('resource://gre/modules/Promise.jsm');

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

  dumpMemoryUsage: function() {
  console.log('dump start');
  return new Promise((function(resolve, reject) {
    var localName = this.generateDumpFilename();
    var file = Cc['@mozilla.org/file/local;1']
                 .createInstance(Ci.nsILocalFile);
    file.initWithPath(prefs.getPref(BASE + 'outputDirectory'));
    file.append(localName);
    this.prepareDirectory(file.parent);

    var anonymize = prefs.getPref(BASE + 'anonymize');
    var start = Date.now();
    var dumper = Cc['@mozilla.org/memory-info-dumper;1']
                   .getService(Ci.nsIMemoryInfoDumper);
    dumper.dumpMemoryReportsToNamedFile(file.path, function() {
      console.log('dump finish (' + ((Date.now() - start) / 1000) + 'sec.)');
      resolve();
    }, null, anonymize);
  }).bind(this));
  },

  lastTimeout: null,

  onTimeout: function() {
    this.dumpMemoryUsage()
    .then((function() {
      var interval = Math.max(1, prefs.getPref(BASE + 'intervalSeconds'));
      lastTimeout = timer.setTimeout(this.onTimeout.bind(this), interval * 1000);
    }).bind(this))
    .catch(function(error) {
      Cu.reportError(error);
    });
  }
};

periodicDumper.onTimeout();

function shutdown() {
  if (periodicDumper.lastTimeout)
    timer.clearTimeout(periodicDumper.lastTimeout);

  timer = Promise = prefs =
    periodicDumper =
      undefined;
}
