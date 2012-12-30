/* 
* Health.* Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

/*
* NOTE: this is a hardlinked file in each of the province subdirectories
* edit the file in the health directory, but don't reference it as the 
* require() statements are expecting to in the province subdirectory
*/

var express = require('express')
  , vault = require('./vault')
  , registration = require('../../registration')
  , mw = require('../../middleware')
  , config = require('../../config')
  , request = require('../../request')
  , token = require('../../token')
  , db = require('../../db')

// /di/link API called from setup
function diLink ( province ) {
  return function diLink ( req, res, next ) {
    var params = req.request['request.a2p3.org']
    db.updateProfile( 'health.'+province, params.sub, {'prov_number': params.account}, function ( e ) {
      if (e) return next( e )
      res.send( {result: {success: true} } )
    })
  }
}

// /prov_number API called from a registered App
function number ( province ) {
  return function prov_number ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'health.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.prov_number) {
        var e = new Error('no account for user')
        e.code = 'NO_PROV_NUMBER'
        return next( e )
      }
      res.send( {result: {'prov_number': profile.prov_number} } )
    })
  }
}

// generate request processing stack and routes
exports.app = function( province ) {
	var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  registration.routes( app, 'health.'+province, vault )  // add in routes for the registration paths

  app.post('/di/link' 
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink( province )
          )
  app.post('/prov_number' 
          , request.check( vault.keys, null, 'health.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'health.'+province, ['/scope/prov_number'] )
          , number( province ) 
          )

  app.use( mw.errorHandler )
	return app
}
