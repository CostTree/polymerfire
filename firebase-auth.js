/**
@license
Copyright 2016 Google Inc. All Rights Reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file or at
https://github.com/firebase/polymerfire/blob/master/LICENSE
*/
/*
`firebase-auth` is a wrapper around the Firebase authentication API. It notifies
successful authentication, provides user information, and handles different
types of authentication including anonymous, email / password, and several OAuth
workflows.

Example Usage:
```html
<firebase-app auth-domain="polymerfire-test.firebaseapp.com"
  database-url="https://polymerfire-test.firebaseio.com/"
  api-key="AIzaSyDTP-eiQezleFsV2WddFBAhF_WEzx_8v_g">
</firebase-app>
<firebase-auth id="auth" user="{{user}}" provider="google" on-error="handleError">
</firebase-auth>
```

The `firebase-app` element initializes `app` in `firebase-auth` (see
`firebase-app` documentation for more information), but an app name can simply
be specified at `firebase-auth`'s `app-name` property instead.

JavaScript sign-in calls can then be made to the `firebase-auth` object to
attempt authentication, e.g.:

```javascript
this.$.auth.signInWithPopup()
    .then(function(response) {// optionally handle a successful login})
    .catch(function(error) {// unsuccessful authentication response here});
```

This popup sign-in will then attempt to sign in using Google as an OAuth
provider since there was no provider argument specified and since `"google"` was
defined as the default provider.

The `user` property will automatically be populated if an active session is
available, so handling the resolved promise of sign-in methods is optional.

It's important to note that if you're using a Service Worker, and hosting on
Firebase, you should let urls that contain `/__/` go through to the network,
rather than have the Service Worker attempt to serve something from the cache.
The `__` namespace is reserved by Firebase and intercepting it will cause the
OAuth sign-in flow to break.

If you are self-deploying your app to some non-Firebase domain, this shouldn't
be a problem.
*/
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/

// Polymer imports
import '@polymer/polymer/polymer-legacy.js';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';
import firebase from '@firebase/app-compat';
import { FirebaseCommonBehavior } from './firebase-common-behavior.js';
import '@firebase/auth-compat';

