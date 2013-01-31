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

// console.log('\nAS /token received\n',req.body)

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
      db.createNotificationURL( device, function ( url ) {
        if ( url ) response.result.notificationURL = url
        return res.send( response )
        } )
    } else {
      return res.send( response )
    }
  })
}

// API called by agent to register itself
function registerAgent ( req, res, next ) {
  var code = req.body.code
    , passcode = req.body.passcode
    , name = req.body.name
    , device = req.body.device
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
          }
      db.storeAgent( 'as', agent, function (e) {
        if (e) return next( e )

        // TBD: let listener on channel know that QR code was read successfully

        // async clear out data associated with the code
        db.deleteProfile( 'as', code, function ( e ) {
          if (e) console.log("Profile update error:\n", e )
        })
        return res.send( { 'result': {'token': result.token } } )
      })
    })
  })

}

// API called by register web app to generate an agent registration code
function registerAgentCode ( req, res, next ) {
  var passcode = req.body.passcode
  var di = req.session.di
  var code = jwt.handle()
  db.updateProfile( 'as', code,
                  {'passcode': passcode, 'di': di }
                  , function ( e ) {
    if (e) return next( e )
    return res.send( { result: {code: code } } )
  } )
}

// called by Setup to create an Agent Request
function setupRequest ( req, res, next ) {
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
  // new entry points
  // called by Setup to create an Agent Request
  app.get('/setup/request', setupRequest )

  // Return URL given to Setup in Agent Request
  app.get('/register/login', registerLogin )

  // static pages
  app.get('/', homepage )
  app.get('/register', register )

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
