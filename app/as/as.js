/* 
* AS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , request = require('../request')
  , token = require('../token')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
  , mw = require('../middleware')
  , jwt = require('../jwt')


// called by IX when agent is to be deleted
function agentDelete ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

// called by app when subsequent web app login to notify personal agent
function notify ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

// generate an IX token for Agent
function tokenHandler ( req, res, next ) {
  var device = req.body.device
    , sar = req.body.sar
    , auth = req.body.auth
  db.retrieveAgentFromDevice( device, function ( e, agent ) {
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
    var ixToken = token.create( payload, vault.ix.latest )
    return res.send( {'result': {'token': ixToken }})
  })
}

// called from personal agent after QR code was scanned and passcode entered
function register ( req, res, next ) {
  var device = req.body.device
    , passcode = req.body.passcode
    , qr = req.body.qr
  try {
    var jwe = new jwt.Parse( qr )
    var payload = jwe.decrypt( vault.keys[config.host.as].latest.key )    
  }
  catch (e) {
    e.code = "INVALID_REQUEST"
    return next( e )
  }

  db.retrieveAgentRegisterSession( payload['token.a2p3.org'].registerSession, function ( e, session ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    if (!session) {
      e = new Error("Unknown agent register session")
      e.code = "INVALID_SESSION"
      return next(e)
    }
    // TBD call IX to add an agent
    var handle = '12345'
    var agent = 
      { 'device': session.device
      , 'passcode': session.passcode
      , 'handle': 'xyz'
      }
    db.storeAgent( agent, function ( e ) {
      if (e) {
        e.code = "INTERNAL_ERROR"
        return next(e)
      }
      res.send({ 'response': {'token': handle}})      
    })
  })

}

// POST that takes register session and device passcode and returns URI to be turned into QR code
// URI is passed back in /register
function registerQR ( req, res, next ) {
  var registerSession = req.body.registerSession // Registar Session Token
  var passcode = req.body.passcode
  db.storeAgentRegisterSessionValue( registerSession, 'passcode', passcode, function (e) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    var registerToken = 
      { 'iss': config.host.as
      , 'token.a2p3.org': { 'registerSession': registerSession }
      }
    var jwe = token.create( registerToken, vault.keys[config.host.as].latest)
    var r = { 'result': { 'qr': jwe }}
    return res.send( r )
  })
}

// called by setup app using GET with no parameters, returns an Agent Request
function registerRequestAgent ( req, res, next ) {
  var registerSession = jwt.handle()
  var agentRequest =
    { 'iss': config.host.as
    , 'aud': config.host.ix
    , 'request.a2p3.org':
     { 'resources':
        [ config.host.ix + '/scope/register/agent' ]
      , 'auth': 
        { 'passcode': true
        , 'authorization': true
        }
      , 'returnURL': config.baseUrl.as + '/register/agent/' + registerSession
      }
    }
  var jws = request.create( agentRequest, vault.keys[config.host.ix].latest )
  db.storeAgentRegisterSessionValue( registerSession, 'request', jws, function (e) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    var r = { 'result': { 'request': jws }}
    return res.send( r )
  })  
}

// return URL for results of authorization request to register a new personal agent
function registerAgent ( req, res, next ) {
  registerSession = req.params.registerSession
  ixToken = req.query.token // IX Token
  db.storeAgentRegisterSessionValue( registerSession, 'token', ixToken, function (e) {
    if (e) {
      e.code = "INTERNAL_ERROR"
      return next(e)
    }
    // return agent registration page - TBD replace placeholder page with final page
    res.sendfile( '/assets/placeholder.html', { 'root': __dirname }, function (e) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    }) 
  })
}

function registerAgentList ( req, res, next ) {
  db.retrieveAgentRegisterSession( payload['request.a2p3.org'].registerSession, function ( e, session ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    if (!session) {
      e = new Error("Unknown agent register session")
      e.code = "INVALID_SESSION"
      return next(e)
    }
    // TBD call IX to get list and then send

  })
}

function registerAgentDelete ( req, res, next ) {
  db.retrieveAgentRegisterSession( payload['request.a2p3.org'].registerSession, function ( e, session ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    if (!session) {
      e = new Error("Unknown agent register session")
      e.code = "INVALID_SESSION"
      return next(e)
    }
    // TBD call IX to delete and send response

  })
}



// setup AS middleware
exports.app = function() {
	var app = express()

  app.use(express.limit('10kb'))  // protect against large POST attack  
  app.use(express.bodyParser())

  app.post('/agent/delete', request.check( vault, config.roles.as ), agentDelete) 
  
  app.post('/notify/:handle',   mw.checkParams( {'params':['handle']} ),                    notify)
  app.post('/register',         mw.checkParams( {'body':['device','passcode','qr']} ),      register)
  app.post('/register/qr',      mw.checkParams( {'body':['registerSession', 'passcode']} ), registerQR)
  app.post('/token',            mw.checkParams( {'body':['device', 'sar', 'auth']} ),       tokenHandler)

  app.get('/register/request/agent', registerRequestAgent)
  app.get('/register/agent/:registerSession', mw.checkParams( {'params':['registerSession']} ), registerAgent)

  app.post('/register/agent/list',    mw.checkParams( {'body':['registerSession']} ), registerAgentList)
  app.post('/register/agent/delete',  mw.checkParams( {'body':['registerSession','handle']} ), registerAgentDelete)

  app.get('/', function(req, res){
    console.log(req.domain);
    console.log(req.headers);
      html = 'Hello World, from AS!';
      res.send(html);    
  });

  app.use( mw.errorHandler )

// console.log( 'AS middleware:\n', app.stack, '\nroutes:',app.routes )

	return app
}
