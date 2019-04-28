from selenium import webdriver
from joblib import Parallel, delayed

def discover():
	browser = webdriver.Chrome()
	browser.get('https://konkanivocabulary.in/discover')
	browser.implicitly_wait(5) # seconds
	assert 'Southern' in browser.title
	try:
		browser.find_element_by_css_selector('#specific-results')
		browser.quit()
	except:
		pass

Parallel(n_jobs=30)(delayed(discover)() for i in range(0, 30))
