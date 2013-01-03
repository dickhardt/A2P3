/* 
* Setup Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , registration = require('../registration')
  , request = require('../request')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
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

  db.updateProfile( 'setup', profile.email, profile, function (e) {
    if (e) return next(e)
      // TBD create user and add to all RSes
    req.session.enrolled = true
    return res.send( {'response': {'success': true } } )
  })
}


function dashboardAgentList ( req, res, next ) {

}

function dashboardAgentDelete ( req, res, next ) {

}


function tokenHandler ( req, res, next ) {

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
