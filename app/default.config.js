/*
* config.js
*
* A2P3 Server Configuration Information
*
* Copyright (C) Province of British Columbia, 2013
*
* This file is copied from default.config.js. Edit config.js to change local installation behaviour.
*
*/

var fs = require('fs')

/*
*   Edit the following if you want to host the server somewhere besides your own machine
*/
var port = '8080'
var baseDomain = 'local.a2p3.net' // this domain resolves to 127.0.0.1
var scheme = 'http'
var portListen = port

/*
*   Check if we are deployed on dotcloud, and if so, configure accordingly
*/
var dotcloud = null
if ( fs.existsSync( '../environment.json' ) )
  dotcloud = require( '../environment.json' )
exports.dotcloud = dotcloud
if (dotcloud) {
  port = '80'
  baseDomain = 'a2p3.net'
  scheme = 'http'
  portListen = dotcloud.PORT_WWW
  console.log('\n****** DOTCLOUD DEPLOYMENT MAGIC *******\n')
}

/*
*   The following builds out the configuration for all the hosts
*   No configurable information is here
*/
var provinces =
  ['ab', 'bc', 'mb', 'nb', 'nl', 'ns', 'nt', 'nu', 'on', 'pe', 'qc', 'sk', 'yt']
var  host =
  { ix: 'ix'
  , registrar: 'registrar'
  , as: 'as'
  , setup: 'setup'
  , bank: 'bank'
  , clinic: 'clinic'
  , si: 'si'
  , people: 'people'
  , health: 'health'
  , email: 'email'
  }
, baseUrl = {}
, reverseHost = {}

provinces.forEach( function ( province ) {
  host['people.'+province] = 'people.'+province
  host['health.'+province] = 'health.'+province
})
Object.keys(host).forEach( function (key) {
  host[key] = host[key] +'.'+ baseDomain
  reverseHost[host[key]] = key
  baseUrl[key] = scheme + '://' + host[key]
  if (port && port != '80')
    baseUrl[key] += ':' + port
})

/*
* Edit information below if you want a different defailt user installed
*/
var profile =
    { 'si': '123456789'
    , 'prov_number': '0123456789'
    , 'email': 'john@example.com'
    , 'name': 'John Smith'
    , 'dob': 'January 1, 1960'
    , 'address1': '100 Main Street'
    , 'address2': 'Suite 1000'
    , 'city': 'Victoria'
    , 'province': 'BC'
    , 'postal': 'V1A 1A1'
    , 'photo': baseUrl.setup + '/images/white-face.jpg'
    }
exports.testProfile =
    { 'name': profile.name
    , 'dob': profile.dob
    , 'address1': profile.address1
    , 'address2': profile.address2
    , 'city': profile.city
    , 'province': profile.province
    , 'postal': profile.postal
    , 'photo': profile.photo
    }
exports.testUser = profile


/*
*   Insert Facebook App credentials if you want to Setup to use Facebook to gather data
*/
exports.facebook =
  { appID: null
  , appSecret: null
  }

/*
* Edit roles.as entry to add additional Authentication Servers
*/

// roles are used for access control to special APIs
var roles =
  { ix: {}
  , as: {}
  , enroll: {}
  , std: {}
  , authN: {}
  }

// IX roles, should just be the one!
roles.ix[host.ix] = true

// AS roles, add other AS when they become available
roles.as[host.as] = true
roles.as[host.setup] = true

// setup is only enrollment app
roles.enroll[host.setup] = true

// health and people are POC standardized resources
roles.std[host.health] = true
roles.std[host.people] = true

roles.authN[host.ix] = true
roles.authN[host.registrar] = true

/********************************************************************
*  Don't edit below here unless you know what you are doing!!!      *
********************************************************************/


// cryptography configuration

var crypto =
  { alg:
    { JWE: 'A256CBC+HS512'
    , JWS: 'HS512'
    }
  , bytesKey: 64
  , bytesKid: 12
  , bytesDI: 20
  , bytesHandle: 20
  , bytesSecret: 20
  }

// export configuration so far
exports.crypto = crypto
exports.baseDomain = baseDomain
exports.host = host
exports.reverseHost = reverseHost
exports.port = port
exports.portListen = portListen
exports.scheme = scheme
exports.baseUrl = baseUrl
exports.roles = roles
exports.provinces = provinces
exports.rootAppDir = __dirname

// how long requests and tokens are valid for
exports.maxTokenAge = 5 * 60 // 5 minutes



