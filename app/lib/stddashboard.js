/*
* Standardized Resource Server App Registration code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , api = require('./api')
  , config = require('../config')
  , async = require('async')
  , db = require('./db')
  , mw = require('./middleware')
  , login = require('./login')
  , api = require('./api')
  , util = require('util')

// main function that sets up all the routes
exports.routes = function ( app, RS, vault ) {

  var stdApi = new api.Standard( RS, vault )

  function _callAllResources ( api, params, callback ) {
    var tasks = {}
    config.provinces.forEach( function ( province ) {
      var host = RS + '.' + province
      tasks[host] = function( done ) {
        stdApi.call( host, api, params, done )
      }
    })
    async.parallel( tasks, callback )
  }


  function dashboardlistApps ( req, res, next ) {
    db.listApps( RS, req.session.email, function ( e, list ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {'list': list, 'email': req.session.email } } )
    })
  }

  function dashboardAppDetails ( req, res, next ) {
    db.appDetails( RS, req.session.email, req.body.id, function ( e, details ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {'details': details, 'email': req.session.email } } )
    })
  }

  function dashboardNewApp ( req, res, next ) {
    stdApi.call( 'registrar', '/app/verify'
                , {id: req.body.id, token: req.session.tokens[config.host.registrar]}
                , function ( e ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      db.newApp( RS, req.body.id, req.body.name, req.session.email, function ( e ) {
        if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
        _callAllResources( '/std/new/app'
                    , {id: req.body.id, name: req.body.name, email: req.session.email}
                    , function ( e, results ) {
          if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
          var keys = {}
          Object.keys( results ).forEach( function ( host ) {
            keys[config.host[host]] = results[host].key
          })
          return res.send( {result: keys} )
        })
      })
    })
  }

  function dashboardDeleteApp ( req, res, next ) {
    _callAllResources( '/std/delete/app', {id: req.body.id}, function ( e ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      db.deleteApp( RS, req.body.id, function ( e ) {
        if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
        return res.send( {result:{success: true }} )
      })
    })
  }

  function dashboardRefreshKey ( req, res, next ) {
    _callAllResources( '/std/refresh/key', {id: req.body.id}, function ( e, results ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      var keys = {}
      Object.keys( results ).forEach( function ( host ) {
        keys[host] =
          { kid: results[host].result.key.kid
          , key: results[host].result.key.key
          }
      })
      return res.send( {result: keys} )
    })
  }

  function dashboardGetKey ( req, res, next ) {
    _callAllResources( '/std/getkey', {id: req.body.id}, function ( e, results ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      var keys = {}
      Object.keys( results ).forEach( function ( host ) {
        keys[host] =
          { kid: results[host].result.key.kid
          , key: results[host].result.key.key
          }
      })
      return res.send( {result: keys} )
    })
  }

  function checkAdminAuthorization ( req, res, next ) {
    db.checkAdminAuthorization( RS, req.body.id, req.session.di, function ( e, authorized ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      if (!authorized) {
        var err = new Error( req.session.di + ' not authorized for ' + req.body.id )
        err.code = "ACCESS_DENIED"
        return next(err)
      } else
        next()
    })
  }

  // checks session has required data, otherwise goes and gets it
  function checkSession ( req, res, next ) {

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

  // setup session management and all login routes
  login.router( app, { 'dashboard': RS, 'vault': vault })

  app.get('/', function( req, res ) { res.sendfile( config.rootAppDir + '/html/homepage_rs.html' ) } )

  app.get('/dashboard/list/apps'
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

  app.get('/dashboard', checkSession, function( req, res ) { res.sendfile( config.rootAppDir + '/html/dashboard_std.html' ) } )


}