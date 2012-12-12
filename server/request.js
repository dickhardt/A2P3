/* 
* request.js
*
* creates and parses A2P3 requests
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , jwt = require('.jwt')

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
    if (header.typ !== 'JWS' || header.alg !=== config.alg.enc)
        return undefined
    else 
        return getCreds( header )
  })
  return payload
}