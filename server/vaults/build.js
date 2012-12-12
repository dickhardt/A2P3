/*
*	build.js: builds core vault files using passed base domain name
*
* Copyright (C) Province of British Columbia 2013
*/

var b64url = require('../b64url')
	, crypto = require('crypto')
	, fs = require('fs')
	, util = require('util')

if (!process.argv[2]) {
	console.error("Usage: build <base domain>")
	process.exit(1)
}

var base = process.argv[2]

var hosts = 
	{ 'ix': {}
	, 'registrar': {}
	, 'as': {}
	, 'setup': {}
	}

var key
	, kid
	, bytesKey = 64 // TBD: rewrite to use config.alg.JWE and jwt.makeKey()
	, bytesKid = 12
	, vault
	, header = "// GENERATED FILE :: DO NOT EDIT\n\nexports.keys = \n"

// ix:as key pair
key = b64url.safe( crypto.randomBytes( bytesKey ).toString('base64') )
kid = b64url.safe( crypto.randomBytes( bytesKid ).toString('base64') )

hosts.ix['as.'+base] = {latest: {}}
hosts.ix['as.'+base].latest.key = key
hosts.ix['as.'+base].latest.kid = kid
hosts.ix['as.'+base][kid] = key

hosts.as['ix.'+base] = {latest: {}}
hosts.as['ix.'+base].latest.key = key
hosts.as['ix.'+base].latest.kid = kid
hosts.as['ix.'+base][kid] = key

// ix:registrar key pair
key = b64url.safe( crypto.randomBytes( bytesKey ).toString('base64') )
kid = b64url.safe( crypto.randomBytes( bytesKid ).toString('base64') )

hosts.ix['registrar.'+base] = {latest: {}}
hosts.ix['registrar.'+base].latest.key = key
hosts.ix['registrar.'+base].latest.kid = kid
hosts.ix['registrar.'+base][kid] = key

hosts.registrar['ix.'+base] = {latest: {}}
hosts.registrar['ix.'+base].latest.key = key
hosts.registrar['ix.'+base].latest.kid = kid
hosts.registrar['ix.'+base][kid] = key

// ix:setup key pair
key = b64url.safe( crypto.randomBytes( bytesKey ).toString('base64') )
kid = b64url.safe( crypto.randomBytes( bytesKid ).toString('base64') )

hosts.ix['setup.'+base] = {latest: {}}
hosts.ix['setup.'+base].latest.key = key
hosts.ix['setup.'+base].latest.kid = kid
hosts.ix['setup.'+base][kid] = key

hosts.setup['ix.'+base] = {latest: {}}
hosts.setup['ix.'+base].latest.key = key
hosts.setup['ix.'+base].latest.kid = kid
hosts.setup['ix.'+base][kid] = key

// make directory for vault files
if (!fs.existsSync(base)) fs.mkdirSync(base)

vault = header + util.inspect( hosts.ix, false, null )
fs.writeFileSync( base + '/ix.' + base + '.vault.js', vault )

vault = header + util.inspect( hosts.as, false, null )
fs.writeFileSync( base + '/as.' + base + '.vault.js', vault )

vault = header + util.inspect( hosts.registrar, false, null )
fs.writeFileSync( base + '/registrar.' + base + '.vault.js', vault )

vault = header + util.inspect( hosts.setup, false, null )
fs.writeFileSync( base + '/setup.' + base + '.vault.js', vault )

