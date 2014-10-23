var docker = require('docker-browser-console')
var websocket = require('websocket-stream')
var pump = require('pump')
var url = require('url')

var u = url.parse(location.toString(), true)
var terminal = docker()
var url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host+'/'+(u.query.id || '')

pump(terminal, websocket(url), terminal)
terminal.appendTo(document.getElementById('console'))