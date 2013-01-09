/*
* helloWorld.js
*
* simple app that runs on IP of host
* useful for logging into from mobile agent
* see README.md for more details
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , config = require('../app/config')
  , mw = require('../app/middleware')
  , app = express()
  , os = require('os')
  , dns = require('dns')
  , async = require('async')
  , vault = require('./vault')
  , helloConfig = require('./config')
  , api = require('../app/api')

var resources =
  { 'email':
    { 'scope': config.baseUrl.email+'/scope/default'
    , 'api': '/email/default'
    , 'host': config.host.email
    }
  , 'si':
    { 'scope': config.baseUrl.si+'/scope/number'
    , 'api': '/number'
    , 'host': config.host.si
    }
/*
  , 'people':
    { 'scope': config.baseUrl.people+'/scope/details'
    , 'api': '/details'
    , 'host': config.host['people.bc']  // TBD -- need to fill these in from redirects
    }
  , 'health':
    { 'scope': config.baseUrl.health+'/scope/prov_number'
    , 'api': '/prov_number'
    , 'host': config.host['health.bc']    // TBD - FIX!
    }
*/
  }


// fetch all resources and send them back
function profileFetch ( req, res, next ) {
  var tokens = req.session.tokens
  var redirects = req.session.redirects
  Object.keys( redirects ).forEach( function ( redirect ) {
    // TBD set resources.host for standardized resources
  })
  if (!tokens) {
    var e = new Error('No tokens')
    return next( e )
  }
  // go get data from all the resources!
  var tasks = []
  Object.keys( resources ).forEach( function ( r ) {
    tasks.push( function( done ) {
      var details =
        { host: resources[r].host
        , api: resources[r].api
        , credentials: vault.keys[resources[r].host].latest
        , payload:
          { iss: helloConfig.hostname
          , aud: config.host[r]
          , 'request.a2p3.org':
            { 'token': tokens[resources[r].host]
            }
          }
        }
      api.call( details, function ( error, result ) {
        if (error) return done( error, null )
        results[resources[r].host] = result
        done( null, result )
      })
    })
  })
  async.parallel( tasks, function ( e, results ) {
    if (e) return next(e)
    return res.send( { result: results } )
  })
}

var scopes = []
Object.keys( resources ).forEach( function (r) { scopes.push( resources[r].scope ) } )

var loginDetails =
  { 'host': helloConfig.hostname
  , 'vault': vault
  , 'resources': scopes
  , 'path':
    { 'login':      '/profile/login'
    , 'return':     '/profile/login/return'
    // the following are static pages located in /assets
    , 'error':      '/profile/error'
    , 'success':    '/profile'
    , 'complete':   '/profile/complete'
    }
  }

// setup middleware and routes

app.use( express.cookieParser() )

var cookieOptions = { 'secret': vault.secret, 'cookie': { path: '/dashboard' } }

app.use( express.cookieSession( cookieOptions ))

app.use( mw.colorLogger( express ))
app.use( express.static( __dirname + '/assets' ) )

mw.loginHandler( app, loginDetails ) // TBD this is incorrect

app.get( '/profile/fetch', mw.checkLoggedIn, profileFetch)

var port = helloConfig.port

app.listen( port )

var hostname = os.hostname()
dns.lookup( hostname, 4, function ( e, address, family ) {
  console.log( "\nHello World server started on 'http://"+hostname+':'+port+"' ("+address+':'+port+')\n')
})
