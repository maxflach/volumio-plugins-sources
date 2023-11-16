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

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
}

volume.prototype.onVolumioStart = function () {
  var self = this;
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

  execSync("/usr/bin/amixer -c 1 -M set Speaker 45%");

  return libQ.resolve();
};

volume.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();

  self.serial.on("error", function (err) {
    console.log("Error serial: ", err.message);
  });

  self.serial.open(function (err) {
    if (err) {
      return console.log("Error opening port: ", err.message);
      console.log(err);
    }

    // Because there's no callback to write, write errors will be emitted on the port:
    console.log("port opened");
    //  port.write("main screen turn on");
    defer.resolve();
  });

  const parser = self.serial.pipe(new ReadlineParser({ delimiter: "\n" }));
  const re = /([0-9]+)|([0-9]+)/g;
  let lastInter = -10;
  let lastVolume = 0;
  let sending = false;
  parser.on("data", (data) => {
    // console.log("parser data: ", data);
    const matches = data.match(re);
    self.serial.flush((err, res) => {
      //console.log("Flush", err, res);
    });
    if (matches && matches.length > 1) {
      let inter = parseInt(matches[0], 10);
      let vol = parseInt(matches[1], 10);

      if (lastInter !== inter) {
        let diff = Math.abs(vol - lastVolume);
        lastInter = inter;
        if (sending === false) {
          if (diff > 3) {
            sending = true;
            if (vol > 90) {
              vol = 90;
            }
            lastVolume = vol;

            exec(`/usr/bin/amixer -c 1 -M set Playback ${vol}%`, (err, res) => {
              //console.log("volume changed", res);
              sending = false;
            });

            /*fetch(
              "http://localhost:3000/api/v1/commands/?cmd=volume&volume=" +
                lastVolume,
              {
                method: "GET",
                headers: {},
              }
            )
              .then((res) => res.json())
              .then((resp) => {
                console.log(resp);
                sending = false;
              })
              .catch(console.error.bind(console)); */
          }
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
    console.log("close error", err);
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
