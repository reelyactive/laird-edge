laird-edge
==========

Edge software for Laird Connectivity gateways.  Forwards [raddecs](https://github.com/reelyactive/raddec/) from the gateway's BL654 Bluetooth Low Energy module to:
- a remote server via UDP and/or webhook (HTTP POST), _and/or_
- an Elasticsearch database, _and/or_
- Google Analytics


Installation
------------

From the gateway, clone this repository, browse to its root, then run:

    npm install

The [serialport](https://www.npmjs.com/package/serialport) dependency may fail.  In this case, a version of serialport precompiled for Laird Linux will need to be manually copied to the node_modules folder.


Configuration
-------------

All configuration parameters can be found in the file __config/config.js__.  Update only this file, as required.

| Parameter                 | Description                                     | 
|:--------------------------|:------------------------------------------------|
| RADDEC_TARGETS            | Array of targets for raddec data (see below)    |
| DIRACT_PROXIMITY_TARGETS  | Array of targets for diract-proximity data      |
| DIRACT_DIGEST_TARGETS     | Array of targets for diract-digest data         |
| ES_NODE                   | Path to Elasticsearch node                      |
| IS_UDP_BROADCAST          | Set to true only if target is UDP broadcast (default: true) |
| ENABLE_MIXING             | Combine multiple decodings of an individual transmitter into a single raddec (default: true) |
| MIXING_DELAY_MILLISECONDS | Mixing delay of radio decodings (default: 1000) |
| RADDEC_FILTER_PARAMETERS  | (see raddec-filter)                             |
| INCLUDE_TIMESTAMP         | Include the optional timestamp in each raddec (default: true) |
| INCLUDE_PACKETS           | Include the optional packets in each raddec (default: true) |
| IS_DEBUG_MODE             | Set true and run in console to see log output   |

Each raddec target in the RADDEC_TARGETS array is an object with the following properties:
- _host_: an IP address or hostname (ex: '192.168.1.10')
- _port_: the target port (default: 50001)
- _protocol_: either 'udp', 'webhook' (HTTP POST), 'elasticsearch' or 'ua' (Google Analytics)
- _tid_: required only for Google Analytics (ex: 'UA-1234567-8')
- _options_: based on the _protocol_ as follows
    * webhook defaults are { useHttps: false, path: "/raddecs" }
    * ua defaults are { useHttps: true, path: "/collect", page: "/laird-gateway" }

To broadcast UDP to all devices on the subnet, set the _host_ to the corresponding broadcast address (ex: 255.255.255.255) and set IS_UDP_BROADCAST to true.

The DIRACT_PROXIMITY_TARGETS and DIRACT_DIGEST_TARGETS support the 'webhook' and 'elasticsearch' protocols, as described above.



License
-------

MIT License

Copyright (c) 2020 [reelyActive](https://www.reelyactive.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
THE SOFTWARE.