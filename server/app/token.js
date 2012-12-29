/* 
* token.js
*
* creates and parses A2P3 tokens
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , jwt = require('./jwt')

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
    return jwt.jwe( details )
}

// middleware that checks token is valid
// depends on request.check middleware being called prior
exports.checkRS = function ( vault, rs, scopePath ) {
  return (function (req, res, next) {
    var jwe, err, token
    if (!req.response['request.a2p3.org'].token) {
      err = new Error("No token in 'request.a2p3.org' payload property")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }  //  
    try {
      jwe = new jwt.Parse(req.response['request.a2p3.org'].token)
      if ( !jwe.kid || !vault.keys[config.host.ix][jwe.kid] ) {
        err = new Error("No valid key for "+config.host.ix)
        err.code = 'INVALID_TOKEN'
        return next( err )
      }
      token = jwe.decrypt( vault.keys[config.host.ix][jwe.kid] )
    }
    catch (e) {
      e.code = 'INVALID_TOKEN'
      return next( e )
    }
    if (token.iss != config.host.ix) {
      err = new Error("RS Token must be signed by "+config.host.ix)
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if (token.aud != config.host[rs]) {
      err = new Error("Wrong token audience. Should be "+config.host[rs])
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if (token['token.a2p3.org'].app != req.request.header.iss) {
      err = new Error("Token and Request app must match")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    var scope = config.scheme + '://' + config.host[rs] + scopePath
    if (token['token.a2p3.org'].scope != scope) {
      err = new Error("Invalid scope. Should be '"+scope+"'")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if (!token['token.a2p3.org'].auth.passcode || !token['token.a2p3.org'].auth.authorization) {
      err = new Error("Invalid authorization. Passcode and authorization must be given.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( jwt.expired( token.iat ) ) {
      err = new Error("The token expired.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    next()
  })
}
