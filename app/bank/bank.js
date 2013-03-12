/*
* bank.js
*
* Bank web app and iPhone app front end
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , fs = require('fs')
  , a2p3 = require('../lib/a2p3')
  , config = require('../config')
  , db = require('../lib/db')
  , fetch = require('request')
  , debug = require('debug')('bank')

var localConfig =
  { appID: config.host.bank
  , ix: config.host.ix
  , ixURL: config.baseUrl.ix
  }
var vault = require('./vault.json').keys

a2p3.init( localConfig, vault )

var HOST_URL = config.baseUrl.bank

var RESOURCES =
    [ config.baseUrl.people + '/scope/details'
    , config.baseUrl.si + '/scope/anytime/number'
    ]

var APIS = {}
APIS[ config.baseUrl.people + '/details' ] =  null
APIS[ config.baseUrl.si + '/oauth' ] = null

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


function fetchSI( access_token, callback ) {
  fetch.post( config.baseUrl.si + '/anytime/number'
    , { form: { access_token: access_token } }
    , function ( error, response, body ) {
        var data = null
          , err = null
        if ( error ) {
          err = new Error(error)
          return callback( err, null)
        }
        if ( response.statusCode != 200 ) {
          err = new Error('Server responded with '+response.statusCode)
          return callback( err, null)
        }
        try {
          data = JSON.parse(body)
        }
        catch (e){
          return callback( e, null)
        }
        if (data.error) {
          err = new Error(data.error.message)
          err.code = data.error.code
          return callback( err, null)
        }
        if ( !data || !data.result || !data.result.si ) return callback( new Error('no data or SI returned'))
        callback( null, data.result.si )
    })
}

function fetchProfile( agentRequest, ixToken, session, callback ) {

// debugger;

  var resource = new a2p3.Resource( localConfig, vault )
  resource.exchange( agentRequest, ixToken, function ( error, di ) {
    if ( error ) return callback ( error )
    // see if user is registered
    db.getProfile( 'bank', di, function ( error, profile ) {
      if ( error && error.code && error.code == 'UNKNOWN_USER') {
        if ( resource.ix.tokens && Object.keys( resource.ix.tokens ).length ) { //  new account
          resource.callMultiple( APIS, function ( error, results ) {
            if ( error ) return callback( error )
            if (!results[config.host.si] || !results[config.host.si].access_token )
              return callback( new Error('Did not get SI results'))
            fetchSI( results[config.host.si].access_token, function ( error, si ) {
              if ( error ) return callback( error )
              session.accessTokenSI = results[config.host.si].access_token  // save for when TOS is agreed
              delete results[config.host.si]  // don't want to send to browser
              results[config.host.si] = { si: si }
              results[config.host.ix] = { di: di }
              callback( null, results )
            })
          })
        } else {  // we have no data and no user, must have tried to login, so return the error
          callback( error )
        }
      } else { // other error or we have a profile
        if ( error ) return callback( error )
        if ( !profile || !profile.access_token )
          return callback( new Error('No profile or access token'))
        fetchSI( profile.access_token, function ( error, si ) {
          if ( error && error.code && error.code == 'INVALID_ACCESS_TOKEN' ) {
            // user revoked the access token
            if ( !resource.ix.tokens || !Object.keys( resource.ix.tokens ).length ) {
              // user tried logging in, need to send down INVALID_ACCESS_TOKEN error
              callback( error, null )
            }
            return resource.call( config.baseUrl.si + '/oauth', null, function ( error, results ) {
              if ( error ) return callback( error )
              if ( !results.access_token ) return callback( new Error('UNKNOWN') )
              var access_token = results.access_token
              fetchSI( access_token, function ( error, si ) {
                if ( error ) return callback( error )
                db.updateProfile( 'bank', di, { access_token: access_token }, function ( e ) {
                  if ( e ) return callback( e )
                  var results = {}
                  results[config.host.si] = { si: si }
                  results[config.host.ix] = { di: di }
                  callback( null, results )
                })
              })
            })
          } else if ( error ) return callback( error )
          var results = {}
          results[config.host.si] = { si: si }
          results[config.host.ix] = { di: di }
          callback( null, results )
        })
      }
    })
  })
}


/*
*   request handlers
*/

