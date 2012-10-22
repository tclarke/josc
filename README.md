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
 * Framework for the browser side but it's not working (need a browser version of node's Buffer)

