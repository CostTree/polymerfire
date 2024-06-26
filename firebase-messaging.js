/**
@license
Copyright 2016 Google Inc. All Rights Reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file or at
https://github.com/firebase/polymerfire/blob/master/LICENSE
*/
/*
`firebase-messaging` is a wrapper around the Firebase Cloud Messaging API. It
allows you to receive Web Push messages in your application, including when
your site isn't in an open tab.

Example Usage:
```html
<firebase-messaging id="messaging"
  token="{{token}}"
  on-message="handleMessage">
</firebase-messaging>
```

Before you can start receiving push messages, you'll need to request permission
to use notifications:

```js
this.$.messaging.requestPermission().then(function() {
  // permission was granted
}, function(err) {
  // permission was denied
});
```

You'll also need to persist your token somewhere that a server can access it so
you can actually send push messsages:

```html
<firebase-messaging token="{{token}}"></firebase-messaging>
<firebase-document path="/users/[[user.uid]]/token" data="[[token]]"></firebase-document>
```

You'll also need a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
for your site. It must contain the following:

```json
{
  "gcm_sender_id": "103953800507"
}
```

**Note:** You must use the **exact line specified above**. Do *not* change the sender
id to your project's individual sender id.

Finally, Firebase Cloud Messaging requires a service worker to handle push messages.
The easiest way is using a service worker called `firebase-messaging-sw.js` in your
app's root directory. See [the FCM docs](https://firebase.google.com/docs/cloud-messaging/js/receive#handle_messages_when_your_web_app_is_in_the_foreground)
for more information.

To use a different service worker than the default, you will need to add the
`custom-sw` attribute to your `<firebase-messaging>` element, and then explicitly
call `.activate()` on the element once you've
*/
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
// Polymer imports
import '@polymer/polymer/polymer-legacy.js';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';
import { FirebaseCommonBehavior } from './firebase-common-behavior.js'; 
import '@firebase/messaging-compat';
var stateMap = {};

/**
 *
 * @param {Object} app
 * @param {string} method
 * @param {...*} var_args
*/
function applyAll(app, method, var_args) {
  var args = Array.prototype.slice.call(arguments, 2);
  stateMap[app.name].instances.forEach(function(el) {
    el[method].apply(el, args);
  });
}

function refreshToken(app) {
  var state = stateMap[app.name];

  app.messaging().getToken().then(function(token) {
    applyAll(app, '_setToken', token);
    applyAll(app, '_setStatusKnown', true);
    return token;
  }, function(err) {
    applyAll(app, '_setToken', null);
    applyAll(app, '_setStatusKnown', true);
    applyAll(app, 'fire', 'error', err);
    throw err;
  });
}

function activateMessaging(el, app) {
  var name = app.name;

  stateMap[name] = stateMap[name] || {messaging: app.messaging()};
  var state = stateMap[name];

  state.instances = state.instances || [];
  if (state.instances.indexOf(el) < 0) {
    state.instances.push(el);
  }

  if (!state.listener) {
    state.listener = app.messaging().onMessage(function(message) {
      state.instances.forEach(function(el) {
        el._setLastMessage(message);
        el.fire('message', {message: message});
      });
    });
  }

  if (!state.tokenListener) {
    state.tokenListener = app.messaging().onTokenRefresh(function() {
      refreshToken(app);
    });
  }

  return refreshToken(app);
}

Polymer({
  is: 'firebase-messaging',

  behaviors: [
    FirebaseCommonBehavior,
  ],

  properties: {
    /**
     * The current registration token for this session. Save this
     * somewhere server-accessible so that you can target push messages
     * to this device.
     * @type {string|null}
     */
    token: {
      type: String,
      value: null,
      notify: true,
      readOnly: true,
    },
    /**
     * True when Firebase Cloud Messaging is successfully
     * registered and actively listening for messages.
     */
    active: {
      type: Boolean,
      notify: true,
      computed: '_computeActive(statusKnown, token)',
    },
    /**
     * True after an attempt has been made to fetch a push
     * registration token, regardless of whether one was available.
     */
    statusKnown: {
      type: Boolean,
      value: false,
      notify: true,
      readOnly: true,
    },
    /**
     * The most recent push message received. Generally in the format:
     *
     *     {
     *       "from": "<sender_id>",
     *       "category": "",
     *       "collapse_key": "do_not_collapse",
     *       "data": {
     *         "...": "..."
     *       },
     *       "notification": {
     *         "...": "..."
     *       }
     *     }
     */
    lastMessage: {
      type: Object,
      value: null,
      notify: true,
      readOnly: true,
    },
    /**
     * When true, Firebase Messaging will not initialize until `activate()`
     * is called explicitly. This allows for custom service worker registration.
     */
    customSw: {
      type: Boolean,
      value: false
    },
    /**
     * True if the Push API is supported in the user's browser.
     */
    pushSupported: {
      type: Boolean,
      value: function() {
        return ('serviceWorker' in navigator && 'PushManager' in window);
      },
      notify: true,
      readOnly: true
    }
  },

  observers: [
    '_bootstrapApp(app, customSw)'
  ],

  /**
   * Requests Notifications permission and returns a `Promise` that
   * resolves if it is granted. Resolves immediately if already granted.
   */
  requestPermission: function() {
    if (!this.messaging) {
      throw new Error('firebase-messaging: No app configured!');
    }

    return this.messaging.requestPermission().then(function() {
      return refreshToken(this.app);
    }.bind(this));
  },

  /**
   * When the `custom-sw` is added to `firebase-messaging`, this method
   * must be called after initialization to start listening for push
   * messages.
   *
   * @param {ServiceWorkerRegistration=}  swreg the custom service worker registration with which to activate
   */
  activate: function(swreg) {
    this.statusKnown = false;
    this.active = false;
    this.token = null;
    if (this.app) {
      this.messaging = this.app.messaging();
      if (swreg) {
        this.messaging.useServiceWorker(swreg);
      }
      activateMessaging(this, this.app);
    } else {
      this.messaging = null;
      this.statusKnown = false;
      this.active = false;
      this.token = null;
      return;
    }
  },

  _computeActive: function(statusKnown, token) {
    return !!(statusKnown && token);
  },

  _bootstrapApp: function(app, customSw) {
    if (app && !customSw) {
      this.activate();
    }
  },
});
