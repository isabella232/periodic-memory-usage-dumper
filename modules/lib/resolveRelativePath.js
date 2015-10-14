/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var EXPORTED_SYMBOLS = ['resolveRelativePath'];

var { Services } = Components.utils.import('resource://gre/modules/Services.jsm', {});

var isWindows = /^win/i.test(Services.appinfo.OS);
var pathDelimiter = isWindows ? '\\' : '/' ;

function resolveRelativePath(aPath) {
  var DIRService = Components.classes['@mozilla.org/file/directory_service;1']
                     .getService(Components.interfaces.nsIProperties)
  aPath = aPath.replace(/\[[^\]]+\]/g, function(matched) {
    var name = matched.replace(/^\[|\]$/g, '');
    try {
      let file = DIRService.get(name, Components.interfaces.nsIFile);
      return file.path + pathDelimiter;
    }
    catch(error) {
      return matched;
    }
  });
  return aPath;
}

function shutdown() {
  Services = isWindows = pathDelimiter =
    resolveRelativePath =
      undefined;
}
