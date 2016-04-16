# Flask imports 
import sqlite3
from flask import Flask, request, session, g, redirect, url_for, abort, render_template, flash
from contextlib import closing

# Miscellaneous imports 
import tweepy 
from vaderSentiment.vaderSentiment import sentiment
from collections import defaultdict 
from time import sleep, time
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

def connect_db():

	""" Connects to a specific database. """

	return sqlite3.connect(app.config['DATABASE'])


def init_db():

	""" Initializes the database. """

	with closing(connect_db()) as db:
		with app.open_resource('schema.sql', mode='r') as f:
			db.cursor().executescript(f.read())
		db.commit()


@app.before_request
def before_request():

	""" Opens a connection prior to the request being made. """

	g.db = connect_db()


@app.teardown_request
def teardown_request(exception):

	""" Closes the connection after the request has finished. """

	db = getattr(g, 'db', None)
	if db is not None:
		db.close()        



# regex
hashtag_re = re.compile(r'#\w\w+')
# at_re = re.compile(r'#\w\w+')

# data
# hashtags = {}
# total_count = {"ct": 0}
# global_sentiment = list()
# recent_sentiment = list()

pp = pprint.PrettyPrinter(indent=1).pprint



class MyStreamListener(tweepy.StreamListener):

	""" Overrides the default streaming settings. """

	def on_status(self, status):

		""" Append sentiment values of each tweet to a size-limited array. """

		# status = json.loads(status._json)
		# pp(status)


		now = time()
		tweet = status.text.encode('utf-8')
		# match = hashtag_re.findall(tweet)
		score = sentiment(tweet)
		# global_sentiment.append(score)
		global_sentiment.append((now,score["compound"]))
		total_count['ct'] += 1

		# try:

		# for m in match:
		# 	# m = m[1:]# strip hash
		# 	try:
		# 		hashtags[m]["count"] += 1
		# 		hashtags[m]["sentiment"] = ( ( hashtags[m]["sentiment"] * (hashtags[m]["count"] - 1)) + score["compound"] ) / hashtags[m]["count"]
		# 		# hashtags[m]["sentiment"]["pos"] += score["pos"]
		# 		# hashtags[m]["sentiment"]["neg"] += score["neg"]
		# 	except KeyError:
		# 		hashtags[m] = {"count": 1, "sentiment": score['compound'] }
		# 		# hashtags[m] = {"count": 1, "sentiment": {"pos": score['pos'], "neg":score['neg']} }

		# if abs(score["compound"]) > 0.0:
		# 	if len(global_sentiment) > 500: global_sentiment.pop(0)
		# 	global_sentiment.append(score["compound"])
		# 	recent_sentiment.append(score["compound"])

		# except Exception as e:
		# 	print e
		# 	pass


	def on_error(self, status_code):

		""" Kill stream on error. """

		if status_code == '420':
			return False 


def startStream(filters=None, coordinates=None): 

	""" This begins the twitter stream. """ 

	# Twitter authentication 
	auth = tweepy.OAuthHandler(keys['consumer_key'], keys['consumer_secret'])
	auth.set_access_token(keys['access_token'], keys['access_token_secret'])

	api = tweepy.API(auth)

	myStream = tweepy.Stream(auth=api.auth, listener=MyStreamListener())

	if filters is None:
		myStream.sample(async=True)
	else:
		myStream.filter(track=filters, async=True)


@app.route("/", methods=["GET"])
def renderHomepage():
	return render_template("index.html")

# @app.route("/live-visuals", methods=["GET"])
# def renderLiveVisuals():
# 	return render_template("live-visuals.html")


@app.route('/login', methods=['GET', 'POST'])
def login():

	""" This function tracks the login of the user. """

	error = None
	if request.method == 'POST':

		if request.form['username'] != app.config['USERNAME']:
			error = 'Invalid username'
		
		elif request.form['password'] != app.config['PASSWORD']:
			error = 'Invalid password'
		else:
			session['logged_in'] = True
			flash('You were logged in')
			return redirect(url_for('renderHomepage'))

	return render_template('login.html', error=error)


@app.route('/logout')
def logout():

	""" This function logs the user out. """

	session.pop('logged_in', None)
	flash('You were logged out')
	return redirect(url_for('renderHomepage'))


@app.route('/live-visuals', methods=["GET"])
def renderLiveVisuals():

	""" This function renders the live-visualization page and pulls 
	 all of the filters from the database. """
	
	# Collect 
	cur = g.db.execute('select tag from entries order by id desc')
	entries = [dict(tag=row[0]) for row in cur.fetchall()]

	# Emit 
	return render_template('live-visuals.html', entries=entries)

@app.route('/add', methods=['POST'])
def add_entry():

	""" This function inserts new tags for filtering. """

	if not session.get('logged_in'):
		abort(401)

	g.db.execute('insert into entries (tag) values (?)', 
		[request.form['tag']])

	g.db.commit()
	flash('New entry was successfully posted')

	return redirect(url_for('renderLiveVisuals'))


@app.route("/tableau", methods=["GET"])
def renderTableau():
	return render_template("tableau.html")

@app.route('/live/view', methods=['GET', 'POST'])
def renderGraph(): 

	""" This function manages the rendering for the graph page. If the page is first requested, or refreshed, 
	it will submit a 5-second stream. If a post request is submitted, it will clear the list and 
	submit a new template of values. """

	# global hashtags
	global total_count
	global global_sentiment
	# global recent_sentiment

	if request.method == 'GET':

		filters = request.args.get('filters')
		if filters is not None:
			filters = filters.split(',')
			startStream(filters)

		else:
			startStream()

		return render_template('hs-stream-view.html')

	elif request.method == 'POST':

		sleep(.25)

		return json.dumps([global_sentiment, total_count["ct"]])
		# sleep(.5)

		# taglist = [ {"tag": key, "count": hashtags[key]["count"], "sentiment":hashtags[key]["sentiment"] } for key in list(hashtags.keys()) if hashtags[key]["count"] > 1 ]
		# top20hashtags = sorted(taglist, key=lambda x: x["count"], reverse=True)[:20]		
		# unique_count = len(hashtags)
		# rs = sum(recent_sentiment)/len(recent_sentiment) if len(recent_sentiment) > 0 else 0
		# recent_sentiment = recent_sentiment[:10]
		# return json.dumps([top20hashtags, global_sentiment, total_count['ct'], unique_count, rs])


	else: 
		pass



if __name__ == '__main__':

	init_db()
	app.run()

