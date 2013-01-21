/*
* Setup Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , util = require('util')
  , async = require('async')
  , vault = require('./vault')
  , config = require('../config')
  , request = require('../lib/request')
  , token = require('../lib/token')
  , db = require('../lib/db')
  , api = require('../lib/api')
  , jwt = require('../lib/jwt')
  , mw = require('../lib/middleware')


var useFB = false
if (config.facebook.appID) {  // Facebook is configured
  useFB = true
}

// fetch name and photo from People to show on Dashboard
function _fetchProfile ( di, complete ) {
  // build an Agent Request and IX Token, get RS Tokens, then call People RS to get name and photo
  var agentRequestDetails =
  { 'iss': config.host.setup
  , 'aud': config.host.ix
  , 'request.a2p3.org':
   { 'resources':
      [ config.baseUrl.people + '/scope/namePhoto' ]
    , 'auth':
      { 'passcode': true
      , 'authorization': true
      }
    , 'returnURL': config.baseUrl.setup + '/dashboard/return'
    }
  }
  var agentRequest = request.create( agentRequestDetails, vault.keys[config.host.ix].latest )
  var jws = new jwt.Parse( agentRequest )
  var ixTokenDetails =
    { 'iss': config.host.setup
    , 'aud': config.host.ix
    , 'sub': di
    , 'token.a2p3.org':
      { 'sar': jws.signature
      , 'auth': agentRequestDetails['request.a2p3.org'].auth
      }
    }
  var ixToken = token.create( ixTokenDetails, vault.keys[config.host.ix].latest )
  var details =
    { host: 'ix'
    , api: '/exchange'
    , credentials: vault.keys[config.host.ix].latest
    , payload:
      { iss: config.host.setup
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'request': agentRequest
        , 'token': ixToken
        }
      }
    }
  api.call( details, function ( e, result ) {
    if (e) return complete( e )
    var peopleHost = Object.keys(result.tokens)[0]
    var peopleToken = result.tokens[peopleHost]
    var peopleDetails =
      { host: config.reverseHost[peopleHost]
      , api: '/namePhoto'
      , credentials: vault.keys[peopleHost].latest
      , payload:
        { iss: config.host.setup
        , aud: peopleHost
        , 'request.a2p3.org': { 'token': peopleToken }
        }
      }
    api.call( peopleDetails, function ( e, result ) {
      if (e) return complete( e , null )
      complete( null, result )
    })
  })
}

function _registerUser ( profile, complete ) {
  var province = profile.province.toLowerCase()
  var healthHost = 'health.'+province
  var peopleHost = 'people.'+province
  var details =
    { host: 'ix'
    , api: '/di/create'
    , credentials: vault.keys[config.host.ix].latest
    , payload:
      { iss: config.host.setup
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'AS': config.host.setup
        , 'RS': [config.host.email, config.host.si, config.host[healthHost], config.host[peopleHost]]
        , 'redirects': {}
        }
      }
    }
  details.payload['request.a2p3.org'].redirects[config.host.health] = [config.host[healthHost]]
  details.payload['request.a2p3.org'].redirects[config.host.people] = [config.host[peopleHost]]
  api.call( details, function ( error, result ) {
    if (error) complete( error, null )
    var diList = result.dis
    var linkDetails = {}
    var linkHosts = ['email','si',peopleHost,healthHost]
    function makeLinkDetails ( host ) {
      linkDetails[host] = { host: host
                        , api: '/di/link'
                        , credentials: vault.keys[config.host[host]].latest
                        , payload:
                          { iss: config.host.setup
                          , aud: config.host[host]
                          , 'request.a2p3.org': { 'sub': diList[config.host[host]] }
                          }
                        }
    }
    linkHosts.forEach( makeLinkDetails )
    linkDetails.email.payload['request.a2p3.org'].account = profile.email
    linkDetails.si.payload['request.a2p3.org'].account = profile.si
    linkDetails[healthHost].payload['request.a2p3.org'].account = profile.prov_number
    linkDetails[peopleHost].payload['request.a2p3.org'].profile = { 'name': profile.name
                                                                  , 'dob': profile.dob
                                                                  , 'address1': profile.address1
                                                                  , 'address2': profile.address2
                                                                  , 'city': profile.city
                                                                  , 'province': profile.province
                                                                  , 'postal': profile.postal
                                                                  , 'photo': profile.photo
                                                                  }
    var tasks = {}

    linkHosts.forEach( function (host) {
      tasks[host] = function (done) {
        api.call( linkDetails[host], function ( error, result) {
          done( error, result )
        }
      )}
    })
    async.parallel(tasks, function (e, result) {
      complete(e, diList[config.host.setup])
    })
  })
}     // _registerUser

function enrollRegister ( req, res, next ) {
  var passedProfile = req.body
  var profile = {}
  profile.email = req.session.profile.email
  profile.si = passedProfile.si
  profile.prov_number = passedProfile.prov_number
  profile.name = passedProfile.name
  profile.dob = passedProfile.dob
  profile.address1 = passedProfile.address1
  profile.address2 = passedProfile.address2
  profile.city = passedProfile.city
  profile.province = passedProfile.province
  profile.postal = passedProfile.postal
  profile.photo = profile.photo || req.session.profile.photo
  _registerUser( profile, function ( e, di ) {
    if (e) return next(e)
    db.updateProfile( 'setup', profile.email, {di: di}, function ( e ) {
      if (e) return next(e)
      req.session.di = di // indicates we have enrolled user
      if (req.body.json) {
        return res.send( {'response': {'success': true } } )
      } else {
        return res.redirect( '/dashboard' )
      }
    })
  })
}


function _loadProfile ( id, profile, req, res ) {
  db.getProfile( 'setup', id, function ( e, existingProfile ) {
    req.session = {}
    if (e) {
      req.session.profile = profile
      return res.redirect( '/enroll' )
    } else {
      req.session.di = existingProfile.di
      return res.redirect( '/dashboard' )
    }
  })
}

function fbRedirect ( req, res, next ) {
  if (!useFB) return res.redirect('/')
  // make FB calls to find out who user is
  var userID = null // TBD
  var profile = null // TBD
  _loadProfile( userID, profile, req, res )
}


function devLogin ( req, res, next ) {

// console.log('\n login req.session:\n', req.session )
// console.log('\n login req.body:\n', req.body )
// console.log('\n login req.query:\n', req.query )

  if (useFB) return res.redirect('/')
  var profile = JSON.parse( JSON.stringify( config.testUser ))  // clone test user object
  profile.email = req.body.email
  _loadProfile( req.body.email, profile, req, res )
}


function enrollProfile ( req, res, next ) {
  res.send( req.session.profile )
}


function _callIX ( apiPath, params, cb ) {
  var details =
    { host: 'ix'
    , api: apiPath
    , credentials: vault.keys[config.host.ix].latest
    , payload:
      { iss: config.host.setup
      , aud: config.host.ix
      , 'request.a2p3.org': params
      }
    }
  api.call( details, cb )
}

/*
* Dashboard web app API
*/


