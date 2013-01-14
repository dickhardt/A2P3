/*
* Health.* Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

/*
* NOTE: this is a symlinked file in each of the province subdirectories
* edit the file in the health directory, but don't reference it as the
* require() statements are expecting to in the province subdirectory
*/

var express = require('express')
  , underscore = require('underscore')
  , util = require('util')
  , config = require('../../config')
  , dashboard = require('../../lib/dashboard')
  , request = require('../../lib/request')
  , mw = require('../../lib/middleware')
  , login = require('../../lib/login')
  , token = require('../../lib/token')
  , db = require('../../lib/db')

var vault = {}  // we pull in correct vault when app() is called

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
        var err = new Error('no account for user')
        e.rrcode = 'NO_PROV_NUMBER'
        return next( err )
      }
      res.send( {result: {'prov_number': profile.prov_number} } )
    })
  }
}

// generates an OAuth access token for later use
function oauth ( vault, province ) {
  return function oauth ( req, res, next ) {
    var details =
      { scopes: req.token['token.a2p3.org'].scopes
      , app: req.token['token.a2p3.org'].app
      , sub: req.token.sub
      }
    db.oauthCreate( 'health.'+province, details.app, details.sub, details, function ( e, accessToken ) {
      if (e) next (e)
      res.send( {result: { access_token: accessToken } } )
    })
  }
}

function _checkScope( province, series, api, scopes ) {
  var requiredScope = '/scope/series/weight'
  if ( api == '/series/update' ) requiredScope += '/update'
  else if ( api == '/series/retrieve' ) requiredScope += '/retrieve'
  else return ('Unknown OAuth access method.')
  var requiredScopes =
    ['config.baseUrl.health' + requiredScope, config.baseUrl['health.'+province] + requiredScope]
  if ( !underscore.intersection( requiredScopes, scopes ) ) return 'Invalid scope(s) for operation.'
  return null
}

// checks that caller has an authorized OAuth token
function oauthCheck ( vault, province ) {
  return function oauthCheck ( req, res, next ) {
    var accessToken = req.body.access_token
    db.oauthRetrieve( 'health.'+province, accessToken, function ( e, details ) {
      if (e) return next( e )
      var series = req.body.series
      var scopeError = _checkScope( province, series, req.path, details.scopes )
      if (scopeError) {
        var err = new Error( scopeError )
        err.code = 'ACCESS_DENIED'
        return next( err )
      }
      req.oauth =
        { sub: details.sub
        , series: series
        }
      return next()
    })
  }
}

// updates data in a time series
function updateSeries ( vault, province ) {
  return function updateSeries ( req, res, next ) {
    var time = req.body.time || Date.now()
    db.updateSeries( 'health.'+province
                    , req.oauth.sub
                    , req.oauth.series
                    , req.body.data
                    , time
                    , function ( e ) {
      if (e) return next ( e )
      return res.send( {result:{success: true }} )
    })
  }
}

// gets a time series of data
function retrieveSeries ( vault, province ) {
  return function retrieveSeries ( req, res, next ) {
    // TBD confirm we got required parameters
    db.retrieveSeries( 'health.'+province
                , req.oauth.sub
                , req.oauth.series
                , function ( e, results ) {
      if (e) return next ( e )
      return res.send( { result: results } )
    })
  }
}

// generate request processing stack and routes
exports.app = function( province ) {
	var app = express()

  vault = require('../'+province+'/vault.json')

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  dashboard.routes( app, 'health.'+province, vault )  // add in routes for the registration paths

  login.router( app, { 'dashboard': 'health.'+province, 'vault': vault } )

  app.post('/di/link'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink( province )
          )
  app.post('/prov_number'
          , request.check( vault.keys, null, 'health.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'health.'+province, ['/scope/prov_number'], 'health' )
          , number( province )
          )
  app.post('/oauth'
          , request.check( vault.keys, null, 'health.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'health.'+province )
          , oauth( vault, province )
          )
  app.post('/series/update'  // add to a time series of data
          , mw.checkParams( {'body':['access_token','series','data']} )
          , oauthCheck( vault, province )
          , updateSeries( vault, province )
          )
  app.post('/series/retrieve'   // retrieve a time series of data
          , mw.checkParams( {'body':['access_token','series']} )
          , oauthCheck( vault, province )
          , retrieveSeries( vault, province )
          )

  app.use( mw.errorHandler )

	return app
}
