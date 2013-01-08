/*
* Standardized Resource Server App Registration code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , request = require('./request')
  , config = require('./config')
  , util = require('util')
  , db = require('./db')
  , mw = require('./middleware')
  , api = require('./api')


exports.routes = function ( app, RS, vault ) {


  function dashboardlistApps ( req, res, next ) {
    db.listApps( RS, req.session.email, function ( e, list ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {'list': list, 'email': req.session.email } } )
    })
  }

  function dashboardNewApp ( req, res, next ) {

    // TBD check that User is auth for this App at Registrar unless we are the Registrar


// call all resources

    db.newApp( RS, req.body.id, req.body.name, req.session.email, function ( e, key ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function dashboardDeleteApp ( req, res, next ) {


// call all resources

    db.deleteApp( RS, req.body.id, function ( e ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id,}} )
    })
  }

  function dashboardRefreshKey ( req, res, next ) {

// call all resources

    db.refreshAppKey( RS, req.body.id, function ( e, key ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function dashboardGetKey ( req, res, next ) {


// call all resources

    db.getAppKey( RS, req.body.id, null, function ( e, key ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function checkAdminAuthorization ( req, res, next ) {
    db.checkAdminAuthorization( RS, req.body.id, req.session.di, function ( e, authorized ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      if (!authorized) {
        var err = new Error( req.session.di + ' not authorized for ' + req.body.id )
        e.code = "ACCESS_DENIED"
        return next(e)
      } else
        next()
    })
  }

  // checks session has required data, otherwise goes and gets it
  function checkSession ( req, res, next ) {


    function badSession( error ) {
      req.session.bad = true
      var err = new Error( error || 'Bad session' )
      err.code = "ACCESS_DENIED"
      return next( err )
    }

    if ( req.session.bad ) return badSession() // been here before

    if (req.session.email) {
      return next()
    } else {
      // first time through, get email from email RS
      if ( !req.session.di ) return badSession('No DI in session')
      if ( !req.session.tokens ) return badSession('No tokens in session')
      var details =
        { host: 'email'
        , api: '/email/default'
        , credentials: vault.keys[config.host.email].latest
        , payload:
          { iss: config.host[RS]
          , aud: config.host.email
          , 'request.a2p3.org': { 'token': req.session.tokens[config.host.email] }
          }
        }
      api.call( details, function ( error, result ) {
        if (error) return badSession( error )
        if (!result.email) badSession( 'No email for user.' )
        req.session.email = result.email
        db.registerAdmin( RS, result.email, req.session.di, function ( e ) {
          if (e) return next (e)
          return next()
        })
      })
    }
  }

  app.use( express.cookieParser() )

  var cookieOptions = { 'secret': vault.secret, 'cookie': { path: '/dashboard' } }
  app.use( express.cookieSession( cookieOptions ))

  app.get('/dashboard/list/apps'
          , checkSession
          , dashboardlistApps
          )
  app.post('/dashboard/new/app'
          , checkSession
          , mw.checkParams( {'body':['id','name']} )
          , dashboardNewApp
          )
  app.post('/dashboard/delete/app'
          , checkSession
          , mw.checkParams( {'body':['id']} )
          , checkAdminAuthorization
          , dashboardDeleteApp
          )
  app.post('/dashboard/refresh/keys'
          , checkSession
          , mw.checkParams( {'body':['id']} )
          , checkAdminAuthorization
          , dashboardRefreshKey
          )
  app.post('/dashboard/getkeys'
          , checkSession
          , mw.checkParams( {'body':['id']} )
          , checkAdminAuthorization
          , dashboardGetKey
          )

}