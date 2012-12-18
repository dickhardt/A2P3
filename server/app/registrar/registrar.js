/* 
* Registrar Server code
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

// Express Middleware that checks if agent token is valid
function checkValidAgent (req, res, next) {
    if (!req.body || !req.body.token) {
      e = new Error("No 'token' parameter in POST")
      e.code = 'INVALID_API_CALL'
      next(e)
      return undefined
    }
    db.validAgent( req.body.token, function (valid) {
      if (!valid) {
        e = new Error('unrecognized agent token')
        e.code = 'INVALID_TOKEN'
        next(e)
        return undefined
      } else {
        next()
      }
    })
}



function requestVerify (req, res, next) {
  var appId
  if (!req.body || !req.body.request) {
      e = new Error("No 'request' parameter in POST")
      e.code = 'INVALID_API_CALL'
      return next( e )
  }
  try {
    appId = request.verifyAndId( req.body.request, vault )
    if ( appId ) {
      db.getAppName( appId, function (appName) {
          res.send({result: { name: appName }})
        })
      return undefined
    } else {
        e = new Error('Invalid request signature')
        e.code = 'INVALID_REQUEST'
        return next( e )
    }
  }
  catch (e) {
    e.code = 'INVALID_REQUEST'
    return next( e )
  }
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
  app.use(express.limit('10kb'))  // protect against large POST attack  
  app.use(express.bodyParser())

  app.post('/request/verify', checkValidAgent, requestVerify)
  app.post('/report', checkValidAgent, report)
  app.post('/authorizations/requests', checkValidAgent, authorizationsRequests)
  app.post('/app/verify', request.check(vault), appVerify)  

  app.get('/', function(req, res){
  console.log(req.domain);
  console.log(req.headers);
    html = 'Hello World, from the Registrar!';
    res.send(html);    
  });

  app.use( middleware.errorHandler )

	return app
}