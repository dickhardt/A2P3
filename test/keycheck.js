/*
* keycheck.js
*
* checks keys are consistent
*
* Copyright (C) Province of British Columbia, 2013
*/
// Mocha globals to expect
/*global describe:true, it:true */

var config = require('../app/config')
  , should = require('chai').should()
  , fetch = require('request')

var relationships = {}

function check ( iss, aud ) {
  describe('Checking if "'+iss+'" and "'+aud+'" share keys', function () {
    it('should be true', function ( done ) {  // change to be result in matrix
      var options =
        { url: config.baseUrl[iss] + '/key/check'
        , method: 'POST'
        , form: { pass: 'makeitso', host: aud }
        , followRedirect: false
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 200 )
        should.exist( body )
        var r = JSON.parse( body )
        should.exist( r )
        relationships[iss] = relationships[iss] || {}
        relationships[iss][aud] = r.result && r.result.success
        r.should.not.have.property( 'error' )
        r.should.have.property( 'result' )
        r.result.should.have.property( 'success', true )
        done( null )
      })
    })
  })
}

function goCheck () {
  Object.keys( relationships ).forEach( function ( iss ) {
    Object.keys( relationships[iss] ).forEach( function ( aud ) {
      check( iss, aud )
    })
  })
}

relationships =
{ ix:
   { registrar: true,
     as: true,
     setup: true },
  registrar:
   { ix: true,
     setup: true,
     si: true,
     people: true,
     health: true,
     email: true,
     'people.ab': true,
     'health.ab': true,
     'people.bc': true,
     'health.bc': true,
     'people.mb': true,
     'health.mb': true,
     'people.nb': true,
     'health.nb': true,
     'people.nl': true,
     'health.nl': true,
     'people.ns': true,
     'health.ns': true,
     'people.nt': true,
     'health.nt': true,
     'people.nu': true,
     'health.nu': true,
     'people.on': true,
     'health.on': true,
     'people.pe': true,
     'health.pe': true,
     'people.qc': true,
     'health.qc': true,
     'people.sk': true,
     'health.sk': true,
     'people.yt': true,
     'health.yt': true },
  as:
   { ix: true,
     setup: true },
  setup:
   { ix: true,
     registrar: true,
     as: true,
     si: true,
     people: true,
     health: true,
     email: true,
     'people.ab': true,
     'health.ab': true,
     'people.bc': true,
     'health.bc': true,
     'people.mb': true,
     'health.mb': true,
     'people.nb': true,
     'health.nb': true,
     'people.nl': true,
     'health.nl': true,
     'people.ns': true,
     'health.ns': true,
     'people.nt': true,
     'health.nt': true,
     'people.nu': true,
     'health.nu': true,
     'people.on': true,
     'health.on': true,
     'people.pe': true,
     'health.pe': true,
     'people.qc': true,
     'health.qc': true,
     'people.sk': true,
     'health.sk': true,
     'people.yt': true,
     'health.yt': true },
  si: {
     registrar: true,
     setup: true,
     email: true },
  people: {
     registrar: true,
     setup: true,
     email: true,
     'people.ab': true,
     'people.bc': true,
     'people.mb': true,
     'people.nb': true,
     'people.nl': true,
     'people.ns': true,
     'people.nt': true,
     'people.nu': true,
     'people.on': true,
     'people.pe': true,
     'people.qc': true,
     'people.sk': true,
     'people.yt': true },
  health: {
     registrar: true,
     setup: true,
     email: true,
     'health.ab': true,
     'health.bc': true,
     'health.mb': true,
     'health.nb': true,
     'health.nl': true,
     'health.ns': true,
     'health.nt': true,
     'health.nu': true,
     'health.on': true,
     'health.pe': true,
     'health.qc': true,
     'health.sk': true,
     'health.yt': true },
  email: {
     registrar: true,
     setup: true,
     si: true,
     people: true,
     health: true,
     'people.ab': true,
     'health.ab': true,
     'people.bc': true,
     'health.bc': true,
     'people.mb': true,
     'health.mb': true,
     'people.nb': true,
     'health.nb': true,
     'people.nl': true,
     'health.nl': true,
     'people.ns': true,
     'health.ns': true,
     'people.nt': true,
     'health.nt': true,
     'people.nu': true,
     'health.nu': true,
     'people.on': true,
     'health.on': true,
     'people.pe': true,
     'health.pe': true,
     'people.qc': true,
     'health.qc': true,
     'people.sk': true,
     'health.sk': true,
     'people.yt': true,
     'health.yt': true },
  'people.ab': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.ab': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.bc': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.bc': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.mb': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.mb': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.nb': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.nb': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.nl': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.nl': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.ns': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.ns': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.nt': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.nt': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.nu': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.nu': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.on': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.on': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.pe': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.pe': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.qc': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.qc': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.sk': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.sk': {
     registrar: true,
     setup: true,
     health: true,
     email: true },
  'people.yt': {
     registrar: true,
     setup: true,
     people: true,
     email: true },
  'health.yt': {
     registrar: true,
     setup: true,
     health: true,
     email: true } }

goCheck()
