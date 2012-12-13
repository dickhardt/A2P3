/* 
* request.js
*
* creates and parses A2P3 requests
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , jwt = require('./jwt')
  , assert = require('assert')

exports.create = function (  payload, credentials ) {
  var details =
    { header:
      { typ: 'JWS'
      , alg: config.alg.JWS
      , kid: credentials.kid
      }
    , payload: payload
    , credentials: credentials
    }
    details.payload.iat = jwt.iat()
    return jwt.encode( details )
}

exports.parse = function ( jws, getCreds ) {
  var payload = jwt.decode( jws, function (header) {
    if (header.typ !== 'JWS' || header.alg !== config.alg.JWS)
        return undefined
    else 
        return getCreds( header )
  })
  return payload
}


// Express Middleware that checks signature of A2P3 Request JWS
exports.check = function ( vault ) {
  assert( vault, "no vault" )
  return (function (req, res, next) {

    if (!req.body || !req.body.request) {
      // TBD ERROR LOGGING
      next('route')
      return undefined
    }
    var jws = jwt.jwsCrack(req.body.request)
    if (!jws.payload || !jws.payload.iss || !jws.header || !jws.header.kid) next('route') // TBD add in error message to be sent back
    var host = jws.payload.iss
    req.a2p3 = jwt.decode( req.body.request, function (header) {
      var credentials = {key: vault.keys && vault.keys[host] && vault.keys[host][header.kid]}
      return credentials
    })
    next()
  })
}

