#!/usr/bin/env python
"""
coding=utf-8
"""
# imports
# *********************************
import csv
import logging
import lda
import pandas as pd
import nltk
from sklearn import feature_extraction
from nltk.stem.wordnet import WordNetLemmatizer
import numpy as np
from nltk.corpus import stopwords
import re


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
def create_raw_df(pkl_path):
    """
    Load the raw DataFrame, created externally
    :param pkl_path: Path to pickled DataFrame, containing columns ['title', 'selftext']
    :type pkl_path: str
    :return: DataFrame containing columns ['title', 'selftext', 'total_text']
    :rtype: pd.DataFrame
    """

    logging.info('Reading input DataFrame from pickle path: ' + pkl_path)

    # Open from pickle
    raw_df = pd.read_pickle(pkl_path)


    # Remove rows with missing body
    logging.info('Number of raw rows: ' + str(len(raw_df.index)))
    raw_df = raw_df[raw_df['selftext'] != '']
    logging.info('Number of non-empty rows: ' + str(len(raw_df.index)))

    # Add total_text column
    raw_df['total_text'] = raw_df['title'] + raw_df['selftext']
    raw_df['processed_text'] = raw_df['total_text'].apply(preprocess)
    raw_df['created'] = raw_df['created'].apply(float)

    raw_df['created_datetime'] = raw_df['created'].apply(lambda x: pd.to_datetime(x, unit='s'))

    # Remove rows with missing body
    logging.info('Number of raw rows: ' + str(len(raw_df.index)))
    raw_df = raw_df[raw_df['processed_text'] != '']
    logging.info('Number of non-empty rows: ' + str(len(raw_df.index)))

    logging.debug('Read input DataFrame. Resulting DataFrame:\n' + str(raw_df))

    return raw_df


def preprocess(input_str):
    """
    Preprocess individual strings, including:
     > Normalize text (Lowercase, remove characters that are not letter or whitespace)
     > Tokenize (Break long string into individual words)
     > Lemmatize (Normalize similar words)
     > Remove custom stopwords (Remove words that have little value in this context)
     > Rejoin (Make everyting back into one long string)
    :param input_str: raw string
    :type input_str: unicode
    :return: String, containing normalized text
    :rtype: unicode
    """

    logging.debug('Preprocessing string: ' + input_str)

    # Remove links
    p = re.compile(r'https?://.+', re.DOTALL)
    input_str = re.sub(p, '', input_str)

    # Remove non-alphabetical / whitespace characters
    input_str = re.sub(r'[^\s^\w]', '', input_str)

    # Lowercase
    input_str = input_str.lower()

    # Tokenize (break up into individual words)
    words = nltk.word_tokenize(input_str)

    # Lemmatize (e.g. friends -> friend, walking -> walk)
    lemmatizer = WordNetLemmatizer()
    stems = list()
    for word in words:
        stems.append(lemmatizer.lemmatize(word))

    # Strip custom stopwords (they have little value in this context)
    stop = stopwords.words('english')
    stop.extend(['gay', 'guy', 'im', 'ive', 'like', 'feel', 'dont', 'life', 'ha', 'wa', 'doesnt', 'really', 'think',
                 'thing', 'said', 'didnt', 'did', 'do'])
    stop.extend(['friend', 'little', 'got', 'went'])

    stems = filter(lambda x: x not in stop, stems)

    # Reset to one long string, so that vectorizer won't complain
    output = u' '.join(stems)

    logging.debug('Done preprocessing string, result is: ' + output)

    return output


def train_lda(input_df, vectorizer):
    """
    Run Latent Dirclet Analysis to determine subtopics from the text.
    This method has been heavily fitted / tailored to text from the askgaybros corpus
    :param input_df: DataFrame, containing text to pull topics from.
    :type input_df: pd.DataFrame
    :param vectorizer: word vectorizer
    :type vectorizer: sklearn.feature_extraction.text.CountVectorizer
    :return: trained lda model
    :rtype: lda.LDA
    """

    logging.info('Training LDA Model')
    logging.debug('Document DataFrame: \n' + str(input_df))

    # Remove text from DataFrame
    document_list = input_df['processed_text'].tolist()

    doc_matrix = vectorizer.fit_transform(document_list)

    # Create LDA model, fit it with hand tuned parameters
    model = lda.LDA(n_topics=5, n_iter=500, random_state=1)
    model.fit(doc_matrix)

    return model


