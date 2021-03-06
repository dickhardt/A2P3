/*
* AS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , request = require('../lib/request')
  , token = require('../lib/token')
  , db = require('../lib/db')
  , mw = require('../lib/middleware')
  , jwt = require('../lib/jwt')
  , api = require('../lib/api')
  , apns = require('../apns/apns')

// creates an Agent Request for registering agent
function _makeAgentRequest ( returnURL ) {
  var agentRequest =
    { 'iss': config.host.as
    , 'aud': config.host.ix
    , 'request.a2p3.org':
     { 'resources': []
      , 'auth':
        { 'passcode': true
        , 'authorization': true
        }
      , 'returnURL': config.baseUrl.as + returnURL
      }
    }
  var jws = request.create( agentRequest, vault.keys[config.host.ix].latest )
  return jws
}

// called by IX when agent is to be deleted
function agentDelete ( req, res, next ) {
  var handle = req.request['request.a2p3.org'].handle
  db.deleteAgentFromHandle( 'as', handle, function ( e ) {
    if (e) return next( e )
    return res.send( { result: { success: true } } )
  })
}

// generate an IX token for Agent
function tokenHandler ( req, res, next ) {
  var device = req.body.device
    , sar = req.body.sar
    , auth = req.body.auth

   db.retrieveAgentFromDevice( 'as', device, function ( e, agent ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    if (!agent) {
      e = new Error('Unknown device id.')
      e.code = "INVALID_DEVICEID"
      return next(e)
    }
    if (auth.passcode && (agent.passcode != auth.passcode)) {
      e = new Error('Invalid passcode.')
      e.code = "INVALID_PASSCODE"
      return next(e)
    }
    var payload =
      { 'iss': config.host.as
      , 'aud': config.host.ix
      , 'sub': agent.sub
      , 'token.a2p3.org':
        { 'sar': sar
        , 'auth':
          { 'passcode': (auth.passcode) ? true : false
          , 'authorization': (auth.authorization) ? true : false
          , 'nfc': (auth.nfc) ? true : false
          }
        }
      }
    var ixToken = token.create( payload, vault.keys[config.host.ix].latest )
    var response = {'result': {'token': ixToken } }
    if (req.body.notificationURL) {
      db.createNotificationCode( agent.notificationDeviceToken, function ( code ) {
        if ( code ) {
          response.result.notificationURL = config.baseUrl.as + '/notification/' + code
        }
        return res.send( response )
        } )
    } else {
      return res.send( response )
    }
  })
}

// called when App wants to nofify Agent that User wants to login
function notificationHandler ( req, res, next ) {
  var code = req.params.code
  var url = req.body.url
  var alert = req.body.alert || 'An app has requested to login'
  db.getDeviceFromNotificationCode( code, function ( notificationDeviceToken ) {
    if (!notificationDeviceToken) return next( new Error('Unknown notification URL') )
    apns.notification( notificationDeviceToken, url, alert )
    return res.send( { result: { success: true } } )
  })
}

// API called by agent to register itself
function registerAgent ( req, res, next ) {
  var code = req.body.code
    , passcode = req.body.passcode
    , name = req.body.name
    , device = req.body.device
    , notificationDeviceToken = req.body.notificationDeviceToken

  db.getProfile( 'as', code, function ( e, profile ) {
    if (e) return next( e )
    if ( passcode != profile.passcode ) {
      var err = new Error('Passcode does not match')
      err.code = 'INVALID_PASSCODE'
      return next( err )
    }
    var details =
      { host: 'ix'
      , api: '/agent/add'
      , credentials: vault.keys[config.host.ix].latest
      , payload:
        { iss: config.host.as
        , aud: config.host.ix
        , 'request.a2p3.org':
          { di: profile.di
          , name: name
          }
        }
      }
    api.call( details, function ( e, result ) {
      if (e) return next( e )
        var agent =
          { 'device': device
          , 'handle': result.handle
          , 'sub': profile.di
          , 'passcode': passcode
          , 'notificationDeviceToken': notificationDeviceToken
          }
      db.storeAgent( 'as', agent, function (e) {
        if (e) return next( e )

        // TBD: let listener on channel know that QR code was read successfully

        // async clear out data associated with the code
        // ... yeah, well that did not work, tests fail as call is made quickly before DB finishes
        db.deleteProfile( 'as', code, function ( e ) {
          if (e) console.log("Profile update error:\n", e )
          return res.send( { 'result': {'token': result.token } } )
        })
      })
    })
  })

}

// API called by register web app to generate an agent registration code
function registerAgentCode ( req, res, next ) {
  var passcode = req.body.passcode
  var di = req.session.di
  var code = jwt.handle()
  db.updateProfile( 'as'
                  , code
                  , {'passcode': passcode, 'di': di }
                  , function ( e ) {
    if (e) return next( e )
    var qrURL = 'a2p3.net://enroll?code=' + code
    return res.send( { result: {qrURL: qrURL, code: code } } )
  } )
}

// called by web app to see if we have completed enrollment
function checkCode( req, res ) {
  if (!req.body.code)
    return res.send( { error: 'No code provided' } )
  // if profile is gone, then we have registered
  db.getProfile( 'as', req.body.code, function ( e, profile ) {
    if ( e && e.code != 'UNKNOWN_USER') return res.send( { error: e.message } )
    var response = { result: { success: true } }
    if ( profile )
      response.status = 'waiting'
    return res.send( response )
  })
}

// called by Setup to create an Agent Request
function setupRequest ( req, res, next ) {
  if (req.query.agent)
    req.session.agentDirect = true
  var agentRequest = _makeAgentRequest ( '/register/login' )
  req.session.agentRequest = agentRequest
  res.redirect( config.baseUrl.setup + '/dashboard/agent/token?request=' + agentRequest)
}

// returnURL for Agent Request for registration
function registerLogin  ( req, res, next ) {
  var agentRequest = req.session.agentRequest
  if (!agentRequest) return res.redirect('/')
  var errorCode = req.query.errorCode
  var errorMessage = req.query.errorMessage
  if (errorCode) {
    console.log('Setup returned Agent Request error:',errorCode,errorMessage)
    return res.redirect('/')
  }
  var ixToken = req.query.token
  if (!ixToken) {
    console.log('Setup returned no IX Token')
    return res.redirect('/')
  }
  var details =
    { host: 'ix'
    , api: '/exchange'
    , credentials: vault.keys[config.host.ix].latest
    , payload:
      { iss: config.host.as
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'request': agentRequest
        , 'token': ixToken
        }
      }
    }
  api.call( details, function ( e, result ) {
    if (e) {
      console.log('IX returned', e )
      return res.redirect('/')
    }
    req.session.di = result.sub
    if (req.session && req.session.agentDirect)
      return res.redirect('/register/direct')
    else
      return res.redirect('/register')
  })
}

// static page serving
function homepage ( req, res, next ) {
    res.sendfile( __dirname+'/html/homepage.html' )
}

function register ( req, res, next ) {
  if (!req.session.di) return res.redirect('/')
  res.sendfile( __dirname+'/html/register.html')
}

function registerDirect ( req, res, next ) {
  if (!req.session.di) return res.redirect('/')
  res.sendfile( __dirname+'/html/register_direct.html')
}

// setup AS middleware
exports.app = function() {
	var app = express()

  app.use(express.limit('10kb'))  // protect against large POST attack
  app.use(express.bodyParser())
  app.use( express.cookieParser() )
  var cookieOptions = { 'secret': vault.secret, 'cookie': { path: '/' } }
  app.use( express.cookieSession( cookieOptions ))

  // A2P3 Protocol API called by agent to create IX Token
  app.post('/token'
          , mw.checkParams( {'body':['device', 'sar', 'auth']} )
          , tokenHandler
          )

  // notification endpoint called by App when remember me / device login notification is used
  app.post('/notification/:code'
          , mw.checkParams( { 'body':['url'], 'params':['code'] } )
          , notificationHandler
          )

  // A2P3 Protocol API  called from IX when an agent is deleted
  app.post('/agent/delete'
          , request.check( vault.keys, config.roles.ix )
          , agentDelete
          )

  // register API
  app.post('/register/agent/code'
          , mw.checkParams( { 'session': ['di'], 'body': ['passcode'] } )
          , registerAgentCode
          )
  // called by agent
  app.post('/register/agent'
          , mw.checkParams( { 'body': ['passcode', 'code', 'name', 'device' ] } )
          , registerAgent
          )
  // called by web app to see if QR code has been read
  app.post('/register/check/code'
          , mw.checkParams( { 'body': ['code'] } )
          , checkCode
          )

  // called by Setup to create an Agent Request
  app.get('/setup/request', setupRequest )

  // Return URL given to Setup in Agent Request
  app.get('/register/login', registerLogin )

  // static pages
  app.get('/', homepage )
  app.get('/register', register )
  app.get('/register/direct', registerDirect )

   // TBD - REMOVE THIS! ... used by XHR to test
  app.post('/ping', function( req, res ) {
    console.log('\nping session:\n',req.session )
    res.send(req.session)
  } )

  // show README.md as documentation
  app.get('/documentation', mw.md( __dirname+'/README.md' ) )

  // key integrity checking API
  app.post( '/key/check', mw.keyCheck( vault, config.host.as ) )

  app.use( mw.errorHandler )

// console.log( 'AS middleware:\n', app.stack, '\nroutes:',app.routes )

	return app
}
