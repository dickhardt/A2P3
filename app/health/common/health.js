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
function oauth ( province ) {
  return function oauth ( req, res, next ) {
    var details =
      { scopes: req.token['token.a2p3.org'].scopes
      , app: req.token['token.a2p3.org'].app
      , sub: req.token.sub
      }
    db.oauthCreate( 'health.'+province, details, function ( e, accessToken ) {
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
function oauthCheck ( province ) {
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
function updateSeries ( province ) {
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
function retrieveSeries ( province ) {
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


function _makeDeleteAuthNRequest ( rs, di, app, vault ) {
  // impersonate Registrar calling us
  var tokenPayload =
    { 'iss': config.host.ix
    , 'aud': config.host[rs]
    , 'sub': di
    , 'token.a2p3.org':
      { 'app': config.host.registrar
      , 'auth': { passcode: true, authorization: true }
      }
    }
  var rsToken = token.create( tokenPayload, vault.keys[config.host.ix].latest )
  var requestDetails =
    { 'iss': config.host.registrar
    , 'aud': config.host[rs]
    , 'request.a2p3.org': { 'app': app, 'token': rsToken }
    }
  var rsRequest = request.create( requestDetails, vault.keys[config.host.registrar].latest )
  return rsRequest
}

// list all authorizations provided by user
function listAuthN ( rs, vault ) {
  return function listAuthN ( req, res, next ) {
    var di = req.token.sub
    db.oauthList( rs, di, function ( e, results ) {
      if (e) return next( e )
      if (!results) return res.send( { result: {} } )
      var response = results
      // make an RS Request for each App to delete it later
      Object.keys(results).forEach( function ( app ) {
        response[app].request = _makeDeleteAuthNRequest( rs, di, app, vault )
      })
      res.send( {result: response} )
    })
  }
}

// delete all authorizations to an app for the user
function deleteAuthN ( rs ) {
  return function deleteAuthN ( req, res, next ) {
    db.oauthDelete( rs, req.token.sub, req.request['request.a2p3.org'].app, function ( e ) {
      if (e) return next( e )
      return res.send( {result:{success: true }} )
    })
  }
}


// generate request processing stack and routes
exports.app = function( province ) {
	var app = express()

  vault = require('../'+province+'/vault.json')

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  // All Dashboard Web pages and API
  dashboard.routes( app, 'health.'+province, vault )  // add in routes for the registration paths

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
          , oauth( province )
          )
  app.post('/series/update'  // add to a time series of data
          , mw.checkParams( {'body':['access_token','series','data']} )
          , oauthCheck( province )
          , updateSeries( province )
          )
  app.post('/series/retrieve'   // retrieve a time series of data
          , mw.checkParams( {'body':['access_token','series']} )
          , oauthCheck( province )
          , retrieveSeries( province )
          )

  app.post('/authorizations/list' // list OAuth anytime authorizatsions
          , request.check( vault.keys, config.roles.authN, 'health.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'health.'+province )
          , listAuthN( 'health.'+province, vault )
          )

  app.post('/authorization/delete' // list OAuth anytime authorizatsions
          , request.check( vault.keys, config.roles.authN, 'health.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'health.'+province )
          , deleteAuthN( 'health.'+province )
          )

  app.get('/documentation', mw.md( config.rootAppDir+'/health/README.md' ) )
  app.get(/\/scope[\w\/]*/, mw.scopes( config.rootAppDir + '/health/scopes.json', config.host['health.'+province] ) )

  app.use( mw.errorHandler )

	return app
}
