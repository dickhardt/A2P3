/*
* Registrar Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , util = require('util')
  , vault = require('./vault')
  , config = require('../config')
  , dashboard = require('../lib/dashboard')
  , request = require('../lib/request')
  , token = require('../lib/token')
  , db = require('../lib/db')
  , mw = require('../lib/middleware')

// Express Middleware that checks if agent token is valid
function checkValidAgent (req, res, next) {
  var err
    if (!req.body || !req.body.token) {
      err = new Error("No 'token' parameter in POST")
      err.code = 'INVALID_API_CALL'
      next(err)
      return undefined
    }
    db.validAgent( req.body.token, function ( di ) {
      if (!di) {
        err = new Error('unrecognized agent token')
        err.code = 'INVALID_TOKEN'
        next(err)
        return undefined
      } else {
        // save DI for later
        req.agent = {'di': di}
        next()
      }
    })
}


// /request/verify
function requestVerify (req, res, next) {

  if (!req.body || !req.body.request) {
      var err = new Error("No 'request' parameter in POST")
      err.code = 'INVALID_API_CALL'
      return next( err )
  }
  request.verifyAndId( req.body.request, 'registrar', vault.keys, function ( error, appID ) {
    if ( error ) return next( error )
    if ( appID ) {
      db.getAppName( appID, function ( e, appName ) {
        if ( e ) return next( e )
        return res.send( {result: { name: appName } } )
      })
    } else
      return next( new Error('unknown') )
  })
}

// /report
function report (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

// /authorizationsRequests
function authorizationsRequests ( req, res, next ) {
  var resources = req.body.authorizations
  var response = {}
  db.getAnytimeAppKeys( resources, vault.keys, function ( e, keys ) {
    if (e) return next( e )
    if (!keys) return res.send( { result: {} } )
    Object.keys( keys ).forEach( function ( rs ) {
      var tokenPayload =
        { 'iss': config.host.ix // Tokens must be from IX
        , 'aud': rs
        , 'sub': db.mapDI( rs, req.agent.di)
        , 'token.a2p3.org':
          { 'app': config.host.registrar
          , 'auth': { passcode: true, authorization: true }
          }
        }
      var rsToken = token.create( tokenPayload, keys[rs].latest )
      var requestDetails =
        { 'iss': config.host.registrar // request comes from Registrar
        , 'aud': rs
        , 'request.a2p3.org': { 'token': rsToken }
        }
      response[rs] = request.create( requestDetails, keys[rs].latest )
      })
    res.send( { result: response } )
  })
}

// /app/verify
function appVerify ( req, res, next ) {
  db.checkApp( 'registrar', req.request['request.a2p3.org'].id, req.token.sub, function ( e, name ) {
    if (e) return next( e )
    if (name) return res.send( { result: { name: name } } )
    var err = new Error('UNKNOWN')
    next( err )
  })
}

exports.app = function() {
	var app = express()
  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  // All Dashboard Web pages and API
  dashboard.routes( app, 'registrar', vault )  // add in routes for the registration paths

  // called by personal agents
  app.post('/request/verify', checkValidAgent, requestVerify )
  app.post('/report', checkValidAgent, report )
  app.post('/authorizations/requests', checkValidAgent, authorizationsRequests )

  // called by RS
  app.post('/app/verify'
          , request.check( vault, null, 'registrar')
          , mw.a2p3Params( ['id', 'token'] )
          , token.checkRS( vault.keys, 'registrar', ['/scope/verify'] )
          , appVerify
          )

  app.get('/documentation', mw.md( __dirname+'/README.md' ) )
  app.get(/\/scope[\w\/]*/, mw.scopes( __dirname + '/scopes.json', config.host.registrar ) )

  app.use( mw.errorHandler )

// console.log( '\nroutes\n', util.inspect( app.routes, null, null ) )

	return app
}