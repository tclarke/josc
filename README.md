josc
====
Open Sound Control (OSC) library for javascript including a proxy using WebSockets and node.js.

josc is licensed under the AGPL v3.0. (see http://opensource.org/licenses/AGPL-3.0)

The node.js portion requires the ws module:
npm install ws
npm install prototype

This will only run in a web server with WebSockets.

Current status
==============
Still in the prototype stage so do not expect the API to be anything close to stable.
Current features:
 * WebSocket based streams for node.js (send and receive)
 * Basic UDP datagram send/receive from node.js
 * Framework for the browser side.

Examples
========
osc_test_server.js - A basic WebSocket echo server. Can be used with osc__test__client.js or the browser client.
osc_test_client.js - Sends a bundle then waits for a response and displays it.
osc_proxy.js - A UDP/WebSocket proxy. WebScoket listens on localhost:8080. UDP sends to localhost:7000 and listens on localhost:4444. This listens for WebSocket connections and forwards packets to UDP. Incoming UDP is forwarded to all active WebSocket connections.
brower/ - A basic web app which displays a button and an "LED". The button sends to address /led/1 and uses floats 0.0/1.0 to toggle state. The "LED" listens to /button/1 and uses floats 0.0/1.0 to toggle state.
static_webserver.js - A simple node.js web server which listens on localhost:8100 and serves data for the browser/ example.
oscontrol_test_form.xml - A layout for [OSControl][1] which has a button and an LED which are counterparts to the button and LED in the browser. It should send to localhost:4444 and listen on localhost:7000.

[1]: https://sourceforge.net/projects/oscontrol/        "OSControl on sourceforge"
