import json 
import csv
import datetime as dt

with open("hashtag_files/hashtags1.csv", 'r') as file_in:
	original = csv.reader(file_in)
	file_out = csv.writer(open("hashtag_files/hashtags_test_conversion.csv", 'wb'))
	for row in original:
		file_out.writerow([row[0], row[1], row[2], row[3], '2016-03-29'])



