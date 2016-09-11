"use strict";

var Promise       = require('bluebird')
  , express       = require('express')
  , winston       = require('winston')
  , _             = require('lodash')
  , cors          = require('cors')
  , responseTime  = require('response-time')
  , config        = require('config-url')
  , Relay         = require('./model/Relay')
  , parser        = require('./middleware/parser')
  , token         = require('./middleware/token')
  , metering      = require('./middleware/metering')
  , ua            = require('universal-analytics')
  , Profiler      = require('step-profiler')
  ;

var app = express();

var relay = new Relay();

app.use(responseTime());
app.use(cors({
    exposedHeaders : ['x-request-id']
}));

app.use((req, res, next) => {  
  req.visitor = ua(config.get('universal-analytics.id'));//.debug();

  req
    .visitor
    .pageview(req.url, '', req.hostname)
    .send();

  next();
});

app.get('/', (req, res) => {
  res.end();
  // todo [akamel] redirect to breadboard.io
});

app.get('/favicon.ico', (req, res) => {
  res.end();
});

app.get('/__stats', (req, res) => {
  res.send(relay.stats());
});

app.all('/*', parser.middleware, token.middleware, metering.middleware, (req, res, next) => {
  // todo [akamel] this doesn't take port nto account
  req.profiler = new Profiler({});
  req.profiler.start('req');
  Promise
    .try(() => {
      req.visitor.event('Gateway', 'Run', req.hostname, req.url, { p : req.url }).send();

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

      req.profiler.done('gateway.emit.pre');
      return relay
              .emit(data, req, res)
              .then((task) => {
                metering.did('run', req.user);
              });
    })
    .catch((err) => {
      winston.error(err);
      // todo [akamel] relay would have ended res already
      // todo [akamel] send error to client, ideal send 404 if url is wrong
      res.end();
    })
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