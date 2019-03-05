var Promise       = require('bluebird')
  , express       = require('express')
  , winston       = require('winston')
  , _             = require('lodash')
  , cors          = require('cors')
  , cache_man     = require('cache-manager')
  , codedb_sdk    = require('taskmill-core-codedb-sdk')
  , responseTime  = require('response-time')
  , config        = require('config-url')
  , Hub           = require('./hub')
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

let hub = undefined;
app.all('/*', parser.middleware, token.middleware, analytics.middleware, metering.middleware, (req, res, next) => {
  // todo [akamel] this doesn't take port into account
  let { remote, branch }  = req.route
    , bearer              = req.bearer
    ;

  let key = `${remote}#${branch}`;

  cache
    .wrap(key, () => {
      return codedb_sdk.sha(remote, { branch, bearer });
    })
    .then(({ sha }) => {
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

      _.extend(data, req.route, { branch : sha });
      let task = new Task(data, req, res);

      return task
              .runOn(hub, (result) => {
                let { headers, statusCode, stream } = result;

                let pipe = req.get('pipe');
                if (pipe) {
                  task.output(stream, pipe, result);
                }

                res.set(headers);
                res.statusCode = statusCode;
                stream.pipe(res);
              });
    })
    // todo [akamel] pipe is not sent in case of error
    .catch((err) => {
      // todo [akamel] send error to client, ideal send 404 if url is wrong
      Task.decline(req, res, err);
    });
});

// generic err handler
app.use(function(err, req, res, next) {
  winston.error(err);
  res.status(500).send({ error : err.message });
});

function listen(options, cb) {
  return Promise
          .fromCallback((cb) => {
            let ret = app.listen(options.port, (err) => {
              cb(err, ret);
            });
          })
          .tap((server) => {
            hub = new Hub(server);
            server.timeout = config.get('gateway.timeout');
          })
          .asCallback(cb);
}

module.exports = {
    listen : listen
};
