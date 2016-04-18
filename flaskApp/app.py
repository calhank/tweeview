# Flask imports 
import sqlite3
from flask import Flask, request, session, g, redirect, url_for, abort, render_template, flash
from contextlib import closing

# Miscellaneous imports 
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from time import time
import json 
import re
import pprint

# configuration
DATABASE = '/tmp/flaskApp.db'
DEBUG = True
SECRET_KEY = 'daa1306d061b233fcdf244f2974efcbbe67d47238d105c0af968e380'
USERNAME = 'admin'
PASSWORD = 'default'

app = Flask(__name__)
app.config.from_object(__name__)

# Tweepy 
keys = {
	
	'consumer_key': 'U2UbUq8DX2WlbfbR9m3nY0tcW'
	, 'consumer_secret': 'm4NHVi738gGyzD4pNLP8lxuoGOlV4TqUwKL0MHqtm1sGwkB9lV'
	, 'access_token': '286789101-m9DbIXjfU5zeddtIsMRtgQ5DeNy64hnDOVr2KFnB'
	, 'access_token_secret': 'H8DSy6MrLmMNnqk9IJh4JiTuk0XsDAmTfNgwmcb9OuQvk'

}  

# regex
hashtag_re = re.compile(r'#\w\w+')

# data
total_count = {"ct": 0}
global_sentiment = list()

pp = pprint.PrettyPrinter(indent=1).pprint


## TWEEPY METHODS AND INITIALIZATION

class TweeviewListener(tweepy.StreamListener):
	# def __init__(self, api=None):
	# 	super(TweeviewListener, self).__init__()

	""" Overrides the default streaming settings. """

	def on_status(self, status):

		""" Append sentiment values of each tweet to a size-limited array. """

		now = time()
		tweet = status.text.encode('utf-8')
		score = sentiment(tweet)
		global_sentiment.append((now,score["compound"]))
		total_count['ct'] += 1

	def on_error(self, status_code):

		""" Kill stream on error. """

		if status_code == '420':
			return False 

# Twitter authentication 
auth = tweepy.OAuthHandler(keys['consumer_key'], keys['consumer_secret'])
auth.set_access_token(keys['access_token'], keys['access_token_secret'])

api = tweepy.API(auth)
STREAM = tweepy.Stream(auth=api.auth, listener=TweeviewListener())

def startStream(filters=None, locations=None): 

	""" This begins the twitter stream. """ 

	if filters is None:
		STREAM.sample(async=True, languages=["en"])
	else:
		STREAM.filter(track=filters, locations=locations, async=True, languages=["en"])


## FLASK METHODS
@app.route("/", methods=["GET"])
def renderHomepage():
	return render_template("index.html")

	
@app.route("/start-stream", methods=["POST"])
def connectStream():
	print "Starting Stream"
	filters = request.args.get('filters')
	coordinates = request.args.get('coordinates')
	if filters is not None:
		filters = filters.split(',')
		print "Filters:", ",".join(filters)
		print "Coordinates:", coordinates
		startStream(filters=filters, coordinates=coordinates)
	else:
		startStream()

	return json.dumps(True)


@app.route("/stop-stream", methods=["POST"])
def disconnectStream():
	print "Stopping Stream"
	STREAM.disconnect()
	return json.dumps(True)


@app.route("/get-data", methods=["POST"])
def getStreamData():
	
	global total_count
	global global_sentiment

	return json.dumps([global_sentiment, total_count["ct"]])


if __name__ == '__main__':

	app.run()

