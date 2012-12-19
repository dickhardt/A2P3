 var fetchUrl = require('fetch').fetchUrl
  , querystring = require('querystring')
  , request = require('../app/request')
  , token = require('../app/token')
  , config = require('../app/config')
  , vaultSetup = require('../app/setup/vault')

var host = config.baseUrl.as

function register ( qr ) {
  console.log('register')
  var options =
    { method: 'POST' 
    , payload: querystring.stringify( {'qr': qr, 'device':'12345', 'passcode':'12345'})
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }  
  fetchUrl( host + '/register', options, function (error, meta, body) {
    if (error) return console.log(error)
    var r = JSON.parse(body)
    console.log(r)

    // can now call registrar with handle
  })   
}


function postRegisterQR ( session ) {
  console.log('postRegisterQR')
  var options =
    { method: 'POST' 
    , payload: querystring.stringify( {'registerSession': session, 'passcode':'12345'} )
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }  
  fetchUrl( host + '/register/qr', options, function (error, meta, body) {
    if (error) return console.log(error)
    var r = JSON.parse(body)
    console.log(r)
    register( r.result.qr )
  })  
}

function getRegisterAgent ( req ) {
  console.log('getRegisterAgent')
  var jws = request.parse( req )
  var returnUrl = jws.payload['request.a2p3.org'].returnURL
  var session = returnUrl.substring( returnUrl.lastIndexOf('/')+1 )
// make an IX Token
  var payload =
    { 'iss': config.host.setup
    , 'aud': config.host.ix
    , 'prn': '12345'
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

function getRequest () {
  console.log('getRequest')
  fetchUrl( host+'/register/request/agent', {}, function (error, meta, body) {
    if (error) return console.log(error)
    var r = JSON.parse( body )
    console.log( r )
    getRegisterAgent( r.result.request )
  })

}


getRequest()
