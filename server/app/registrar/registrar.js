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

// Express Middleware that checks if agent token is valid
function checkValidAgent (req, res, next) {
    if (!req.body || !req.body.token) {
      // TBD set ERROR and ERROR LOGGING
      next('route')
      return undefined
    }
    db.validAgent( req.body.token, function (name) {
      if (name) {
        req.a2p3 = {'appName': name}
        next()
      } else {
        res.send({error: 
                  { code: 'INVALID_TOKEN'
                  , message: 'Agent Token was not recognized'
                  } })
      }
    })
}



function requestVerify (req, res) {
  if (!req.body || !req.body.request) {
    // TBD set ERROR and ERROR LOGGING
    next('route')
    return undefined
  }
  try {
    if (request.verify( vault, req.body.request )) {
      res.send({result: { name: req.a2p3.appName }}) // ERRROR, fix, TBD
    } else {
      res.send({error: 
                { code: 'INVALID_REQUEST'
                , message: 'Invalid signature'
                } })      
    }
  }
  catch (e) {
    res.send({error: 
              { code: 'INVALID_REQUEST'
              , message: e.message
              } })      
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

  app.get("/", function(req, res){
  console.log(req.domain);
  console.log(req.headers);
    html = 'Hello World, from the Registrar!';
    res.send(html);    
  });

	return app
}