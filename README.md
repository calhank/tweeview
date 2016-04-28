#Tweeview

A Twitter Sentiment Analysis tool made with Python, [vaderSentiment](https://github.com/cjhutto/vaderSentiment), [Flask](http://flask.pocoo.org/), [Tweepy](http://www.tweepy.org/), jQuery, [D3](https://d3js.org/), [Highcharts](http://www.highcharts.com/), [Tableau](www.tableau.com/), and [jQCloud](https://github.com/lucaong/jQCloud).

###Authors
* Hank Mushinski
* Filip Krunic
* Eric Perkins

---


## Goals

We sought to create a dashboard focused on **hashtags**, utilizing data made available by Twitter's public streaming API.

The **hashtag** is very important to Twitter's core service. By tagging a tweet with a hashtag, users are able to connect their comment thematically to an event, person, idea, or social movement. Because hashtags are meaningful and can relate to polarizing topics, we sought to improve a user's understanding of how hashtags are being used in the aggregate.

## Audience and Use Case

Our tool is for any Twitter user, for the purpose of live tracking how people are using hashtags. A common use case would be to use Tweeview to track hashtags and sentiment about a given topic or from a given geographic location during a public event, such as a television show or sporting event.


## Data Source

Twitter stream via the Tweepy streaming library for Python. Data stream is processed in memory by Python before being sent to front end via jQuery POST requests.

## Tools

1. Python / Flask - Allows local hosting of web app framework, easy integration with existing Twitter API and sentiment analysis libraries
1. vaderSentiment - Sentiment analysis algorithm and Python library specifically designed for social media text
2. D3 / Highcharts - Javascript visualization libraries made live front-end data filtering and plot updates possible. Highcharts provided a good deal of "free" functionality, especially in the sparklines and time series plots
3. jQCloud - Provided flexible word cloud creation


## Running the Application

You can either go to our [public URL](ec2-52-37-49-158.us-west-2.compute.amazonaws.com) or run the application from your own computer (**requires Python 2.7**).

Clone this repository to your personal computer.

`$ git clone https://github.com/calhank/tweeview.git`

Go into the repo directory and download dependencies.

```
$ cd tweeview
$ pip install -r requirements.txt
```

NOTE: If you have never installed NLTK before, you will have to download the NLTK "Stopwords" collection before the app will run properly. Instructions here: [NLTK 3.0 Documentation](http://www.nltk.org/data.html).

Run the app.

`$ python app.py`

Once the app returns a result like `* Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)`, navigate to that URL on your browser and enjoy! (We recommend Chrome or Safari for best experience).


## Usage

The application is a single page with live streaming visualizations and interactive Tableau visualizations based on static data.

To run the streaming, you can choose between a random 1% sample of all Twitter activity, or you can specify topics/location to track a specific current event.

If you choose to specify both topics and a location, the results are the union of those filters.
