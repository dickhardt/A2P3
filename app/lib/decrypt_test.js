


var crypto = require('crypto')

var CIPHER = 'aes256'

var inputText = "Mary had a little lamb, a little pork, and a little ham."
var iv = new Buffer([81,249,131,194,25,166,147,155,47,249,146,160,200,236,115,72])
var key = new Buffer([157,19,75,205,31,190,110,46,117,217,137,19,116,166,126,60,18,244,226,114,38,153,78,198,26,0,181,168,113,45,149,89])

console.log('\nChecking crypto process ... \n')

console.log('process.versions\n', process.versions )

try {
  // encrypt
  var cipher = crypto.createCipheriv( CIPHER, key, iv)
  var cipherText = cipher.update( inputText, 'utf8', 'base64' )
  cipherText += cipher.final( 'base64')
  //decrypt
  var cipherText = new Buffer( cipherText, 'base64' )
  var decipher = crypto.createDecipheriv( CIPHER, key, iv )
  var outputText = decipher.update( cipherText,'binary','utf8' )
  outputText +=  decipher.final( 'utf8' )

}
catch ( e ) {
  console.error( e, e.stack )
  process.exit( 1 )
}

console.log('Crypto test passed', (inputText == outputText) ? true : false,'\n\n' )

