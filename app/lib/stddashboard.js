/*
* Standardized Resource Server App Registration code
*
* Copyright (C) Province of British Columbia, 2013
*/

var underscore = require('underscore')
  , api = require('./api')
  , config = require('../config')
  , async = require('async')
  , db = require('./db')
  , mw = require('./middleware')
  , login = require('./login')
  , api = require('./api')

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
    var stdApi = new api.Standard( RS, vault )
    stdApi.call( 'registrar', '/app/list'
                , {token: req.session.tokens[config.host.registrar]}
                , function ( e, result ) {
      if (e) return next( e )
      var allAdminAppIDs = result && Object.keys( result )
      req.session.apps = allAdminAppIDs
      db.registeredApps( RS, function ( e, result ) {
        if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
        var appsAtRS = null
        if (result && allAdminAppIDs) {
          appsAtRS = underscore.intersection( allAdminAppIDs, Object.keys( result ) )
        }
        var list = {}
        if (appsAtRS) {
          appsAtRS.forEach( function ( id ) {
            list[id] = result[id]
          })
        }
        return res.send( { result: {'list': list, 'email': req.session.email } } )
      })
    })
  }

  function dashboardAppDetails ( req, res, next ) {
    db.appDetails( RS, req.body.id, function ( e, details ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( { result: {'details': details, 'email': req.session.email } } )
    })
  }

  function dashboardNewApp ( req, res, next ) {
    stdApi.call( 'registrar', '/app/verify'
                , {id: req.body.id, token: req.session.tokens[config.host.registrar]}
                , function ( e, result ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      db.newApp( RS, req.body.id, result.name, req.session.email, function ( e ) {
        if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
        _callAllResources( '/std/new/app'
                    , {id: req.body.id, name: result.name, email: req.session.email}
                    , function ( e, results ) {
          if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
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
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      db.deleteApp( RS, req.body.id, function ( e ) {
        if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
        return res.send( {result:{success: true }} )
      })
    })
  }

  function dashboardRefreshKey ( req, res, next ) {
    _callAllResources( '/std/refresh/key', {id: req.body.id}, function ( e, results ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      var keys = {}
      Object.keys( results ).forEach( function ( host ) {
        if (results[host].key) {
          keys[config.host[host]] = results[host].key
        }
      })
      return res.send( {result: keys} )
    })
  }

  function dashboardGetKey ( req, res, next ) {
    _callAllResources( '/std/getkey', {id: req.body.id}, function ( e, results ) {
      if (e) { e.code = e.code || "INTERNAL_ERROR"; return next(e) }
      var keys = {}
      Object.keys( results ).forEach( function ( host ) {
        if (results[host].key) {
          keys[config.host[host]] = results[host].key
        }
      })
      return res.send( {result: keys} )
    })
  }

  function checkAdminAuthorization ( req, res, next ) {

// console.log('\n checkAdminAuthorization req.session.apps\n',req.session.apps)

    if (!req.session.apps || req.session.apps.indexOf( req.body.id ) == -1 ) {
      var e = new Error('Admin is not authorative for '+req.body.id )
      e.code = "ACCESS_DENIED"
      return next( e )
    }
    next()
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
          , mw.checkParams( {'body':['id']} )
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

  app.get('/dashboard', checkSession, function( req, res ) { res.sendfile( config.rootAppDir + '/html/dashboard_std.html' ) } )


}