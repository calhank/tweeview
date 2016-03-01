app.controller('TwitterController', function($scope, $q, twitterService) {

	$scope.tweets = [];

	twitterService.initialize(); 

	// Get 20 latest tweets 
	$scope.refreshTimeline = function(maxId) {

		twitterService.getLatestTweets(maxId).then(function(data) {

			$scope.tweets = $scope.tweets.concat(data);

		}, function() {

			$scope.rateLimitError = true; 

		});

	}



	// When clicking on the twitter button, pop-up window opens 
	$scope.connectButton = function() {

		twitterService.connectTwitter().then(function() {

			if (twitterService.isReady()) {

				// hide connect button if successful 
				$('#connectButton').fadeOut(function() {

					$('#getTimelineButton', '#signOut').fadeIn(); 
					$scope.refreshTimeline(); 
					$scope.connectedTwitter = true; 

				});

			} else {



			}

		});

	}


	// sign out clears the cache 
	$scope.signOut = function() {

		twitterService.clearCache();

		$scope.tweets.length = 0; 

		$('#getTimelineButton, #signOut').fadeOut(function() {

			$('#connectButton').fadeIn();
			$scope.$apply(function() {

				$scope.connectedTwitter = false;

			})

		});

	}

	// returning users don't have to sign in. 
	if (twitterService.isReady()) {

		$('#connectButton').hide(); 
		$('#getTimelineButton, #signOut').show(); 

		$scope.connectedTwitter = true; 
		$scope.refreshTimeline(); 

	}

});