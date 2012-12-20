$(document).bind("mobileinit", function () {
	//disable JQM router
    $.mobile.ajaxEnabled = false;
    $.mobile.linkBindingEnabled = false;
    $.mobile.hashListeningEnabled = false;
    $.mobile.pushStateEnabled = false;

    // Set default page transitions
    $.mobile.defaultPageTransition = "none"
                 
    // Remove page from DOM when it's being replaced
    $('div[data-role="page"]').live('pagehide', function (event, ui) {
        $(event.currentTarget).remove();
    });
    
    
});

window.Agent = window.Agent || {};
window.Agent.Context = { BaseUrl: 'http://localhost' };

// Register device for push notifications
var pushNotification = window.plugins.pushNotification;
pushNotification.registerDevice({alert:true, badge:true, sound:true}, function(status) {
    console.log(JSON.stringify(['registerDevice status: ', status])+"\n");
    //app.storeToken(status.deviceToken);
});

// And test if registration is scuessful
var pushNotification = window.plugins.pushNotification;
pushNotification.getRemoteNotificationStatus(function(status) {
    console.log(JSON.stringify(['Registration check - getRemoteNotificationStatus', status])+"\n");
});

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

/*
 * Javascript function called by Cordova from handleOpenURL delegate.
 * In the iOS Agent, the custom URL schema ix.a2p3.net is registered in the XCode Info.plist.
 * You cannot launch any interactive features like alerts in the handleOpenURL code, 
 * if you do, your app will hang. Similarly, you should not call any Cordova APIs in 
 * there, unless you wrap it first in a setTimeout call, with a timeout value of zero
 *  */
function handleOpenURL(url) {
	
	setTimeout(function() {
	    window.Agent.Notify("Url (count:" + url.length + ") = " + url, "Incoming Request", null, null);
	    //window.Agent.AppRouter.agentrequest();
	}, 0);
	
}



