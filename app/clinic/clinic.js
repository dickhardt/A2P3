/*
* clinic.js
*
* Simple Clinic check-in App
*
* Copyright (C) Province of British Columbia, 2013
*/


var express = require('express')
  , fs = require('fs')
  , a2p3 = require('../lib/a2p3')
  , config = require('../config')

var localConfig =
  { appID: config.host.clinic
  , ix: config.host.ix
  , ixURL: config.baseUrl.ix
  }
var vault = require('./vault.json').keys

a2p3.init( localConfig, vault )

var HOST_URL = config.baseUrl.clinic

var RESOURCES =
    [ config.baseUrl.people + '/scope/details'
    , config.baseUrl.health + '/scope/prov_number'
    ]

var APIS = {}
APIS[ config.baseUrl.people + '/details' ] =  null
APIS[ config.baseUrl.health + '/prov_number' ] = null

// HTML for meta refresh and Agent Install Page
// we could read this in once, but reading it in each
// time makes it easy to edit and reload for development
var META_REFRESH_HTML_FILE = __dirname + '/html/meta_refresh.html'

// calculate this once
var QR_SESSION_LENGTH = a2p3.random16bytes().length


//////////////////////////////////////////////////////////////////
//TBD - put following into a DB call
/////////////////////////////////////////////////////////////////


// Global for holding QR sessions, need to put in DB if running mulitple instances
// NOTE: DOES NOT SCALE AS CODED
// checkForTokenRequest and storeTokenRequest are coded with callbacks so that
// they can easily be implemented to store data in a DB
var sessions = {}

// checks if we are have received the IX Token and Agent Request from the Agent
function checkForTokenRequest( qrSession, callback ) {
  if ( !sessions[qrSession] ) return callback( null, null )
  var agentRequest = sessions[qrSession].agentRequest
  var ixToken = sessions[qrSession].ixToken
  delete sessions[qrSession]
  callback( ixToken, agentRequest )
}

// stores IX Token and Agent Request we received back channel from the Agent
function storeTokenRequest( qrSession, agentRequest, ixToken, callback ) {
  sessions[qrSession] =
    { ixToken: ixToken
    , agentRequest: agentRequest
    }
  callback( null )
}

// metaRedirectInfoPage() returns a meta-refresh page with the supplied URL
function metaRedirectInfoPage ( redirectURL ) {
  var html = fs.readFileSync( META_REFRESH_HTML_FILE, 'utf8' )
  return html.replace( '$REDIRECT_URL', redirectURL )
}

function fetchProfile( agentRequest, ixToken, callback ) {
  var resource = new a2p3.Resource( localConfig, vault )
  resource.exchange( agentRequest, ixToken, function ( error, di ) {
    if ( error ) return callback ( error )
    var userDI = di // App's directed identifier for User
    resource.callMultiple( APIS, function ( error, results ) {
      if (results)
        results[config.host.ix] = { di: userDI }
      callback( error, results )
    })
  })
}


/*
*   request handlers
*/

// loginQR() - called by web app when it wants a QR code link
// creates an agentRequest and state
function loginQR( req, res )  {
  var qrSession = a2p3.random16bytes()
  req.session.qrSession = qrSession
  var qrCodeURL = HOST_URL + '/QR/' + qrSession
  res.send( { result: { qrURL: qrCodeURL, qrSession: qrSession } } )
}

// loginDirect -- loaded when web app thinks it is running on a mobile device that
// can support the agent
// we send a meta-refresh so that we show a info page in case there is no agent to
// handle the a2p3.net: protcol scheme
function loginDirect( req, res ) {
  var params = { returnURL: HOST_URL + '/response/redirect', resources: RESOURCES }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
  if (req.query.json) {
    return res.send( { result: { request: agentRequest } } )
  } else {
    var redirectURL = 'a2p3.net://token?request=' + agentRequest
      , html = metaRedirectInfoPage( redirectURL )
    res.send( html )
  }
}

// loginBackdoor -- development login that uses a development version of setup.a2p3.net
function loginBackdoor( req, res )  {
  var params = { returnURL: HOST_URL + '/response/redirect', resources: RESOURCES }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
    , redirectURL = config.baseUrl.setup + '/backdoor/login?request=' + agentRequest
  res.redirect( redirectURL )
}


// clear session, logout user
function logout( req, res )  {
  req.session = null
  res.redirect('/')
}


