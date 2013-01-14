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
  , login = require('../lib/login')

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
        req.body.di = di
        next()
      }
    })
}


// /request/verify
function requestVerify (req, res, next) {
  var appId, err
  if (!req.body || !req.body.request) {
      err = new Error("No 'request' parameter in POST")
      err.code = 'INVALID_API_CALL'
      return next( err )
  }
  try {
    appId = request.verifyAndId( req.body.request, vault.keys )
    if ( appId ) {
      db.getAppName( appId, function (appName) {
          res.send({result: { name: appName }})
        })
      return undefined
    } else {
        err = new Error('Invalid request signature')
        err.code = 'INVALID_REQUEST'
        return next( err )
    }
  }
  catch (e) {
    e.code = 'INVALID_REQUEST'
    return next( e )
  }
}

// /report
function report (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

// /authorizationsRequests
function authorizationsRequests (req, res) {
  var resources = req.body.authorizations
  var response = {}
  resources.forEach( function ( rs) {
    db.getAnytimeAppKey( vault.keys, function ( e, key ) {
      if (e) return
      if (!key) return
      var tokenPayload =
        { 'iss': config.host.registrar
        , 'aud': config.host[rs]
        , 'sub': req.body.di
        , 'token.a2p3.org': { 'empty': true }
        }
      var rsToken = token.create( tokenPayload, key.latest )
      var requestDetails =
        { 'iss': config.host.registrar
        , 'aud': config.host[rs]
        , 'request.a2p3.org': { 'token': rsToken }
        }
      response[rs] = request.create( requestDetails, key.latest )
    })
  })
  res.send( { result: response } )
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

  app.use( express.cookieParser() )
  var cookieOptions = { 'secret': vault.secret, 'cookie': { path: '/dashboard' } }
  app.use( express.cookieSession( cookieOptions ))

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

  // dashboard web APIs
  dashboard.routes( app, 'registrar', vault, __dirname )  // add in routes for the registration paths

  // login routing
  login.router( app, { 'dashboard': 'registrar', 'vault': vault } )

  app.use( mw.errorHandler )

// console.log( '\nroutes\n', util.inspect( app.routes, null, null ) )

	return app
}