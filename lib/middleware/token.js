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
    .resolve(req.get('Authorization'))
    .then((header) => {
      if (header) {
        let auth = authorization.parse(header);

        if (auth.scheme === 'Bearer') {
          let re    = /Bearer\s([0-9a-fA-F]{32})/
            , match = re.exec(header)
            ;

          if (match) {
            let key = match[1];

            // 1. get jwt from account server
            return account_sdk
                    .issueTokenByKey(key)
                    .then((result) => {
                      req.bearer = `Bearer ${result.data.jwt}`;
                      req.headers['authorization'] = req.bearer;
                      req.sub = result.data.sub;
                    });
          } else {
            let decoded = account_sdk.decode(auth.token);

            req.bearer = header;
            req.headers['authorization'] = req.bearer;
            req.sub = decoded.sub;
          }
        }
      }
    })
    .asCallback(next);
}

module.exports = {
  middleware  : middleware
};
