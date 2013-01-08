#A2P3 Server
====

Authentication &amp; Authorization Privacy Protecting Protocol (A2P3)

There is also the [A2P3 Agent](https://github.com/dickhardt/A2P3_agent)

##Prerequisites
You will need [node](http://nodejs.org/download/) 0.8.* to run the server and a [git](http://git-scm.com/downloads) tool if you want to push changes.


##Installation
	git clone git://github.com/dickhardt/A2P3.git
	# or you can download the zip file from github and unzip it
	cd A2P3
	npm install
This will do the following:

* clone complete repository into an A2P3 directory
* install all the dependant packages
* copy default.config.js to config.js
* bootstrap the development database and create a local set of keys (vault.json files)


##Testing
	npm start
	# change to another terminal
	npm test
	
##Configuration
Edit config.js to change how the servers run.
	
	npm run-script bootstrap
	# or
	node bootstrap.js

Will bootstrap new vaults and database if you have changed relevant settings in config.js
