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
    return jwt.jws( details )
}

exports.parse = function ( request ) {
  var jws = new jwt.Parse( request )
  return jws
}


function sanityCheck( jws, vault ) {
  if (!jws.payload.iss)
    throw new Error('No "iss" in JWS payload')
  if (!jws.header.kid) 
    throw new Error('No "kid" in JWS header')
  if (!vault.keys[jws.payload.iss])
    throw new Error('Unknown JWS "iss":"'+jws.payload.iss+'"')
  if (!vault.keys[jws.payload.iss][jws.header.kid])
    throw new Error('Unknown JWS "kid":"'+jws.header.kid+'"')  
}

exports.verifyAndId = function ( request, vault ) {
  var jws = new jwt.Parse( request )
  sanityCheck( jws, vault )
  var valid = jws.verify( vault.keys[jws.payload.iss][jws.header.kid] )
  return ( valid ) ? jws.payload.iss : undefined
}


// Express Middleware that checks signature of A2P3 Request JWS
exports.check = function ( vault ) {
  assert( vault, "no vault" )
  return (function (req, res, next) {
    var jws, valid

    if (!req.body || !req.body.request) {
      e = new Error('No "request" parameter in POST')
      e.code = 'INVALID_API_CALL'
      next(e)
      return undefined
    }
    try {
      jws = jwt.Parse( req.body.request )
      sanityCheck( jws, vault )
      if ( jws.verify( vault.keys[host][header.kid] ) ) {
        req.request = jws.payload
        next()
      } else {
        new Error('Invalid JWS signature')
        e.code = 'INVALID_REQUEST'
        next( e )
      }
    }
    catch (e) {
      e.code = 'INVALID_REQUEST'
      next( e )
    }
  })
}

