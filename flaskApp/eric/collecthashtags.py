from flask import Flask, render_template, request 
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from collections import defaultdict 
import json
import time 
import datetime as dt
import math
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
start = time.time()

class MyStreamListener(tweepy.StreamListener):

	""" Overrides the default streaming settings. """

	def on_status(self, status):

		""" Append sentiment values of each tweet to a size-limited array. """

		# time.sleep(0.2)

		# try:
		tweet = status.text.encode('utf-8')
		match = hashtag_re.findall(tweet)
		score = sentiment(tweet)
		total_count['ct'] += 1

		for m in match:
			try:
				oldcount = hashtags[m]["count"]
				hashtags[m]["count"] += 1
				hashtags[m]["sentiment"] = ( ( hashtags[m]["sentiment"] * (hashtags[m]["count"] - 1)) + score["compound"] ) / hashtags[m]["count"]
				oldvar = hashtags[m]["sentstd"] ** 2
				newvar = (oldcount * oldvar + (score["compound"] - hashtags[m]["sentiment"]) ** 2) / (oldcount + 1)
				hashtags[m]["sentstd"] = math.sqrt(newvar)
			except KeyError:
				hashtags[m] = {"count": 1, "sentiment": score['compound'], "sentstd": 0.0}

		
		for h in hashtags:
			hashtags[h]['date'] = str(dt.date.today())

		if total_count['ct'] > 30000:
			print "dumping hashtags"
			with open("hashtag_files/hashtags.json", 'w') as file_out:
				finish = time.time()
				total_time = finish - start
				print "Total time taken: " +  str(total_time)
				json.dump(hashtags, file_out)
			return False
		# except ProtocolError:
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

	start = time.time()
	myStream = tweepy.Stream(auth=api.auth, listener=MyStreamListener())

	myStream.sample(async=True)

print("starting stream")

startStream()



