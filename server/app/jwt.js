/* 
* JSON Web Token code
*
* Copyright (C) Dick Hardt dickhardt@gmail.com, 2012
*/

var crypto = require('crypto')
 , b64url = require("./b64url")

// Concat KDF key generation and caching
var keyCache = {}

var concatKDF = function ( cmk ) {
    // check if we have already created keys
    if (keyCache[cmk]) return keyCache[cmk]

    var hash
      , keys = {}
      , input

    if (cmk.length === 256/8) { // 256 bit key
      input =
        [ Buffer([0,0,0,1])
        , cmk
        , Buffer([0,0,0,128, 65,49,50,56,67,66,67,43,72,83,50,53,54, 
                  0,0,0,0, 0,0,0,0, 69,110,99,114,121,112,116,105,111,110])
        ]
      hash = crypto.createHash('sha256')  
      hash.update( Buffer.concat( input ) )
      keys.cek = new Buffer( hash.digest().slice( 0, 128/8 ), 'binary' )

      input =
        [ Buffer([0,0,0,1])
        , cmk
        , Buffer([0,0,1,0, 65,49,50,56,67,66,67,43,72,83,50,53,54, 
                  0,0,0,0, 0,0,0,0, 73,110,116,101,103,114,105,116,121])
        ]
      hash = crypto.createHash('sha256')  
      hash.update( Buffer.concat( input ) )
      keys.cik = new Buffer( hash.digest(), 'binary' )

    } else if (cmk.length === 512/8) { // 512 bit key
      input =
        [ Buffer([0,0,0,1])
        , cmk
        , Buffer([0,0,1,0, 65,50,53,54,67,66,67,43,72,83,53,49,50,
                  0,0,0,0, 0,0,0,0, 69,110,99,114,121,112,116,105,111,110])
        ]
      hash = crypto.createHash('sha512')  
      hash.update( Buffer.concat( input ) )
      keys.cek = new Buffer( hash.digest().slice( 0, 256/8 ), 'binary' )
      
      input =
        [ Buffer([0,0,0,1])
        , cmk
        , Buffer([0,0,2,0, 65,50,53,54,67,66,67,43,72,83,53,49,50, 
                  0,0,0,0, 0,0,0,0, 73,110,116,101,103,114,105,116,121])
        ]
      hash = crypto.createHash('sha512')  
      hash.update( Buffer.concat( input ) )
      keys.cik = new Buffer( hash.digest(), 'binary' )
    }
    
    keyCache[cmk] = keys
    return keys
} 

/*
// concatKDF tests - uncomment out to run
// data from: http://tools.ietf.org/html/draft-ietf-jose-json-web-encryption
// specifically, http://tools.ietf.org/html/draft-ietf-jose-json-web-encryption-07

var assert = require('assert')
  , actual
  , expected

// test 256 bit 
expected =   
  { cek: Buffer([203,165,180,113,62,195,22,98,91,153,210,38,112,35,230,236])
  , cik: Buffer([218,24,160,17,160,50,235,35,216,209,100,174,155,163,10,117,
                 180,111,172,200,127,201,206,173,40,45,58,170,35,93,9,60]) 
  }
actual = concatKDF( Buffer([4,211,31,197,84,157,252,254,11,100,157,250,63,170,
            106,206,107,124,212,45,111,107,9,219,200,177,0,240,143,156,44,207]) ) 
assert.deepEqual(actual, expected, "concat KDF failure")

// check that cache works
actual = concatKDF( Buffer([4,211,31,197,84,157,252,254,11,100,157,250,63,170,
            106,206,107,124,212,45,111,107,9,219,200,177,0,240,143,156,44,207]) ) 
assert.deepEqual(actual, expected, "concat KDF failure")

// test 512 bit

expected =   
  { cek: Buffer([157,19,75,205,31,190,110,46,117,217,137,19,116,166,126,
                60,18,244,226,114,38,153,78,198,26,0,181,168,113,45,149,89])
  , cik: Buffer([81,249,131,194,25,166,147,155,47,249,146,160,200,236,115,
                72,103,248,228,30,130,225,164,61,105,172,198,31,137,170,215,
                141,27,247,73,236,125,113,151,33,0,251,72,53,72,63,146,117,
                247,13,49,20,210,169,232,156,118,1,16,45,29,21,15,208]) 
  }

actual = concatKDF( Buffer([148,116,199,126,2,117,233,76,150,149,89,193,61,34,239,
                            226,109,71,59,160,192,140,150,235,106,204,49,176,68,119,
                            13,34,49,19,41,69,5,20,252,145,104,129,137,138,67,23,153,
                            83,81,234,82,247,48,211,41,130,35,124,45,156,249,7,225,168]) )
assert.deepEqual(actual, expected, "concat KDF failure")

// test key cache again
actual = concatKDF( Buffer([148,116,199,126,2,117,233,76,150,149,89,193,61,34,239,
                            226,109,71,59,160,192,140,150,235,106,204,49,176,68,119,
                            13,34,49,19,41,69,5,20,252,145,104,129,137,138,67,23,153,
                            83,81,234,82,247,48,211,41,130,35,124,45,156,249,7,225,168]) )
assert.deepEqual(actual, expected, "concat KDF failure")
*/

