/* 
* AS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')

function agentDelete (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function notify (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function register (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function token (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}


exports.app = function() {
	var app = express()
	app.get('/', function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from AS!';
	    res.send(html);    
	});
  app.post('/agent/delete', agentDelete)
  app.post('/notify/:handle', notify)
  app.post('/register', register)
  app.post('/token', token)
	return app
}
