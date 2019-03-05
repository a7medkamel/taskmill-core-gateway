"use strict";

var _               = require('lodash')
  , Promise         = require('bluebird')
  , onFinished      = require('on-finished')
  , rp              = require('request-promise')
  , request         = require('request')
  , parser          = require('parse-cache-control')
  , sha1            = require('sha1')
  , randtoken       = require('rand-token')
  , urljoin         = require('url-join')
  , ms              = require('ms')
  , config          = require('config-url')
  , content_type    = require('content-type')
  , winston         = require('winston')
  ;

class Task {
  constructor(doc, req, res) {
    this.doc = doc;

    if (!_.has(this.doc, 'id')) {
      this.doc.id =  randtoken.generate(32, 'abcdefghijklnmopqrstuvwxyz1234567890');
    }

    this.id = doc.id;
    this.req = req;
    this.res = res;
  }

  make_headers(response) {
    let headers = {
        'X-Request-Id'                : this.doc.id
      , 'cache-control'               : 'no-cache'
      , 'Access-Control-Allow-Origin' : '*'
    };

    return headers;
  }

  runOn(hub, on_response, cb) {
    let { remote, branch, blob, filename, tailf } = this.doc
      , { req }                                   = this
      , bearer                                    = req.get('authorization')
      ;

    return hub
            .get_container(remote, { sha : branch, blob, filename, tailf, /*token,*/ bearer, timeout : ms('2m') })
            .then((result = {}) => {
              let __metadata = _.omit(this.doc, 'blob');

              let { run_url, secret } = result
                , filename            = this.doc.filename
                , url                 = urljoin(run_url, filename)
                , { query : qs }      = req
                , headers             = { '__metadata' : JSON.stringify(__metadata), '__secret' : secret }
                ;

              return Promise
                      .fromCallback((cb) => {
                        winston.info(`proxy ${remote} ${filename} => ${url}`);

                        let out = request({ url, headers, qs, timeout : ms('4m') });

                        req
                          .pipe(out)
                          .on('response', (response) => {
                            winston.info(`proxy:response ${remote} ${filename} => ${url}`, response.statusCode);

                            let headers = this.make_headers(response);

                            // don't allow res to set cookie
                            let res_headers = _.defaults(headers, _.omit(response.headers, 'set-cookie'));
                            // let res_headers = response.headers;

                            let ret = {
                                headers     : res_headers
                              , statusCode  : response.statusCode
                              , stream      : response
                            };

                            on_response(ret);

                            cb(undefined);
                          })
                          .on('error', (err) => {
                            winston.error(`proxy:error ${remote} ${filename} => ${url}`, err);
                            cb(err);
                          });
                      });
            });
  }

  output(stream, url, options = {}) {
    let headers = {
          '__metadata' : JSON.stringify({
                            'headers'       : options.headers
                          , 'status-code'   : options.statusCode
                        })
        };
    // let headers = _.defaults({ 'status-code' : options.statusCode }, options.headers);

    let out = request({
                      method    : 'POST'
                    , url
                    , headers
                  });

    stream.pipe(out);
  }

  static decline(req, res, err) {
    winston.error(err);

    if (!onFinished.isFinished(res)) {
      res.set('cache-control', 'no-cache');
      // todo [akamel] for some reason .send doesn't seem to really work? try again later
      // res.status(500).send(this.errorify(err));
      res.status(500);
      res.set('content-type', 'application/json');
      // note [akamel] sometimes onHeaders is called after the first .write is.. we call write('') to force onHeader first
      res.write('');
      res.write(JSON.stringify(Task.errorify(err, { details : req.url, debug : true })));
      res.end();
    } else {
      winston.error('can\'t decline, res already ended');
    }
  }

  static errorify(err = {}, options = {}) {
    let { debug, details }        = options
      , { stack, message, name }  = err
      ;

    let ret = {
        type    : stack? 'exception' : 'notification'
      , name
      , message : message
      , target  : 'taskmill-core-gateway'
    };

    // todo [akamel] should we expose this? its OSS anyway
    if (debug && stack) {
      ret.stack = stack
    }

    if (details) {
      ret.details = details
    }

    return ret;
  }
}

module.exports = Task;