/*******************************************************
* Decrypt and Encrypt code
*/

var encryptAxxxCBC = function ( details, cipher, sign, numBytes) {
    
  var cmk = Buffer( b64url.b64( details.credentials.key ), 'base64' )
  if (numBytes != cmk.length) 
    throw new Error("key is not "+numBytes+" long.")    

  var kdf = concatKDF(cmk)

  var plainText = JSON.stringify( details.payload)
  var iv = crypto.randomBytes( 16)
  
  // encrypt
  var cipher = crypto.createCipheriv( cipher, kdf.cek, iv)
  var cipherText = b64url.safe( cipher.update( plainText,'binary','base64'))
  cipherText += b64url.safe( cipher.final( 'base64'))

  // create signature    
  var input = b64url.encode( JSON.stringify( details.header)) +'..'+ b64url.encode(iv) +'.'+ cipherText
  var hmac = crypto.createHmac( sign, kdf.cik).update(input);
  var token = input +'.'+ b64url.safe( hmac.digest('base64'))
  return token;
}

var encryptA128CBC = function ( details) {
  return encryptAxxxCBC( details, 'aes128', 'sha256', 32)
}

var encryptA256CBC = function ( details) {
  return encryptAxxxCBC( details, 'aes256', 'sha512', 64)
}

var encryptAlg =
  { 'A128CBC+HS256': encryptA128CBC
  , 'A256CBC+HS512': encryptA256CBC
  }


var decryptAxxxCBC = function ( input, cmkEncrypted, ivB64url, ciphertextB64url, signature, key, cipher, sign, numBytes) {
  if (cmkEncrypted) 
    throw new Error('Encrypted CMK is not supported in JWE')

  var cmk = Buffer(b64url.b64(key), 'base64')
  if (numBytes != cmk.length) 
    throw new Error("key is not "+numBytes+" long.")

  var kdf = concatKDF(cmk)
  
  var iv = Buffer(b64url.b64(ivB64url), 'base64')
  
  // check integrity
  var hmac = crypto.createHmac(sign, kdf.cik).update(input);
  var inputSignature = b64url.safe(hmac.digest('base64'))
  if (inputSignature != signature) 
    throw new Error("JWE has invalid signature:"+signature)    
  
  // decrypt
  var cipherText = Buffer(b64url.b64(ciphertextB64url), 'base64')
  var decipher = crypto.createDecipheriv( cipher, kdf.cek, iv)
  var plainText = b64url.safe(decipher.update(cipherText,'binary','base64'))
  plainText += b64url.safe(decipher.final('base64'))
  return plainText;
}

var decryptA128CBC = function ( input, cmk, iv, ciphertext, signature, key ) {
  return decryptAxxxCBC( input, cmk, iv, ciphertext, signature, key, 'aes128', 'sha256', 32 )
}


var decryptA256CBC = function ( input, cmk, iv, ciphertext, signature, key) {
  return decryptAxxxCBC( input, cmk, iv, ciphertext, signature, key, 'aes256', 'sha512', 64) 
}

var decryptAlg =
  { 'A128CBC+HS256': decryptA128CBC
  , 'A256CBC+HS512': decryptA256CBC
  }

/********************************************************************
* verify and sign code
*/

var verifyHSxxx = function (input, signature, b64safeKey, alg) {
  var key = Buffer( b64url.b64( b64safeKey ), 'base64' )
  var hmac = crypto.createHmac( alg, key ).update( input )
  var inputSignature = b64url.safe( hmac.digest( 'base64' ) )
  return (inputSignature === signature)
}

var verifyHS256 = function (input, signature, b64safeKey) {
  return verifyHSxxx( input, signature, b64safeKey, 'sha256' )  
}

var verifyHS512 = function (input, signature, b64safeKey) {
  return verifyHSxxx( input, signature, b64safeKey, 'sha512' )  
}

var verifyAlg =
  { 'HS256': verifyHS256
  , 'HS512': verifyHS512
  }

var signHSxxx = function (details, alg) {
  details.header.kid = details.credentials.kid 
  var input = b64url.encode( JSON.stringify( details.header ) ) 
        +'.'+ b64url.encode( JSON.stringify( details.payload ) )
  var key = Buffer( b64url.b64(details.credentials.key), 'base64')
  var hmac = crypto.createHmac(alg, key).update(input);
  var token = input +'.'+ b64url.safe(hmac.digest('base64'))
  return token.toString();
}

