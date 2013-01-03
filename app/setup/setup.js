/* 
* Setup Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , async = require('async')
  , registration = require('../registration')
  , request = require('../request')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
  , api = require('../api')
  , mw = require('../middleware')


var useFB = false
if (config.facebook.appID) {  // Facebook is configured
  useFB = true
}

function _loadProfile ( di, profile, req, res ) {
  db.getProfile( 'setup', di, function ( e, existingProfile ) {
    if (e) {
      req.session.profile = profile
      return res.redirect( '/enroll' )
    } else {
      req.session.enrolled = true
      req.session.profile = profile
      return res.redirect( '/dashboard' )      
    }
  })
}

function _registerUser ( session, complete ) {
  var profile = session.profile
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
    session.di = diList[config.host.setup] // we need this for registering an agent
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
          console.log('host:',host, result)
          done( error, result )
        }
      )} 
    })
    async.parallel(tasks, function (e, result) {
      complete(e, result)
    })
  })
}     // _registerUser

function fbRedirect ( req, res, next ) {
  if (!useFB) return res.redirect('/')
  // make FB calls to find out who user is
  var user = null // TBD
  var profile = null // TBD
  _loadProfile( user, profile, req, res )
}


function devLogin ( req, res, next ) {
  if (useFB) return res.redirect('/')
  var profile = JSON.parse( JSON.stringify( config.testUser ))  // clone test user object
  profile.email = req.body.email
  _loadProfile( req.body.email, profile, req, res )
}


function enrollProfile ( req, res, next ) {
  res.send( req.session.profile )
}

function enrollRegister ( req, res, next ) {
  var newProfile = req.body
  var profile = req.session.profile

  profile.si = newProfile.si
  profile.prov_number = newProfile.prov_number
  profile.name = newProfile.name
  profile.dob = newProfile.dob
  profile.address1 = newProfile.address1
  profile.address2 = newProfile.address2
  profile.city = newProfile.city
  profile.province = newProfile.province
  profile.postal = newProfile.postal
  profile.photo = profile.photo || req.session.profile.photo
  req.session.profile = profile
  _registerUser( req.session, function ( e ) {
    if (e) return next(e)
    profile.di = req.session.di // this was set in _registerUser
    db.updateProfile( 'setup', profile.email, profile, function (e) {
      if (e) return next(e)
      req.session.enrolled = true
      return res.send( {'response': {'success': true } } )
    })
  })
}


function dashboardAgentList ( req, res, next ) {

}

function dashboardAgentDelete ( req, res, next ) {

}


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
    var ixToken = token.create( payload, vault.ix.latest )
    return res.send( {'result': {'token': ixToken }})
  })
}


function agentDelete ( req, res, next ) {

}



function homepage ( req, res, next ) {
  if (useFB) {
    res.sendfile( __dirname+'/assets/homepageFB.html' )
  } else {
    res.sendfile( __dirname+'/assets/homepageDev.html' )
  }
}

function enroll ( req, res, next ) {
  if (!req.session.profile) return res.redirect('/')
  res.sendfile( __dirname+'/assets/enroll.html')
}

function dashboard ( req, res, next ) {
  if (!req.session.enrolled) return res.redirect('/')
  res.sendfile( __dirname+'/assets/dashboard.html')
}

exports.app = function() {
	var app = express()
  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )  
  app.use( express.cookieParser() )
  var cookieOptions =
    { 'secret': vault.secret
    , 'cookie': { path: '/', httpOnly: true, maxAge: 300 }
    , 'proxy': true
    }
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

  // CLI agent token exchange
  app.post('/token'
          , mw.checkParams( {'body':['device', 'sar', 'auth']} )
          , tokenHandler
          )
  // called from IX when an agent is deleted
  app.post('/agent/delete'
          , request.check( vault, config.host.ix )
          , agentDelete 
          )

  // dashboard API
  app.post('/dashboard/profile'
          , mw.checkParams( {'session':['profile', 'enrolled']} )
          , enrollProfile // getting profile for dashboard works same as in enroll
          )
  app.post('/dashboard/agent/list'
          , mw.checkParams( {'session':['profile', 'enrolled']} )
          , dashboardAgentList
          )
  app.post('/dashboard/agent/delete'
          , mw.checkParams( {'session':['profile', 'enrolled'], 'body': ['handle']} )
          , dashboardAgentDelete
          )

  // static pages
	app.get('/', homepage )
  app.get('/enroll', enroll )
  app.get('/dashboard', dashboard )

	return app
}
