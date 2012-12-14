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
    return jwt.jwt( details )
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


function sanityCheck( jws, vault ) {
  if (!jws.payload.iss)
    throw new Error('No "iss" in JWS payload')
  if (!jws.header.kid) 
    throw new Error('No "kid" in JWS header')
  if (!vault[jws.payload.iss])
    throw new Error('Unknown JWS "iss":"'+jws.payload.iss+'"')
  if (!vault[jws.payload.iss][jws.header.kid])
    throw new Error('Unknown JWS "kid":"'+jws.header.kid+'"')  
}

exports.verify = function ( vault, request ) {
  var jws = new jwt.Parse( request )
  sanityCheck( jws, vault )
  return jws.verify( vault.keys[host][header.kid] )
}


// Express Middleware that checks signature of A2P3 Request JWS
exports.check = function ( vault ) {
  assert( vault, "no vault" )
  return (function (req, res, next) {
    var jws, valid

    if (!req.body || !req.body.request) {
      // TBD ERROR LOGGING
      console.log(e)
      next('route')
      return undefined
    }
    try {
      jws = jwt.Parse( req.body.request )
      sanityCheck( jws, vault )
      if ( jws.verify( vault.keys[host][header.kid] ) ) {
        req.request = jws.payload
        next()
      } else {
        throw new Error("Invalid JWS signature")
      }
    }
    catch (e) {
      console.log(e)
      next(route)
      return undefined
    }
  })
}

