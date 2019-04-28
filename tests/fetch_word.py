import random
import string
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from joblib import Parallel, delayed

def random_letter():
	browser = webdriver.Chrome()
	browser.get('https://konkanivocabulary.in')
	assert 'Southern' in browser.title
	element = browser.find_element(by=By.ID, value="search")
	element.send_keys(random.choice(string.ascii_letters))
	browser.implicitly_wait(5) # seconds
	browser.find_element_by_css_selector('#results table')
	element.send_keys(Keys.RETURN)
	try:
		browser.find_element_by_css_selector('#specific-results')
		browser.quit()
	except:
		pass

Parallel(n_jobs=30)(delayed(random_letter)() for i in range(0, 30))
