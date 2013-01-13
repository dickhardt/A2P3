/*
* SI Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , config = require('../config')
  , dashboard = require('../lib/dashboard')
  , request = require('../lib/request')
  , db = require('../lib/db')
  , mw = require('../lib/middleware')
  , token = require('../lib/token')


// /di/link API called from setup
function diLink ( req, res, next ) {
  var params = req.request['request.a2p3.org']
  db.updateProfile( 'si', params.sub, {'number': params.account}, function ( e ) {
    if (e) return next( e )
    res.send( {result: {success: true} } )
  })
}

// /number API called from a registered App
function number ( req, res, next ) {
  var di = req.token.sub
  db.getProfile( 'si', di, function ( e, profile ) {
    if (e) next( e )
    if (!profile || !profile.number) {
      var e = new Error('no social insurance number for user')
      e.code = 'NO_NUMBER'
      return next( e )
    }
    res.send( {result: {'si': profile.number} } )
  })
}

// generate request processing stack and routes
exports.app = function() {
  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  dashboard.routes( app, 'si', vault )  // add in routes for the registration paths

  mw.loginHandler( app, { 'dashboard': 'si', 'vault': vault } )

  app.post('/di/link'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink
          )
  app.post('/number'
          , request.check( vault.keys, null, 'si' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'si', ['/scope/number'] )
          , number
          )
  app.use( mw.errorHandler )

  return app
}
