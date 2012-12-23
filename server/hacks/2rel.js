var querystring = require('querystring')
console.log( querystring.parse('foo=bar&rel=token1&rel=token2') )
console.log( querystring.stringify({'foo':'bar','rel':['token1','token2']}))
