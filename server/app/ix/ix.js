/* 
* IX Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , url = require('url')
  , request = require('../request')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
  , jwt = require('../jwt')
  , mw = require('../middleware')

function diCreate ( req, res, next ) {
    var AS = req.request['request.a2p3.org'].AS
    var rsHosts = req.request['request.a2p3.org'].RS
    var redirects = req.request['request.a2p3.org'].redirect
    db.newUser( AS, rsHosts, redirect, function ( e, dis ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      res.send( {'result': {'dis': dis}} )
    })
}


// parses out hosts from passed in scopes
function getHosts ( scopes ) {
  var results = {}
  urls.forEach( function ( scope ) {
    var o = url.parse( scope )
    results[host] = o.hostname
  })
  return results
}


// exchange IX Token for RS Tokens if all is good
function exchange ( req, res, next ) {
  // verify the token
  var jwe, jws, token, rsList, hostList
    , tokens = []
  try {
    jwe = jwt.Parse( req.request.token )
    if ( !jwe.header.kid || !vault.keys.as[jwe.header.kid] ) {
      var e = new Error( "No AS key for 'kid' "+jwe.header.kid)
      e.code = "INVALID_TOKEN"
      return next( e )
    }
    token = jwe.verify( vault.keys.as[jwe.header.kid] ) // list of keys for AS
  }
  catch (e) {
    e.code = 'INVALID_TOKEN'
    next( e )
  }
  jws = new jwt.Parse( req.body.request )  // need to look at header, so need full JWS

  // make sure 'iss' matches associated 'kid'
  if (!vault.keys[token.iss][jwe.header.kid]) {
      var e = new Error("'iss' does not have supplied 'kid'")
      e.code = 'INVALID_TOKEN'
      return next( e )
  }
  // check request signature matches 'sar' that AS got
  if (token['token.a2p3.org'].sar != jws.signature) {
      var e = new Error("Token 'sar' does not match request signature")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  // check request and token have not expired
  if ( jwt.expired( jws.payload.iat ) ) {
      var e = new Error("Request has expired")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  if ( jwt.expired( jwe.payload.iat ) ) {
      var e = new Error("Token has expired")
      e.code = 'INVALID_TOKEN'
      return next( e )
  }
  rsScopes = getHosts( jws.payload['request.a2p3.org'].resources )
  db.getStandardResourceHosts( token.sub, token.iss, Object.keys( rsScopes ), function ( e, redirects ) {
    hostList = [jws.iss]
    Object.keys(rsScope).forEach( function (rs) {
      if (redirects[rs]) {
        hostList.push( redirects[rs] )
      } else {
        hostList.push( rs )
      }
    })
    db.getAppKeys( 'ix', hostList, function ( e, keys ) {
      if (e) return next( e )
      db.getRsDIfromAsDI( token.sub, token.iss, hostList, function ( e, dis ) {
        if (e) return next( e )
        Object.keys( rsScope ).forEach( function (rs) {
          var t = 
            { resource: rs
            , scope: rsScope[rs]
            }
          function makeToken ( r ) {
            var payload = 
              { 'iss': config.host.ix
              , 'aud': r
              , 'sub': dis[r]
              , 'token.a2p3.org': 
                { 'auth': jwe.payload['token.a2p3.org'].auth
                , 'app': jws.payload.iss
                , 'scope': rsScope[r]
                }
              }
            return jwt.create( payload, keys[r] )  
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
        res.send( { 'sub': dis[jws.payload.iss], 'tokens': tokens } )

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
          , request.check( vault.keys
          , config.roles.enroll )
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

	return app
}
