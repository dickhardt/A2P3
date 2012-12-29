/* 
* IX Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , url = require('url')
  , request = require('../request')
  , token = require('../token')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
  , jwt = require('../jwt')
  , mw = require('../middleware')

function diCreate ( req, res, next ) {
    var AS = req.request['request.a2p3.org'].AS
    var rsHosts = req.request['request.a2p3.org'].RS
    var redirects = req.request['request.a2p3.org'].redirects
    db.newUser( AS, rsHosts, redirects, function ( e, dis ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      res.send( {'result': {'dis': dis}} )
    })
}


// parses out hosts from passed in scopes
function getHosts ( scopes ) {
  var results = {}
  scopes.forEach( function ( scope ) {
    var o = url.parse( scope )
    results[o.hostname] = scope
  })
  return results
}


// exchange IX Token for RS Tokens if all is good
function exchange ( req, res, next ) {

  var jwe, jws, ixToken, rsList, hostList, rsScopes
    , tokens = []

  try {
    jwe = new jwt.Parse( req.request['request.a2p3.org'].token )
    if ( !jwe.header.kid || !vault.keys.as[jwe.header.kid] ) {
      var e = new Error( "No AS key for 'kid' "+jwe.header.kid)
      e.code = "INVALID_TOKEN"
      return next( e )
    }
    ixToken = jwe.decrypt( vault.keys.as[jwe.header.kid] ) // list of keys for AS

// console.log('\ntoken\n', ixToken )

  }
  catch (e) {
    e.code = 'INVALID_TOKEN'
    return next( e )
  }
  try {
    jws = new jwt.Parse( req.request['request.a2p3.org'].request )  // agent Request
    if ( !jws.verify( vault.keys[jws.payload.iss][jws.header.kid] ) ) {
      var e = new Error( "Invalid Agent Request")
      e.code = "INVALID_REQUEST"
      return next( e )
    }  
  }
  catch (e) {
    e.code = 'INVALID_REQUEST'
    return next( e )    
  }

// console.log('\nJWS\n',jws )

// console.log('\nIX Request\n',req.request )

  // make sure IX Token 'iss' matches associated 'kid'
  if (!vault.keys[ixToken.iss][jwe.header.kid]) {
      var e = new Error("'iss' does not have supplied 'kid'")
      e.code = 'INVALID_TOKEN'
      return next( e )
  }
  // check agent request signature matches 'sar' that AS got
  if (ixToken['token.a2p3.org'].sar != jws.signature) {
      var e = new Error("IX Token 'sar' does not match request signature")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  // check ix request and agent request are from same app
  if (req.request.iss != jws.payload.iss) {
      var e = new Error("Agent Request 'iss' does not match IX Request 'iss'")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  // check IX & Agent Requests and IX Token have not expired
  if ( jwt.expired( req.request.iat ) ) {
      var e = new Error("IX Request has expired")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  if ( jwt.expired( jws.payload.iat ) ) {
      var e = new Error("Agent Request has expired")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  if ( jwt.expired( jwe.payload.iat ) ) {
      var e = new Error("IX Token has expired")
      e.code = 'INVALID_TOKEN'
      return next( e )
  }
  rsScopes = getHosts( jws.payload['request.a2p3.org'].resources )
  db.getStandardResourceHosts( ixToken.sub, ixToken.iss, Object.keys( rsScopes ), function ( e, redirects ) {
    hostList = [jws.payload.iss]
    Object.keys(rsScopes).forEach( function (rs) {
      if (redirects[rs]) {
        hostList.push( redirects[rs] )
      } else {
        hostList.push( rs )
      }
    })

    // app keys are stored with registrar
    db.getAppKeys( 'registrar', hostList, vault.keys, function ( e, keys ) {
      if (e) return next( e )
      db.getRsDIfromAsDI( ixToken.sub, ixToken.iss, hostList, function ( e, dis ) {
        if (e) return next( e )
        Object.keys( rsScopes ).forEach( function (rs) {
          var t = 
            { resource: rs
            , scope: rsScopes[rs]
            }

          function makeToken ( r ) {
            var payload = 
              { 'iss': config.host.ix
              , 'aud': r
              , 'sub': dis[r]
              , 'token.a2p3.org': 
                { 'auth': jwe.payload['token.a2p3.org'].auth
                , 'app': jws.payload.iss
                , 'scope': rsScopes[r]
                }
              }
            return token.create( payload, keys[r].latest )  
          } 

          if (redirects[rs]) {
            t.redirects = []
            redirects[rs].forEach( function (rsStd) {
              t.redirects.push(
                { 'resource': rsStd
                , 'token': makeToken( rsStd )
                } ) 
            })
          } else {
            t.token = makeToken( rs )
          }
          tokens.push( t ) 
        })
        return res.send( { result: {'sub': dis[jws.payload.iss], 'tokens': tokens} } )
      })
    })
  })
}


// APIs called from agent registration page
function agentList ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentAdd ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentDelete ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

exports.app = function() {
	var app = express()
  app.use(express.limit('10kb'))  // protect against large POST attack  
  app.use(express.bodyParser())

  app.post('/di/create'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['AS', 'RS', 'redirects'] )
          , diCreate 
          )
  app.post('/exchange'
          , request.check( vault.keys, null, 'ix' )
          , mw.a2p3Params( ['token', 'request'] )
          , exchange
          )  
  app.post('/agent/list'
          , request.check( vault.keys, config.roles.as )
          , agentList
          )
  app.post('/agent/add'
          , request.check( vault.keys, config.roles.as )
          , agentAdd
          )  
  app.post('/agent/delete'
          , request.check( vault.keys, config.roles.as )
          , agentDelete
          )

  app.use( mw.errorHandler )

	return app
}
