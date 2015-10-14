/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var EXPORTED_SYMBOLS = ['ensureDirectoryExist'];

function ensureDirectoryExist(aDir) {
  if (aDir.parent)
    ensureDirectoryExist(aDir.parent);
  if (!aDir.exists())
    aDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
}

function shutdown() {
  ensureDirectoryExist =
      undefined;
}
