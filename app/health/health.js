/*
* Standardized Health Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , stdDashboard = require('../lib/stdDashboard')
  , mw = require('../lib/middleware')
  , login = require('../lib/login')
  , config = require('../config')

exports.app = function( ) {
  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  stdDashboard.routes( app, 'health', vault )  // add in routes for the registration paths

  login.router( app, { 'dashboard': 'health', 'vault': vault } )

  app.get('/', function( req, res ) { res.sendfile( config.rootAppDir + '/html/homepage_rs.html' ) } )

  app.use( mw.errorHandler )
  return app
}
