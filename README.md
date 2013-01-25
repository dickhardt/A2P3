#A2P3 Server
====

Authentication &amp; Authorization Privacy Protecting Protocol (A2P3)

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

## Related

[A2P3 project home page](http://www.a2p3.net)

[A2P3](https://github.com/dickhardt/A2P3) POC Server implementation source (node.js)

[A2P3_agent](https://github.com/dickhardt/A2P3_agent) POC mobile agent (PhoneGap)

[A2P3_bank](https://github.com/dickhardt/A2P3_bank) POC mobile bank app (PhoneGap)

[node-a2p3](https://github.com/dickhardt/node-a2p3) node.js npm module for A2P3 applications

[sample-node-a2p3](https://github.com/dickhardt/sample-node-a2p3) sample A2P3 application using node-a2p3
