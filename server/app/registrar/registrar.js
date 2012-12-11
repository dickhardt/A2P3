/* 
* Registrar Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')

exports.create = function() {
	var app = express()
	app.get("/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from the Registrar!';
	    res.send(html);    
	});
	return app
}
