/* 
* app.js
* 
* main router for all calls, distributes calls to each server implementation 
* we run all the POC apps on one set of servers to save money
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , config = require('./config')
  , app = express()
  , mw = require('./middleware')

// common assets
app.use( express.static( __dirname + '/assets' ) )

// setup logging after static files so we only log API calls
app.use( mw.colorLogger( express ))

// use app server per host called
app.use( express.vhost( config.host.ix, require('./ix/ix').app() ) )
app.use( express.vhost( config.host.as, require('./as/as').app() ) ) 
app.use( express.vhost( config.host.registrar, require('./registrar/registrar').app() ) )
app.use( express.vhost( config.host.setup, require('./setup/setup').app() ) ) 
app.use( express.vhost( config.host.bank, require('./bank/bank').app() ) ) 
app.use( express.vhost( config.host.clinic, require('./clinic/clinic').app() ) ) 
app.use( express.vhost( config.host.si, require('./si/si').app() ) ) 
app.use( express.vhost( config.host.email, require('./email/email').app() ) ) 
app.use( express.vhost( config.host.health, require('./health/healthstd').app() ) ) 
app.use( express.vhost( config.host.people, require('./people/peoplestd').app() ) ) 

config.provinces.forEach( function ( province ) {
  app.use( express.vhost( config.host['health.'+province], require('./health/'+province+'/health').app( province ) ) ) 
  app.use( express.vhost( config.host['people.'+province], require('./people/'+province+'/people').app( province ) ) ) 
})

// in case we get called with a host we don't understand
app.use( express.vhost( '*', function ( req, res, next ) {
  console.error('UKNOWN HOST:'+host,' from ', req.headers.host )
  res.send(500, 'UKNOWN HOST:'+host )
}) )

app.listen( config.port )

console.log( "A2P3 server started on port:", config.port )
