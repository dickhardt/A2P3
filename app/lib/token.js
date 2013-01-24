/*
* token.js
*
* creates and parses A2P3 tokens
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('../config')
  , jwt = require('./jwt')
  , underscore = require('underscore')

exports.create = function ( payload, credentials ) {
  var details =
    { header:
      { typ: 'JWE'
      , alg: 'dir'
      , enc: config.crypto.alg.JWE
      , kid: credentials.kid
      }
    , payload: payload
    , credentials: credentials
    }
    details.payload.iat = jwt.iat()

// console.log('\ncreating token\niss:',payload.iss,'\naud:',payload.aud,'\nkid:',credentials.kid)

    return jwt.jwe( details )
}

function validScope ( passedScopes, acceptedScopes ) {
  var valid = underscore.intersection( passedScopes, acceptedScopes )
  if (!valid) console.log('\ninvalid scope\npassed:\t'+passedScopes+'\naccepted:\t'+acceptedScopes)
  return valid
}

// middleware that checks token is valid
// depends on request.check middleware being called prior
exports.checkRS = function ( vault, rs, scopePaths, stdRS ) {
  // build list of acceptable scopes
  if ( scopePaths instanceof String )
    scopePaths = [scopePaths]
  var acceptedScopes = scopePaths && scopePaths.map( function ( scopePath ) {
    return (config.baseUrl[rs] + scopePath)
    })
  if (acceptedScopes && stdRS) {
    var stdAcceptedScopes = scopePaths.map( function ( scopePath ) {
      return (config.baseUrl[stdRS] + scopePath)
    })
    acceptedScopes.push( stdAcceptedScopes )
  }

  return (function checkRS (req, res, next) {
    var jwe, err, token
    if (!req.request['request.a2p3.org'].token) {
      err = new Error("No token in 'request.a2p3.org' payload property")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }  //
    try {
      jwe = new jwt.Parse(req.request['request.a2p3.org'].token)

// console.log('\ngoing to decrypt token\nkid:',jwe.header.kid)

      if ( !jwe.header.kid || !vault[config.host.ix][jwe.header.kid] ) {
        err = new Error("No valid key for "+config.host.ix)
        err.code = 'INVALID_TOKEN'
        return next( err )
      }
      token = jwe.decrypt( vault[config.host.ix][jwe.header.kid] )
    }
    catch (e) {
      e.code = 'INVALID_TOKEN'
      return next( e )
    }
    if ( token.iss != config.host.ix ) {
      err = new Error("RS Token must be signed by "+config.host.ix)
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( token.aud != config.host[rs] ) {
      err = new Error("Wrong token audience. Should be "+config.host[rs])
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( token['token.a2p3.org'].app != req.request.iss ) {
      err = new Error("Token and Request app must match")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( acceptedScopes && !token['token.a2p3.org'].scopes ) {
      err = new Error("No scope provided.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( acceptedScopes && !validScope( token['token.a2p3.org'].scopes, acceptedScopes ) ) {
      err = new Error("Invalid scope.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( !token['token.a2p3.org'].auth.passcode || !token['token.a2p3.org'].auth.authorization ) {
      err = new Error("Invalid authorization. Passcode and authorization must be given.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( jwt.expired( token.iat ) ) {
      err = new Error("The token expired.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    req.token = token
    next()
  })
}
