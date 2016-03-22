from flask import Flask, render_template, request 
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from collections import defaultdict 
from time import sleep 
import json 
import re

# app = Flask(__name__)
# app.config.from_object(__name__)


keys = {
	
	'consumer_key': '71flBi0ZpYPlFniaYNYKxcJQw'
	, 'consumer_secret': 'wOjII61YDpR6O6xeQSCCQyJKg7J2VFNeDTKlMb0IIrceev6qWS'
	, 'access_token': '4049153049-dvIR146fp9WYheDJfnEqZ1D0GuZVY8H9ZHum5yd'
	, 'access_token_secret': 'KaXRrae7ashpafyEsDLAPDpWrCQ6Wu5FuqJ0N104oAEBa'

}

# regex
hashtag_re = re.compile(r'#\w\w+')
# at_re = re.compile(r'#\w\w+')

# data
hashtags = {}
total_count = {"ct": 0}
global_sentiment = list()
recent_sentiment = list()

class MyStreamListener(tweepy.StreamListener):

	""" Overrides the default streaming settings. """

	def on_status(self, status):

		""" Append sentiment values of each tweet to a size-limited array. """

		tweet = status.text.encode('utf-8')
		match = hashtag_re.findall(tweet)
		score = sentiment(tweet)
		total_count['ct'] += 1

		# try:

		for m in match:
			# m = m[1:]# strip hash
			try:
				hashtags[m]["count"] += 1
				hashtags[m]["sentiment"] = ( ( hashtags[m]["sentiment"] * (hashtags[m]["count"] - 1)) + score["compound"] ) / hashtags[m]["count"]
				# hashtags[m]["sentiment"]["pos"] += score["pos"]
				# hashtags[m]["sentiment"]["neg"] += score["neg"]
			except KeyError:
				hashtags[m] = {"count": 1, "sentiment": score['compound'] }
				# hashtags[m] = {"count": 1, "sentiment": {"pos": score['pos'], "neg":score['neg']} }

		if abs(score["compound"]) > 0.0:
			if len(global_sentiment) > 500: global_sentiment.pop(0)
			global_sentiment.append(score["compound"])
			recent_sentiment.append(score["compound"])

		if len(hashtags) > 10:
			with open("doop.txt", 'w') as file_out:
				print("dumping hashtags")
				json.dump(hashtags, file_out)
			return False

		# except Exception as e:
		# 	print e
		# 	pass


	def on_error(self, status_code):

		""" Kill stream on error. """

		if status_code == '420':
			return False 


def startStream(): 

	""" This begins the twitter stream. """ 

	# Twitter authentication 
	auth = tweepy.OAuthHandler(keys['consumer_key'], keys['consumer_secret'])
	auth.set_access_token(keys['access_token'], keys['access_token_secret'])

	api = tweepy.API(auth)

	myStream = tweepy.Stream(auth=api.auth, listener=MyStreamListener())

	# Non-blocking 
	# myStream.filter(languages=["en"], track=['apple', 'microsoft', 'google', 'sanders','clinton','trump','debate'], async=True)
	myStream.sample(async=True)

print("starting stream")

startStream()

print("finishing stream")

# if __name__ == '__main__':

# 	app.debug = True
# 	app.run()

