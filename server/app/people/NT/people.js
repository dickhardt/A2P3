/* 
* People.* Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

/*
* NOTE: this is a hardlinked file in each of the province subdirectories
* edit the file in the people directory, but don't reference it as the 
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
    db.updateProfile( 'people.'+province, params.sub, params.profile, function ( e ) {
      if (e) return next( e )
      res.send( {result: {success: true} } )
    })
  }
}

// /namePhoto API called from a registered App
function namePhoto ( province ) {
  return function namePhoto ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.name || !profile.photo) {
        var e = new Error('no name and/or photo for user')
        e.code = 'NO_PROFILE'
        return next( e )
      }
      res.send( {result: {'name': profile.name, 'photo': profile.photo} } )
    })
  }
}

// generate request processing stack and routes
exports.app = function( province ) {
  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  registration.routes( app, 'people.'+province, vault )  // add in routes for the registration paths

  app.post('/di/link' 
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'profile'] )
          , diLink( province )
          )
  app.post('/namePhoto' 
          , request.check( vault, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, '/scope/namePhoto' )
          , namePhoto( province ) 
          )

  app.use( mw.errorHandler )
  return app
}