// QR Code was scanned
// if scanned by Agent, then 'json=true' has been set and we return the Agent Request in JSON
// if scanned by a general QR reader, then return a meta refresh page with Agent Reqeuest and
// and state parameter of qrSession so we can link the response from the Agent
// back to this web app session in checkQR
function qrCode( req, res ) {
  var qrSession = req.params.qrSession
  // make sure we got something that looks like a qrSession
  if ( !qrSession || qrSession.length != QR_SESSION_LENGTH || qrSession.match(/[^\w-]/g) ) {
    return res.redirect('/error')
  }
  var params = { callbackURL: HOST_URL + '/response/callback', resources: RESOURCES }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
    , json = req.query.json
  if ( json ) {
    return res.send( { result: { agentRequest: agentRequest, state: qrSession } } )
  } else {
    var redirectURL = 'a2p3://token?request=' + agentRequest + '&state=' + qrSession
    var html =  metaRedirectInfoPage( redirectURL )
    return res.send( html )
  }
}


/*
* We are getting called back through the redirect which means we are running on the
* same device as the Agent is
*/
function loginResponseRedirect( req, res )  {
  var ixToken = req.query.token
  var agentRequest = req.query.request

  if (!ixToken || !agentRequest) {
    return res.redirect( '/error' )
  }
  fetchProfile( agentRequest, ixToken, function ( error, results ) {
    if ( error ) return res.redirect( '/error' )
    req.session.profile = results
    return res.redirect('/')
  })
}

/*
* Agent is calling us back with the IX Token and Agent Request, but
* Agent is running on a different device
*/
function loginResponseCallback( req, res )  {
  var ixToken = req.body.token
  var agentRequest = req.body.request
  var qrSession = req.body.state

  if (!ixToken || !agentRequest || !qrSession) {
    var code = 'MISSING_STATE'
    if (!agentRequest) code = 'MISSING_REQUEST'
    if (!ixToken) code = 'MISSING_TOKEN'
    return res.send( { error: { code: code, message: 'token, request and state are required' } } )
  }
  storeTokenRequest( qrSession, agentRequest, ixToken, function ( error ) {
    if ( error ) return res.send( { error: error } )
    return res.send( { result: { success: true } } )
  })
}



function checkQR( req, res ) {
  if (!req.body.qrSession)
    return res.send( { error: 'No QR Session provided' } )
  checkForTokenRequest( req.body.qrSession, function ( ixToken, agentRequest ) {
    if (!ixToken || !agentRequest) {
      return res.send( { status: 'waiting'} )
    }
    fetchProfile( agentRequest, ixToken, function ( error, results ) {
      var response = {}
      if ( error ) response.error = error
      if ( results ) {
        response.result = results
        req.session.profile = results
      }
      return res.send( response )
    })
  })
}


function profile( req, res )  {
  if ( req.session.profile ) {
    return res.send( { result: req.session.profile } )
  } else { //
    return res.send( { errror: 'NOT_LOGGED_IN'} )
  }
}

// set up middleware
exports.app = function () {
  var app = express()

  app.use( express.limit('10kb') )                    // protect against large POST attack
  app.use( express.bodyParser() )

  app.use( express.cookieParser() )                   // This does not scale to more than one machine
  var cookieOptions =                                 // Put in DB backend for session to scale
    { 'secret': a2p3.random16bytes()
    , 'cookie': { path: '/' } }
  app.use( express.cookieSession( cookieOptions ))

  //setup request routes

  // these end points are all AJAX calls from the web app and return a JSON response
  app.post('/login/QR', loginQR )
  app.post('/profile', profile )
  app.post('/check/QR', checkQR )

  // this page is called by either the Agent or a QR Code reader
  // returns either the Agent Request in JSON if called by Agent
  // or sends a redirect to the a2p3.net://token URL
  app.get('/QR/:qrSession', qrCode )


  // these pages return a redirect
  app.get('/logout', logout )
  app.get('/login/backdoor', loginBackdoor)
  app.get('/login/direct', loginDirect)
  app.get('/response/redirect', loginResponseRedirect )
  app.post('/response/callback', loginResponseCallback )

  // these endpoints serve static HTML pages
  app.get('/', function( req, res ) { res.sendfile( __dirname + '/html/index.html' ) } )
  app.get('/error', function( req, res ) { res.sendfile( __dirname + '/html/login_error.html' ) } )
  app.get('/complete', function( req, res ) { res.sendfile( __dirname + '/html/login_complete.html' ) } )
  app.get('/agent/install', function( req, res ) { res.sendfile( __dirname + '/html/agent_install.html' ) } )

  return app

}

