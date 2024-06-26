/**
@license
Copyright 2016 Google Inc. All Rights Reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file or at
https://github.com/firebase/polymerfire/blob/master/LICENSE
*/
// Polymer imports
import '@polymer/polymer/polymer-legacy.js';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';
import { FirebaseDatabaseBehavior } from './firebase-database-behavior.js';
import firebase from '@firebase/app-compat';

/**
 * The firebase-document element is an easy way to interact with a firebase
 * location as an object and expose it to the Polymer databinding system.
 *
 * For example:
 *
 *     <firebase-document
 *       path="/users/[[userId]]/notes/[[noteId]]"
 *       data="{{noteData}}">
 *     </firebase-document>
 *
 * This fetches the `noteData` object from the firebase location at
 * `/users/${userId}/notes/${noteId}` and exposes it to the Polymer
 * databinding system. Changes to `noteData` will likewise be, sent back up
 * and stored.
 *
 * `<firebase-document>` needs some information about how to talk to Firebase.
 * Set this configuration by adding a `<firebase-app>` element anywhere in your
 * app.
 */
Polymer({
  is: 'firebase-document',

  behaviors: [
    FirebaseDatabaseBehavior
  ],

  attached: function() {
    this.__needSetData = true;
    this.__refChanged(this.ref, this.ref);
  },

  detached: function() {
    if (this.ref) {
      this.ref.off('value', this.__onFirebaseValue, this);
    }
  },


  get isNew() {
    return this.disabled || !this.__pathReady(this.path);
  },


  get zeroValue() {
    return {};
  },

  /**
   * Update the path and write this.data to that new location.
   *
   * Important note: `this.path` is updated asynchronously.
   *
   * @param {string} parentPath The new firebase location to write to.
   * @param {string=} key The key within the parentPath to write `data` to. If
   *     not given, a random key will be generated and used.
   * @return {Promise} A promise that resolves once this.data has been
   *     written to the new path.
   *
   */
  saveValue: function(parentPath, key) {
    return new Promise(function(resolve, reject) {
      var path = null;

      if (!this.app) {
        reject(new Error('No app configured!'));
      }

      if (key) {
        path = parentPath + '/' + key;
        resolve(this._setFirebaseValue(path, this.data));
      } else {
        path = firebase.database(this.app).ref(parentPath)
            .push(this.data, function(error) {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            }).path.toString();
      }

      this.path = path;
    }.bind(this));
  },

  reset: function() {
    this.path = null;
    return Promise.resolve();
  },

  destroy: function() {
    return this._setFirebaseValue(this.path, null).then(function() {
      return this.reset();
    }.bind(this));
  },

  memoryPathToStoragePath: function(path) {
    var storagePath = this.path;

    if (path !== 'data') {
      storagePath += path.replace(/^data\.?/, '/').split('.').join('/');
    }

    return storagePath;
  },

  storagePathToMemoryPath: function(storagePath) {
    var path = 'data';

    storagePath =
        storagePath.replace(this.path, '').split('/').join('.');

    if (storagePath) {
      path += '.' + storagePath;
    }

    return path;
  },

  getStoredValue: function(path) {
    return new Promise(function(resolve, reject) {
      this.db.ref(path).once('value', function(snapshot) {
        var value = snapshot.val();
        if (value == null) {
          resolve(this.zeroValue);
        }
        resolve(value);
      }, this.__onError, this);
    }.bind(this));
  },

  setStoredValue: function(path, value) {
    return this._setFirebaseValue(path, value);
  },

  __refChanged: function(ref, oldRef) {
    if (oldRef) {
      oldRef.off('value', this.__onFirebaseValue, this);
    }

    if (ref) {
      ref.on('value', this.__onFirebaseValue, this.__onError, this);
    }
  },

  __onFirebaseValue: function(snapshot) {
    var value = snapshot.val();

    if (value == null) {
      value = this.zeroValue;
      this.__needSetData = true;
    }

    if (!this.isNew) {
      this.async(function() {
        this.syncToMemory(function() {
          this._log('Updating data from Firebase value:', value);

          // set the value if:
          // it is the first time we run this (or the path has changed and we are back with zeroValue)
          // or if  this.data does not exist
          // or value is primitive
          // or if firebase value obj contain less keys than this.data (https://github.com/Polymer/polymer/issues/2565)
          if (this.__needSetData || !this.data || typeof value !== 'object' || ( Object.keys(value).length <  Object.keys(this.data).length)) {
            this.__needSetData = false;
            return this.set('data', value);
          }

          // now, we loop over keys
          for (var prop in value) {
            if(value[prop] !== this.data[prop]) {
              this.set(['data', prop], value[prop]);
            }
          }
        });
      });
    }
  }
});