var signHS256 = function (details) {
  return signHSxxx( details, 'sha256' )
}

var signHS512 = function (details) {
  return signHSxxx( details, 'sha512' )
}

var signAlg =
    { 'HS256': signHS256
    , 'HS512': signHS512
    }

/********************************************************************
* Exported functions
*/

// make a JWE
function jwe ( details ) {
  if (!details.header)
    throw new Error('No header for JWE token')
  if (!details.header.alg || details.header.alg != 'dir')
    throw new Error('Only "dir" algorithm supported for JWE token')
  if (!details.header.enc)
    throw new Error('No JWE encryption algorithm specified')  
  if (!encryptAlg[details.header.enc])
    throw new Error('Unsupported JWE encryption algorithm:"'+details.header.enc+'"')
  if (!details.payload)
    throw new Error('No payload for JWE token')
  if (!details.credentials)
    throw new Error('No credentials for JWE token')
  if (!details.credentials.kid)
    throw new Error('No credentials.kid for JWE token')
  if (!details.credentials.key)
    throw new Error('No credentials.key for JWE token')
  return encryptAlg[details.header.enc]( details )
}

// make a JWS
function jws ( details ) {
  if (!details.header)
    throw new Error('No header for JWS token')
  if (!details.header.alg)
    throw new Error('No JWS signing algorithm specified')  
  if (!signAlg[details.header.alg])
    throw new Error('Unsupported JWS signing algorithm:"'+details.header.alg+'"')
  if (!details.payload)
    throw new Error('No payload for JWS token')
  if (!details.credentials)
    throw new Error('No credentials for JWS token')
  if (!details.credentials.kid)
    throw new Error('No credentials.kid for JWS token')
  if (!details.credentials.key)
    throw new Error('No credentials.key for JWS token')
  return signAlg[details.header.alg]( details )
}

/*
* parses a JWT and returns an object that can then be 
* verified (JWS) or decrypted (JWE)
*/
function Parse ( token ) {
  if ( typeof token != 'string' )
      throw new Error('JWT must be a string object')

  var parts = token.split('.')

  if (!parts.every(b64url.valid)) 
      throw new Error('JWT contains invalid URL safe Base64 chars')
  try {
    this.header = JSON.parse( b64url.decode( parts[0] ) )
  }
  catch (e) {
      return e
  }
  if (!this.header.typ) 
      throw new Error('No "typ" in JWT header')
  
  if (this.header.typ == 'JWS') {
    try {
      this.payload = JSON.parse( b64url.decode( parts[1] ) )
    }
    catch (e) {
        return e
    }
    this._input = parts[0] +'.'+ parts[1]
    this.signature = parts[2]
    return this      
  
  } else if (this.header.typ == 'JWE') {
    if (parts.length != 5)
      throw new Error('Invalid JWE token, does not have 5 components')
    this._input = parts[0] +'.'+ parts[1] +'.'+ parts[2] +'.'+ parts[3]
    this._cmk = parts[1]
    this._iv = parts[2]
    this._ciphertext = parts[3]
    this.signature = parts[4]
    return this

  } else 
    throw new Error('Uknownn JWT header "typ":"'+header.typ+'"')
}

Parse.prototype.verify = function (key) {
  if (!this.header.alg)
    throw new Error('No algorithm in JWS token')
  if (!verifyAlg[this.header.alg])
    throw new Error('Unsupported algorithm in JWS token:"'+this.header.alg+'"')
  return verifyAlg[this.header.alg]( this._input, this.signature, key)
}

Parse.prototype.decrypt = function (key) {
  if (!this.header.alg)
    throw new Error('No algorithm in JWE token')
  if (this.header.alg != 'dir')
    throw new Error('Unsupported content key algorithm in JWE token:"'+this.header.alg+'"')
  if (!decryptAlg[this.header.enc])
    throw new Error('Unsupported encryption algorithm in JWE token:"'+this.header.enc+'"')
  var plaintext = decryptAlg[this.header.enc]( this._input, this._cmk, this._iv, this._ciphertext, this.signature, key )
  try {
    this.payload = JSON.parse(plaintext)
  }
  catch (e) {
    this.payload = plaintext
  }
  return this.payload
}


// generates a key for the passed algorithm
exports.keygen = function (alg) {
    algs = 
        { 'HS256': 256/8
        , 'HS512': 512/8
        , 'A128CBC+HS256': 256/8
        , 'A256CBC+HS512': 512/8
        };
    if (!algs[alg]) return null;
    return (b64url.encode(crypto.randomBytes(algs[alg])))
}

// generates a session / handle id
exports.handle = function () {
    return (b64url.encode(crypto.randomBytes(16))) // UUID size
}


// generates JWT date/time value
exports.iat = function () {
  return Math.round(new Date().getTime() / 1000)
}

// export functions defined above
exports.Parse = Parse
exports.jwe = jwe
exports.jws = jws

