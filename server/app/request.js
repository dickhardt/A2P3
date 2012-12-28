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


function headerCheck( jws ) {
  if (!jws.payload.iss)
    throw new Error('No "iss" in JWS payload')
  if (!jws.header.kid) 
    throw new Error('No "kid" in JWS header')
}

function vaultKeys( jws, keys ) {
  var haveKeys = keys && keys[jws.payload.iss] && keys[jws.payload.iss][jws.header.kid]
  return ( haveKeys )
}


exports.verifyAndId = function ( request, keys ) {
  var jws = new jwt.Parse( request )
  headerCheck( jws )
  if (!vaultKeys( jws, keys )) return undefined
  var valid = jws.verify( keys[jws.payload.iss][jws.header.kid] )
  return ( valid ) ? jws.payload.iss : undefined
}


// Express Middleware that checks signature of A2P3 Request JWS
exports.check = function ( keys, accessList, reg ) {
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
      headerCheck( jws )
      if ( accessList ) {
        if ( !accessList[jws.payload.iss] ) {
          err = new Error('Access not allowed')
          err.code = 'ACCESS_DENIED'
          return next( err )          
        }
      }
      if (vaultKeys( jws, keys )) {
        if ( jws.verify( keys[jws.payload.iss][jws.header.kid] ) ) {
          req.request = jws.payload
          return next()
        } else {
          err = new Error('Invalid JWS signature')
          err.code = 'INVALID_REQUEST'
          return next( err )
        }        
      } else { // need to fetch keys from DB
        if (!reg) {
            err = new Error('No key available for '+ jws.header.iss)
            err.code = 'ACCESS_DENIED'
            return next( err )                              
        }
        db.getAppKey( reg, jws.payload.iss, function ( e, key ) {
          if (e) {
            err.code = 'INTERNAL_ERROR'
            return next( err )
          }
          if (!key) {
            err = new Error('No key available for '+ jws.header.iss)
            err.code = 'ACCESS_DENIED'
            return next( err )                    
          }          
          if (!key[jws.header.kid]) {
            err = new Error('Invalid KID '+ jws.header.kid)
            err.code = 'ACCESS_DENIED'
            return next( err )                    
          }
          if ( jws.verify( key[jws.header.kid] ) ) {
            req.request = jws.payload
            return next()
          } else {
            err = new Error('Invalid JWS signature')
            err.code = 'INVALID_REQUEST'
            return next( err )
          }        
        })
      }
    }
    catch (e) {
      e.code = 'INVALID_REQUEST'
      return next( e )
    }
  })
}

