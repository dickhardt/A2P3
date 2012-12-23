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
      , alg: config.crypto.alg.JWS
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


function sanityCheck( jws, keys ) {
  if (!jws.payload.iss)
    throw new Error('No "iss" in JWS payload')
  if (!jws.header.kid) 
    throw new Error('No "kid" in JWS header')
  if (!keys[jws.payload.iss])
    throw new Error('Unknown JWS "iss":"'+jws.payload.iss+'"')
  if (!keys[jws.payload.iss][jws.header.kid])
    throw new Error('Unknown JWS "kid":"'+jws.header.kid+'"')  
}

exports.verifyAndId = function ( request, keys ) {
  var jws = new jwt.Parse( request )
  sanityCheck( jws, keys )
  var valid = jws.verify( keys[jws.payload.iss][jws.header.kid] )
  return ( valid ) ? jws.payload.iss : undefined
}


// Express Middleware that checks signature of A2P3 Request JWS
exports.check = function ( keys, accessList ) {
  assert( keys, "no keys passed in" )
  return (function (req, res, next) {
    var jws, valid, err

    if (!req.body || !req.body.request) {
      err = new Error('No "request" parameter in POST')
      err.code = 'INVALID_API_CALL'
      next( err )
      return undefined
    }
    try {
      jws = new jwt.Parse( req.body.request )
      sanityCheck( jws, keys )
      if ( accessList ) {
        if ( !accessList[jws.payload.iss] ) {
          err = new Error('Access not allowed')
          err.code = 'ACCESS_DENIED'
          return next( err )          
        }
      }
      if ( jws.verify( keys[jws.payload.iss][jws.header.kid] ) ) {
        req.request = jws.payload
        return next()
      } else {
        err = new Error('Invalid JWS signature')
        err.code = 'INVALID_REQUEST'
        return next( err )
      }
    }
    catch (e) {
      e.code = 'INVALID_REQUEST'
      return next( e )
    }
  })
}

