$(function($) {
	'use strict';
	
	window.Agent.A2P3AgentRequestView = Backbone.View.extend({
	
	    template:_.template($('#a2p3agentrequest').html()),
	
		initialize: function(Opts) {
		},
		
	    render:function (eventName) {
	        $(this.el).html(this.template());
	        return this;
	    },
	
		events: {
	    },
	});
});