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
  , registration = require('../../registration')
  , mw = require('../../middleware')
  , config = require('../../config')
  , request = require('../../request')
  , token = require('../../token')
  , db = require('../../db')

var vault = {}  // we pull in correct vault when app() is called


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

// calculates age with DOB passed in as string
function ageYears ( dateString ) {
  var dob = new Date( dateString )
  var today = new Date()
  var age = today.getFullYear() - dob.getFullYear()
  if ( ( today.getMonth() <= dob.getMonth() ) && ( today.getDate() <= dob.getDate() ) )
    age++
  return age
}

// /over19 API called from a registered App
function over19 ( province ) {
  return function over19 ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.dob) {
        var e = new Error('no DOB for user')
        e.code = 'NO_PROFILE'
        return next( e )
      }
      var over19 = ageYears( profile.dob ) >= 19
      res.send( {result: {'over19': over19 ? true : false } } )
    })
  }
}

// /under20over65 API called from a registered App
function under20over65 ( province ) {
  return function under20over65 ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.dob) {
        var e = new Error('no DOB for user')
        e.code = 'NO_PROFILE'
        return next( e )
      }
      var age = ageYears( profile.dob )
      var under20over65 = (age <= 19 || age >=65)
      res.send( {result: {'under20over65': under20over65 ? true : false } } )
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

// /details API called from a registered App
function details ( province ) {
  return function details ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile) {
        var e = new Error('no profile for user')
        e.code = 'NO_PROFILE'
        return next( e )
      }
      res.send( {'result': profile } )
    })
  }
}

// generate request processing stack and routes
exports.app = function( province ) {

  vault = require('../'+province+'/vault.json')

  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  registration.routes( app, 'people.'+province, vault )  // add in routes for the registration paths
  
  mw.loginHandler( app, { 'app': 'people.'+province, 'vault': vault, 'dashboard': true } )

  app.post('/di/link' 
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'profile'] )
          , diLink( province )
          )
  app.post('/over19' 
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/over19','/scope/details'], 'people' )
          , over19( province ) 
          )
  app.post('/under20over65' 
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/under20over65','/scope/details'], 'people' )
          , under20over65( province ) 
          )
  app.post('/namePhoto' 
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/namePhoto','/scope/details'], 'people' )
          , namePhoto( province ) 
          )
  app.post('/details' 
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/details'], 'people' )
          , details( province ) 
          )

  app.use( mw.errorHandler )
  return app
}

