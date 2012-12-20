/* 
* config.js
*
* A2P3 Server Configuration Information
*
* Copyright (C) Province of British Columbia, 2013
*/

var alg =
    { JWE: 'A256CBC+HS512'
    , JWS: 'HS512'
    }
   , host = 
    { ix: 'ix'
    , registrar: 'registrar'
    , as: 'as'
    , setup: 'setup'
    , bank: 'bank'
    , clinic: 'clinic'
    , is: 'is'
    }
  , baseUrl = {}

// TBD dynamically figure out the following!!!

var port = '8080'
var baseHost = 'local.a2p3.net' 
var scheme = 'http'

Object.keys(host).forEach( function (key) {
  host[key] = host[key] +'.'+ baseHost
  baseUrl[key] = scheme + '://' + host[key] + ':' + port
})

// roles are used for access control to APIs
var roles =
  { as: {}
  , enroll: {}
  }
roles.as[host.as] = true
roles.as[host.setup] = true
// add other AS when they become available
roles.enroll[host.setup] = true

// exported configuration
exports.alg = alg
exports.host = host
exports.port = port
exports.scheme = scheme
exports.baseUrl = baseUrl
exports.roles = roles
