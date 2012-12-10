$(document).bind("mobileinit", function () {
	//disable JQM router
    $.mobile.ajaxEnabled = false;
    $.mobile.linkBindingEnabled = false;
    $.mobile.hashListeningEnabled = false;
    $.mobile.pushStateEnabled = false;

    // Set default page transitions
    $.mobile.defaultPageTransition = "none"
    //$.mobile.defaultDialogTransition = "none"
                 
    // Remove page from DOM when it's being replaced
    $('div[data-role="page"]').live('pagehide', function (event, ui) {
        $(event.currentTarget).remove();
    });
});

window.Agent = window.Agent || {};
window.Agent.Context = { BaseUrl: 'http://localhost' };

/*
 * Global notification system. Function will use PhoneGap notification if
 * available otherwise we'll use standard JS alert for debugging/testing.
 * Necessary to use PG alert in iOS. Calling JS alert from barcode scan
 * callbacks caused threading error. PG alert handles this threading for us.
 */
window.Agent.Notify = function(message, title, button, callback) {
 	if (navigator.notification != null) {
 		if (!title) title = "Agent";
		navigator.notification.alert(message, callback, title, button);
 	}
 	else {
 		alert(message);
 	}
};




