/*
*
*
*
*/

var crypto = require('crypto');


/*
*    URL Safe Base64 routines.
*/
var b64url = require("./b64url")


/* 

refactor code

split into jws and jwe 

parse - return a JWT object (or should we do JWE and JWS separately?)

    verify(key)
    decrypt(key)

jwe - make jwe
jws - make jws

*/



/*
*   Error Functions
*/
var dumpStack = function () {
    var stack = new Error().stack
    console.error( stack )
}

var decodeError = function(message) {
    dumpStack()
    throw("JWT decode ERROR:"+message)
}

var encodeError = function(message) {
    dumpStack()
    throw("JWT encode ERROR:"+message)
}

var headerError = function(message) {
    dumpStack()
    throw("JWT header ERROR:"+message)
}

var jwsCrackError = function(message) {
    dumpStack()
    throw("JWT JWS Crack ERROR:"+message)
}

/*
*   JWS signing and verifying functions
*/


var signHS256 = function (details, input) {
    var key = Buffer( b64url.b64(details.credentials.key), 'base64')
    var hmac = crypto.createHmac('sha256', key).update(input);
    var token = input +'.'+ b64url.safe(hmac.digest('base64'))
    return token;
}

var verifyHS256 = function (header, input, signature, credentials) {
    if (!credentials.key) decodeError('no credentials.key value')
    var key = Buffer( b64url.b64(credentials.key), 'base64')
    var hmac = crypto.createHmac('sha256', key).update(input);
    var inputSignature = b64url.safe(hmac.digest('base64'))
    return (inputSignature === signature);    
}

var signHS512 = function (details, input) {
    var key = Buffer( b64url.b64(details.credentials.key), 'base64')
    var hmac = crypto.createHmac( 'sha512', key).update(input);
    var token = input +'.'+ b64url.safe(hmac.digest('base64'))
    return token;
}

var verifyHS512 = function (header, input, signature, credentials) {
    if (!credentials.key) decodeError('no credentials.key value')
    var key = Buffer( b64url.b64(credentials.key), 'base64')
    var hmac = crypto.createHmac('sha512', key).update(input);
    var inputSignature = b64url.safe(hmac.digest('base64'))
    return (inputSignature === signature);    
}

/*
*   JWE encrypting and decrypting functions
*/

var signJWS =
    { 'HS256': signHS256
    , 'HS512': signHS512
    }

var verifyJWS =
    { 'HS256': verifyHS256
    , 'HS512': verifyHS512
    , 'none': function () {return true;}
    }

var encryptCMK =
    { 'RSA1_5' : null   // TBD
    , 'dir': function () {return "";}
    };

var decryptCMK =
    { 'RSA1_5' : null   // TBD
    , 'dir': function () {return "";}
    };

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


var encryptACBC = function ( details, cipher, sign, numBytes) {
    
    // NOTE: we are inlining 'dir' support here for 'alg', no support for RSA1_5 yet
    
    var cmk = Buffer(b64url.b64(details.credentials.key), 'base64')
    if (numBytes != cmk.length) encodeError("key is not "+numBytes+" long.")    

    var kdf = concatKDF(cmk)
 
    var plainText = JSON.stringify( details. payload)
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
    return encryptACBC( details, 'aes128', 'sha256', 32)
}

var encryptA256CBC = function ( details) {
    return encryptACBC( details, 'aes256', 'sha512', 64)
}

