/* 
* config.js
*
* A2P3 Server Configuration Information
*
* Copyright (C) Province of British Columbia, 2013
*/

var provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']

var crypto =
        { alg:
          { JWE: 'A256CBC+HS512'
          , JWS: 'HS512'
          }
        , bytesKey: 64
        , bytesKid: 12
        , bytesDI: 20
        , bytesHandle: 20
        , bytesSecret: 20
        }

var  host = 
    { ix: 'ix'
    , registrar: 'registrar'
    , as: 'as'
    , setup: 'setup'
    , bank: 'bank'
    , clinic: 'clinic'
    , si: 'si'
    , people: 'people'
    , health: 'health'
    , email: 'email'
    }
  , baseUrl = {}

// set the a2p3domain and a2p3scheme environment variables to change where the server runs
var port = '8080'
var baseDomain = process.env.a2p3domain || 'local.a2p3.net' 
var scheme = process.env.a2p3scheme || 'http'
var portListen = process.env.a2p3port || port


provinces.forEach( function ( province ) {
  host['people.'+province] = 'people.'+province
  host['health.'+province] = 'health.'+province
})

Object.keys(host).forEach( function (key) {
  host[key] = host[key] +'.'+ baseDomain
  baseUrl[key] = scheme + '://' + host[key] + ':' + port
})

// roles are used for access control to special APIs
var roles =
  { as: {}
  , enroll: {}
  , std: {}
  }
// AS roles, add other AS when they become available
roles.as[host.as] = true
roles.as[host.setup] = true
// setup is only enrollment app
roles.enroll[host.setup] = true
// health and people are onlu standardized resources
roles.std[host.health] = true
roles.std[host.people] = true

// exported configuration
exports.crypto = crypto
exports.baseDomain = baseDomain
exports.host = host
exports.port = port
exports.portListen = portListen
exports.scheme = scheme
exports.baseUrl = baseUrl
exports.roles = roles
exports.provinces = provinces
exports.maxTokenAge = 5 * 60 // 5 minutes

