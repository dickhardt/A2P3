/* 
* Setup Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , config = require('config')




if (config.facebook.appID) {  // Facebook is configured

}


exports.app = function() {
	var app = express()
	app.get("/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from the Setup!';
	    res.send(html);    
	});
	return app
}
