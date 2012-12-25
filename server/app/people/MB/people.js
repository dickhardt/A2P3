/* 
* People Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , registration = require('../../registration')

exports.app = function( province ) {
	var app = express()
  registration.routes( app, 'people.'+province, vault )  // add in routes for the registration paths

	app.get("/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from People!';
	    res.send(html);    
	});
	return app
}
