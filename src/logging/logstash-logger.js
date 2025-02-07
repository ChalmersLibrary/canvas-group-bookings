'use strict';

const fetch = require("node-fetch");

class LogstashLogger {
  constructor(logstashBaseUrl, logstashUsername, logstashPassword, source) {
    this.logstashBaseUrl = logstashBaseUrl;
    this.logstashUsername = logstashUsername;
    this.logstashPassword = logstashPassword;
    this.source = source;
  }

  async sendToLogstash(data) {
    if (this.logstashBaseUrl) {
      try {
        let encodedLogin = Buffer.from(this.logstashUsername + ":" + this.logstashPassword, "binary").toString("base64");
        let response = await fetch(this.logstashBaseUrl, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Authorization": "Basic " + encodedLogin,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          throw new Error("Response was (" + response.status + "): " + await response.text());
        }
      } catch (error) {
        console.log("Failed to send log message to Logstash", error);
      }
    }
  }

  async info(msg) {
    await this.sendToLogstash({
      Type: "Info",
      Time: new Date().toISOString(),
      Source: this.source,
      Message: msg
    });
  }

  async warn(msg) {
    await this.sendToLogstash({
      Type: "Warning",
      Time: new Date().toISOString(),
      Source: this.source,
      Message: msg
    });
  }

  async error(msg) {
    await this.sendToLogstash({
      Type: "Error",
      Time: new Date().toISOString(),
      Source: this.source,
      Message: msg
    });
  }
}

module.exports = { LogstashLogger };