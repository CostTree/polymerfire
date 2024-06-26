/**
@license
Copyright 2016 Google Inc. All Rights Reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file or at
https://github.com/firebase/polymerfire/blob/master/LICENSE
*/

// Polymer imports
import '@polymer/polymer/polymer-legacy.js';
import { AppStorageBehavior } from '@polymer/app-storage/app-storage-behavior';
import { FirebaseCommonBehavior } from './firebase-common-behavior.js';
import '@firebase/database-compat';


// Polymer({
//
//   is: 'firebase-auth',
//
//   behaviors: [
//     Polymer.FirebaseCommonBehavior
//   ],
//
//   properties: {

/** @polymerBehavior Polymer.FirebaseDatabaseBehavior */
export const FirebaseDatabaseBehaviorImpl = {
  properties: {
    db: {
      type: Object,
      computed: '__computeDb(app)'
    },

    ref: {
      type: Object,
      computed: '__computeRef(db, path, disabled)',
      observer: '__refChanged'
    },

    /**
     * Path to a Firebase root or endpoint. N.B. `path` is case sensitive.
     * @type {string|null}
     */
    path: {
      type: String,
      value: null,
      observer: '__pathChanged'
    },

    /**
     * When true, Firebase listeners won't be activated. This can be useful
     * in situations where elements are loaded into the DOM before they're
     * ready to be activated (e.g. navigation, initialization scenarios).
     */
    disabled: {
      type: Boolean,
      value: false
    }
  },

  observers: [
    '__onlineChanged(online)'
  ],

  /**
   * Set the firebase value.
   * @return {!firebase.Promise<void>}
   */
  _setFirebaseValue: function(path, value) {
    this._log('Setting Firebase value at', path, 'to', value)
    var key = value && value.$key;
    var leaf = value && value.hasOwnProperty('$val');
    if (key) {
      value.$key = null;
    }
    var result = this.db.ref(path).set(leaf ? value.$val : value);
    if (key) {
      value.$key = key;
    }
    return result;
  },

  __computeDb: function(app) {
    return app ? app.database() : null;
  },

  __computeRef: function(db, path) {
    if (db == null ||
        path == null ||
        !this.__pathReady(path) ||
        this.disabled) {
      return null;
    }

    return db.ref(path);
  },

  /**
   * Override this method if needed.
   * e.g. to detach or attach listeners.
   */
  __refChanged: function(ref, oldRef){
    return;
  },

  __pathChanged: function(path, oldPath) {
    if (!this.disabled && !this.valueIsEmpty(this.data)) {
      this.syncToMemory(function() {
        this.data = this.zeroValue;
        this.__needSetData = true;
      });
    }
  },

  __pathReady: function(path) {
    return path && path.split('/').slice(1).indexOf('') < 0;
  },

  __onlineChanged: function(online) {
    if (!this.ref) {
      return;
    }

    if (online) {
      this.db.goOnline();
    } else {
      this.db.goOffline();
    }
  }
};

/** @polymerBehavior */
export const FirebaseDatabaseBehavior = [
  AppStorageBehavior,
  FirebaseCommonBehavior,
  FirebaseDatabaseBehaviorImpl
];
