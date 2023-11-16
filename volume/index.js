"use strict";

var libQ = require("kew");
var fs = require("fs-extra");
var config = new (require("v-conf"))();
var exec = require("child_process").exec;
var execSync = require("child_process").execSync;
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const fetch = require("node-fetch");

module.exports = volume;
function volume(context) {
  var self = this;

  self.context = context;
  self.commandRouter = this.context.coreCommand;
  self.logger = this.context.logger;
  self.configManager = this.context.configManager;
}

volume.prototype.onVolumioStart = function () {
  var self = this;
  // setup serial port connected to adc potentiometer
  self.serial = new SerialPort({
    path: "/dev/serial0",
    baudRate: 115200,
    autoOpen: false,
  });

  var configFile = this.commandRouter.pluginManager.getConfigurationFile(
    this.context,
    "config.json"
  );
  this.config = new (require("v-conf"))();
  this.config.loadFile(configFile);

  // set default sound levels on other mixer
  execSync("/usr/bin/amixer -c 1 -M set Speaker 45%");

  return libQ.resolve();
};

volume.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();

  self.serial.on("error", function (err) {
    self.logger.Error("Volume::Error serial: " + err.message);
  });

  self.serial.open(function (err) {
    if (err) {
      return self.logger.Error("Volume::Error opening port: " + err.message);
      console.log(err);
    }

    // Because there's no callback to write, write errors will be emitted on the port:
    self.logger.info("Volume::port opened");
    //  port.write("main screen turn on");
    defer.resolve();
  });

  const parser = self.serial.pipe(new ReadlineParser({ delimiter: "\n" }));
  const re = /([0-9]+)|([0-9]+)/g;
  let lastInter = -10;
  let lastVolume = 0;
  let sending = false;
  parser.on("data", (data) => {
    const matches = data.match(re);
    self.serial.flush((err, res) => {
      // flush serial so we don't get old messages
    });
    if (matches && matches.length > 1) {
      let inter = parseInt(matches[0], 10);
      let vol = parseInt(matches[1], 10);
      // check its a new volume value
      if (lastInter !== inter) {
        let diff = Math.abs(vol - lastVolume);
        lastInter = inter;
        if (sending === false) {
          // old potentiometer is sometimes jumping a bit
          if (diff > 3) {
            sending = true;
            // since we dont use volumio to change the volume but go directly to the mixer we need our own top volume
            if (vol > 90) {
              vol = 90;
            }
            lastVolume = vol;

            exec(`/usr/bin/amixer -c 1 -M set Playback ${vol}%`, (err, res) => {
              self.logger.info("Volume::change volume changed to " + vol);
              sending = false;
            });
        }
      }
    }
  });

  // Once the Plugin has successfull started resolve the promise

  return defer.promise;
};

volume.prototype.onStop = function () {
  var self = this;
  var defer = libQ.defer();
  self.serial.close((err) => {
    self.logger.Error("close error"+ err);
    defer.resolve();
  });

  // Once the Plugin has successfull stopped resolve the promise
  //defer.resolve();

  return libQ.resolve();
};

volume.prototype.onRestart = function () {
  var self = this;
  // Optional, use if you need it
};

// Configuration Methods -----------------------------------------------------------------------------

volume.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  var self = this;

  var lang_code = this.commandRouter.sharedVars.get("language_code");

  self.commandRouter
    .i18nJson(
      __dirname + "/i18n/strings_" + lang_code + ".json",
      __dirname + "/i18n/strings_en.json",
      __dirname + "/UIConfig.json"
    )
    .then(function (uiconf) {
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });

  return defer.promise;
};

volume.prototype.getConfigurationFiles = function () {
  return ["config.json"];
};

volume.prototype.setUIConfig = function (data) {
  var self = this;
  //Perform your installation tasks here
};

volume.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};

volume.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};
