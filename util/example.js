

var a = require('./agent')
var agent = new a.Create()

agent.generate( null, function ( e ) {
  if (e) console.log( e )
  console.log( agent )
})