// loginQR() - called by web app when it wants a QR code link for login
function loginQR( req, res )  {
  var qrSession = a2p3.random16bytes()
  req.session.qrSession = qrSession
  var qrCodeURL = HOST_URL + '/QR/' + qrSession
  res.send( { result: { qrURL: qrCodeURL, qrSession: qrSession } } )
}

// newQR() - called by web app when it wants a QR code link for creating a new account
function newQR( req, res )  {
  var qrSession = a2p3.random16bytes()
  req.session.qrSession = qrSession
  var qrCodeURL = HOST_URL + '/QRnew/' + qrSession
  res.send( { result: { qrURL: qrCodeURL, qrSession: qrSession } } )
}


// loginDirect -- loaded when web app thinks it is running on a mobile device that
// can support the agent
// we send a meta-refresh so that we show a info page in case there is no agent to
// handle the a2p3.net: protcol scheme
function loginDirect( req, res ) {
  var params = { returnURL: HOST_URL + '/response/redirect', resources: [] }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
  if (req.query.json) {
    return res.send( { result: { request: agentRequest } } )
  } else {
    var redirectURL = 'a2p3.net://token?request=' + agentRequest
    var html = metaRedirectInfoPage( redirectURL )
    return res.send( html )
  }
}

// LoginApp -- called by mobile Bank App
function loginApp( req, res ) {
  var params = { returnURL: 'bank.a2p3.net://logon', resources: [] }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
    return res.send( { result: { request: agentRequest } } )
}


// loginBackdoor -- development login that uses a development version of setup.a2p3.net
function loginBackdoor( req, res )  {
  var params = { returnURL: HOST_URL + '/response/redirect', resources: [] }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
    , redirectURL = config.baseUrl.setup + '/backdoor/login?request=' + agentRequest
  res.redirect( redirectURL )
}


// newDirect -- loaded when web app thinks it is running on a mobile device that
// can support the agent
// we send a meta-refresh so that we show a info page in case there is no agent to
// handle the a2p3.net: protcol scheme
function newDirect( req, res ) {
  var params = { returnURL: HOST_URL + '/response/redirect', resources: RESOURCES }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
  if (req.query.json) {
    return res.send( { result: { request: agentRequest } } )
  } else {
    var redirectURL = 'a2p3.net://token?request=' + agentRequest
    var html = metaRedirectInfoPage( redirectURL )
    res.send( html )
  }
}

// newApp -- called by Mobile Bank App to create a new account
function newApp( req, res ) {
  var params = { returnURL: 'bank.a2p3.net://logon', resources: RESOURCES }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
    return res.send( { result: { request: agentRequest } } )
}