function dashboardProfile ( req, res, next ) {
  var di = req.session.di
  _fetchProfile( di, function ( e, profile ) {
    if (e) return next( e )
    return res.send( { 'result': profile } )
  })
}


function dashboardAgentList ( req, res, next ) {
  var params =
    { di: req.session.di
    }
  _callIX( '/agent/list', params, function ( e, result ) {
    if (e) return next( e )
    return res.send( { 'result': result } )
  })
}

function dashboardAgentDelete ( req, res, next ) {
  var params =
    { di: req.session.di
    , handle: req.body.handle
    }
  _callIX( '/agent/delete', params, function ( e, result ) {
    if (e) return next( e )
    return res.send( { 'result': result } )
  })
}


// create a CLI agent for Setup AS
function dashboardAgentCreate ( req, res, next ) {
  var params =
    { di: req.session.di
    , name: req.body.name
    }
  _callIX( '/agent/add', params, function ( e, result ) {
    if (e) return next( e )
      var agent =
        { 'device': jwt.handle()  // CLI Agent device is created here rather than at device
        , 'handle': result.handle
        , 'sub': req.session.di    // no passcode is used with CLI Agents
        }
    db.storeAgent( 'setup', agent, function (e) {
      var results =
        { 'device': agent.device
        , 'token': result.token
        }
      if (e) return next( e )
      return res.send( { 'result': results } )
    })
  })
}

