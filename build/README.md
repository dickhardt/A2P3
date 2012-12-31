# build
Build and deploy scripts for A2P3 servers.
## install.js
Called during `npm install`. Creates local app/config.js from default.config.js. Edit config.js to change local behaviour.
## pretest.js
Checks that server is running before running mocha tests.
## bootstrap.js
Bootstraps the A2P3 servers. Generates keys between all POC servers and registars Apps in respective Databases. Edit app/config.js to change where servers are hosted. Rerunning `npm install` will rerun bootstrap.js.