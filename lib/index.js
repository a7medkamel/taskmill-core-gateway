"use strict";

var Promise       = require('bluebird')
  , Profiler      = require('step-profiler')
  , express       = require('express')
  , winston       = require('winston')
  , _             = require('lodash')
  , cors          = require('cors')
  , responseTime  = require('response-time')
  , config        = require('config-url')
  , Relay         = require('./model/Relay')
  , Task          = require('./model/Task')
  , parser        = require('./middleware/parser')
  , token         = require('./middleware/token')
  , metering      = require('./middleware/metering')
  , analytics     = require('./middleware/analytics')
  , morgan        = require('morgan')
  ;

var app = express();

var relay = new Relay();

app.use(responseTime());
app.use(morgan('dev'));
app.use(cors({
    exposedHeaders : ['x-request-id']
}));

app.get('/', analytics.middleware, (req, res) => {
  res.end();
  // todo [akamel] redirect to breadboard.io
});

app.get('/favicon.ico', analytics.middleware, (req, res) => {
  res.end();
});

app.get('/__stats', analytics.middleware, (req, res) => {
  res.send(relay.stats());
});

app.all('/*', parser.middleware, token.middleware, analytics.middleware, metering.middleware, (req, res, next) => {
  req.profiler = new Profiler({});
  req.profiler.start('req');
  // todo [akamel] this doesn't take port into account
  Promise
    .try(() => {
      var params = {
          ec: 'gateway'
        , ea: 'run'
        // , el: '…and a label'
        // , ev: 42
        // , dp: req.url
      };

      req.visitor.event(params).send();

      var data = {};

      var blob = req.get('blob');
      if (blob) {
        data.blob = new Buffer(blob, 'base64').toString('utf8');
      }

      var tty_id = req.get('tty-id');
      if (tty_id) {
        data.tty = {
            ws : config.getUrl('tty')
          , id : tty_id
        }
      }

      _.extend(data, req.route);

      return new Task(data, req, res);
    })
    .tap((task) => {
      return relay
              .registry()
              .findRunOn(task)
              .tap(() => req.profiler.start('runOn'))
              .then((agent) => {
                return task.runOn(agent);
              })
              .tap(() => req.profiler.done('runOn'))
              .then((result) => {
                if (task.etag.code) {
                  task.log(result.stream, result);
                }

                let pipe = req.get('pipe');
                if (pipe) {
                  task.output(result.stream, pipe, result);
                }

                res.set(result.headers);
                res.statusCode = result.statusCode;
                result.stream.pipe(res);
              })
              // todo [akamel] some err wont benefit from decline if happen before this promise chain
              .catch((err) => {
                task.decline(err);

                throw err;
              });
    })
    .tap((task) => {
      metering.did('run', req.user);
    })
    // todo [akamel] pipe is not sent in case of error
    .catch((err) => {
      winston.error(err);
      // todo [akamel] relay would have ended res already
      // todo [akamel] send error to client, ideal send 404 if url is wrong
      res.end();
    })
    .finally(() => {
      req.profiler.done('req');
      console.log(req.profiler.toString());
    });
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

// todo [akamel] expose active agents and stats
// index: function (req, res, next) {
//   var agents = _.map(Relay.get().agent_registry.find(), function(value){
//     var ret = value.info || { error : 'no info reported' };

//     if (ret.workers) {
//       ret.workers = _.map(ret.workers, function(w){
//         // todo [akamel] do we still have this info being sent?
//         return _.omit(w, 'protocol', 'hostname', 'dir');
//       });
//     }

//     return ret;
//   });

//   res.render('admin/index', {
//       model         : agents
//     , user          : req.user
//   });
// }