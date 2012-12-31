

var config = require('../app/config')
  , request = require('../app/request')
  , token = require('../app/token')
  , vault = require('../app/setup/vault')

var credentials = vault.keys[config.host.ix].latest
  , payload = 
    { iss: config.host.setup
    , aud: config.host.ix
    , 'request.a2p3.org':
      { 'AS': config.host.as
      , 'RS': [] 
      
    }
  }


function jwsCreate  () {
  var jws = request.create( payload, credentials )
}


function jwsCreateParse () {
  var jws = request.create( payload, credentials )
  var output = request.parse( jws, function() { return credentials})
}

function jweCreate () {
  var jwe = token.create( payload, credentials )
}

function jweCreateParse () {
  var jwe = token.create( payload, credentials )
  var output = token.parse( jwe, function() { return credentials})  
}


var timing = function (func) {
  var times = []
  for (var x=0; x<10; x++) {
    var start = process.hrtime()
    for (var i=0; i<1000; i++) {
      func()
    }
    times.push( Math.round( process.hrtime(start)[1]/1000000 ) )
  }
  var avg = 0
  times.forEach( function(v) {avg += v})
  avg = avg/10
  console.log( func.name, times, avg)
}

console.log(config.crypto.alg.JWS)
timing( jwsCreate )
timing( jwsCreateParse )
timing( jweCreate )
timing( jweCreateParse )


config.crypto.alg.JWS = 'HS256'
config.crypto.alg.JWE = 'A128CBC+HS256'
vault = require('../app/setup/128.vault')
credentials = vault.keys[config.host.ix].latest

console.log(config.crypto.alg.JWS)
timing( jwsCreate )
timing( jwsCreateParse )
timing( jweCreate )
timing( jweCreateParse )