def add_nlp_features(df):
    # Get words
    df['words_list'] = df['total_text'].apply(nltk.word_tokenize)
    df['word_set'] = df['words_list'].apply(set)

    df['num_words'] = df['words_list'].apply(len).apply(float)
    df['num_unique_words'] = df['word_set'].apply(len).apply(float)

    df['density_unique_word'] = df['num_unique_words'] / df['num_words']

    return df


def create_topic_top_words_df(model, vectorizer):
    """
    Create a DataFrame containing the top words for each topic
    :param model: trained LDA model
    :type model: lda.LDA
    :param vectorizer: Word vectorizer
    :type vectorizer: sklearn.feature_extraction.text.CountVectorizer
    :return: DataFrame containing columns [topic_number, top_words]
    :rtype: pd.DataFrame
    """

    logging.info('Creating topic top words df')

    # Convert vocabulary from {'word': index} to array with every word in its index
    vocab_dict = vectorizer.vocabulary_
    vocab = [None] * (max(vocab_dict.values()) + 1)

    for key, value in vocab_dict.iteritems():
        vocab[value] = key

    topic_word = model.topic_word_

    # Create DataFrame containing top words for every topic
    n_top_words = 30
    topic_words_list = list()
    for i, topic_dist in enumerate(topic_word):
        topic_words = np.array(vocab)[np.argsort(topic_dist)][:-n_top_words:-1]
        local_dict = dict()
        local_dict['topic_number'] = i
        local_dict['top_words'] = topic_words
        topic_words_list.append(local_dict)

    topic_words_df = pd.DataFrame(topic_words_list)

    logging.debug('Finished creating topic top words df: \n' + str(topic_words_df))
    return topic_words_df


def sanitize_column_name(column_name):
    column_name = column_name.replace('_', ' ')
    column_name = column_name.replace('num', 'number of')
    return column_name


def convert_to_web_df(df):
    df['date'] = df['created_datetime'].apply(lambda x: x.strftime('%m/%d/%Y'))

    df = df[['date', 'num_words', 'ups', 'score', 'num_comments', 'topic_name', 'over_18']]

    df.columns = map(sanitize_column_name, df.columns)

    df.to_pickle('../data/output/web/askgaybros_web_with_features_subset.pkl')
    df.to_csv('../data/output/web/askgaybros_web_with_features_subset.csv', encoding='utf-8', quoting=csv.QUOTE_ALL,
              index=False)


def main():
    logging_format = "%(levelname)s . %(asctime)s . %(pathname)s . %(lineno)s: %(message)s"
    logging.basicConfig(level=logging.INFO, format=logging_format)
    df = create_raw_df('../data/raw/combined/combined_askgaybros_submissions.pkl')

    # Create vectorizer
    vectorizer = feature_extraction.text.CountVectorizer(lowercase=True, strip_accents='ascii', stop_words='english',
                                                         tokenizer=nltk.word_tokenize)

    # Create lda model
    model = train_lda(df, vectorizer)

    # Create a DataFrame containing the top words for each topic
    topic_top_words_df = create_topic_top_words_df(model, vectorizer)
    topic_top_words_df.to_pickle('../data/output/lda/topic_top_words.pkl')
    topic_top_words_df.to_csv('../data/output/lda/topic_top_words.csv')

    # Assign each submission one topic (specific to order documents were fed to model
    doc_topic = model.doc_topic_
    df['topic_number'] = map(lambda x: x.argmax(), doc_topic)

    topic_mapping = ['finding a guy', 'young adult', 'coming out', 'aroused', 'long term relationship']

    df['topic_name'] = df['topic_number'].apply(lambda x: topic_mapping[x])

    df = df.reset_index()
    df = add_nlp_features(df)
    df.to_pickle('../data/output/askgaybros_with_features.pkl')
    df.to_csv('../data/output/askgaybros_with_features.csv', encoding='utf-8', quoting=csv.QUOTE_ALL)

    convert_to_web_df(df)

# main
# *********************************

if __name__ == '__main__':
    main()
