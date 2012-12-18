$(function($) {
	'use strict';
	
	window.Agent.AuthzView = Backbone.View.extend({
	
	    template:_.template($('#authz').html()),
	
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