"use strict";

var _               = require('lodash')
  , Promise         = require('bluebird')
  , onFinished      = require('on-finished')
  , rp              = require('request-promise')
  , request         = require('request')
  , parser          = require('parse-cache-control')
  , sha1            = require('sha1')
  , randtoken       = require('rand-token')
  , make_sdk        = require('taskmill-core-make-sdk')
  , urljoin         = require('url-join')
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

    this.etag = {
        code : undefined
      , type : undefined
    };

    this.cache = parser(req.get('cache-control')) || {};

    if (this.cache.private && this.cache.log) {
      this.etag = {
          code  : this.id
        , type  : 'instance'
      };
    } else if (req.method === 'GET') {
      this.etag = {
          code  : sha1(this.req.url)
        , type  : 'public'
      };
    }
  }

  make_headers(response) {
    let headers = {};

    if (this.etag.type === 'public') {
      // don't cache if:
      // 1- there is no cache header in res
      // 1- the header has Age [means it came from cache server]
      // 1- the max-age is <= 0
      // 1- the cache is marked private
      // var cache           = parser(res.getHeader('cache-control')) || {}
      var cache           = parser(response.headers['cache-control']) || {}
        , max_age         = Math.max(cache['max-age'] || 0, 0)
        , is_public       = !!cache.public
        , is_from_cache   = !_.isUndefined(response.headers['Age'])
        , is_err          = response.statusCode >= 400 && response.statusCode < 600
        ;
      if (is_from_cache || !max_age || !is_public || is_err) {
        this.etag.code = undefined;
        // this.etag.type = undefined;
      }
    }

    headers['X-Request-Id'] = this.doc.id;

    if (this.etag.type === 'instance') {
      headers['cache-control'] = 'private, log, max-age=120';
    }

    // let is_err = response.statusCode >= 400 && response.statusCode < 600;
    // cache_bust if err or no cache-control is set
    if (is_err || !this.cache) {
      headers['cache-control'] = 'no-cache';
    }

    headers['Access-Control-Allow-Origin'] = '*';

    return headers;
  }

  runOn(on_response, cb) {
    let { remote, branch, blob, filename, tailf } = this.doc
      , { req }                                   = this
      , bearer                                    = req.get('authorization')
      ;

    req.profiler.done('pre-make');
    return make_sdk
            .make(remote, branch, { blob, filename, tailf, /*token,*/ bearer, timeout : 30 * 1000 })
            .then((result = {}) => {
              req.profiler.done('post-make');

              req.profiler.start('req.pipe');

              let { run_url, secret } = result
                , filename            = this.doc.filename
                , url                 = urljoin(run_url, filename)
                , { query : qs }      = req
                , headers             = { '__metadata' : JSON.stringify(this.doc), '__secret' : secret }
                ;

              return Promise
                      .fromCallback((cb) => {
                        let out = request({ url, headers, qs });

                        // todo [akamel] query string aren't passed
                        let stream = req.pipe(out); //.pipe(this.res);

                        stream.on('error', cb);

                        stream.on('response', (response) => {
                          req.profiler.done('req.pipe');
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
                      });
            });
  }

  log(stream, options = {}) {
    let url = urljoin(config.getUrl('log'), 'write', this.etag.code);

    this.output(stream, url, options);
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
      res.write(JSON.stringify(Task.errorify(err, { details : req.url })));
      res.end();
    } else {
      winston.error(`can't decline, res already ended`);
    }
  }

  static errorify(err = {}, options = {}) {
    var ret = {
        type    : err.stack? 'exception' : 'notification'
      , message : err.message
      // todo [akamel] should we expose this? its OSS anyway
      , stack   : err.stack
      , details : options.details
      , target  : 'taskmill-core-gateway'
    };

    return ret;
  }
}

module.exports = Task;