var decryptACBC = function ( header, input, cmkEncrypted, ivB64url, ciphertextB64url, signature, credentials, cipher, sign, numBytes) {
    
    // NOTE: we are inlining 'dir' support here for 'alg', no support for RSA1_5 yet
    
    var cmk = Buffer(b64url.b64(credentials.key), 'base64')
    if (numBytes != cmk.length) encodeError("key is not "+numBytes+" long.")    

    var kdf = concatKDF(cmk)
    
    var iv = Buffer(b64url.b64(ivB64url), 'base64')
    
    // check integrity
    var hmac = crypto.createHmac(sign, kdf.cik).update(input);
    var inputSignature = b64url.safe(hmac.digest('base64'))
    if (inputSignature != signature) decodeError("invalid signature:"+signature)    
    
    // decrypt
    var cipherText = Buffer(b64url.b64(ciphertextB64url), 'base64')
    var decipher = crypto.createDecipheriv( cipher, kdf.cek, iv)
    var plainText = b64url.safe(decipher.update(cipherText,'binary','base64'))
    plainText += b64url.safe(decipher.final('base64'))
    return plainText;
}

var decryptA128CBC = function (header, input, cmk, iv, ciphertext, signature, credentials) {
    return decryptACBC( header, input, cmk, iv, ciphertext, signature, credentials, 'aes128', 'sha256', 32)
}


var decryptA256CBC = function (header, input, cmk, iv, ciphertext, signature, credentials) {
    return decryptACBC( header, input, cmk, iv, ciphertext, signature, credentials, 'aes256', 'sha512', 64)
}


var encryptJWE =
    { 'A128CBC+HS256': encryptA128CBC
    , 'A256CBC+HS512': encryptA256CBC
    }

var decryptJWE =
    { 'A128CBC+HS256': decryptA128CBC
    , 'A256CBC+HS512': decryptA256CBC
    }


/****************************************************************************
Exported functions
****************************************************************************/

/*
* generates a key for the passed algorithm
*/
exports.keygen = function (alg) {
    algs = 
        { 'HS256': 32
        , 'HS512': 64
        , 'A128CBC+HS256': 32
        , 'A256CBC+HS512': 64
        };
    if (!algs[alg]) return null;
    return (b64url.encode(crypto.randomBytes(algs[alg])))
}


exports.iat = function () {
  return Math.round(new Date().getTime() / 1000)
}

exports.encode = function (details) {

    if (!details.header) return encodeError('header must be provided')
    if (!details.payload) return encodeError('payload must be provided')
    var header = details.header
    var payload = details.payload
        
    // deal with plain JWT
    if (header.alg === 'none') {
        return ( b64url.encode(JSON.stringify(header)) +'.'+ b64url.encode(JSON.stringify(payload)) )
    }
    
    if (!details.credentials) return encodeError('credentials must be provided')

    // check we support alg and enc
    if (!header.alg) return encodeError('no "alg" in header')
    if (header.enc) { // payload will be encrypted
        if (!encryptCMK[header.alg]) return encodeError('unsupported CMK algorithm:"'+header.alg+'"')
        if (!encryptJWE[header.enc]) return encodeError('unsupported encrypt algorithm:"'+header.enc+'"')
    } else {
        if (!signJWS[header.alg]) return encodeError('unsupported algorithm:"'+header.alg+'"')
    }
    
    // create the token
    if (header.enc) {   // encrypt payload
        return encryptJWE[header.enc](details)
    } else {            // sign payload
        var input = null
        if (details.headerBytes && details.payloadBytes) // used to pass specific bytes in for testing
            input = b64url.encode(details.headerBytes) +'.'+ b64url.encode(details.payloadBytes);
        else
            input = b64url.encode(JSON.stringify(header)) +'.'+ b64url.encode(JSON.stringify(payload));
        return (signJWS[header.alg]( details, input))
    }

};

