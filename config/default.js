var bytes = require('bytes')
  , fs    = require('fs')
  , ms    = require('ms')
  , _     = require('lodash')
  ;

module.exports = {
  "hub" : {
    "aud"               : _.trim(fs.readFileSync('/run/secrets/hub/aud', 'utf-8')),
    "sub"               : _.trim(fs.readFileSync('/run/secrets/hub/sub', 'utf-8')),
    "key_pem"           : _.trim(fs.readFileSync('/run/secrets/hub/key.pem', 'utf-8'))
  },
  "gateway" : {
    "port"              : 8070,
    "timeout"           : ms('5m')
  },
  "universal-analytics" : {
    "id"                : fs.readFileSync('/run/secrets/universal-analytics/id', 'utf-8')
  },
  "account"             : {
    "url"               : "https://account.breadboard.io"
  },
  "codedb" : {
    "url"               : "http://code.breadboard.xyz:8585"
  },
  "metering" : {
    "limits" : {
      "run"   : 50000,
      "90a2f297ced94d504f6e58f3e326d06b4935947f2618860d665a57b3d11f3b1b" : 50,
      "0748897a12015c876ea4c657dbe2eacd610d92da60a9143ee139bdf23f509a86" : 10
    },
    "redis" : {
      "host"      : "metering.redis.breadboard.xyz",
      "port"      : 6379,
      "password"  : null,
      "db"        : 0
    }
  }
};
