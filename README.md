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