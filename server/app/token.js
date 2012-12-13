/* 
* token.js
*
* creates and parses A2P3 tokens
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , jwt = require('.jwt')

exports.create = function ( credentials, payload ) {
  var details =
    { header:
      { typ: 'JWE'
      , alg: 'dir'
      , enc: config.alg.JWE
      , kid: credentials.kid
      }
    , payload: payload
    , credentials: credentials
    }
    details.payload.iat = jwt.iat()
    return jwt.encode( details )
}

exports.parse = function ( token, getCreds ) {
  var payload = jwt.decode( token, function (header) {
    if (header.typ !== 'JWE' || header.alg !== 'dir' || header.enc !=== config.alg.enc)
        return undefined
    else 
        return getCreds( header )
  })
  return payload
}