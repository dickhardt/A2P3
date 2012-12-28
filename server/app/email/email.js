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


function diLink ( req, res, next ) {
  var params = req.request['request.a2p3.org']

}

function emailDefault ( req, res, next ) {
  var di = req.token.
  db.getProfile( 'email', di, function ( e, profile ) {
    if (e) next( e )
    if (!profile || !profile.email) {
      var e = new Error('no email for user')
      e.code = 'NO_EMAIL'
      next( e )
    }
    res.send( {result: {'email': profile.email} } )
  })
}

exports.app = function() {
	var app = express()
  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )
  registration.routes( app, 'email', vault )  // add in routes for the registration paths

  app.post('/di/link' 
          , request.check( vault, config.roles.enroll )
          , mw.a2p3Params( ['directed', 'account'] )
          , diLink )
  app.post('/email/default' 
          , request.check( vault, null, 'email' )
          , token.checkRS( vault, 'email', '/scope/default' )
          , mw.a2p3Params( ['directed', 'account'] )
          , emailDefault )
  app.use( mw.errorHandler )
	return app
}
