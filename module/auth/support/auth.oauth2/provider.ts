import * as url from 'url';
import { OAuth2Source } from './source';

type SMap<T = any> = { [key: string]: T };

export class AuthOauthProvider {

  constructor(protected oauth2: OAuth2Source, protected options: {
    callbackURL: string;
    scope: string;
    sessionKey?: string;
    store: any;
    shouldSkipUserProfile?: (accessToken: string) => Promise<boolean>;
    scopeSeparator?: string;
    authorizationParams?: (options: SMap) => SMap;
    tokenParams?: (options: SMap) => SMap;
    fetchUserProfile?: (accessToken: string) => Promise<SMap>
  }) {
    this.options = {
      scopeSeparator: ' ',
      authorizationParams: (opts) => ({}),
      tokenParams: (opts) => ({}),
      fetchUserProfile: async (accessToken) => ({}),
      sessionKey: `oauth2:${url.parse(oauth2.authorizeURL).hostname}`,
      ...this.options
    };
  }

  async getUserProfile(accessToken: string) {
    if (!this.options.shouldSkipUserProfile || !(await this.options.shouldSkipUserProfile(accessToken))) {
      return await this.options.fetchUserProfile!(accessToken);
    } else {
      return {};
    }
  }

  authenticate(req: { query: SMap }, options: { callbackURL?: string } = {}) {
    options = options || {};

    if (req.query && req.query.error) {
      if (req.query.error === 'access_denied') {
        throw new Error(req.query.error_description);
      } else {
        throw new Error(req.query.error_description);
      }
    }

    let callbackURL = options.callbackURL || this.options.callbackURL;

    if (callbackURL) {
      parsed = url.parse(callbackURL);
      if (!parsed.protocol) {
        // The callback URL is relative, resolve a fully qualified URL from the
        // URL of the originating request.
        callbackURL = url.resolve(utils.originalURL(req, { proxy: this._trustProxy }), callbackURL);
      }
    }

    var meta = {
      authorizationURL: this._oauth2._authorizeUrl,
      tokenURL: this._oauth2._accessTokenUrl,
      clientID: this._oauth2._clientId
    }

    if (req.query && req.query.code) {
      function loaded(err, ok, state) {
        if (err) { return self.error(err); }
        if (!ok) {
          return self.fail(state, 403);
        }

        var code = req.query.code;

        var params = self.tokenParams(options);
        params.grant_type = 'authorization_code';
        if (callbackURL) { params.redirect_uri = callbackURL; }

        self._oauth2.getOAuthAccessToken(code, params,
          function (err, accessToken, refreshToken, params) {
            if (err) { return self.error(self._createOAuthError('Failed to obtain access token', err)); }

            self._loadUserProfile(accessToken, function (err, profile) {
              if (err) { return self.error(err); }

              function verified(err, user, info) {
                if (err) { return self.error(err); }
                if (!user) { return self.fail(info); }

                info = info || {};
                if (state) { info.state = state; }
                self.success(user, info);
              }

              try {
                if (self._passReqToCallback) {
                  var arity = self._verify.length;
                  if (arity == 6) {
                    self._verify(req, accessToken, refreshToken, params, profile, verified);
                  } else { // arity == 5
                    self._verify(req, accessToken, refreshToken, profile, verified);
                  }
                } else {
                  var arity = self._verify.length;
                  if (arity == 5) {
                    self._verify(accessToken, refreshToken, params, profile, verified);
                  } else { // arity == 4
                    self._verify(accessToken, refreshToken, profile, verified);
                  }
                }
              } catch (ex) {
                return self.error(ex);
              }
            });
          }
        );
      }

      var state = req.query.state;
      try {
        var arity = this._stateStore.verify.length;
        if (arity == 4) {
          this._stateStore.verify(req, state, meta, loaded);
        } else { // arity == 3
          this._stateStore.verify(req, state, loaded);
        }
      } catch (ex) {
        return this.error(ex);
      }
    } else {
      var params = this.authorizationParams(options);
      params.response_type = 'code';
      if (callbackURL) { params.redirect_uri = callbackURL; }
      var scope = options.scope || this._scope;
      if (scope) {
        if (Array.isArray(scope)) { scope = scope.join(this._scopeSeparator); }
        params.scope = scope;
      }

      var state = options.state;
      if (state) {
        params.state = state;

        var parsed = url.parse(this._oauth2._authorizeUrl, true);
        utils.merge(parsed.query, params);
        parsed.query['client_id'] = this._oauth2._clientId;
        delete parsed.search;
        var location = url.format(parsed);
        this.redirect(location);
      } else {
        function stored(err, state) {
          if (err) { return self.error(err); }

          if (state) { params.state = state; }
          var parsed = url.parse(self._oauth2._authorizeUrl, true);
          utils.merge(parsed.query, params);
          parsed.query['client_id'] = self._oauth2._clientId;
          delete parsed.search;
          var location = url.format(parsed);
          self.redirect(location);
        }

        try {
          var arity = this._stateStore.store.length;
          if (arity == 3) {
            this._stateStore.store(req, meta, stored);
          } else { // arity == 2
            this._stateStore.store(req, stored);
          }
        } catch (ex) {
          return this.error(ex);
        }
      }
    }
  }