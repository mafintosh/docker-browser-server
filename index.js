#!/usr/bin/env node

var WebSocketServer = require('ws').Server
var freeport = require('freeport')
var request = require('request')
var websocket = require('websocket-stream')
var docker = require('docker-browser-console')
var root = require('root')
var url = require('url')
var send = require('send')
var path = require('path')
var pump = require('pump')
var cors = require('cors')
var net = require('net')
var debug = require('debug')('docker-browser-server')
var debugStream = require('debug-stream')('docker-browser-server-stream')

module.exports = function(image, opts) {
  if (!opts) opts = {}

  var DOCKER_HOST = opts.docker || (process.env.DOCKER_HOST || '127.0.0.1').replace(/^.+:\/\//, '').replace(/:\d+$/, '').replace(/^\/.+$/, '127.0.0.1')

  var server = root()
  var wss = new WebSocketServer({server: server})
  var containers = {}

  wss.on('connection', function (connection, req) {
    var url = req.url.slice(1)
    var persist = opts.persist && !!url
    var id = url || Math.random().toString(36).slice(2)
    var stream = websocket(connection)
    debug('socket start', id, +new Date())

    var startProxy = function(httpPort, cb) {
      if (!opts.offline) return cb(null, id+'.c.'+req.headers.host)

      var proxy = net.createServer(function(socket) {
        pump(socket, net.connect(httpPort, DOCKER_HOST), socket)
      })

      proxy.once('error', cb)
      proxy.listen(0, function() {
        var port = proxy.address().port
        cb(null, req.headers.host.split(':')[0]+':'+port, proxy)
      })
    }

    freeport(function(err, filesPort) {
      if (err) return connection.destroy()
      freeport(function(err, dockerHostPort) {
        if (err) return connection.destroy()
        freeport(function(err, httpPort) {
            if (err) return connection.destroy()
            startProxy(httpPort, function(err, subdomain, proxy) {
              if (err) return connection.destroy()

              var container = containers[id] = {
                id: id,
                host: 'https://' + subdomain,
                ports: {http: httpPort, fs: filesPort, docker: dockerHostPort}
              }

              server.emit('spawn', container)

              var ports = {}
              var dockercontainerport = opts.dockerport || 9000
              ports[httpPort] = 80
              ports[filesPort] = 8441
              ports[dockerHostPort] = dockercontainerport

              var envs = {}
              envs['CONTAINER_ID'] = container.id
              envs['HOST'] = container.host
              envs['PORT_80'] = httpPort
              envs['PORT_8441'] = filesPort
              envs['PORT_' + dockercontainerport] = dockerHostPort
              if (opts.envs) {
                Object.keys(opts.envs).forEach(function(name) {
                  envs[name] = opts.envs[name]
                })
              }

              var dopts = {
                tty: opts.tty === undefined ? true : opts.tty,
                env: envs,
                ports: ports,
                volumes: opts.volumes || {},
                beforeCreate: opts.beforeCreate
              }

              if (persist) dopts.volumes['/tmp/'+id] = '/root'
              if (opts.trusted) dopts.volumes['/var/run/docker.sock'] = '/var/run/docker.sock'

              stream.on('close', function () {
                debug('socket close', id, +new Date())
              })

              pump(stream, docker(image, dopts), debugStream(), stream, function(err) {
                if (proxy) proxy.close()
                server.emit('kill', container)
                delete containers[id]
              })
            })
          })
      })
    })
  })

  server.all(cors())

  server.all(function(req, res, next) {
    var host = req.headers.host || ''
    var i = host.indexOf('.c.')

    if (i > -1) {
      var id = host.slice(0, i)
      var container = containers.hasOwnProperty(id) && containers[id]
      if (container) return pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+req.url), res)
      return res.error(404, 'Could not find container')
    }

    next()
  })

  server.get('/-/*', function(req, res) {
    send(req, req.params.glob, {root:path.join(__dirname, 'web')}).pipe(res)
  })

  server.get('/containers/{id}', function(req, res) {
    var id = req.params.id
    var container = containers.hasOwnProperty(id) && containers[id]
    if (!container) return res.error(404, 'Could not find container')
    res.send(container)
  })

  server.all('/http/{id}/*', function(req, res) {
    var id = req.params.id
    var url = req.url.slice(('/http/'+id).length)
    var container = containers.hasOwnProperty(id) && containers[id]
    if (!container) return res.error(404, 'Could not find container')
    pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+url), res)
  })

  server.all('/files/{id}/*', function(req, res) {
    var id = req.params.id
    var url = req.url.slice(('/files/'+id).length)
    var container = containers.hasOwnProperty(id) && containers[id]
    if (!container) return res.error(404, 'Could not find container')
    pump(req, request('http://'+DOCKER_HOST+':'+container.ports.fs+url), res)
  })

  server.all(function(req, res, next) {
    if (!opts.offline) return next()
    var id = req.connection.address().address
    var container = containers.hasOwnProperty(id) && containers[id]
    if (container) return pump(req, request('http://'+DOCKER_HOST+':'+container.ports.http+req.url), res)
    next()
  })

  server.get('/bundle.js', '/-/bundle.js')
  server.get('/index.html', '/-/index.html')
  server.get('/', '/-/index.html')

  return server
}
