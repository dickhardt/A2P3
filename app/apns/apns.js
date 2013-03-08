/*
* apns.js
*/

var apns = require('apn')

var options =
  { pfx: __dirname + '/adhoc.p12'       // File path for private key, certificate and CA certs in PFX or PKCS12 format.
  , gateway: 'gateway.push.apple.com'   // gateway address
  , rejectUnauthorized: false           // Value of rejectUnauthorized property to be passed through to tls.connect()
}

// console.log( 'APNS options\n', options )

var apnsConnection = new apns.Connection( options )

// event listeners

apnsConnection.on('error', function ( error ) {
  console.log('APNS:Error:', error )
})

apnsConnection.on('transmitted', function ( notification ) {
  //console.log('APNS:Transmitted:', notification )
  console.log('APNS:Transmitted:', notification.payload )

})

apnsConnection.on('timeout', function ( ) {
  console.log('APNS:Timeout event')
})

apnsConnection.on('connected', function (  ) {
  console.log('APNS:connected event' )
})


apnsConnection.on('disconnected', function (  ) {
  console.log('APNS:disconnected event' )
})


apnsConnection.on('socketError', function ( error ) {
  console.log('APNS:socketError:', error )
})


apnsConnection.on('transmissionError', function ( error, notification ) {
  console.log('APNS:transmissionError:', error, notification )
})

apnsConnection.on('cacheTooSmall', function ( difference ) {
  console.log('APNS:cacheTooSmall:', difference )
})

exports.notification = function ( device, shortURL, alert ) {
  var note = new apns.Notification()
  note.expiry = Math.floor( Date.now() / 1000 ) + ( 4 * 60 )// Expires 4 minutes from now.
  note.sound = 'chime'
  note.alert = alert
  note.payload = { url: shortURL }
  note.device = new apns.Device( device )
  var result = apnsConnection.sendNotification( note )
  // console.log('sendNotification returned', result )
}