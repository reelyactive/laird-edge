/*
 * Copyright reelyActive 2020
 * We believe in an open Internet of Things
 */


const dgram = require('dgram');
const http = require('http');
const https = require('https');
const dns = require('dns');
const querystring = require('querystring');
const Barnowl = require('barnowl');
const BarnowlLaird = require('barnowl-laird');
const DirActDigester = require('diract-digester');
const Raddec = require('raddec');
const RaddecFilter = require('raddec-filter');
const { Client } = require('@elastic/elasticsearch');
const config = require('../config/config');


// Load the configuration parameters
const raddecTargets = config.raddecTargets;
const diractProximityTargets = config.diractProximityTargets;
const diractDigestTargets = config.diractDigestTargets;
const barnowlOptions = {
    enableMixing: config.enableMixing,
    mixingDelayMilliseconds: config.mixingDelayMilliseconds
};
const raddecOptions = {
    includeTimestamp: config.includeTimestamp,
    includePackets: config.includePackets
};
const raddecFilterParameters = config.raddecFilterParameters;
const useElasticsearch = (config.esNode !== null);
const useDigester = (config.diractProximityTargets.length > 0) ||
                    (config.diractDigestTargets.length > 0);
let digesterOptions = {};
if(config.diractProximityTargets.length > 0) {
  digesterOptions.handleDirActProximity = handleDirActProximity;
};
if(config.diractDigestTargets.length > 0) {
  digesterOptions.handleDirActDigest = handleDirActDigest;
};
const isDebugMode = config.isDebugMode;


// Constants
const DEFAULT_RADDEC_PATH = '/raddecs';
const DEFAULT_UA_PATH = '/collect';
const DEFAULT_UA_HOST = 'www.google-analytics.com';
const DEFAULT_UA_PAGE = '/laird-gateway';
const INVALID_DNS_UPDATE_MILLISECONDS = 2000;
const STANDARD_DNS_UPDATE_MILLISECONDS = 60000;
const ES_MAX_QUEUED_DOCS = 12;
const ES_RADDEC_INDEX = 'raddec';
const ES_DIRACT_PROXIMITY_INDEX = 'diract-proximity';
const ES_DIRACT_DIGEST_INDEX = 'diract-digest';
const ES_MAPPING_TYPE = '_doc';


// Update DNS
updateDNS();

// Create a UDP client
let client = dgram.createSocket('udp4');
client.on('listening', function() {
  client.setBroadcast(config.isUdpBroadcast);
});

// Create HTTP and HTTPS agents for webhooks
let httpAgent = new http.Agent({ keepAlive: true });
let httpsAgent = new https.Agent({ keepAlive: true });

// Create Elasticsearch client
let esClient;
let esDocs;
let isEsCallPending = false;
if(useElasticsearch) {
  esClient = new Client({ node: config.esNode });
  esDocs = new Map();
}

// Create raddec filter
let filter = new RaddecFilter(raddecFilterParameters);

// Create diract digester
let digester = new DirActDigester(digesterOptions);

// Create barnowl instance with serial listener
let barnowl = new Barnowl(barnowlOptions);
barnowl.addListener(BarnowlLaird, {}, BarnowlLaird.SerialListener, {});

// Forward the raddec to each target
barnowl.on('raddec', function(raddec) {
  if(filter.isPassing(raddec)) {
    raddecTargets.forEach(function(target) {
      forward(raddec, target);
    });
    if(useDigester) {
      digester.handleRaddec(raddec);
    }
  }
});


/**
 * Forward the given raddec to the given target, observing the target protocol.
 * @param {Raddec} raddec The outbound raddec.
 * @param {Object} target The target host, port and protocol.
 */
function forward(raddec, target) {
  switch(target.protocol) {
    case 'udp':
      if(target.isValidAddress) {
        let raddecHex = raddec.encodeAsHexString(raddecOptions);
        client.send(Buffer.from(raddecHex, 'hex'), target.port, target.address,
                    function(err) { });
      }
      break;
    case 'webhook':
      target.options = target.options || {};
      target.options.path = target.options.path || DEFAULT_RADDEC_PATH;
      post(raddec, target);
      break;
    case 'elasticsearch':
      let id = raddec.timestamp + '-' + raddec.transmitterId + '-' +
               raddec.transmitterIdType;
      let esRaddec = raddec.toFlattened(raddecOptions);
      esRaddec.timestamp = new Date(esRaddec.timestamp).toISOString();
      esHandleDoc(id, ES_RADDEC_INDEX, esRaddec);
      break;
    case 'ua':
      target.host = target.host || DEFAULT_UA_HOST;
      target.port = target.port || 443;
      target.options = target.options || {};
      target.options.path = target.options.path || DEFAULT_UA_PATH;
      if(!(target.options.useHttps === false)) {
        target.options.useHttps = true;
      }
      let data = {
          v: '1',
          tid: target.tid,
          cid: raddec.transmitterId + '/' + raddec.transmitterIdType,
          t: 'pageview',
          dp: target.options.page || DEFAULT_UA_PAGE
      };
      post(data, target, true);
      break;
  }
}