Polymer({

  is: 'firebase-auth',

  behaviors: [
    FirebaseCommonBehavior
  ],

  properties: {
    /**
     * [`firebase.Auth`](https://firebase.google.com/docs/reference/js/firebase.auth.Auth) service interface.
     */
    auth: {
      type: Object,
      computed: '_computeAuth(app)',
      observer: '__authChanged'
    },

    /**
     * Default auth provider OAuth flow to use when attempting provider
     * sign in. This property can remain undefined when attempting to sign
     * in anonymously, using email and password, or when specifying a
     * provider in the provider sign-in function calls (i.e.
     * `signInWithPopup` and `signInWithRedirect`).
     *
     * Current accepted providers are:
     *
     * ```
     * 'facebook'
     * 'github'
     * 'google'
     * 'twitter'
     * ```
     */
    provider: {
      type: String,
      notify: true
    },

    /**
     * Email field value.
     *
     * @type {String}
     */
    email: {
      type: String
    },

    /**
     * Password field value.
     *
     * @type {String}
     */
    password: {
      type: String
    },

    /**
     * True if the client is authenticated, and false if the client is not
     * authenticated.
     */
    signedIn: {
      type: Boolean,
      computed: '_computeSignedIn(user)',
      notify: true
    },

    /**
     * The currently-authenticated user with user-related metadata. See
     * the [`firebase.User`](https://firebase.google.com/docs/reference/js/firebase.User)
     * documentation for the spec.
     */
    user: {
      type: Object,
      readOnly: true,
      value: null,
      notify: true
    },

    /**
     * When true, login status can be determined by checking `user` property.
     */
    statusKnown: {
      type: Boolean,
      value: false,
      notify: true,
      readOnly: true,
      reflectToAttribute: true
    }

  },

  /**
   * Authenticates a Firebase client using a new, temporary guest account.
   *
   * @return {Promise} Promise that handles success and failure.
   */
  signInAnonymously: function() {
    if (!this.auth) {
      return Promise.reject('No app configured for firebase-auth!');
    }

    return this._handleSignIn(this.auth.signInAnonymously());
  },

  /**
   * Authenticates a Firebase client using a custom JSON Web Token.
   *
   * @return {Promise} Promise that handles success and failure.
   */
  signInWithCustomToken: function(token) {
    if (!this.auth) {
      return Promise.reject('No app configured for firebase-auth!');
    }
    return this._handleSignIn(this.auth.signInWithCustomToken(token));
  },

  /**
   * Authenticates a Firebase client using an oauth id_token.
   *
   * @return {Promise} Promise that handles success and failure.
   */
  signInWithCredential: function(credential) {
    if (!this.auth) {
      return Promise.reject('No app configured for firebase-auth!');
    }
    return this._handleSignIn(this.auth.signInWithCredential(credential));
  },

  /**
   * Authenticates a Firebase client using a popup-based OAuth flow.
   *
   * @param  {?String} provider Provider OAuth flow to follow. If no
   * provider is specified, it will default to the element's `provider`
   * property's OAuth flow (See the `provider` property's documentation
   * for supported providers).
   * @return {Promise} Promise that handles success and failure.
   */
  signInWithPopup: function(provider) {
    return this._attemptProviderSignIn(this._normalizeProvider(provider), this.auth.signInWithPopup);
  },

  /**
   * Authenticates a firebase client using a redirect-based OAuth flow.
   *
   * @param  {?String} provider Provider OAuth flow to follow. If no
   * provider is specified, it will default to the element's `provider`
   * property's OAuth flow (See the `provider` property's documentation
   * for supported providers).
   * @return {Promise} Promise that handles failure. (NOTE: The Promise
   * will not get resolved on success due to the inherent page redirect
   * of the auth flow, but it can be used to handle errors that happen
   * before the redirect).
   */
  signInWithRedirect: function(provider) {
    return this._attemptProviderSignIn(this._normalizeProvider(provider), this.auth.signInWithRedirect);
  },

  /**
   * Authenticates a Firebase client using an email / password combination.
   *
   * @param  {!String} email Email address corresponding to the user account.
   * @param  {!String} password Password corresponding to the user account.
   * @return {Promise} Promise that handles success and failure.
   */
  signInWithEmailAndPassword: function(email, password) {

    return this._handleSignIn(this.auth.signInWithEmailAndPassword(email, password));
  },

  /**
   * Creates a new user account using an email / password combination.
   *
   * @param  {!String} email Email address corresponding to the user account.
   * @param  {!String} password Password corresponding to the user account.
   * @return {Promise} Promise that handles success and failure.
   */
  createUserWithEmailAndPassword: function(email, password) {
    return this._handleSignIn(this.auth.createUserWithEmailAndPassword(email, password));
  },

  /**
   * Sends a password reset email to the given email address.
   *
   * @param  {!String} email Email address corresponding to the user account.
   * @return {Promise} Promise that handles success and failure.
   */
  sendPasswordResetEmail: function(email) {
    return this._handleSignIn(this.auth.sendPasswordResetEmail(email));
  },

  /**
   * Unauthenticates a Firebase client.
   *
   * @return {Promise} Promise that handles success and failure.
   */
  signOut: function() {
    if (!this.auth) {
      return Promise.reject('No app configured for auth!');
    }

    return this.auth.signOut();
  },

  _attemptProviderSignIn: function(provider, method) {
    provider = provider || this._providerFromName(this.provider);
    if (!provider) {
      return Promise.reject('Must supply a provider for popup sign in.');
    }
    if (!this.auth) {
      return Promise.reject('No app configured for firebase-auth!');
    }

    return this._handleSignIn(method.call(this.auth, provider));
  },

  _providerFromName: function(name) {
    switch (name) {
      case 'facebook': return new firebase.auth.FacebookAuthProvider();
      case 'github': return new firebase.auth.GithubAuthProvider();
      case 'google': return new firebase.auth.GoogleAuthProvider();
      case 'twitter': return new firebase.auth.TwitterAuthProvider();
      default: this.fire('error', 'Unrecognized firebase-auth provider "' + name + '"');
    }
  },

  _normalizeProvider: function(provider) {
    if (typeof provider === 'string') {
      return this._providerFromName(provider);
    }
    return provider;
  },

  _handleSignIn: function(promise) {
    return promise.catch(function(err) {
      this.fire('error', err);
      throw err;
    }.bind(this));
  },

  _computeSignedIn: function(user) {
    return !!user;
  },

  _computeAuth: function(app) {
    return this.app.auth();
  },

  __authChanged: function(auth, oldAuth) {
    this._setStatusKnown(false);
    if (oldAuth !== auth && this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    if (this.auth) {
      this._unsubscribe = this.auth.onAuthStateChanged(function(user) {
        this._setUser(user);
        this._setStatusKnown(true);
      }.bind(this), function(err) {
        this.fire('error', err);
      }.bind(this));
    }
  }
});
