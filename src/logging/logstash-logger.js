'use strict';

/* fetch is the runtime's own. The polyfill this used to import announced itself in the user agent
   on every request, which is a needless dependency on the credential path. */

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
          console.error("Failed to send log message to Logstash:", response.status, await response.text());
          throw new Error("Response was (" + response.status + "): " + await response.text());
        }
      } catch (error) {
        console.log("Failed to send log message to Logstash", error);
      }
    }
  }

  /*
   * The structured half of a log entry, under its own key rather than flattened into Message, so
   * an existing consumer of Message is unaffected. Omitted entirely when there is nothing to send,
   * which keeps the payload byte-identical to what it was for every call that passes no detail.
   *
   * Whatever arrives here has already been through the redaction in ./index.js. Nothing should be
   * passed to it directly.
   */
  entry(type, msg, data) {
    const payload = {
      Type: type,
      Time: new Date().toISOString(),
      Source: this.source,
      Message: msg !== null && typeof msg === 'object' ? JSON.stringify(msg) : String(msg)
    };

    if (data !== undefined && data !== null && !(Array.isArray(data) && data.length === 0)) {
      payload.Data = data;
    }

    return payload;
  }

  async info(msg, data) {
    await this.sendToLogstash(this.entry("Info", msg, data));
  }

  async error(msg, data) {
    await this.sendToLogstash(this.entry("Error", msg, data));
  }
}

module.exports = { LogstashLogger };