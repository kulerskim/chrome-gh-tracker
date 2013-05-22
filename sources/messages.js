chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
	
	//let in only this extension
	if(sender.id!=chrome.i18n.getMessage("@@extension_id"))
	    return;
	
	//send config, for it's only API and token
	if (request.config)
	    sendResponse({
		api: "http://www.pivotaltracker.com/services/v3",
		token:   localStorage["token"]
	    });
    });