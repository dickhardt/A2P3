/*
* email RS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , config = require('../config')
  , db = require('../db')
  , registration = require('../registration')
  , mw = require('../middleware')
  , request = require('../request')
  , token = require('../token')
  , querystring = require('querystring')
  , api = require('../api')
  , jwt = require('../jwt')


// /di/link API called from setup
function diLink ( req, res, next ) {

debugger;

  var params = req.request['request.a2p3.org']
  db.updateProfile( 'email', params.sub, {'email': params.account}, function ( e ) {
    if (e) return next( e )
    res.send( {result: {success: true} } )
  })
}

// /email/default API called from a registered App
function emailDefault ( req, res, next ) {

debugger;

  var di = req.token.sub
  db.getProfile( 'email', di, function ( e, profile ) {
    if (e) next( e )
    if (!profile || !profile.email) {
      var e = new Error('no email for user')
      e.code = 'NO_EMAIL'
      return next( e )
    }
    res.send( {result: {'email': profile.email} } )
  })
}

// generate request processing stack and routes
exports.app = function() {
	var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  registration.routes( app, 'email', vault )  // add in routes for the registration paths

  mw.loginHandler( app, { 'dashboard': 'email', 'vault': vault } )

  app.post('/di/link'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink
          )
  app.post('/email/default'
          , request.check( vault.keys, null, 'email' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'email', ['/scope/default'] )
          , emailDefault
          )
  app.use( mw.errorHandler )

  return app
}
