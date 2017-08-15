"use strict";

var Promise         = require('bluebird')
  , _               = require('lodash')
  , urljoin         = require('url-join')
  , config          = require('config-url')
  , authorization   = require('auth-header')
  , rp              = require('request-promise')
  , account_sdk     = require('taskmill-core-account-sdk')
  ;

function middleware(req, res, next) {
  Promise
    .resolve(req.get('Authorization') || req.query['Authorization'])
    .then((header) => {
      if (header) {
        let auth = authorization.parse(header);

        if (auth.scheme === 'Bearer') {
          if (_.size(auth.token) == 20) {
            // 1. get jwt from account server
            return account_sdk
                    .issueTokenByKey(auth.token)
                    .then((result) => {
                      req.bearer = `Bearer ${result.data.jwt}`;
                      req.headers['authorization'] = req.bearer;
                      req.sub = result.data.sub;
                    });
          }

          let decoded = account_sdk.decode(auth.token);
          if (decoded) {
            req.bearer = header;
            req.headers['authorization'] = header;
            req.sub = decoded.sub;
            return;
          }
        }
      }
    })
    .asCallback(next);
}

module.exports = {
  middleware  : middleware
};
