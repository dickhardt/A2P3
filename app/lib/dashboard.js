/*
* Resource Server App Dashboard code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , util = require('util')
  , config = require('../config')
  , request = require('./request')
  , db = require('./db')
  , mw = require('./middleware')
  , api = require('./api')
  , login = require('./login')


exports.routes = function ( app, RS, vault ) {

  var std = RS.replace(/\...$/,'')

  if (std == RS) std = null // std is set if we are doing a province standardized resource

  // only called at Registrar Dashboard
  function dashboardAddAdmin ( req, res, next ) {
    db.addAppAdmin( RS, req.body.id, req.body.admin, function ( e ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {success: true } } )
    })
  }

  // only called at Registrar Dashboard
  function dashboardDeleteAdmin ( req, res, next ) {
    db.deleteAppAdmin( RS, req.body.id, req.body.admin, function ( e ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {success: true } } )
    })
  }

  // only called at Registrar Dashboard
  function dashboardAppIdTaken ( req, res, next ) {
    db.checkRegistrarAppIdTaken( req.body.id, function ( e, taken ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'taken': taken}} )
    })
  }

  function dashboardlistApps ( req, res, next ) {
    db.listApps( RS, req.session.email, function ( e, list ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {'list': list, 'email': req.session.email } } )
    })
  }

  function dashboardAppDetails ( req, res, next ) {
    db.appDetails( RS, req.session.email, req.body.id, function ( e, details ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {'details': details, 'email': req.session.email } } )
    })
  }



  function dashboardNewApp ( req, res, next ) {

    function newApp() {
      var anytime = ( req.body.anytime == 'true' )
      db.newApp( RS, req.body.id, req.body.name, req.session.email, anytime, function ( e, key ) {
        if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
        return res.send( {result:{'key': key}} )
      })
    }
    // check that User is auth for this App at Registrar unless we are the Registrar
    // or this is an API call from a Standardized Resource
    if ( ( RS == 'registrar' ) || req.request ) return newApp()
    if (!req.session && !req.session.tokens && !req.session.tokens[config.host.registrar]) {
      var e = new Error('No RS Token for Registrar found')
      e.code = 'INTERNAL_ERROR'
      return next( e )
    }
    var stdApi = new api.Standard( RS, vault )
    stdApi.call( 'registrar', '/app/verify'
                , {id: req.body.id, token: req.session.tokens[config.host.registrar]}
                , function ( e, result ) {
      if (e) return next(e)
      req.body.name = result.name
      newApp()
    })
  }



  function dashboardDeleteApp ( req, res, next ) {
    db.deleteApp( RS, req.body.id, function ( e ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{success: true }} )
    })
  }

  function dashboardRefreshKey ( req, res, next ) {
    db.refreshAppKey( RS, req.body.id, function ( e, key ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function dashboardGetKey ( req, res, next ) {
    db.getAppKey( RS, req.body.id, null, function ( e, key ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function checkAdminAuthorization ( req, res, next ) {
    db.checkAdminAuthorization( RS, req.body.id, req.session.di, function ( e, authorized ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      if (!authorized) {
        var err = new Error( req.session.di + ' not authorized for ' + req.body.id )
        err.code = "ACCESS_DENIED"
        return next(err)
      } else
        next()
    })
  }

// reformat parameters from standard resource host API calls
// to fit existing dashboard calls
  function stdNewApp ( req, res, next ) {
    req.body.id = req.request['request.a2p3.org'].id
    req.body.name = req.request['request.a2p3.org'].name
    req.session = {}
    req.session.email = req.request['request.a2p3.org'].email
    dashboardNewApp( req, res, next )
  }

  function stdDeleteApp ( req, res, next ) {
    req.body.id = req.request['request.a2p3.org'].id
    dashboardDeleteApp( req, res, next )
  }

  function stdRefreshKey ( req, res, next ) {
    req.body.id = req.request['request.a2p3.org'].id
    dashboardRefreshKey( req, res, next )
  }

  function stdGetKey ( req, res, next ) {
    req.body.id = req.request['request.a2p3.org'].id
    dashboardGetKey( req, res, next )
  }


  // checks session has required data, otherwise goes and gets it
  function checkSession ( req, res, next ) {

// console.log('\ncheckSession session\n', req.session)

    function badSession( error ) {
      if (req.route.method === 'get') { // we are serving a page, so send user back to homepage
        return res.redirect('/')
      }
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
      // if we are email RS, then we can just fetch it ourselves
      if (RS == 'email') {
        return db.getProfile( RS, req.session.di, function ( e, profile ) {
          if (e) return badSession( e.message )
          if (!profile.email) return badSession( 'No email for user.' )
          req.session.email = profile.email
          db.registerAdmin( RS, req.session.email, req.session.di, function ( e ) {
            if (e) return next (e)
            return next()
          })
        })
      }
      if ( !req.session.tokens || !req.session.tokens[config.host.email] ) return badSession('No tokens in session')
      db.getAppKey( RS, config.host.email, vault.keys, function ( e, keys ) {
        var details =
          { host: 'email'
          , api: '/email/default'
          , credentials: keys.latest
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
          db.registerAdmin( RS, req.session.email, req.session.di, function ( e ) {
            if (e) return next (e)
            return next()
          })
        })
      })
    }
  }

  // setup session management and all login routes
  login.router( app, { 'dashboard': RS, 'vault': vault })

  app.get('/', function( req, res ) { res.sendfile( config.rootAppDir + '/html/homepage_rs.html' ) } )

  if (RS == 'registrar') { // only Registrar is allowed to check if ID is available
    app.post('/dashboard/appid/taken'
            , checkSession
            , mw.checkParams( {'body':['id']} )
            , dashboardAppIdTaken
            )
    app.post('/dashboard/add/admin'
            , checkSession
            , mw.checkParams( {'body':['id','admin']} )
            , checkAdminAuthorization
            , dashboardAddAdmin
            )
    app.post('/dashboard/delete/admin'
            , checkSession
            , mw.checkParams( {'body':['id','admin']} )
            , checkAdminAuthorization
            , dashboardDeleteAdmin
            )
    app.get('/dashboard', checkSession, function( req, res ) { res.sendfile( config.rootAppDir + '/html/dashboard_registrar.html' ) } )
  } else { // if not registrar
    app.get('/dashboard', checkSession, function( req, res ) { res.sendfile( config.rootAppDir + '/html/dashboard.html' ) } )
  }

  app.post('/dashboard/list/apps'
          , checkSession
          , dashboardlistApps
          )
  app.post('/dashboard/app/details'
          , checkSession
          , mw.checkParams( {'body':['id'],'session':['email','di']} )
          , checkAdminAuthorization
          , dashboardAppDetails
          )
  app.post('/dashboard/new/app'
          , checkSession
          , mw.checkParams( {'body':['id'],'session':['email','di']} ) // {'body':['id','name']} only Registrar takes name
          , dashboardNewApp
          )
  app.post('/dashboard/delete/app'
          , checkSession
          , mw.checkParams( {'body':['id']} )
          , checkAdminAuthorization
          , dashboardDeleteApp
          )
  app.post('/dashboard/refresh/key'
          , checkSession
          , mw.checkParams( {'body':['id']} )
          , checkAdminAuthorization
          , dashboardRefreshKey
          )
  app.post('/dashboard/getkey'
          , checkSession
          , mw.checkParams( {'body':['id']} )
          , checkAdminAuthorization
          , dashboardGetKey
          )


// API calls from Standardized Resource Manager
  if (std) {  // we are setting up a standardized resource
    var accessList = {}
    accessList[config.host[std]] = true
    app.post('/std/new/app'
            , request.check( vault.keys, accessList, config.host[RS])
            , mw.a2p3Params( ['id', 'name', 'email'] )
            , stdNewApp
            )
    app.post('/std/delete/app'
            , request.check( vault.keys, accessList, config.host[RS])
            , mw.a2p3Params( ['id'] )
            , stdDeleteApp
            )
    app.post('/std/refresh/key'
            , request.check( vault.keys, accessList, config.host[RS])
            , mw.a2p3Params( ['id'] )
            , stdRefreshKey
            )
    app.post('/std/getkey'
            , request.check( vault.keys, accessList, config.host[RS])
            , mw.a2p3Params( ['id'] )
            , stdGetKey
            )
  }


}