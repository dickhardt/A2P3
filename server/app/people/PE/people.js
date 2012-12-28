/* 
* People.* Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

/*
* NOTE: this is a hardlinked file in each of the province subdirectories
* edit the file in the people directory, but don't reference it as the 
* require() statements are expecting to in the province subdirectory
*/

var express = require('express')
  , vault = require('./vault')
  , registration = require('../../registration')
  , mw = require('../../middleware')

exports.app = function( province ) {
	var app = express()
  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )
  registration.routes( app, 'people.'+province, vault )  // add in routes for the registration paths
  app.use( mw.errorHandler )
	return app
}
