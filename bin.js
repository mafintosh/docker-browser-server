#!/usr/bin/env node

var minimist = require('minimist')
var docker = require('./')

var argv = minimist(process.argv, {
  alias: {port:'p', docker:'d', help:'h'},
  default: {port:process.env.PORT || 8080}
})

var image = argv._[2]

if (argv.help || !image) {
  console.log('Usage: docker-browser-server image [options]')
  console.log()
  console.log('  --port,    -p  [8080]          (port to listen on)')
  console.log('  --docker,  -d  [$DOCKER_HOST]  (optional host of the docker daemon)')
  console.log('  --persist                      (allow persistance of /root in the containers)')
  console.log('')
  return process.exit(argv.help ? 0 : 1)
}

var server = docker(image, argv)

server.on('spawn', function(container) {
  console.log('Spawning new container (%s)', container.id)
})

server.on('kill', function(container) {
  console.log('Killing container (%s)', container.id)
})

server.on('listening', function() {
  console.log('Server is listening on port %d', server.address().port)
})

server.listen(argv.port)
