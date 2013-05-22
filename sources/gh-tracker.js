/**
 * Main content script
 *
 **/
(function(){
    
    this.config = {};
    this.project = "";
    //this.storyIdRE = new RegExp(/\[[^\]]*#([0-9]{4,})\]/i)
    this.storyIdRE = new RegExp(/([0-9]{7,})/) //less restrictive
    
    /*inits content script when received config*/
    this.init = function(config){
	
	this.config = config;
	if(!this.config.token)
	    return;
	
	//try to match PT project id
	this.callPivotal("/projects",
	{
	    success: jQuery.proxy(this.fetchProjectList, this),
	    async: false
	}
	);
    }
    
    /*inits when PT project found*/
    this.initProject = function(){
	//insert PT project link
	
	$("h1").append("<a class='pt-info' href='https://www.pivotaltracker.com/s/projects/"+this.project+"'>&nbsp;</a>");

	$(".commit-title .message, .branches .name h3").each(jQuery.proxy(function(i, el){
	  el = $(el);
	  matches = this.storyIdRE.exec(el.html())
	  if(!matches)
	      return;
	  if(el.is("A"))
	    el.after(this.getStoryLink(matches[1]));  
	  else
	    el.append(this.getStoryLink(matches[1]));  
	},this));
      
	//run on new pull request page
	if($('.new-pull-request').length){
	    this.pullRequest = {
		base: null, 
		head: null,
		story: null
	    }
	    this.reloadPullRequest();
	    $(document).on("click","#new_pull_request button[type=submit]",null,jQuery.proxy(this.newPullRequest, this));    
	    $(document).on("click","button.pt-start-story",null,jQuery.proxy(this.startPullRequestStory, this));      
	    this.pullRequestBranchObserver = new MutationObserver(jQuery.proxy(this.pullRequestMutationCallback, this));      
	    this.pullRequestBranchObserver.observe($('#js-repo-pjax-container').get(0),{
		childList: true
	    });
	}
	//run on merge pull request page
	if($('#js-pull-merging').length){
	    $(document).on("click","button.merge-branch-action",null,jQuery.proxy(this.mergePullRequest, this));
	}
		
    }
  
    this.callPivotal = function(call, options) {
	if(!options.url)
	    options.url = this.config.api+call;
	if(!options.headers)
	    options.headers = {}    
	options.headers["X-TrackerToken"] = this.config.token
    
	return jQuery.ajax(options);
    };

    /*Run on successfuly received project list*/
    this.fetchProjectList = function(data){
	proid = 0;
	reponame = $(".js-current-repository").text().toLowerCase();
	$(data).find("project > name").each(function(i, el){
	    if($(this).text().toLowerCase()==reponame){
		proid = $(this).parent().children("id").text();
		return false;
	    }
	})
	if(proid){
	    this.project = proid
	    this.projectName = reponame
	    this.initProject();
	}
    }

    this.getStoryLink = function(storyId){
	return $("<a class='pt-lnk pt-info' href='https://www.pivotaltracker.com/story/show/" + storyId + "'></a>");
    }

    /*Returns numeric story id parsed from given branchName or false*/
    this.getStoryIdFromBranchName = function(branchName){
	ret = branchName.replace(/.*?([0-9]{6,}).*/gi,"$1");
	return isFinite(ret) ? ret : false;
    }
  
    /*Returns fetched story object*/
    this.getStory = function(storyId){
	story = false;
	r=this.callPivotal("/projects/"+this.project+"/stories/"+storyId,
	{
	    success: function(data){
		story = {
		    id: $(data).find('story > id').text() * 1,
		    state: $(data).find('story > current_state').text()
		}
	    },
	    async: false
	}
	);
	return story;
    }
  
    /*Saves story object*/
    this.saveStory = function(story){
	r=this.callPivotal("/projects/"+this.project+"/stories/"+story.id,
	{
	    type: "PUT",
	    data: {
		"story[current_state]": story.state
	    },
	    async: false
	}
	);
        
	return r.status==200
    }

    /*Callback for mutation observer*/
    this.pullRequestMutationCallback = function(mutations) {
	mutations.forEach(function(mutation) {
	    if(mutation.addedNodes.length){        
		this.reloadPullRequest();        
	    }            
	});    
    }
  
    /*Refreshes extension options on new pull request page*/
    this.reloadPullRequest = function(){
    
	$(".pt-message, .pt-story").remove();  
    
	this.pullRequest.base = $('.js-select-button[title^="base branch"]').text().trim()
	this.pullRequest.head = $('.js-select-button[title^="head branch"]').text().trim()
	storyId = this.getStoryIdFromBranchName(this.pullRequest.head);
	this.pullRequest.story = storyId ? this.getStory(storyId) : false;
            
	if(this.pullRequest.story==false)
	    msg = "Could not determine PT story for this branch";
	else{
	    $('.js-select-button[title^="head branch"]').after("<span class='pt-story pt-info'>"+this.pullRequest.story.state+"</span>")    
	    switch(this.pullRequest.story.state){
		case "unstarted":
		    msg = "PT story is not started, <button class='pt-start-story button'>Start story first</button>";
		    break;
		case "started":
		    msg = "PT story will be finished automatically";
		    break;
		default:
		    msg = "PT story will not be finished, it's state is "+this.pullRequest.story.state
	    }
	}
	if(this.pullRequest.base == "develop")
	    $("#new_pull_request button[type=submit]").before("<span class='pt-message pt-info'>"+msg+"</span>");  
    }
  
    /*sets pull request story as started*/
    this.startPullRequestStory = function(e){
	if(this.pullRequest.story && 
	    (this.pullRequest.story.state=='unstarted' || this.pullRequest.story.state=='rejected')){
	    this.pullRequest.story.state = "started"
	    if(this.saveStory(this.pullRequest.story))
		this.reloadPullRequest();
	    else
		alert("Problem with starting story, do it manually and reload page");        
	}
    }
  
    /*on new pull request sets story as finished*/
    this.newPullRequest = function(e){
	if(this.pullRequest.base=='develop' && this.pullRequest.story && this.pullRequest.story.state=='started'){
	    this.pullRequest.story.state = "finished"
	    if(!this.saveStory(this.pullRequest.story))
		return confirm("Could not set finish state on Pivotal Tracker, continue?")        
	}
    }

    /*on merge pull request sets commit message to be delivered*/
    this.mergePullRequest = function(e){
	storyId = this.getStoryIdFromBranchName($(".pull-description .commit-ref:not(:first)").text().trim())
	if(storyId)
	    $(".merge-commit-message").val($(".merge-commit-message").val()+"\n[Delivers #"+storyId+"]")    
    }      
    
    //request for config and init on receive
    chrome.runtime.sendMessage({config: true}, jQuery.proxy(this.init, this));
    
})()