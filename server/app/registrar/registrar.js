/* 
* Registrar Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')

function requestVerify (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function report (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function authorizationsRequests (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function appVerify (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}


exports.app = function() {
	var app = express()
	app.get("/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from the Registrar!';
	    res.send(html);    
	});
  app.post('/request/verify', requestVerify)
  app.post('/report', report)
  app.post('/authorizations/requests', authorizationsRequests)
  app.post('/app/verify', appVerify)  
	return app
}