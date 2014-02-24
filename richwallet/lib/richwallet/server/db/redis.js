var DB = require('../db');
var config = require('../config');

if(process.env.NODE_ENV == 'test')
  var redis = require('redis-mock');
else
  var redis = require('redis');

function ArgumentError(message) {
  this.name = 'ArgumentError';
  this.message = message || 'missing arguments';
}

ArgumentError.prototype = new Error();
ArgumentError.prototype.constructor = ArgumentError;

DB.prototype = {
  connect: function() {
    this.redis = redis.createClient(config.redisConnection.port,
				    config.redisConnection.host,
				   config.redisConnection.option);
  },

  getWalletRecord: function(serverKey, callback) {
    this.redis.hgetall(serverKey, function(err, payload) {
      if(err)
        return callback(err);
      callback(undefined, payload);
    });
  },

  setAuthKey: function(serverKey, authKey, callback) {
    this.redis.hmset(serverKey, 'authKey', authKey, function(err, res) {
      if(err)
        return callback(err);
      callback(undefined, true);
    });
  },

  disableAuthKey: function(serverKey, callback) {
    this.redis.hdel(serverKey, 'authKey', function(err, res) {
      if(err)
        return callback(err);
      callback(undefined, true);
    });
  },

  getWallet: function(serverKey, callback) {
    this.getWalletRecord(serverKey, function(err, payload) {
      if(err)
        return callback(err);
      if(!payload)
        return callback(undefined, null);

      callback(undefined, payload.wallet);
    });
  },

  set: function(serverKey, payload, callback) {
    var self = this;

    if(!payload || (payload && !payload.wallet))
      callback('missing wallet payload');

    this.redis.hgetall(serverKey, function(err, res) {
      if(err)
        callback('database error: '+err);

      if(res && res.payloadHash != undefined && res.payloadHash != 'undefined' && payload.originalPayloadHash != undefined && payload.originalPayloadHash != res.payloadHash) {
        self.getWallet(serverKey, function(err, wallet) {
          return callback('outOfSync', {wallet: wallet});
        });
      } else {
        if(payload.newPayloadHash)
          payload.payloadHash = payload.newPayloadHash;

        delete payload.originalPayloadHash;
        delete payload.newPayloadHash;

        self.redis.hmset(serverKey, payload, callback);
      }
    });
    
  },

  delete: function(serverKey, callback) {
    this.redis.del(serverKey, function(err, res) {
      if(err)
        callback(err);
        
      if(res == 1)
        callback(undefined, true);
      else
        callback(undefined, false);
    });
  },
  
  checkEmailExists: function(email, callback) {
    var email = email.toString().toLowerCase();
    var self = this;
    this.redis.keys('*', function(err, serverKeys) {
      if(err)
        return callback(err);
      
      for(var k=0;k<serverKeys.length;k++)
        self.redis.hmget(serverKeys[k], 'email', function(err, res) {
          if(err)
            return callback(err);
          if(res.toString().toLowerCase() == email)
            return callback(undefined, true)
        });

      callback(undefined, false)
    });
  }
};

module.exports = DB;
