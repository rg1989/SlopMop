.PHONY: dev server client build test install

dev:
	npm run dev

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