exports.decode = function (token, getCreds) {

    
    // parse token
    var parts = token.split('.');
    if (!parts.every(b64url.valid)) decodeError('token contains invalid URL safe base 64 character(s)')

    try {
        var header = JSON.parse(b64url.decode(parts[0]));
    }
    catch (e) {
        return decodeError('token header is not valid JSON')
    }
    
    // check we support alg and enc
    if (!header.alg) return decodeError('no "alg" in header')
    if (header.enc) { // payload is encrypted
        if (!decryptJWE[header.enc]) return decodeError('unsupported algorithm:"'+header.alg+'"')
        if (!decryptCMK[header.alg]) return decodeError('unsupported CMK algorithm:"'+header.alg+'"')
    } else {
        if (!verifyJWS[header.alg]) return decodeError('unsupported algorithm:"'+header.alg+'"')
    }
    
    // get credentials from caller
    var credentials = getCreds(header)
    if (header.alg != 'none' && !credentials) return decodeError('no key returned for:'+JSON.stringify(header))
    
    // decrypt or verify
    var payload = ""
    if (header.enc) { // token is encrypted
        var signature = parts[4]
        var input = parts[0] +'.'+ parts[1] +'.'+ parts[2] +'.'+ parts[3]
        var cmk = parts[1]
        var iv = parts[2]
        var ciphertext = parts[3]
        
        payload = decryptJWE[header.enc]( header, input, cmk, iv, ciphertext, signature, credentials)

    } else { // verify
        var signature = parts[2]
        var input = parts[0] + '.' + parts[1]
        
        if (!verifyJWS[header.alg]( header, input, signature, credentials))
            return decodeError('invalid signature:"'+signature+'"')
        
        payload = b64url.decode(parts[1])
    }

    try { // try to parse payload
        payload = JSON.parse(payload);
    }
    catch (e) {
        // leave payload as it is
    }
    return payload

};

exports.header = function (token) {
    var parts = token.split('.');
    if (!parts.every(b64url.valid)) headerError('token contains invalid URL safe base 64 character(s)')

    try {
        var header = JSON.parse(b64url.decode(parts[0]));
        return header;
    }
    catch (e) {
        return headerError('token header is not valid JSON')
    }
}

exports.jwsCrack = function (token) {
    var parts = token.split('.');
    if (!parts.every(b64url.valid)) jwsCrackError('token contains invalid URL safe base 64 character(s)')

    var jws = {}
    try {
        var header = b64url.decode( parts[0] )
        jws.header = JSON.parse( header );
    }
    catch (e) {
        return jwsCrackError(e)
    }
    try {
        var payload = b64url.decode( parts[1] )
        jws.payload = JSON.parse( payload );
    }
    catch (e) {
        return jwsCrackError(e)
    }
    jws.signature = parts[2]
    
    return jws;
}

/*
var JWT_ALGORITHM = 'HS256';
var OPENSSL_ALGORITHM = 'sha256';

var sign = function (token, key) {
  var hmac = crypto.createHmac(OPENSSL_ALGORITHM, key).update(token);
  return b64url.safe(hmac.digest('base64'));
};

exports.stringify = function (header, payload, key) {
  if (header.alg != JWT_ALGORITHM) throw ('unsupported JWT algorithm'); 
  if (header.typ && (header.typ != 'JWT')) throw ('unsupported JWT header type'); 
  if (!key) throw ('a key must be provided');
    
  header.typ = 'JWT'; 
  header.iss = Math.round(Date.now() / 1000);
  
  var token = b64url.encode(JSON.stringify(header)) + '.' + b64url.encode(JSON.stringify(payload));
  
  return token + '.' + sign(token, key);
};

exports.parse = function (token, key, ttl) {
    if (!key) throw ('key required');
    if (!token) throw ('token required');
    if (!ttl) var ttl = 5 * 60; // default expiry of token is 5 minutes
    
    var parts = token.split('.');
    var headerB64 = parts[0], 
        payloadB64 = parts[1], 
        signature = parts[2];
    
    var header = JSON.parse(b64url.decode(headerB64));
    var payload = JSON.parse(b64url.decode(payloadB64));
    
  if (header.typ != 'JWT') throw ('unsupported JWT header type'); 
  if (header.alg != JWT_ALGORITHM) throw ('unsupported JWT algorithm'); 
    if (!header.iss || ((header.iss + ttl) < Math.round(Date.now() / 1000))) throw ('expired token');
    if (signature != sign(headerB64 + '.' + payloadB64, key)) throw ('invalid signature');
    
    return ({'header':header,'payload':payload});
}

*/