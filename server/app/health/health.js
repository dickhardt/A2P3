/* 
* Health Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

/*
* NOTE: this is a hardlinked file in each of the province subdirectories
* edit the file in the health directory, but don't reference it as the 
* require() statements are expecting to in the province subdirectory
*/

var express = require('express')
  , vault = require('./vault')
  , registration = require('../../registration')


exports.app = function( province ) {
	var app = express()
  registration.routes( app, 'health.'+province, vault )  // add in routes for the registration paths
  
	app.get("/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from Health!';
	    res.send(html);    
	});
	return app
}
