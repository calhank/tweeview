from flask import Flask, render_template, request 
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from collections import defaultdict 
from time import sleep 
import json 
import re

app = Flask(__name__)
app.config.from_object(__name__)

# sentimentStream = defaultdict(list)
# sentimentStream['hashtags'] = {}
hashtags = {}
# ats = {}

keys = {
	
	'consumer_key': '71flBi0ZpYPlFniaYNYKxcJQw'
	, 'consumer_secret': 'wOjII61YDpR6O6xeQSCCQyJKg7J2VFNeDTKlMb0IIrceev6qWS'
	, 'access_token': '4049153049-dvIR146fp9WYheDJfnEqZ1D0GuZVY8H9ZHum5yd'
	, 'access_token_secret': 'KaXRrae7ashpafyEsDLAPDpWrCQ6Wu5FuqJ0N104oAEBa'

}

hashtag_re = re.compile(r'#\w\w+')
# at_re = re.compile(r'#\w\w+')

class MyStreamListener(tweepy.StreamListener):

	""" Overrides the default streaming settings. """


	# def on_status(self, status):

	# 	""" Append sentiment values of each tweet to a size-limited array. """

	# 	tweet = status.text.encode('utf-8')
	# 	score = sentiment(tweet)

	# 	try: 
	# 		sentimentStream['neg'].pop(0)
		
	# 	except: 
	# 		pass

	# 	finally: 
	# 		sentimentStream['neg'].append(score['neg'])			

	def on_status(self, status):

		""" Append sentiment values of each tweet to a size-limited array. """

		tweet = status.text.encode('utf-8')
		match = hashtag_re.findall(tweet)
		# score = sentiment(tweet)

		# try:
		# for m in match:
		# 	try:
		# 		hashtags[m] += 1
		# 	except KeyError:
		# 		hashtags[m] = 1
		for m in match:
			try:
				hashtags[m] += 1
			except KeyError:
				hashtags[m] = 1
		

		# except: 
		# 	pass

		# finally: 
		# 	sentimentStream['text'].append(tweet)		


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



@app.route('/', methods=['GET', 'POST'])
def renderGraph(): 

	""" This function manages the rendering for the graph page. If the page is first requested, or refreshed, 
	it will submit a 5-second stream. If a post request is submitted, it will clear the list and 
	submit a new template of values. """

	global hashtags

	if request.method == 'GET':

		startStream()

		sleep(5)

		print hashtags

		return render_template('hashtag-bargraph.html')

	elif request.method == 'POST':

		sleep(.5)

		hashobs = [ {"tag": key, "count": hashtags[key]} for key in hashtags ]
		print hashtags
		print hashobs
		return json.dumps(hashobs)

	else: 
		pass 


if __name__ == '__main__':

	app.debug = True
	app.run()

