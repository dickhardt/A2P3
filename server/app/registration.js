/* 
* Resource Server App Registration code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , request = require('./request')
  , config = require('./config')
  , util = require('util')
  , db = require('./db')
  , mw = require('./middleware')


exports.routes = function ( app, RS, vault ) {

  function dashboardNewApp ( req, res, next ) {
    db.newApp( RS, req.body.id, req.body.name, req.session.email, function ( e, key ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function dashboardAddAdmin ( req, res, next ) {
    db.addAppAdmin( RS, req.body.id, eq.body.admin, function ( e ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'admin': req.body.admin}} )
    })
  }

  function dashboardDeleteApp ( req, res, next ) {
    db.deleteApp( RS, req.body.id, function ( e ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id,}} )
    })
  }

  function dashboardRefreshKey ( req, res, next ) {
    db.refreshAppKey( RS, req.body.id, function ( e, key ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function dashboardGetKey ( req, res, next ) {
    db.getAppKey( RS, req.body.id, function ( e, key ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      return res.send( {result:{'id': req.body.id, 'key': key}} )
    })
  }

  function checkAdminAuthorization ( req, res, next ) {
    db.checkAdminAuthorization( RS, req.body.id, req.a2p3admin.di, function ( e, authorized ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      if (!authorized) {
        var err = new Error(req.a2p3admin.di+' not authorized for '+req.body.id)
        e.code = "ACCESS_DENIED"
        return next(e)
      } else 
        next()
    })
  }

  // TBD: placeholder for managing access control and sessions
  function checkSession ( req, res, next ) {
    if (req.session.di && req.session.email) {
      next()
    } else {
      var err = new Error('DI and email missing from session')
      err.code = "ACCESS_DENIED"
      return next( err )
    }
  }

  // sets session cookie values
  function bootRegistrar ( req, res, next ) {
    if (req.request && req.request['request.a2p3.org'] && 
        req.request['request.a2p3.org'].di && req.request['request.a2p3.org'].email) {
      req.session.di = req.request['request.a2p3.org'].di
      req.session.email = req.request['request.a2p3.org'].email
      res.send( {result: {success:true}} )
    } else {
      var err = new Error('DI and email missing from request')
      err.code = "INVALID_REQUEST"
      return next( err )
    }
  }


  app.use( express.cookieParser() )
  
  var cookieOptions =
    { 'secret': vault.secret
    , 'cookie': { path: '/dashboard', httpOnly: true, maxAge: 300 }
    , 'proxy': true
    }
  app.use( express.cookieSession( cookieOptions ))

  // TBD add in '/dashboard/login' that checks credentials and 
  // if good sets cookie and redirects to /dashboard, or to error page
  
  app.post('/dashboard/new/app'
          , checkSession
          , mw.checkParams( {'body':['session','id','name']} )
          , dashboardNewApp
          )
  app.post('/dashboard/add/admin'
          , checkSession
          , mw.checkParams( {'body':['session','id','admin']} )
          , checkAdminAuthorization
          , dashboardAddAdmin
          )
  app.post('/dashboard/delete/app'
          , checkSession
          , mw.checkParams( {'body':['session','id']} )
          , checkAdminAuthorization
          , dashboardDeleteApp
          )
  app.post('/dashboard/refresh/key'
          , checkSession
          , mw.checkParams( {'body':['session','id']} )
          , checkAdminAuthorization
          , dashboardRefreshKey
          )
  app.post('/dashboard/getkey'
          , checkSession
          , mw.checkParams( {'body':['session','id']} )
          , checkAdminAuthorization
          , dashboardGetKey
          )


}