// generate an IX token for CLI agent
function tokenHandler ( req, res, next ) {
  var device = req.body.device
    , sar = req.body.sar
    , auth = req.body.auth
  db.retrieveAgentFromDevice( 'setup', device, function ( e, agent ) {
    if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
    if (!agent) {
      e = new Error('Unknown device id.')
      e.code = "INVALID_DEVICEID"
      return next(e)
    }
    // Setup Personal Agent does not take passcode as parameter, assumes it is entered
    var payload =
      { 'iss': config.host.setup
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
    return res.send( {'result': {'token': ixToken }})
  })
}

// called by IX when an agent is deleted
function agentDelete ( req, res, next ) {
  var handle = req.request['request.a2p3.org'].handle
  db.deleteAgentFromHandle( 'setup', handle, function (e) {
    if (e) return next( e )
    return res.send({ result: { success: true } } )
  })
}

// AS Agent enrollment end points

function agentBasic ( req, res, next ) {
  // sends browser over to AS to generate an Agent Request
  // which then redirects back to /dashboard/agent/token agentToken()
  // user must be authenticated
  if (!req.session.di) return res.redirect('/')
  res.redirect( config.baseUrl.as + '/setup/request')
}

function agentToken ( req, res, next ) {
  // acts as an agent for AS for enrolling a Personal Agent
  // creates an IX Token for Agent Request and sends result back
  // user must be authenticated

  // TBD error handling -- should create errorCode and errorMessage to send back to AS

//console.log('\n req.session:\n', req.session )

// console.log('\n req.body:\n', req.body )

// console.log('\n req.query:\n', req.query )

  var di = req.session.di
  var jws
  if (!di) {
    console.log('No DI in session.')
    return res.redirect('/')
  }
  var agentRequest = req.query.request
  if (!agentRequest) {
    console.log('No Agent Request was passed.')
    return res.redirect('/')
  }
  try {
    jws = new jwt.Parse( agentRequest )
  }
  catch (e) {
    console.log('Invalid Agent Request was passed.', e )
    return res.redirect('/')
  }

  var payload =
    { 'iss': config.host.setup
    , 'aud': config.host.ix
    , 'sub': di
    , 'token.a2p3.org':
      { 'sar': jws.signature
      , 'auth': jws.payload['request.a2p3.org'].auth
      }
    }
  var ixToken = token.create( payload, vault.keys[config.host.ix].latest )
  return res.redirect( jws.payload['request.a2p3.org'].returnURL +'?token='+ixToken )
}

// static page serving
function homepage ( req, res, next ) {

  if (useFB) {
    res.sendfile( __dirname+'/html/homepageFB.html' )
  } else {
    res.sendfile( __dirname+'/html/homepageDev.html' )
  }
}

function enroll ( req, res, next ) {
  if (!req.session.profile) return res.redirect('/')
  res.sendfile( __dirname+'/html/enroll.html')
}

function dashboard ( req, res, next ) {
  if (!req.session.di) return res.redirect('/')
  res.sendfile( __dirname+'/html/dashboard.html')
}

function databaseRestore ( req, res, next ) {
   var e = db.restoreSnapshotSync()
  if (e) return next(e)
  return res.send({ result: { success: true } } )
}

//
function backdoorLogin ( req, res, next ) {
  var email = req.params.email
  var request = req.query.request
  var state = req.query.state
  var jws = jwt.Parse(request)
  db.getProfile( 'setup', email, function ( e, profile ) {
    if ( e ) return next( e )
    var payload =
      { 'iss': config.host.setup
      , 'aud': config.host.ix
      , 'sub': profile.di
      , 'token.a2p3.org':
        { 'sar': jws.signature
        , 'auth': { 'passcode': true, 'authorization': true }
        }
      }
    var ixToken = token.create( payload, vault.keys[config.host.ix].latest )
    var returnURL = jws.payload['request.a2p3.org'].returnURL + '?token=' + ixToken
    if (state) returnURL += '&state=' + state
    return res.redirect( returnURL )
  })
}

exports.app = function() {
	var app = express()
  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )
  app.use( express.cookieParser() )
  var cookieOptions = { 'secret': vault.secret, 'cookie': { path: '/' } }
  app.use( express.cookieSession( cookieOptions ))

  // FB response
  app.get('/fb/redirect', fbRedirect )

  // dev login
  app.post('/dev/login'
          , mw.checkParams( {'body':['email']} )
          , devLogin )

  // enroll web app API
  app.post('/enroll/register'
          , mw.checkParams( {'session':['profile'], 'body':['si','prov_number','province','dob']} )
          , enrollRegister
          )
  app.post('/enroll/profile'
          , mw.checkParams( {'session':['profile']} )
          , enrollProfile
          )

  // CLI agent token exchange API
  app.post('/token'
          , mw.checkParams( {'body':['device', 'sar', 'auth']} )
          , tokenHandler
          )
  // protocol API called from IX when an agent is deleted
  app.post('/agent/delete'
          , request.check( vault.keys, config.roles.ix )
          , agentDelete
          )

  // dashboard API
  app.post('/dashboard/profile'
          , mw.checkParams( {'session':['di']} )
          , dashboardProfile
          )
  app.post('/dashboard/agent/list'
          , mw.checkParams( {'session':['di']} )
          , dashboardAgentList
          )
  app.post('/dashboard/agent/create'
          , mw.checkParams( {'session':['di'], 'body': ['name']} )
          , dashboardAgentCreate
          )
  app.post('/dashboard/agent/delete'
          , mw.checkParams( {'session':['di'], 'body': ['handle']} )
          , dashboardAgentDelete
          )

  // DB restore API, only callable if signed with Setup
  var dbRestoreList = {}
  dbRestoreList[config.host.registrar] = true
  app.post('/database/restore'
          , request.check( vault.keys, dbRestoreList, config.host.setup )
          , databaseRestore
          )


  // AS redirection pages
  app.get('/dashboard/agent/basic', agentBasic )
  app.get('/dashboard/agent/token', agentToken )

  // static pages
	app.get('/', homepage )
  app.get('/enroll', enroll )
  app.get('/dashboard', dashboard )

  // show README.md as documentation
  app.get('/documentation', mw.md( __dirname+'/README.md' ) )

///////////////////////////////////////////////////////////////////////////
// TBD DEVELOPMENT FUNCTIONALITY THAT NEEDS TO BE DISABLED FOR PRODUCTION
  app.get('/backdoor', function ( req, res ) { res.sendfile( __dirname+'/html/backdoor.html') } )
  app.get('/backdoor/login', function ( req, res ) { res.sendfile( __dirname+'/html/backdoorLogin.html') })
  app.get('/backdoor/login/:email', backdoorLogin )
////////////////////////////////////////////////////////////////////////////

  app.use( mw.errorHandler )


	return app
}
