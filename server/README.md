A2P3 Server
====

Authentication &amp; Authorization Privacy Protecting Protocol (A2P3)

##Configuration
You will need to have [node](http://nodejs.org/download/) 0.8.* and [git](http://git-scm.com/downloads)


##Installation
	git clone git@github.com:dickhardt/A2P3.git
	cd A2P3\server
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