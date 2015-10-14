/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

Components.utils.import('resource://periodic-memory-usage-dumper-resources/modules/lib/ensureDirectoryExist.js');
Components.utils.import('resource://periodic-memory-usage-dumper-resources/modules/lib/resolveRelativePath.js');

function openOutputDirectory() {
  var field = document.getElementById('outputDirectory-textbox');
  var path = resolveRelativePath(field.value);
  var file = Components.classes['@mozilla.org/file/local;1']
               .createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(path);
  ensureDirectoryExist(file);

  if (file.isDirectory()) {
    file.launch();
  }
  else {
    alert('Not a directory');
  }
}
