.PHONY: run install freeze

run:
	source .venv/bin/activate && python run.py

install:
	python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

freeze:
	source .venv/bin/activate && pip freeze > requirements.txt