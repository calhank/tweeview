# import sqlite3
from flask import Flask, request, session, g, redirect, url_for, abort, render_template, flash
# from contextlib import closing
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from time import time, mktime
import copy
import json 
import pprint
from collections import Counter

# configuration
# DATABASE = '/tmp/flaskApp.db'
# DEBUG = True
# SECRET_KEY = 'daa1306d061b233fcdf244f2974efcbbe67d47238d105c0af968e380'
# USERNAME = 'admin'
# PASSWORD = 'default'

app = Flask(__name__)
app.config.from_object(__name__)

# Tweepy 
keys = {
	
	'consumer_key': 'U2UbUq8DX2WlbfbR9m3nY0tcW'
	, 'consumer_secret': 'm4NHVi738gGyzD4pNLP8lxuoGOlV4TqUwKL0MHqtm1sGwkB9lV'
	, 'access_token': '286789101-m9DbIXjfU5zeddtIsMRtgQ5DeNy64hnDOVr2KFnB'
	, 'access_token_secret': 'H8DSy6MrLmMNnqk9IJh4JiTuk0XsDAmTfNgwmcb9OuQvk'

}  


pp = pprint.PrettyPrinter(indent=1).pprint

def parse_tweet_array(tweet_array):

	output = {}
	output["TOTAL_TWEET_COUNT"] = len(tweet_array)
	output["TOTAL_TWEET_COUNT_NON_RT"] = 0
	output["TAG_COUNT"] = Counter()
	output["TAG_COUNT_NON_RT"] = Counter()
	output["GLOBAL_SENTIMENT"] = []
	
	for tweet_tuple in tweet_array:
		try:
			tweet = tweet_tuple[1]
			ht = tweet["hashtag"]
			output["TAG_COUNT"][ht] += 1
			if tweet["is_rt"]:
				output["TOTAL_TWEET_COUNT_NON_RT"] += 1
				output["TAG_COUNT_NON_RT"][ht] += 1

			sentimentTuple = (tweet["timestamp"], tweet["sentiment"], tweet["is_rt"])
			output["GLOBAL_SENTIMENT"].append( sentimentTuple )
			try:
				output[ht]["sentiment_series"].append( sentimentTuple )
				output[ht]["total_observations"] += 1
				for word in tweet["text"].split(" "):
					output[ht]["word_count"][word] += 1

			except KeyError:
				output[ht] = {}
				output[ht]["sentiment_series"] = [ sentimentTuple ]
				output[ht]["total_observations"] = 1
				output[ht]["word_count"] = Counter()
				for word in tweet["text"].split(" "):
					output[ht]["word_count"][word] += 1

		except Exception,e:
			print e

	output["TOP_TAGS"] = output["TAG_COUNT"].most_common()
	output["TOTAL_TAG_COUNT"] = len(output["TAG_COUNT"])
	output["TOTAL_TAG_COUNT_NON_RT"] = len(output["TAG_COUNT_NON_RT"])

	return output

def truncate_tweet_array(tweet_array, max_tweets=100000, max_time_seconds = 60*30 ):
	return [tweet for tweet in tweet_array if time() - tweet[0] <= max_time_seconds ][-max_tweets:]
	
# data
tweet_array = list()

## TWEEPY METHODS AND INITIALIZATION

class TweeviewListener(tweepy.StreamListener):

	""" Overrides the default streaming settings. """

	def on_status(self, status):

		""" Append sentiment values of each tweet to a size-limited array. """

		try:

			now = time()

			parsed_tweet = {}
			ds = set(dir(status)) 
			parsed_tweet["is_rt"] = "retweeted_status" in ds
			parsed_tweet["timestamp"] = mktime(status.created_at.timetuple())
			parsed_tweet["sentiment"] = sentiment(status.text.encode('utf-8'))["compound"]
			parsed_tweet["text"] = status.text.encode('utf-8')

			if len(status.entities["hashtags"]) == 0:
				parsed_tweet["hashtag"] = "(No Hashtag)"
				tweet_array.append( (now, copy.deepcopy(parsed_tweet)) )
			else:
				for ht in status.entities["hashtags"]:
					parsed_tweet["hashtag"] = ht["text"]
					tweet_array.append( (now, copy.deepcopy(parsed_tweet)) )
		
		except KeyboardInterrupt:
			return False

		except Exception, e:
			print "Exception!", type(e).__name__, e

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

	
@app.route("/start-stream", methods=["GET"])
def connectStream():
	print "Starting Stream"
	filters = request.args.get('filters')
	coordinates = request.args.get('coordinates')
	if filters is not None:
		filters = filters.split(',')
		print "Filters:", ",".join(filters)
		print "Coordinates:", coordinates
	startStream(filters=filters, locations=coordinates)

	return json.dumps(True)


@app.route("/stop-stream", methods=["POST"])
def disconnectStream():
	print "Stopping Stream"
	global tweet_array
	tweet_array = list()
	STREAM.disconnect()
	return json.dumps(True)


@app.route("/get-data", methods=["POST"])
def getStreamData():

	"""Returns parsed data from stream"""

	global tweet_array

	# limit tweet array size to last 30 min or 100k tweets
	tweet_array = truncate_tweet_array(tweet_array, max_time_seconds=30 * 60, max_tweets=100000)

	pta = parse_tweet_array(tweet_array)

	return json.dumps(pta)


if __name__ == '__main__':

	app.run()

