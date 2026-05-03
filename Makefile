.PHONY: dev server client build test install

dev:
	@bash scripts/dev.sh

server:
	npm run server

client:
	npm run client

build:
	npm run build

test:
	npm test -- --run

install:
	npm install
