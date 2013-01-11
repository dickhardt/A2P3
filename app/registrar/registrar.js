/*
* Registrar Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , registration = require('../registration')
  , request = require('../request')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
  , mw = require('../middleware')

// Express Middleware that checks if agent token is valid
function checkValidAgent (req, res, next) {
  var err
    if (!req.body || !req.body.token) {
      err = new Error("No 'token' parameter in POST")
      err.code = 'INVALID_API_CALL'
      next(err)
      return undefined
    }
    db.validAgent( req.body.token, function (valid) {
      if (!valid) {
        err = new Error('unrecognized agent token')
        err.code = 'INVALID_TOKEN'
        next(err)
        return undefined
      } else {
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
    res.send(501, 'NOT IMPLEMENTED');
}

// /app/verify
function appVerify (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}


/*
*  registrar app APIs
*/

/*
function dashboardAppIdTaken ( req, res, next ) {
  db.checkRegistrarAppIdTaken( req.body.id, function ( e, taken ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    return res.send( {result:{'id': req.body.id, 'taken': taken}} )
  })
}

function dashboardNewApp ( req, res, next ) {
  db.newApp( 'registrar', req.body.id, req.body.name, req.session.email, function ( e, key ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    return res.send( {result:{'id': req.body.id, 'key': key}} )
  })
}

function dashboardAddAdmin ( req, res, next ) {
  db.addAppAdmin( 'registrar', req.body.id, eq.body.admin, function ( e ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    return res.send( {result:{'id': req.body.id, 'admin': req.body.admin}} )
  })
}

function dashboardDeleteApp ( req, res, next ) {
  db.deleteApp( 'registrar', req.body.id, function ( e ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    return res.send( {result:{'id': req.body.id,}} )
  })
}

function dashboardRefreshKey ( req, res, next ) {
  db.refreshAppKey( 'registrar', req.body.id, function ( e, key ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    return res.send( {result:{'id': req.body.id, 'key': key}} )
  })
}

function dashboardGetKey ( req, res, next ) {
  db.getAppKey( 'registrar', req.body.id, null, function ( e, key ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    return res.send( {result:{'id': req.body.id, 'key': key}} )
  })
}

function checkAdminAuthorization ( req, res, next ) {
  db.checkAdminAuthorization( 'registrar', req.body.id, req.a2p3admin.di, function ( e, authorized ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    if (!authorized) {
      var err = new Error(req.a2p3admin.di+' not authorized for '+req.body.id)
      e.code = "ACCESS_DENIED"
      return next(e)
    } else
      next()
  })
}

// TBD: placeholder for managing access control and sessions
function checkSession ( req, res, next ) {
  if (req.session.di && req.session.email) {
    next()
  } else {
    var err = new Error('DI and email missing from session')
    err.code = "ACCESS_DENIED"
    return next( err )
  }
}

// sets session cookie values
function bootRegistrar ( req, res, next ) {
  if (req.request && req.request['request.a2p3.org'] &&
      req.request['request.a2p3.org'].di && req.request['request.a2p3.org'].email) {
    req.session.di = req.request['request.a2p3.org'].di
    req.session.email = req.request['request.a2p3.org'].email
    res.send( {result: {success:true}} )
  } else {
    var err = new Error('DI and email missing from request')
    err.code = "INVALID_REQUEST"
    return next( err )
  }
}

*/

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
  app.post('/app/verify', request.check( vault, null, 'registrar'), appVerify )

  // dashboard web APIs
  registration.routes( app, 'registrar', vault )  // add in routes for the registration paths

  // login routing
  mw.loginHandler( app, { 'dashboard': 'registrar', 'vault': vault } )

  app.use( mw.errorHandler )

// console.log( '\nroutes\n', util.inspect( app.routes, null, null ) )

	return app
}