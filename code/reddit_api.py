#!/usr/bin/env python
"""
coding=utf-8
"""
# imports
# *********************************
import csv
import glob
import logging
import os
import datetime

import pandas as pd
import praw

# global variables
# *********************************
import sys

__author__ = 'bjherger'
__version__ = '1.0'
__email__ = '13herger@gmail.com'
__status__ = 'Development'
__maintainer__ = 'bjherger'


# functions
# *********************************

def main():
    logging_format = "%(levelname)s . %(asctime)s . %(filename)s . %(lineno)s: %(message)s"
    logging.basicConfig(level=logging.DEBUG, format=logging_format)

    logging.info('Beginning script: ' + os.path.basename(__file__))
    # create_samples()
    aggregrate_samples()


def aggregrate_samples():

    data_frames = map(pd.read_pickle, glob.iglob('../data/raw/daily/*.pkl'))
    cumulative_df = pd.concat(data_frames)

    cumulative_df.to_pickle('../data/output/combined_askgaybros_submissions.pkl')
    cumulative_df.to_csv('../data/output/combined_askgaybros_submissions.csv', encoding='utf-8', quoting=csv.QUOTE_ALL)



def create_samples():
    # Make connection to Reddit
    logging.info('Making Reddit connection')
    r = praw.Reddit(user_agent='python-askgaybros-machine-learning')

    # Create tuples containing upper and lower bounds
    current_date = datetime.datetime.now().strftime('%m/%d/%Y')
    date_range = list(pd.date_range(start='04/25/2014', end=current_date, freq='D'))

    # Iterate through tuples of datetime bounds, pull any submissions in that date range
    for lower_timestamp, upper_timestamp in zip(date_range, date_range[1:]):

        # Convert timestamps from pd.Timestamp to epoch, offset by 1 second to avoid overlap
        lower_timestamp_epoch = int(lower_timestamp.value / 1e9)
        upper_timestamp_epoch = int((upper_timestamp.value / 1e9) - 1)
        logging.debug('Running search for range ' + str(lower_timestamp) + ' to ' + str(upper_timestamp))

        # Create query for timeframe
        query = 'timestamp:%d..%d' % (lower_timestamp_epoch, upper_timestamp_epoch)
        submissions = r.search(query, subreddit='askgaybros', sort='new', limit=100, syntax='cloudsearch')

        # Create a DataFrame containing results
        result_list = list()
        for index, newest_submission in enumerate(submissions):
            raw_dict = newest_submission.__dict__

            # Convert keys to strings, to avoid recursion issues
            cleaned_dict = dict(raw_dict)
            cleaned_dict['author'] = unicode(cleaned_dict['author'])
            cleaned_dict['reddit_session'] = unicode(cleaned_dict['reddit_session'])
            cleaned_dict['subreddit'] = unicode(cleaned_dict['subreddit'])

            result_list.append(cleaned_dict)

        # Write results to file
        logging.info('Converting to dataframe')
        df = pd.DataFrame(result_list)

        logging.info('Number of entries: ' + str(len(df.index)))

        if len(df.index) > 100:
            logging.warn('Maximum sample exceeded.')

        filename = 'askgaybros_' + str(lower_timestamp) + '_to_' + str(upper_timestamp)
        logging.info('Writing to pickle: ' + filename)
        df.to_pickle('../data/raw/daily/' + filename + '.pkl')

        logging.info('Writing to csv: ' + filename)
        df.to_csv('../data/raw/daily/' + filename + '.csv', encoding='utf-8', quoting=csv.QUOTE_ALL)


# main
# *********************************

if __name__ == '__main__':
    main()