/**
 * HTTP POST the given JSON data to the given target.
 * @param {Object} data The data to POST.
 * @param {Object} target The target host, port and protocol.
 * @param {boolean} toQueryString Convert the data to query string?
 */
function post(data, target, toQueryString) {
  target.options = target.options || {};
  let dataString;
  let headers;

  if(toQueryString) {
    dataString = querystring.encode(data);
    headers = { "Content-Length": dataString.length };
  }
  else {
    dataString = JSON.stringify(data);
    headers = {
        "Content-Type": "application/json",
        "Content-Length": dataString.length
    };
  }

  let options = {
      hostname: target.host,
      port: target.port,
      path: target.options.path || '/',
      method: 'POST',
      headers: headers
  };
  let req;
  if(target.options.useHttps) {
    options.agent = httpsAgent;
    req = https.request(options, function(res) { });
  }
  else {
    options.agent = httpAgent;
    req = http.request(options, function(res) { });
  }
  req.on('error', handleError);
  req.write(dataString);
  req.end();
}


/**
 * Handle an Elasticsearch doc, initiating bulk update if no API call pending.
 * @param {Object} params The parameters.
 */
function esHandleDoc(id, index, doc) {
  while(esDocs.size >= ES_MAX_QUEUED_DOCS) {
    let oldestKey = esDocs.keys().next().value;
    esDocs.delete(oldestKey);
  }

  esDocs.set({ id: id, index: index }, doc);

  if(!isEsCallPending) {
    esBulk();
  }
}


/**
 * Perform Elasticsearch bulk update iteratively until there are no more docs.
 */
function esBulk() {
  let body = [];
  isEsCallPending = true;

  esDocs.forEach(function(doc, key) {
    body.push({ "create": { "_index": key.index, "_id": key.id } });
    body.push(doc);
  });
  esDocs.clear();

  esClient.bulk({ body: body }, function(err, result) {
    let isMoreEsDocs = (esDocs.size > 0);
    if(err) {
      handleError(err);
    }
    if(isMoreEsDocs) {
      esBulk();
    }
    else {
      isEsCallPending = false;
    }
  });
}


/**
 * Handle a DirAct proximity packet by forwarding to all targets.
 * @param {Object} proximity The DirAct proximity data.
 */
function handleDirActProximity(proximity) {
  diractProximityTargets.forEach(function(target) {
    switch(target.protocol) {
      case 'webhook':
        post(proximity, target);
        break;
      case 'elasticsearch':
        let id = proximity.timestamp + '-' + proximity.instanceId;
        let esProximity = Object.assign({}, proximity);
        esProximity.timestamp = new Date(proximity.timestamp).toISOString();
        esHandleDoc(id, ES_DIRACT_PROXIMITY_INDEX, esProximity);
        break;
    }
  });
}


/**
 * Handle a DirAct digest packet by forwarding to all targets.
 * @param {Object} digest The DirAct digest data.
 */
function handleDirActDigest(digest) {
  diractDigestTargets.forEach(function(target) {
    switch(target.protocol) {
      case 'webhook':
        post(digest, target);
        break;
      case 'elasticsearch':
        let id = digest.timestamp + '-' + digest.instanceId;
        let esDigest = Object.assign({}, digest);
        esDigest.timestamp = new Date(digest.timestamp).toISOString();
        esHandleDoc(id, ES_DIRACT_DIGEST_INDEX, esDigest);
        break;
    }
  });
}


/**
 * Perform a DNS lookup on all hostnames where the UDP protocol is used,
 * and self-set a timeout to repeat the process again.
 */
function updateDNS() {
  let nextUpdateMilliseconds = STANDARD_DNS_UPDATE_MILLISECONDS;

  // If there are invalid UDP addresses, shorten the update period
  raddecTargets.forEach(function(target) {
    if((target.protocol === 'udp') && !target.isValidAddress) {
      nextUpdateMilliseconds = INVALID_DNS_UPDATE_MILLISECONDS;
    }
  });

  // Perform a DNS lookup on each UDP target
  raddecTargets.forEach(function(target) {
    if(target.protocol === 'udp') {
      dns.lookup(target.host, {}, function(err, address, family) {
        if(err) {
          handleError(err);
          target.isValidAddress = false;
        }
        else {
          target.address = address;
          target.isValidAddress = true;
        }
      });
    }
  });

  // Schedule the next DNS update
  setTimeout(updateDNS, nextUpdateMilliseconds);
}


/**
 * Handle the given error by blinking the red LED and, if debug mode is enabled,
 * print the error to the console.
 * @param {Object} err The error to handle.
 */
function handleError(err) {
  // TODO: turn on LED
  if(isDebugMode) {
    console.log(err);
  }
  // TODO: turn off LED
}
