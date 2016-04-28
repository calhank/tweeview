
# Imports 
from flask import Flask, request, session, g, redirect, url_for, abort, render_template, flash
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from time import time, mktime
import copy
import json 
import pprint
from collections import Counter
from nltk.corpus import stopwords
import string

twitter_stopwords = ["rt","i'm","&amp;","u"]
STOP_CHARS = frozenset(list(string.punctuation))
STOP_WORDS = frozenset(stopwords.words('english') + twitter_stopwords)

# Config 
app = Flask(__name__)
app.config.from_object(__name__)

# Universal Tweepy API Credentials
keys = {
	
	'consumer_key': 'U2UbUq8DX2WlbfbR9m3nY0tcW'
	, 'consumer_secret': 'm4NHVi738gGyzD4pNLP8lxuoGOlV4TqUwKL0MHqtm1sGwkB9lV'
	, 'access_token': '286789101-m9DbIXjfU5zeddtIsMRtgQ5DeNy64hnDOVr2KFnB'
	, 'access_token_secret': 'H8DSy6MrLmMNnqk9IJh4JiTuk0XsDAmTfNgwmcb9OuQvk'

}  

# pretty printer for debugging
pp = pprint.PrettyPrinter(indent=1).pprint

def parse_tweet_array(tweet_array):
	"""Method to parse a list of streamed Tweet tuples with format (unix timestamp, tweet object)"""

	# ensure deduplication
	all_tweets_processed = set()

	# init output fields
	output = {}
	output["TOTAL_TWEET_COUNT"] = len(tweet_array)
	output["TOTAL_TWEET_COUNT_NON_RT"] = 0
	output["TAG_COUNT"] = Counter()
	output["TAG_COUNT_NON_RT"] = Counter()
	output["LINK_COUNT"] = Counter()
	output["LINK_COUNT_NON_RT"] = Counter()
	output["GLOBAL_SENTIMENT"] = []
	output["WORD_COUNT"] = Counter()
	output["WORD_COUNT_NON_RT"] = Counter()
	all_hashtags_processed = set() # unique hashtags
	
	for tweet_tuple in tweet_array:
		if str(tweet_tuple[1]) not in all_tweets_processed: # ensure deduplication
			all_tweets_processed.add(str(tweet_tuple[1])) # ensure deduplication
			try: # fail silently
				tweet = tweet_tuple[1]
				text_list = [t for t in tweet["text"].split(" ") if t.lower() not in STOP_WORDS and t.lower()[:4] !=  "http" and t[:1] not in STOP_CHARS and len(t) > 1] # get unique text that is not a URL, hashtag, or single-letter word
				ht = tweet["hashtag"]
				all_hashtags_processed.add(ht)
				output["TAG_COUNT"][ht] += 1
				output["WORD_COUNT"].update(text_list)
				output["LINK_COUNT"].update(tweet["related_links"])
				if not tweet["is_rt"]:
					output["TOTAL_TWEET_COUNT_NON_RT"] += 1
					output["TAG_COUNT_NON_RT"][ht] += 1
					output["WORD_COUNT_NON_RT"].update(text_list)
					output["LINK_COUNT_NON_RT"].update(tweet["related_links"])

				# data for global and filtered sentiment time series plots
				sentimentTuple = (tweet["timestamp"], tweet["sentiment"], tweet["is_rt"])
				output["GLOBAL_SENTIMENT"].append( sentimentTuple )
				try:
					# if hashtag already has entry in output
					output[ht]["sentiment_series"].append( sentimentTuple )
					output[ht]["total_observations"] += 1
					output[ht]["word_count"].update(text_list)
					output[ht]["related_hashtags"].update(tweet["related_hashtags"])
					output[ht]["related_links"].update(tweet["related_links"])

					output[ht]["word_count_non_rt"].update(text_list)
					output[ht]["related_hashtags_non_rt"].update(tweet["related_hashtags"])
					output[ht]["related_links_non_rt"].update(tweet["related_links"])

				except KeyError: 
					# if hashtag did not yet appear in output
					output[ht] = {}
					output[ht]["sentiment_series"] = [ sentimentTuple ]
					output[ht]["total_observations"] = 1

					output[ht]["word_count"] = Counter()
					output[ht]["word_count"].update(text_list)
					output[ht]["related_hashtags"] = Counter()
					output[ht]["related_hashtags"].update(tweet["related_hashtags"])
					output[ht]["related_links"] = Counter()
					output[ht]["related_links"].update(tweet["related_links"])

					output[ht]["word_count_non_rt"] = Counter()
					output[ht]["word_count_non_rt"].update(text_list)
					output[ht]["related_hashtags_non_rt"] = Counter()
					output[ht]["related_hashtags_non_rt"].update(tweet["related_hashtags"])
					output[ht]["related_links_non_rt"] = Counter()
					output[ht]["related_links_non_rt"].update(tweet["related_links"])


			except Exception,e:
				print e

	for ht in all_hashtags_processed:
		#transform counters to ordered lists of decreasing frequency
		output[ht]["word_count"] = output[ht]["word_count"].most_common()
		output[ht]["related_hashtags"] = output[ht]["related_hashtags"].most_common()
		output[ht]["related_links"] = output[ht]["related_links"].most_common()

	# get global top counts
	output["TOP_TAGS"] = output["TAG_COUNT"].most_common(100)
	output["TOP_TAGS_NON_RT"] = output["TAG_COUNT_NON_RT"].most_common(100)
	output["TOP_WORDS"] = output["WORD_COUNT"].most_common(100)
	output["TOP_WORDS_NON_RT"] = output["WORD_COUNT_NON_RT"].most_common(200)
	output["TOP_LINKS"] = output["LINK_COUNT"].most_common(100)
	output["TOTAL_TAG_COUNT"] = len(output["TAG_COUNT"])
	output["TOTAL_TAG_COUNT_NON_RT"] = len(output["TAG_COUNT_NON_RT"])

	return output

def truncate_tweet_array(tweet_array, max_tweets=100000, max_time_seconds = 60*30 ):

	"""Method to truncate the stream of tweets to ensure it can be kept in memory. Defaults to last 100000 tweets that occured in the last 30 minutes"""

	return [tweet for tweet in tweet_array if time() - tweet[0] <= max_time_seconds ][-max_tweets:]
	
# global data
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
			parsed_tweet["related_links"] = [ lnk["url"].replace("\\","") + "||" + lnk["display_url"].replace("\\","") for lnk in status.entities["urls"]]

			if len(status.entities["hashtags"]) == 0:
				# handle case of tweet with no hashtags
				parsed_tweet["related_hashtags"] = []
				parsed_tweet["hashtag"] = "(No Hashtag)"
				tweet_array.append( (now, copy.deepcopy(parsed_tweet)) )
			else:
				# separate stream entry for each hashtag
				for ht in status.entities["hashtags"]:
					parsed_tweet["related_hashtags"] = [ lnk["text"] for lnk in status.entities["hashtags"] if lnk["text"] != ht["text"] ]
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

	if filters is None and locations is None:
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
	coordinates = request.args.get('locations')
	if filters is not None:
		filters = filters.split(',')
		print "Filters:", ",".join(filters)
	if coordinates is not None:
		coordinates = [float(x) for x in coordinates.split(",")]
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

