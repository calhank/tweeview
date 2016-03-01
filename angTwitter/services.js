angular.module('tweeView.services', []).factory('twitterService', function($q) {

	var authorizationResult = false; 

	return {

		initialize: function() {

			// Oath token 
			OAuth.initialize('TnygAuf2tATXzc6uoAxAf60Imuw', {
				cache: true
			});

			// Creates authorization result (no-reclick)
			authorizationResult = OAuth.create('twitter');

		}, 

		isReady: function() {
			return (authorizationResult);
		}, 

		connectTwitter: function() {

			var deferred = $q.defer(); 

			OAuth.popup('twitter', {
				cache: true
			
			}, function(error, result) {

				// cache executes callback if tokens are present 
				if (!error) {

					authorizationResult = result; 
					deferred.resolve();

				} else {

					console.log(error)

				}

			});

			return deferred.promise;

		}, 

		clearCache: function() {

			OAuth.clearCache('twitter');
			authorizationResult = false; 

		}, 

		getLatestTweets: function(maxId) {

			// create deferred object 
			var deferred = $q.defer(); 

			var url = '/1.1/statuses/home_timeline.json';

			if (maxId) {

				url += '?max_id=' + maxId;

			}

			var promise = authorizationResult.get(url).done(function(data) {

				// https://dev.twitter.com/docs/api/1.1/get/statuses/home_timeline
                // when the data is retrieved resolve the deferred object

                deferred.resolve(data)

			}).fail(function(err) {

				deferred.reject(err);

			});

			return deferred.promise; 

		}
		


	}


});