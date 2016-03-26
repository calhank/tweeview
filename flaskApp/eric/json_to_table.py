import json 
import csv
import datetime as dt

'''
	This script takes the currently stored hashtags.json file, which only stores
	the contents of one collection/one sample of tweets, and updates the larger
	hashtags.csv file to include the results of this new collection 
'''
with open("hashtag_files/hashtags.json", 'r') as file_in:
	js = json.loads(file_in.read())
	file_out = csv.writer(open("hashtag_files/hashtags.csv", 'a'))
	file_out.writerow(["hashtag", "count", "sentiment", "date"])
	for hashtag in js:
		file_out.writerow([hashtag, js[hashtag]['count'], js[hashtag]['sentiment'], str(dt.date.today())])



