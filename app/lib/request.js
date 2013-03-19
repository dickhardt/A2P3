/*
* request.js
*
* creates and parses A2P3 requests
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('../config')
  , jwt = require('./jwt')
  , assert = require('assert')
  , db = require('./db')

exports.create = function (  payload, credentials ) {
  payload['request.a2p3.org'] = payload['request.a2p3.org'] || {}
  payload['request.a2p3.org'].ix = 'a2p3.net'
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


function paramCheck( jws ) {
  if (!jws.payload.iss) throw new Error('No "iss" in JWS payload')
  if (!jws.header.kid) throw new Error('No "kid" in JWS header')
  if (!jws.payload['request.a2p3.org']) throw new Error('No "request.a2p3.org" in JWS payload')
}


exports.verifyAndId = function ( request, RS, keys, callback ) {
  var e = null
    , jws
  try {
    jws = new jwt.Parse( request )
    paramCheck( jws )
  }
  catch (e) {
    e.code = 'INVALID_REQUEST'
    return callback( e )
  }
  db.getAppKey( RS, jws.payload.iss, keys, function ( error, key ) {
    if (error) {
      error.code = 'INVALID_REQUEST'
      return callback( error )
    }
    if (!key || !key[ jws.header.kid ]) {
      e = new Error('No key found for "'+jws.payload.iss+'" with KID "'+jws.header.kid+'"')
      e.code = "INVALID_REQUEST"
      return callback( error )
    }
    try {
      if ( jws.verify( key[ jws.header.kid ] ) ) {
        return callback( null, jws.payload.iss )
      }
      e = new Error('Invalid signature.')
      e.code = "INVALID_REQUEST"
      return callback( error )
    }
    catch ( e ) {
      e.code = "INVALID_REQUEST"
      callback( e )
    }
  })
}


// Express Middleware that checks signature of A2P3 Request JWS
exports.check = function ( keys, accessList, reg ) {
  assert( keys, "no keys passed in" )
  return (function checkRequest (req, res, next) {
    var jws, err
    if (!req.body || !req.body.request) {
      err = new Error('No "request" parameter in POST')
      err.code = 'INVALID_API_CALL'
      next( err )
      return undefined
    }
    try {
      jws = new jwt.Parse( req.body.request )

      paramCheck( jws )
      if ( accessList ) {
        if ( !accessList[jws.payload.iss] ) {
          err = new Error('Access not allowed')
          err.code = 'ACCESS_DENIED'
          return next( err )
        }
      }
      if ( jws.payload.aud != req.host ) {
        err = new Error("Request 'aud' does not match "+req.host)
        err.code = 'ACCESS_DENIED'
        return next( err )
      }
      db.getAppKey( reg, jws.payload.iss, keys, function ( e, key ) {
        if (e) {
          e.code = 'INTERNAL_ERROR'
          return next( err )
        }
        if (!key) {
          err = new Error('No key available for '+ jws.payload.iss)
          err.code = 'ACCESS_DENIED'
          return next( err )
        }
        if (!key[jws.header.kid]) {

console.error('\nrequest.check jws\n',jws)
console.error('key:\n',key)

          err = new Error('Invalid KID '+ jws.header.kid)
          err.code = 'ACCESS_DENIED'
          return next( err )
        }
        if ( !jws.verify( key[jws.header.kid] ) ) {
           err = new Error('Invalid JWS signature')
          err.code = 'INVALID_REQUEST'
          return next( err )
        } else {
          req.request = jws.payload
          return next()
        }
      })
    }
    catch (e) {
      e.code = 'INVALID_REQUEST'
      return next( e )
    }
  })
}

