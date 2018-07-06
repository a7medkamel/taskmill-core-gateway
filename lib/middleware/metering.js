var Promise         = require('bluebird')
  , metering        = require('taskmill-api-metering')
  , requestip       = require('request-ip')
  , crypto          = require('crypto')
  ;

function middleware(req, res, next) {
  let { uri }   = req.route
    , types     = [metering.types.run, uri]
    , { sub }   = req
    ;

  if (!sub) {
    let ip = requestip.getClientIp(req);

    // todo [akamel] as a prefix before shaed sub and shaed meter type
    sub = crypto.createHmac('sha256', '').update(ip).digest('hex')
  }

  return metering
          .can(types, sub)
          .asCallback((err, ret) => {
            if (err) {
              return res.status(403).send({ message : err.message });
            }

            res.on('finish', () => {
              metering.did(types, sub);
            });

            next(undefined, ret);
          });
}

module.exports = {
  middleware
};
