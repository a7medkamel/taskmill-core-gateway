var Promise       = require('bluebird')
  , winston       = require('winston')
  , _             = require('lodash')
  , config        = require('config-url')
  , socket_io     = require('socket.io')
  , socket_io_jwt = require('socketio-jwt')
  , winston       = require('winston')
  , weighted      = require('weighted')
  , ms            = require('ms')
  , NoAgentError  = require('error-ex')
  ;

const PUBLIC_KEY  = config.get('hub.key_pem')
  ,   TOKEN_SUB   = config.get('hub.sub')
  ,   TOKEN_AUD   = config.get('hub.aud')
  ;

class Hub {
  constructor(server) {
    let io = socket_io(server, { httpCompression : true });

    io
      .on('connection', socket_io_jwt.authorize({
          secret : (request, token, cb) => {
            if (token.sub != TOKEN_SUB) { return cb(new Error('invalid_sub')) }
            if (token.aud != TOKEN_AUD) { return cb(new Error('invalid_aud')) }

            cb(null, PUBLIC_KEY);
          }
        , timeout : ms('30s')
      }))
      .on('authenticated', (socket) => {
        socket.on('/ping', (info) => {
          socket.breadboard_node_info = info;
        });
      });

    this.io = io;
  }

  nodes() {
    return Promise
            .try(() => {
              var connected = this.io.of('/').connected;

              return _
                      .chain(connected)
                      .map((i) => { return { socket : i, info : i.breadboard_node_info }})
                      .filter((i) => !!i.info)
                      .compact()
                      .value();
            });
  }

  free() {
    return this
            .nodes()
            .then((nodes) => {
              if (_.size(nodes) > 0) {
                let weights = _.map(nodes, (i) => i.info.freemem / i.info.totalmem);

                return weighted.select(nodes, weights);
              }

              throw new NoAgentError('no agents available');
            });
  }

  get_container(remote, { sha, blob, filename, token, cache, tailf, bearer }) {
    // let bearer = req.get('authorization');
    return this
            .free()
            .then((node) => {
              return Promise
                      .fromCallback((cb) => {
                        node.socket.emit('/create', { remote, sha, blob, filename, token, cache, tailf, bearer }, cb);
                      });
            })
  }
}

Hub.NoAgentError = NoAgentError;

module.exports = Hub;
