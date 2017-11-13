"use strict";

var Promise       = require('bluebird')
  , Profiler      = require('step-profiler')
  , express       = require('express')
  , winston       = require('winston')
  , _             = require('lodash')
  , cors          = require('cors')
  , cache_man     = require('cache-manager')
  , codedb_sdk    = require('taskmill-core-codedb-sdk')
  , responseTime  = require('response-time')
  , config        = require('config-url')
  , Task          = require('./task')
  , parser        = require('./middleware/parser')
  , token         = require('./middleware/token')
  , metering      = require('./middleware/metering')
  , analytics     = require('./middleware/analytics')
  , morgan        = require('morgan')
  ;

require('http').globalAgent.keepAlive = true;

var cache = cache_man.caching({ store : 'memory', max : 1000, ttl : 20 /*seconds*/});

var app = express();

app.use(responseTime());
app.use(morgan('dev'));
app.use(cors({
    exposedHeaders    : ['x-request-id']
}));

app.get('/', analytics.middleware, (req, res) => {
  res.end();
  // todo [akamel] redirect to breadboard.io
});

app.get('/favicon.ico', analytics.middleware, (req, res) => {
  res.end();
});

app.all('/*', parser.middleware, token.middleware, analytics.middleware, metering.middleware, (req, res, next) => {
  req.profiler = new Profiler({});
  req.profiler.start('req');
  // todo [akamel] this doesn't take port into account

  let { remote, branch }  = req.route
    , bearer              = req.bearer
    ;

  let key = `${remote}#${branch}`;

  req.profiler.done('pre-sha-read');
  cache
    .wrap(key, () => {
      return codedb_sdk.sha(remote, { branch, bearer });
    })
    .then(({ sha }) => {
      req.profiler.done('post-sha-read');

      // todo [akamel] google analytics
      // var params = {
      //     ec: 'gateway'
      //   , ea: 'run'
      //   // , el: '…and a label'
      //   // , ev: 42
      //   // , dp: req.url
      // };

      // req.visitor.event(params).send();

      var data = {};

      let blob      = req.get('blob')
        , blob_type = req.get('blob-type')
        ;

      if (blob) {
        if (blob_type != 'application/x-gtar') {
          data.blob = new Buffer(blob, 'base64').toString('utf8');
        }

        if (blob_type) {
          data.blob_type = blob_type;
        }
      }

      let tailf = req.get('tailf');
      if (tailf) {
        data.tailf = tailf;
      }

      req.profiler.done('pre-task-make');

      _.extend(data, req.route, { branch : sha });
      let task = new Task(data, req, res);

      req.profiler.done('pre-runOn');
      return task
              .runOn((result) => {
                if (task.etag.code) {
                  task.log(result.stream, result);
                }

                let pipe = req.get('pipe');
                if (pipe) {
                  task.output(result.stream, pipe, result);
                }

                // result.stream.pipe(process.stdout);

                res.set(result.headers);
                res.statusCode = result.statusCode;
                result.stream.pipe(res);
              })
              // todo [akamel] some err wont benefit from decline if happen before this promise chain
              .catch((err) => {


                throw err;
              });
    })
    .then((task) => {
      metering.did('run', req.sub);
      req.profiler.done('req');
      console.log(req.profiler.toString());
    })
    // todo [akamel] pipe is not sent in case of error
    .catch((err) => {
      // todo [akamel] send error to client, ideal send 404 if url is wrong
      Task.decline(req, res, err);
    })
    // .finally(() => {
    // });
});

// generic err handler
app.use(function(err, req, res, next) {
  winston.error(err);
  res.status(500).send({ error : err.message });
});

function listen(options, cb) {
  return Promise.fromCallback((cb) => app.listen(options.port, cb)).asCallback(cb);
}

module.exports = {
    listen : listen
};
