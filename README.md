# docker-browser-server

Spawn and expose docker containers over http and websockets

```
npm install -g docker-browser-server
```

Running the above will expose a command line tool called `docker-browser-server`.
To run the server do

```
docker-browser-server docker-image-name --port 8080
```

Make sure you pulled `docker-image-name` from a docker registry first.
Running the above will start the server on port 8080

Visit http://localhost:8080 after to attach to a container using a web browser.

## Spawn a new container

To spawn a new container create a websocket to the server and pipe it to a [docker-browser-console](https://github.com/mafintosh/docker-browser-console) instance

``` js
// using browserify
var docker = require('docker-browser-console')
var websocket = require('websocket-stream')

var container = docker()
var socket = websocket('ws://localhost:8080')

container.appendTo(document.body)

socket.pipe(container).pipe(socket)
```

A demo interface is available if you simply visit http://localhost:8080 after starting the server

## Expose filesystem

If you run [expose-fs](https://github.com/mafintosh/expose-fs) inside your container the containers
file system will be exposed using the following rest api

* `GET /files/{container}/{path}` Get a file or directory listing
* `PUT /files/{container}/{path}` Write a new file with the http body
* `POST /files/{container}/{path}` Create a new directory

## Expose a http server

When you spawn a new container a special env var called `$HOST` will be set to a http address.
If you listen on port 80 inside the container all requests going to `$HOST` will be forwarded to this server.

## Adventure time

Checkout [maxogden/adventure-time](https://github.com/maxogden/adventure-time) for a complete client environment
that integrates with docker-browser-server.

The easiest way to create your own workshop is creating a new Dockerfile and inheriting from the [mafintosh/docker-browser-adventure](https://github.com/mafintosh/docker-adventure-time) image.
This will setup expose-fs and install node among other things

```
FROM mafintosh/docker-adventure-time
RUN npm install -g your-workshop-stuff
```

## Programmatic usage

``` js
var server = require('docker-browser-server')

var s = server('mafintosh/dev')

s.on('spawn', function(container) {
  console.log('spawned new container', container.id)
})

s.on('kill', function(container) {
  console.log('killed container', container.id)
})

s.listen(8080)
```

## License

MIT
