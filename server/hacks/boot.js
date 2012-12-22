 var fetchUrl = require('fetch').fetchUrl
  , querystring = require('querystring')
  , request = require('../app/request')
  , token = require('../app/token')
  , config = require('../app/config')
  , vaultSetup = require('../app/setup/vault')
  , vaultRegistrar = require('../app/registrar/vault')
  , api = require('../app/api')

/*
boot.js - boots up system to have operational components

create a user
enroll an agent for user
create app
  bank, clinic
  si, health.*, people.*

*/


// register Personal Agent at AS
function register ( qr ) {
  console.log('register')
  var options =
    { method: 'POST' 
    , payload: querystring.stringify( {'qr': qr, 'device':'12345', 'passcode':'12345'})
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }  
  fetchUrl( config.baseUrl.as + '/register', options, function (error, meta, body) {
    if (error) return console.log(error)
    var r = JSON.parse(body)
    console.log(r)

    // can now call registrar with handle
  })   
}

// get QR Code from AS for Personal Agent registration
function postRegisterQR ( session ) {
  console.log('postRegisterQR')
  var options =
    { method: 'POST' 
    , payload: querystring.stringify( {'registerSession': session, 'passcode':'12345'} )
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }  
  fetchUrl( config.baseUrl.as + '/register/qr', options, function (error, meta, body) {
    if (error) return console.log(error)
    var r = JSON.parse(body)
    console.log(r)
    register( r.result.qr )
  })  
}

// create IX Token for AS from setup to enable Personal Agent registration
function getRegisterAgent ( req ) {
  console.log('getRegisterAgent')
  var jws = request.parse( req )
  var returnUrl = jws.payload['request.a2p3.org'].returnURL
  var session = returnUrl.substring( returnUrl.lastIndexOf('/')+1 )
// make an IX Token
  var payload =
    { 'iss': config.host.setup
    , 'aud': config.host.ix
    , 'prn': '12345' // TBD - need to get asDI for setup to fill in here
    , 'token.a2p3.org': 
      { 'sar': jws.signature
      , 'auth': 
        { 'passcode': true
        , 'authorization': true
        , 'nfc': false
        }
      }
    }
  var ixToken = token.create( payload, vaultSetup.keys[config.host.ix].latest)
  var query = querystring.stringify( {'token':ixToken} )
  fetchUrl( returnUrl + '?' + query, {}, function (error, meta, body) {
    if (error) return console.log(error)
    postRegisterQR( session )
  })   
}

// get an Agent Request from AS
function getRequest () {
  console.log('getRequest')
  fetchUrl( config.baseUrl.as + '/register/request/agent', {}, function (error, meta, body) {
    if (error) return console.log(error)
    var r = JSON.parse( body )
    console.log( r )
    getRegisterAgent( r.result.request )
  })

}


// getRequest()

function registerApp ( appID, cb ) {

  // call registrar and get keys
  // write out keys
}

function authorizeApp ( appID, rsID, cb ) {

}

// boot up system with root DI
// registrar will set a session cookie with DI and 'root' email
// use session cookie in subsequent boot calls
function getBootSession ( diAdmin ) {
  var payload = 
    { iss: config.host.setup
    , aud: config.host.registrar
    , 'request.a2p3.org':
      { 'di': diAdmin
      , 'email': 'root' 
      }
    }
  var jwt = request.create( payload, vaultSetup.keys[config.host.registrar].latest )

  var options =
    { method: 'POST' 
    , payload: querystring.stringify({'request': jwt})
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }
  
  fetchUrl( config.baseUrl.registrar+'/dashboard/boot', options, function (error, meta, body) {
//    console.log("error:",error)
    console.log("body:", JSON.parse(body) )

    var cookieJar = meta.cookieJar

    options =
      { method: 'POST' 
      , payload: querystring.stringify({'session': 'foo', 'id': 'example.com', 'name': 'Example App'})
      , headers: {'content-type': 'application/x-www-form-urlencoded'}
      , cookieJar: cookieJar
      }
    fetchUrl( config.baseUrl.registrar+'/dashboard/new/app', options, function (error, meta, body) {
//      console.log("error:",error)
//      console.log("meta:",meta)
      console.log("body:", JSON.parse(body) )
    })

  })
}  



// create a root user to bootup RS and App creation
function createRootUser () {
  console.log('createRootUser')
  var details = 
    { host: 'ix'
    , api: '/di/create'
    , credentials: vaultSetup.keys[config.host.ix].latest
    , payload: 
      { iss: config.host.setup
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'AS': config.host.as
        , 'RS': [config.host.registrar] 
        }
      }
    }
  api.call( details, function (response) {
    console.log(response)
    getBootSession( response.result.dis[config.host.registrar] )
  })  
}

createRootUser()