// newBackdoor -- development new account that uses a development version of setup.a2p3.net
function newBackdoor( req, res )  {
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


// QR Code was scanned to login to an existing account
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
  var params = { callbackURL: HOST_URL + '/response/callback', resources: [] }
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

// QR Code was scanned to open a new account
// if scanned by Agent, then 'json=true' has been set and we return the Agent Request in JSON
// if scanned by a general QR reader, then return a meta refresh page with Agent Reqeuest and
// and state parameter of qrSession so we can link the response from the Agent
// back to this web app session in checkQR
function qrNewCode( req, res ) {
  var qrSession = req.params.qrSession
  // make sure we got something that looks like a qrSession
  if ( !qrSession || qrSession.length != QR_SESSION_LENGTH || qrSession.match(/[^\w-]/g) ) {
    return res.redirect('/error')
  }
  var params = { callbackURL: HOST_URL + '/response/callback', resources: RESOURCES }
    , agentRequest = a2p3.createAgentRequest( localConfig, vault, params )
    , json = req.query.json
  if ( json ) {
    var response = { result: { agentRequest: agentRequest, state: qrSession } }
    return res.send( response )
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
  fetchProfile( agentRequest, ixToken, req.session, function ( error, results ) {
    if ( error && error.code && error.code == 'UNKNOWN_USER')
      return res.redirect( '/unknown' )
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

/*
* Bank App is calling us back after a login Agent Request
*/
function loginResponseApp( req, res )  {
  var ixToken = req.body.token
  var agentRequest = req.body.request

  if (!ixToken || !agentRequest ) {
    var code = 'MISSING_REQUEST'
    if (!ixToken) code = 'MISSING_TOKEN'
    return res.send( { error: { code: code, message: 'token and request are required' } } )
  }
  fetchProfile( agentRequest, ixToken, req.session, function ( error, results ) {
    if ( error ) return res.send( { error: error } )
    req.session.profile = results
    return res.send( { result: { success: true } } )
  })
}


// agreeTOS() - user has agreed to TOS
// save profile
function agreeTOS( req, res, next ) {
  var di = req.session && req.session.profile &&
      req.session.profile[config.host.ix] &&
      req.session.profile[config.host.ix].di
  if ( di && req.session.accessTokenSI ) {
    db.updateProfile( 'bank', di,
          { access_token: req.session.accessTokenSI }, function ( e ) {
      if (e) next( e )
      var save = {}
      save[config.host.ix] = req.session.profile[config.host.ix]
      save[config.host.si] = req.session.profile[config.host.si]
      req.session.profile = save  // deletes everything else
      res.send({ result: { success: true } } )
    })
  } else
    next( new Error('No access token found in session.'))
}

function closeAccount( req, res, next ) {
  var di =  req.session &&
            req.session.profile &&
            req.session.profile[config.host.ix] &&
            req.session.profile[config.host.ix].di
  if ( di ) {
    db.deleteProfile( 'bank', di, function ( e ) {
      if ( e ) return next( e )
      req.session = null
      if (req.query.json)
        return res.send( { result: { success: true } } )
      else
        return res.redirect('/')
    })
  } else {
    next( new Error('No DI found in session.') )
  }
}

function checkQR( req, res ) {
  if (!req.body.qrSession)
    return res.send( { error: 'No QR Session provided' } )
    checkForTokenRequest( req.body.qrSession, function ( ixToken, agentRequest ) {
      if (!ixToken || !agentRequest) {
        return res.send( { status: 'waiting'} )
      }
      fetchProfile( agentRequest, ixToken, req.session, function ( error, results ) {
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

// console.log('req.session.profile\n',req.session.profile)

  if ( req.session.profile && Object.keys( req.session.profile ).length ) {
    debug(req.session.profile)
    return res.send( { result: req.session.profile } )
  } else { //
    debug('error: not logged in')
    return res.send( { error: 'NOT_LOGGED_IN'} )
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
  app.post('/new/QR', newQR )
  app.post('/profile', profile )
  app.post('/check/QR', checkQR )
  app.post('/agree/tos', agreeTOS )

  // these pages are called by either the Agent or a QR Code reader
  // returns either the Agent Request in JSON if called by Agent
  // or sends a redirect to the a2p3.net://token URL
  app.get('/QR/:qrSession', qrCode )
  app.get('/QRnew/:qrSession', qrNewCode )

  // these pages return a redirect
  app.get('/login/backdoor', loginBackdoor)
  app.get('/login/direct', loginDirect)
  app.get('/new/backdoor', newBackdoor)
  app.get('/new/direct', newDirect)
  app.get('/logout', logout )
  app.get('/close', closeAccount )
  app.get('/response/redirect', loginResponseRedirect )

  app.post('/response/callback', loginResponseCallback )
  app.post('/response/app', loginResponseApp )
  app.post('/login/app', loginApp )
  app.post('/new/app', newApp )

  // these endpoints serve static HTML pages
  app.get('/', function( req, res ) { res.sendfile( __dirname + '/html/index.html' ) } )
  app.get('/error', function( req, res ) { res.sendfile( __dirname + '/html/login_error.html' ) } )
  app.get('/unknown', function( req, res ) { res.sendfile( __dirname + '/html/unknown_user.html' ) } )
  app.get('/complete', function( req, res ) { res.sendfile( __dirname + '/html/login_complete.html' ) } )
  app.get('/agent/install', function( req, res ) { res.sendfile( __dirname + '/html/agent_install.html' ) } )

  return app

}

