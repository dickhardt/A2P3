/* 
* app.js
* 
* main router for all calls, distributes calls to each server implementation 
* we run all the POC apps on one set of servers to save money
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , config = require('../config')
  , app = express()

// use app server per host called
app.use( express.vhost( 'ix.*', require('./ix/ix').app() ) )
app.use( express.vhost( 'as.*', require('./as/as').app() ) ) 
app.use( express.vhost( 'registrar.*', require('./registrar/registrar').app() ) ) 

// in case we get called with a host we don't understand
app.use( express.vhost( '*', function ( req, res, next) {
  console.error('UKNOWN HOST:'+host,' from ', req.headers.host)
  res.send(500, 'UKNOWN HOST:'+host)
}) )

app.listen( config.port )

console.log("A2P3 running on port:",config.port)