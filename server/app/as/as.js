/* 
* AS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
 , request = require('../request')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')
  , middleware = require('../middleware')

function agentDelete ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function notify ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function register ( req, res, next ) {
  var e = undefined
  if (!req.body) e = new Error("No JSON in POST")
  else if (!req.body.device) e = new Error("No 'device' in JSON POST")
  else if (!req.body.passcode) e = new Error("No 'passcode' in JSON POST")
  else if (!req.body.request) e = new Error("No 'request' in JSON POST")
  if (e) {
    e.code = 'INVALID_API_CALL'
    next(e)
    return undefined
  }

  // TBD add code to register

}

function token ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}


exports.app = function() {
	var app = express()

  app.use(express.limit('10kb'))  // protect against large POST attack  
  app.use(express.bodyParser())

  app.post('/agent/delete', agentDelete)
  app.post('/notify/:handle', notify)
  app.post('/register', register)
  app.post('/token', token)

  app.get('/', function(req, res){
    console.log(req.domain);
    console.log(req.headers);
      html = 'Hello World, from AS!';
      res.send(html);    
  });

  app.use( middleware.errorHandler )

console.log( 'AS middleware:\n', app.stack, '\nroutes:',app.routes )

	return app
}
