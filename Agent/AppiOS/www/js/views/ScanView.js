$(function($) {
	'use strict';
	
	window.Agent.ScanView = Backbone.View.extend({
	
	    template:_.template($('#scan').html()),
	
		initialize: function(Opts) {
		},
		
	    render:function (eventName) {
	        $(this.el).html(this.template());
	        window.plugins.barcodeScanner.scan(
                function(result) {
                    if (result.cancelled)
                        alert("the user cancelled the scan")
                    else
                        alert("we got a barcode: " + result.text)
                },
                function(error) {
                    alert("scanning failed: " + error)
                }
            )
	        return this;
	    },
	
		events: {
	    },
	});
});