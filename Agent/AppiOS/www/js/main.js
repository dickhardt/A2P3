$(document).ready(function () {
    console.log('main begin');
	session = new window.Agent.Session(); 
    app = new window.Agent.AppRouter();
    Backbone.history.start();
	console.log('main end');
});


