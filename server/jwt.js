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



var encryptACBC = function ( details, cipher, sign, numBytes) {
    
    // NOTE: we are inlining 'dir' support here for 'alg', no support for RSA1_5 yet
    
    var cmk = Buffer(b64url.b64(details.credentials.key), 'base64')
    if (numBytes != cmk.length) encodeError("key is not "+numBytes+" long.")    

    // NOTE: we are using the same key for encryption and signing
    // waiting for IETF JOSE WG to settle on standard
    var cik = cmk
    var cek = cmk.slice( 0, numBytes/2)
    var plainText = JSON.stringify( details. payload)
    var iv = crypto.randomBytes( 16)
    
    // encrypt
    var cipher = crypto.createCipheriv( cipher, cek, iv)
    var cipherText = b64url.safe( cipher.update( plainText,'binary','base64'))
    cipherText += b64url.safe( cipher.final( 'base64'))

    // create signature    
    var input = b64url.encode( JSON.stringify( details.header)) +'..'+ b64url.encode(iv) +'.'+ cipherText
    var hmac = crypto.createHmac( sign, cik).update(input);
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

    // NOTE: we are using the same key for encryption and signing
    // waiting for IETF JOSE WG to settle on standard
    var cik = cmk
    var cek = cmk.slice(0,numBytes/2)
    
    var iv = Buffer(b64url.b64(ivB64url), 'base64')
    
    // check integrity
    var hmac = crypto.createHmac(sign, cik).update(input);
    var inputSignature = b64url.safe(hmac.digest('base64'))
    if (inputSignature != signature) decodeError("invalid signature:"+signature)    
    
    // decrypt
    var cipherText = Buffer(b64url.b64(ciphertextB64url), 'base64')
    var decipher = crypto.createDecipheriv( cipher, cek, iv)
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
        jws.header = JSON.parse(b64url.decode(parts[0]));
    }
    catch (e) {
        return jwsCrackError(e)
    }
    try {
        jws.payload = JSON.parse(b64url.decode(parts[1]));
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