"use strict";

var Promise         = require('bluebird')
  , _               = require('lodash')
  , urljoin         = require('url-join')
  , config          = require('config-url')
  , authorization   = require('auth-header')
  , rp              = require('request-promise')
  ;

function middleware(req, res, next) {
  Promise
    .resolve(req.get('Authorization'))
    .then((header) => {
      if (header) {
        let auth = authorization.parse(header);

        if (auth.scheme === 'Bearer') {// && _.size(auth.token) === 32) {
          let re    = /([0-9a-fA-F]{24}):([0-9a-fA-F]{32})/
            , match = re.exec(auth.token)
            ;

          if (match) {
            let sub     = match[1]
              , secret  = match[2]
              ;

            // 1. get jwt from account server
            // /account/:id/secret/:secret/token
            return rp
                    .get({ 
                        url     : urljoin(config.getUrl('account'), 'account', sub, 'secret', secret, 'token')
                      , json    : true
                      , headers : {
                          'authorization' : req.get('authorization')
                        }
                    })
                    .then((result) => {
                      req.headers['authorization'] = `Bearer ${result.data}`;
                      req.user = result.__account;
                    })
          }
        }
      }
    })
    .asCallback(next);
}

module.exports = {
  middleware  : middleware
};