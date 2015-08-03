var BASE = 'extensions.restartless@piro.sakura.ne.jp.';

var prefs = require('lib/prefs').prefs;
prefs.setDefaultPref(BASE + 'anonymize', false);
prefs.setDefaultPref(BASE + 'intervalSeconds', 60);
{
  let dir = Cc['@mozilla.org/file/directory_service;1']
               .getService(Components.interfaces.nsIProperties)
               .get('Home', Components.interfaces.nsIFile);
  dir.append('firefox-memory-usage');
  prefs.setDefaultPref(BASE + 'outputDirectory', dir.path);
}

var timer = Cu.import('resource://gre/modules/Timer.jsm');
var { Promise } = Cu.import('resource://gre/modules/Promise.jsm');

function generateDumpFilename() {
  var now = new Date();
  var timestamp = now.toISOString().replace(/:/g, '-');
  return timestamp + '.json.gz';
}

function prepareDirectory(aDir) {
  if (aDir.parent)
    prepareDirectory(aDir.parent);
  if (!aDir.parent.exists()
    aDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0700);
}

function dumpMemoryUsage() {
  console.log('dump start');
  return new Promise(function(resolve, reject) {
    var localName = generateDumpFilename();
    var file = Cc['@mozilla.org/file/local;1']
                 .createInstance(Ci.nsILocalFile);
    file.initWithPath(prefs.getPref(BASE + 'outputDirectory'));
    file.append(localName);
    prepareDirectory(file.parent);

    var anonymize = prefs.getPref(BASE + 'anonymize');
    var start = Date.now();
    var dumper = Cc['@mozilla.org/memory-info-dumper;1']
                   .getService(Ci.nsIMemoryInfoDumper);
    dumper.dumpMemoryReportsToNamedFile(file.path, function() {
      console.log('dump finish (' + ((Date.now() - start) / 1000) + 'sec.)');
      resolve();
    }, null, anonymize);
  });
}

var lastTimeout;

function onTimeout() {
  dumpMemoryUsage()
    .then(function() {
      var interval = Math.max(1, prefs.getPref(BASE + 'intervalSeconds'));
      lastTimeout = timer.setTimeout(onTimeout, interval * 1000);
    })
    .error(function(error) {
      Cu.reportError(error);
    });
}

onTimeout();

function shutdown() {
  if (lastTimeout)
    timer.clearTimeout(lastTimeout);

  timer = Promise = prefs =
    dumpMemoryUsage = lastTimeout = onTimeout =
      undefined;
}
