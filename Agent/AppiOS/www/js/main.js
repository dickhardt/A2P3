$(document).ready(function () {
    console.log('document ready');
	session = new window.Agent.Session(); 

    app = new window.Agent.AppRouter();
    Backbone.history.start();

});


