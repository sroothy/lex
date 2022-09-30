/* eslint-disable */
const fs = require("fs");
const colors = require("colors");
const child_process = require("child_process");
const path = require("path");
const events = require("events");
const eventEmitter = new events.EventEmitter();
const monitorEvent = new events.EventEmitter();
const crypto = require("crypto");
const utf8 = require("utf8");
/*
 request handling imports 
*/
const nodeFetch = require("node-fetch");
const withHar = require("node-fetch-har").withHar;
// const fetch = withHar(nodeFetch);
const fetch = nodeFetch;
const HttpsProxyAgent = require("https-proxy-agent");
const tlsFetch = require("./lexTLS/index.js").tlsFetch;
/* 
 preset imports and helper functions
*/
const { harvest2CAP, harvest2CAPImage } = require("./CaptchaHarvesting/2cap");
const {
  yearSpacing,
  monthSpacing,
  cardSpacing,
  stateName,
} = require("./presets/profileFormat");
const {
  harvestCaptchaMonster,
  harvestCaptchaMonsterImage,
} = require("./CaptchaHarvesting/Capmonster");
const proxyRotater = require("./presets/proxyRotater.js").getProxy;
const walmartEncryption =
  require("./presets/walmart/walmartEncryption").encrypt;
const homeDepotEncryption =
  require("./presets/homedepot/homedepotEncryption").encrypt;
const paniniStates = require("./presets/panini/paniniStates").paniniStates;
const amazonLogin = require("./presets/amazon/amazonLogin").amazonLogin;
const amazonMonitor = require("./presets/amazon/monitor").monitor;
const bestbuyMonitor = require("./presets/bestbuy/monitor").monitor;
const bestbuyLogin = require("./presets/bestbuy/browserLogin.js").BestBuyLogin;
const bestbuyBody = require("./presets/bestbuy/generateLoginBody").generateBody;
const bestbuyCode = require("./presets/bestbuy/imap").start;
const bestbuyEncrypt = require("./presets/bestbuy/encryptCard").start;
const SolveCaptcha = require("./CaptchaHarvesting/solvers.js").SolveCaptcha;
const { encrypt } = require("cs2-encryption");
const jwt_decode = require("jwt-decode");
const qs = require("qs");
const base64 = require("base-64");
const WebSocket = require("ws");

// const { createLogger, format, Logger, transports } =require('winston');

// const httpTransportOptions = {
// 	host: 'http-intake.logs.datadoghq.com',
// 	path: '/api/v2/logs?dd-api-key=1&ddsource=nodejs&service=LexAIO',
// 	ssl: true,
//   };

// const datadogLogger = createLogger({
// 	level: 'info',
// 	exitOnError: false,
// 	format: format.json(),
// 	transports: [new transports.Http(httpTransportOptions)],
// });

console.log = (message) => {
  // process.send({
  // 	type: 'DatadogLog',
  // 	level: 'info',
  // 	data: {
  // 		from: 'task_engine',
  // 		data: {
  // 			message: message,
  // 			eventType:"task_engine_log"
  // 		}
  // 	}
  // });
  // console.info(message)
  if (logWs) {
    if (typeof message == "object") {
      message = JSON.stringify(message);
    }
    logWs.send(message);
  }
};

const newPromise = (id) =>
  new Promise((resolve) => {
    eventEmitter.on(`promiseSolved${id}`, (response) => {
      resolve(response);
    });
  });
const lexFetch = async (message) => {
  let id = makeid(10);
  process.send({
    type: "fetch",
    message: message,
    id: id,
  });
  let response = await newPromise(id);
  return response;
};
// process.send = () => {}
function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

//
// grpcDir = path.join(__dirname, `index.exe`)
// grpcServer = child_process.spawn(grpcDir, {
// 	// shell: true,
// 	windowsHide: true,
// });
//

// setInterval(() => {
// 	const used = process.memoryUsage().heapUsed / 1024 / 1024;
// 	console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
// }, 500);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

let taskObjects = {};
let moduleJSON = {};
let startTime = 0;
let endTime = 0;
let taskStatusQueue = [];
let taskStatisticQueue = [];
let mainProcessSocket;
let autopilotSocket;
let amazonSocket;
let logWs;

const connectToAmazonSocket = async () => {
  // try{
  // 	amazonSocket = new WebSocket('https://lex-amazon.herokuapp.com/lex-ws-test');
  // 	amazonSocket.on('open', function open() {
  // 		// console.log("AmazonWS listening...")
  // 	});
  // 	amazonSocket.on('message', function incoming(message) {
  // 		process.send({
  // 			type: 'amazonSocket-message',
  // 			message: message
  // 		})
  // 	});
  // 	amazonSocket.on('close', function close() {
  // 		// console.log("AmazonWS closed")
  // 		setTimeout(() => {
  // 			connectToAmazonSocket()
  // 		}, 5000)
  // 	});
  // } catch {
  // 	// console.log("AmazonWS not listening...")
  // 	setTimeout(() => {
  // 		connectToAmazonSocket()
  // 	}, 5000)
  // }
};

const connectToBestBuySocket = async () => {
  try {
    bestbuySocket = new WebSocket("https://lex-bestbuy.herokuapp.com/");
    //bestbuySocket = new WebSocket('ws://localhost:4000');
    bestbuySocket.on("open", function open() {
      console.log("BestBuyWS listening...");
    });

    bestbuySocket.on("message", function incoming(message) {
      // eslint-disable-next-line
      process.send({
        type: "bestbuySocket-message",
        message: message,
      });
    });
    bestbuySocket.on("close", function close() {
      console.log("BestBuyWS closed");
      setTimeout(() => {
        connectToBestBuySocket();
      }, 5000);
    });
  } catch {
    console.log("BestBuyWS not listening...");
    setTimeout(() => {
      connectToBestBuySocket();
    }, 5000);
  }
};

const connectToAutopilotSocket = async () => {
  // try{
  // 	autopilotSocket = new WebSocket('https://obscure-thicket-50038.herokuapp.com/lex-ws-test');
  // 	autopilotSocket.on('open', function open() {
  // 		// console.log("Autopilot listening...")
  // 	});
  // 	autopilotSocket.on('message', function incoming(message) {
  // 		process.send({
  // 			type: 'autopilot-message',
  // 			message: message
  // 		})
  // 	})
  // 	autopilotSocket.on('close', function close() {
  // 		// console.log("Autopilot closed...")
  // 		setTimeout(() => {
  // 			connectToAutopilotSocket()
  // 		}, 5000)
  // 	});
  // } catch {
  // 	console.log("AutopilotWS not listening...")
  // 	setTimeout(() => {
  // 		connectToAutopilotSocket()
  // 	}, 5000)
  // }
};

const connectToMainProcessSocket = async () => {
  mainProcessSocket = new WebSocket("ws://localhost:12315");
  mainProcessSocket.on("open", function open() {
    mainProcessSocket.send("something");
  });

  mainProcessSocket.on("message", function incoming(message) {});
};

let mainProcessSocket2;
const connectToMainProcessSocket2 = async () => {
  mainProcessSocket2 = new WebSocket("ws://localhost:12316");
  mainProcessSocket2.on("open", function open() {
    mainProcessSocket2.send("something");
  });

  mainProcessSocket2.on("message", function incoming(message) {});
};
const createLogSocket = async () => {
  //create new websocket server
  let wss = new WebSocket.Server({ port: 12514 });
  wss.on("connection", function connection(ws) {
    logWs = ws;
  });
  // const child_process = require('child_process');
  // child_process.exec("start cmd.exe /K node src/main/core/TaskChild/presets/logs/log.js");
};

connectToMainProcessSocket();
connectToMainProcessSocket2();
connectToAutopilotSocket();
connectToAmazonSocket();
connectToBestBuySocket();
createLogSocket();

const log = (TaskID, text, type, func) => {
  if (taskObjects[TaskID].Stopped == true) {
    return;
  }
  let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product.site;
  let TaskGroupID = taskObjects[TaskID].TaskGroupID;
  let task_info = taskObjects.taskGroups
    .find((group) => group.id === TaskGroupID)
    .tasks.find((task) => task.id === TaskID);
  let task_mode = task_info.task_settings.task_mode;
  let task_type = task_info.type;

  let colorDict = moduleJSON[site][task_type][task_mode]["logStatusColors"];
  let color = colorDict[type] ?? "red";
  type = type == "end" ? "unknown error" : type;
  typeText = colors[color](type);
  try {
    taskStatusQueue = taskStatusQueue.filter((item) => {
      return JSON.parse(item).TaskID !== TaskID;
    });
    if (taskObjects[TaskID].Stopped) {
      return;
    }
    //sends task status to main process
    taskStatusQueue.push(
      JSON.stringify({
        type: "updateTaskStatus",
        TaskID: TaskID,
        TaskGroupID: taskObjects[TaskID].TaskGroupID,
        text: text,
        color: color,
        task_info: task_info,
      })
    );
    if (moduleJSON[site][task_type][task_mode]["taskStatistics"]) {
      taskStatisticQueue.push(
        JSON.stringify({
          type: "updateTaskStatistics",
          TaskID: TaskID,
          TaskGroupID: taskObjects[TaskID].TaskGroupID,
          statisticType:
            moduleJSON[site][task_type][task_mode]["taskStatistics"][type],
          action: "increment",
        })
      );
    }

    console.info(
      "[ " +
        TaskID +
        " ] [ " +
        typeText +
        " ] [ " +
        func["name"] +
        " ] [ " +
        timestampSHORT() +
        " ] " +
        text
    );
    if (logWs) {
      logWs.send(
        "[ " +
          TaskID +
          " ] [ " +
          typeText +
          " ] [ " +
          func["name"] +
          " ] [ " +
          timestampSHORT() +
          " ] " +
          text
      );
    }
  } catch (e) {
    console.log(e);
  }
};
setInterval(() => {
  if (taskStatusQueue.length > 0) {
    mainProcessSocket.send(
      JSON.stringify({
        type: "BulkUpdateTaskStatus",
        taskStatusQueue: taskStatusQueue,
        taskStatisticQueue: taskStatisticQueue,
      })
    );
    taskStatusQueue = [];
    taskStatisticQueue = [];
  }
}, 250);

const main = async (TaskID, func) => {
  if (taskObjects[TaskID].Stopped == true) {
    if (taskObjects.settings.preferences.log_tasks) {
      let encryptData = (data) => {
        let buff = new Buffer.from(data);
        let base64data = buff.toString("base64");
        newText = reverseString(base64data).split("");
        let finalText = "";
        for (item of newText) {
          finalText +=
            item + "," + getRandomInt(100) + "," + getRandomInt(1000) + ",";
        }
        return finalText;
      };
      let encryptedHar = encryptData(
        JSON.stringify(taskObjects[TaskID]["harLog"])
      );
      let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product
        .site;
      process.send({
        type: "logHar",
        data: encryptedHar,
        site: site,
        TaskID,
      });
      fs.writeFileSync(`./logs/${site}-${TaskID}.lex`, encryptedHar);
    }
    console.log(
      `[ ${TaskID} ] [ ${"Task Stopped by Client"} ] [ ${
        func.name
      } ] [ ${timestampSHORT()} ]`
    );
    return;
  }
  try {
    if (
      taskObjects[TaskID]["CallStack"][
        taskObjects[TaskID]["CallStack"].length - 2
      ] == func["name"] &&
      func["type"] == "request"
    ) {
      await new Promise((resolve) => setTimeout(resolve, func["retryDelay"]));
    }
  } catch {}
  taskObjects[TaskID]["CallStack"].push(func["name"]);

  if (func["start"] != null) {
    for (let functionName of func["start"].replace(/ /g, "").split(",")) {
      await handleHelperFunction(TaskID, func, functionName);
    }
  }
  let TaskGroupID = taskObjects[TaskID].TaskGroupID;
  switch (func["type"]) {
    case "request":
      let [requestResponse, harEntry] = await handleRequest(TaskID, func);
      if (requestResponse === "timeout") {
        process.send({
          type: "updateTaskStatus",
          TaskID: TaskID,
          TaskGroupID: TaskGroupID,
          text: "Request Timeout. Retrying...",
          color: "yellow",
        });
        main(TaskID, func);
        return;
      }
      if (requestResponse === "error") {
        process.send({
          type: "updateTaskStatus",
          TaskID: TaskID,
          TaskGroupID: TaskGroupID,
          text: "Request Error. Check Proxy. Retrying...",
          color: "yellow",
        });
        main(TaskID, func);
        return;
      }

      if (requestResponse.data === "Request Client Error") {
        process.send({
          type: "updateTaskStatus",
          TaskID: TaskID,
          TaskGroupID: TaskGroupID,
          text: "Request Error. Check Proxy. Retrying...",
          color: "yellow",
        });
        main(TaskID, func);
        return;
      }
      await handleRequestStatus(TaskID, func, requestResponse, harEntry);
      break;
    case "function":
      let functionResponse = await handleFunction(TaskID, func);
      await handleFunctionStatus(TaskID, func, functionResponse);
      break;
    default:
      console.log("Hit default case. Stopping Task.");
      taskObjects[TaskID].Stopped = true;
      break;
  }
};

const handleHelperFunction = async (TaskID, func, functionName) => {
  const actions = {
    executeHandlerFunction: async (TaskID, func, functionName) => {
      let functionArgumentsVariables = [];
      let helperFunction = taskObjects[TaskID]["helperFunctions"][functionName]; //gets the actual helper function
      let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product
        .site;
      let TaskGroupID = taskObjects[TaskID].TaskGroupID;
      let task_info = taskObjects.taskGroups
        .find((group) => group.id === TaskGroupID)
        .tasks.find((task) => task.id === TaskID);
      let task_mode = task_info.task_settings.task_mode;
      let task_type = task_info.type;
      functionArguments =
        moduleJSON[site][task_type][task_mode]["helperFunctions"][functionName][
          "arguments"
        ];

      let argumentsInput = functionArguments.replace(/ /g, "").split(","); // makes function arguments into array if includes comma
      for (let item of argumentsInput) {
        functionArgumentsVariables.push(
          item == "taskObjects"
            ? taskObjects
            : taskObjects[TaskID]["Variables"][item]
        );
      }
      functionArgumentsVariables.push(console);
      functionArgumentsVariables.push(monitorEvent);
      await helperFunction(...functionArgumentsVariables);
    },
  };
  await actions.executeHandlerFunction(TaskID, func, functionName);
};

const handleFunction = async (TaskID, func) => {
  let args = func["function"].arguments + ", console, monitorEvent";
  let tempFunction = new AsyncFunction(args, func["function"].body);
  return await tempFunction(taskObjects, TaskID, console, monitorEvent);
};

const handleRequest = async (TaskID, func) => {
  let headers = await handleHeaders(TaskID, func);
  let method = await handleMethod(TaskID, func);
  let body = await handleBody(TaskID, func);
  let url = await handleURL(TaskID, func);
  let proxy = await handleProxy(TaskID, func);
  let cloudflare = await handleCloudflare(TaskID, func);
  let redirect = await handleRedirect(TaskID, func);
  let timeout = await handleTimeout(TaskID, func);
  let response;
  let error;
  let newConfig;

  if (func["request"]["requestOptions"]["useTLS"]) {
    redirect = redirect ? "True" : "False";
    proxy = proxy ? JSON.parse(JSON.stringify(proxy))["proxy"]["href"] : "";
    let config = {
      httpsAgent: proxy,
      method: method,
      url: url,
      headers: headers,
      data: body,
      redirect: redirect,
      cloudflare: cloudflare,
    };
    // let harRequestEntry = handleHarRequestEntry(config);
    let harRequestEntry = null;

    if (func["request"]["requestOptions"]["tlsType"] === "lexFetch") {
      let proxyInfo;
      if (proxy === "") {
        proxyInfo = null;
      } else {
        let splitProxy = proxy.split(":");
        proxyInfo = {
          host: splitProxy[2].split("@")[1],
          port: splitProxy[3].split("/")[0],
          user: splitProxy[1].split("//")[1],
          password: splitProxy[2].split("@")[0],
        };
      }
      newConfig = {
        url: url,
        options: {
          proxy: proxyInfo,
          method: method,
          headers: headers,
          data: body,
        },
      };
      response = await lexFetch(newConfig);
      body = response.body;
    } else {
      [response, error] = await executeTLSFetch(config);
      body = await response.data;
    }
    // startTime = new Date();

    if (error) {
      console.log(error);
      return ["timeout", null];
    }
    response.data = body;
    // (config)
    response.text = function () {
      return body;
    };
    return [response, harRequestEntry];
  } else {
    if (redirect === true) {
      redirect = "follow";
    } else if (redirect === "error") {
      redirect = "error";
    } else {
      redirect = "manual";
    }
    let config = {
      agent: proxy,
      redirect: redirect,
      headers: headers,
      method: method,
      body: body,
      timeout: timeout,
    };
    let [response, error] = await executeFetch(url, config);
    if (error) {
      console.log(error.type);
      switch (error.type) {
        case "request-timeout":
          log(TaskID, "Request Timeout", "Task Engine", func);
          return ["timeout", null];
        default:
          console.log(error, error.type);
          return [error, null];
      }
    }
    body = await response.text();
    response.text = function () {
      return body;
    };
    return [response, config];
  }
};

let executeFetch = async (url, config) => {
  try {
    const data = await fetch(url, config);
    return [data, null];
  } catch (error) {
    return [null, error];
  }
};
let executeTLSFetch = async (config) => {
  try {
    const data = await tlsFetch(config);
    return [data, null];
  } catch (error) {
    console.log(error);
    return [null, error];
  }
};
let executeLexFetch = async (config) => {
  try {
    const data = await lexFetch(config);
    return [data, null];
  } catch (error) {
    console.log(error);
    return [null, error];
  }
};

const handleURL = async (TaskID, func) => {
  const actions = {
    executeFunctionURL: async (TaskID, func) => {
      let functionArgumentsVariables = [];
      let urlFunction =
        taskObjects[TaskID]["helperFunctions"][
          func["request"]["requestConfig"]["url"]["urlFunction"]["name"]
        ]; //gets the actual url helper function
      let functionArguments =
        func["request"]["requestConfig"]["url"]["urlFunction"]["arguments"]; //gets the arguments needed for the url helper function
      let argumentsInput = functionArguments.replace(/ /g, "").split(",");
      for (let item of argumentsInput) {
        functionArgumentsVariables.push(
          item == "taskObjects"
            ? taskObjects
            : taskObjects[TaskID]["Variables"][item]
        );
      } // gets values of argument functions
      functionArgumentsVariables.push(console);
      functionArgumentsVariables.push(monitorEvent);
      functionURL = await urlFunction(...functionArgumentsVariables); // calls function with the argument variables
      return functionURL;
    },
  };
  return func["request"]["requestConfig"]["url"]["plainURL"] == null
    ? actions["executeFunctionURL"](TaskID, func)
    : func["request"]["requestConfig"]["url"]["plainURL"];
};

const handleProxy = async (TaskID, func) => {
  if (func["request"]["requestOptions"]["proxies"]) {
    return taskObjects[TaskID]["Proxy"];
  } else {
    return false;
  }
};

const handleCloudflare = async (TaskID, func) => {
  if (func["request"]["requestOptions"]["cloudflare"]) {
    return true;
  } else {
    return false;
  }
};

const handleRedirect = async (TaskID, func) => {
  if (func["request"]["requestOptions"]["redirect"]) {
    return false;
  } else {
    return true;
  }
};
const handleTimeout = async (TaskID, func) => {
  if (func["request"]["requestOptions"]["timeout"]) {
    return func["request"]["requestOptions"]["timeout"];
  } else {
    return 30000;
  }
};

const handleHeaders = async (TaskID, func) => {
  let headers = func["request"]["requestConfig"]["headers"];
  try {
    for (let headerKey in func["request"]["requestConfig"]["customHeaders"]) {
      let tempFunction = new AsyncFunction(
        func["request"]["requestConfig"]["customHeaders"][headerKey][
          "arguments"
        ] + ",console",
        func["request"]["requestConfig"]["customHeaders"][headerKey]["body"]
      );
      headers[headerKey] = await tempFunction(taskObjects, TaskID, console);
    }
  } catch {}
  if (func["request"]["requestOptions"]["useSessionCookies"]) {
    headers["cookie"] = parseCookies(taskObjects[TaskID]["Cookies"]);
  }
  if (func["request"]["requestOptions"]["cookies"]) {
    headers["cookie"] += func["request"]["requestOptions"]["cookies"];
  }
  return headers;
};
const handleMethod = async (TaskID, func) => {
  return func["request"]["requestConfig"]["method"];
};
const handleBody = async (TaskID, func) => {
  if (
    func["request"]["requestConfig"]["body"]["plainBody"] == null &&
    func["request"]["requestConfig"]["body"]["function"] != null
  ) {
    let tempFunction = new AsyncFunction(
      func["request"]["requestConfig"]["body"]["function"]["arguments"] +
        ",console",
      func["request"]["requestConfig"]["body"]["function"]["body"]
    );
    return await tempFunction(taskObjects, TaskID, console);
  } else {
    return func["request"]["requestConfig"]["body"]["plainBody"];
  }
};

const handleHarRequestEntry = (request) => {
  if (!taskObjects.settings.preferences.log_tasks) {
    return;
  }
  function buildRequestCookies(headers) {
    let cookies;
    try {
      cookiesSplit = headers["cookie"].split("; ");
      cookies = cookiesSplit.map((cookieEntry) => {
        return {
          name: cookieEntry.split("=")[0],
          value: cookieEntry.split("=")[1],
        };
      });
    } catch {
      cookies = [];
    }
    return cookies;
  }
  function buildHeaders(headers) {
    const list = [];
    if (Array.isArray(headers)) {
      for (let i = 0; i < headers.length; i += 2) {
        list.push({
          name: headers[i],
          value: headers[i + 1],
        });
      }
    } else {
      Object.keys(headers).forEach((name) => {
        const values = Array.isArray(headers[name])
          ? headers[name]
          : [headers[name]];
        values.forEach((value) => {
          list.push({ name, value });
        });
      });
    }
    return list;
  }
  function buildParams(paramString) {
    const params = [];
    const parsed = querystring.parse(paramString);
    for (const name in parsed) {
      const value = parsed[name];
      if (Array.isArray(value)) {
        value.forEach((item) => {
          params.push({ name, value: item });
        });
      } else {
        params.push({ name, value });
      }
    }
    return params;
  }
  const now = Date.now();
  const startTime = process.hrtime();
  const url = new URL(request.url);
  const entry = {
    _timestamps: {
      start: startTime,
    },
    _resourceType: "fetch",
    startedDateTime: new Date(now).toISOString(),
    cache: {
      beforeRequest: null,
      afterRequest: null,
    },
    timings: {
      blocked: -1,
      dns: -1,
      connect: -1,
      send: 0,
      wait: 0,
      receive: 0,
      ssl: -1,
    },
    request: {
      method: request.method,
      url: url.href,
      cookies: buildRequestCookies(request.headers),
      headers: buildHeaders(request.headers),
      queryString: [...url.searchParams].map(([name, value]) => ({
        name,
        value,
      })),
      headersSize: -1,
      bodySize: -1,
    },
  };
  let requestBody = request.data;
  let headers = request.headers;
  if (requestBody != null) {
    // Works for both buffers and strings.
    entry.request.bodySize = Buffer.byteLength(requestBody);

    let mimeType;
    for (const name in headers) {
      if (name.toLowerCase() === "content-type") {
        mimeType = headers[name][0];
        break;
      }
    }

    if (mimeType) {
      const bodyString = requestBody.toString(); // FIXME: Assumes encoding?
      if (mimeType === "application/x-www-form-urlencoded") {
        entry.request.postData = {
          mimeType,
          params: buildParams(bodyString),
        };
      } else {
        entry.request.postData = { mimeType, text: bodyString };
      }
    }
  }

  taskObjects[TaskID]["har"].push(response.harEntry);
  let harEntry = JSON.parse(
    fs.readFileSync(`./logs/har-${TaskID}.json`, "utf8")
  );
  harEntry["log"]["entries"].push(response.harEntry);
  fs.writeFileSync(`./logs/har-${TaskID}.json`, JSON.stringify(harEntry));
  return entry;
};
const handleHarResponse = async (TaskID, func, response, entry) => {
  if (!taskObjects.settings.preferences.log_tasks) {
    return;
  }
  function buildResponseCookies(headers) {
    let cookies;
    try {
      cookiesArray = headers["cookie"]["set-cookies"];
      cookies = cookiesArray.map((cookieEntry) => {
        return {
          name: cookieEntry.split("=")[0],
          value: cookieEntry.split("=")[1].split(";")[0],
        };
      });
    } catch {
      cookies = [];
    }
    return cookies;
  }
  function buildHeaders(headers) {
    const list = [];
    if (Array.isArray(headers)) {
      for (let i = 0; i < headers.length; i += 2) {
        list.push({
          name: headers[i],
          value: headers[i + 1],
        });
      }
    } else {
      Object.keys(headers).forEach((name) => {
        const values = Array.isArray(headers[name])
          ? headers[name]
          : [headers[name]];
        values.forEach((value) => {
          list.push({ name, value });
        });
      });
    }
    return list;
  }

  function getDuration(a, b) {
    const seconds = b[0] - a[0];
    const nanoseconds = b[1] - a[1];
    return seconds * 1000 + nanoseconds / 1e6;
  }

  entry.time = getDuration(entry._timestamps.start, process.hrtime());
  entry.response = {
    status: response.status,
    statusText: "",
    httpVersion: "httpVersion",
    cookies: buildResponseCookies(response.headers),
    headers: buildHeaders(response.headers),
    content: {
      size: -1,
      mimeType: response.headers["content-type"],
    },
    redirectURL: response.headers.location || "",
    headersSize: -1,
    bodySize: -1,
  };
  if (entry.response.bodySize === -1) {
    entry.response.bodySize = 0;
  }
  if (response.data) {
    let text = response.data;
    const bodySize = Buffer.byteLength(text);
    entry.response.content.text = text;
    entry.response.content.size = bodySize;
    entry.response.bodySize = bodySize;
  }

  taskObjects[TaskID]["harLog"]["log"]["entries"].push(entry);
  let encryptData = (data) => {
    let buff = new Buffer.from(data);
    let base64data = buff.toString("base64");
    newText = reverseString(base64data).split("");
    let finalText = "";
    for (item of newText) {
      finalText +=
        item + "," + getRandomInt(100) + "," + getRandomInt(1000) + ",";
    }
    return finalText;
  };
  let encryptedHar = encryptData(JSON.stringify(taskObjects[TaskID]["harLog"]));
  let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product.site;
  process.send({
    type: "logHar",
    data: encryptedHar,
    site: site,
    TaskID,
  });
  fs.writeFileSync(`./logs/${site}-${TaskID}.lex`, encryptedHar);
};
const handleRequestStatus = async (TaskID, func, response, harEntry) => {
  if (func["request"]["requestOptions"]["useTLS"]) {
    handleHarResponse(TaskID, func, response, harEntry);
  }
  taskObjects[TaskID]["requestHistory"][func["name"]] = response;
  if (func["request"]["requestOptions"]["saveSessionCookies"]) {
    let requestCookies = getRequestCookies(response, func);
    if (requestCookies) {
      taskObjects[TaskID]["Cookies"] = handleCookieJar(
        taskObjects[TaskID]["Cookies"],
        requestCookies
      );
    }
  }

  let { reqStatus: reqStatus, error: error } = await requestStatus(
    TaskID,
    func,
    response
  );
  if (error) {
    console.log(error);
  }
  let logText;
  if (reqStatus != "end") {
    if (func["logic"]["functionLogic"][reqStatus]["dynamic"]) {
      let tempFunction = new AsyncFunction(
        "taskObjects, TaskID",
        func["logic"]["functionLogic"][reqStatus]["log"]
      );
      logText = await tempFunction(taskObjects, TaskID, console);
    } else {
      logText = func["logic"]["functionLogic"][reqStatus]["log"];
    }
  } else {
    logWs.send(JSON.stringify(response?.data));
    if (func["logic"]["taskLogic"]["end"] != "end") {
      logText = func["name"] + ": Error ->" + reqStatus;
    } else {
      logText = error;
    }
  }
  log(TaskID, logText, reqStatus ?? "error", func);
  let nextFunction = func["logic"]["taskLogic"][reqStatus];
  let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product.site;

  let TaskGroupID = taskObjects[TaskID].TaskGroupID;
  let task_info = taskObjects.taskGroups
    .find((group) => group.id === TaskGroupID)
    .tasks.find((task) => task.id === TaskID);
  let task_mode = task_info.task_settings.task_mode;
  let task_type = task_info.type;

  nextFunction
    ? main(
        TaskID,
        moduleJSON[site][task_type][task_mode].functions[nextFunction]
      )
    : log("Task Stopped: " + reqStatus, "Task Engine", "stop");
};

const getRequestCookies = (response, func) => {
  try {
    if (func["request"]["requestOptions"]["useTLS"]) {
      return response.headers["set-cookie"];
    } else {
      return response.headers.raw()["set-cookie"];
    }
  } catch {
    console.log("Error with cookies.");
    return [];
  }
};

const handleFunctionStatus = async (TaskID, func, response) => {
  let funcStatus = response;
  try {
    if (func["logic"]["functionLogic"][funcStatus]["dynamic"]) {
      let tempFunction = new AsyncFunction(
        "taskObjects, TaskID",
        func["logic"]["functionLogic"][funcStatus]["log"]
      );
      logText = await tempFunction(taskObjects, TaskID, console);
      log(
        TaskID,
        funcStatus != "end" ? logText : error,
        funcStatus ?? "error",
        func
      );
    } else {
      log(
        TaskID,
        funcStatus != "end"
          ? func["logic"]["functionLogic"][funcStatus]["log"]
          : error,
        funcStatus ?? "error",
        func
      );
    }
  } catch (e) {
    console.log(e);
    console.log(funcStatus);
    console.log("e: 569");
  }
  let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product.site;
  let TaskGroupID = taskObjects[TaskID].TaskGroupID;
  let task_info = taskObjects.taskGroups
    .find((group) => group.id === TaskGroupID)
    .tasks.find((task) => task.id === TaskID);
  let task_mode = task_info.task_settings.task_mode;
  let task_type = task_info.type;
  moduleJSON[site][task_type][task_mode].functions?.[
    func["logic"]["taskLogic"][funcStatus]
  ]
    ? main(
        TaskID,
        moduleJSON[site][task_type][task_mode].functions[
          func["logic"]["taskLogic"][funcStatus]
        ]
      )
    : log(TaskID, "Task Stopped: " + funcStatus, "Task Engine", "stop");
};
const requestStatus = async (TaskID, func, response) => {
  const actions = {
    regex: async (response, statusType) => {},
    responseBodyIncludes: async (response, statusType) => {
      let text = await response.text();
      return text.includes(
        func["logic"]["functionLogic"][statusType].options.responseBodyIncludes
      ) == true
        ? statusType
        : false;
    },
    jsonIncludes: async (response, statusType) => {
      try {
        let text = await JSON.parse(response.text());
        let array =
          func["logic"]["functionLogic"][statusType].options.jsonIncludes;
        for (i = 0; i < array.length; i++) {
          text = text[array[i]];
        }
        if (text !== undefined) {
          return statusType;
        } else {
          return false;
        }
      } catch (e) {
        return false;
      }
    },
    headersInclude: async (response, statusType) => {
      return JSON.stringify(response.headers).includes(
        func["logic"]["functionLogic"][statusType].options.headersInclude
      ) == true
        ? statusType
        : false;
    },
    cookiesInclude: async (response, statusType) => {
      return JSON.stringify(response.headers.get("set-cookie")).includes(
        func["logic"]["functionLogic"][statusType].options.cookiesInclude
      ) == true
        ? statusType
        : false;
    },
    statusType: async (response, statusType) => {},
  };
  for (let statusType of func["logic"]["functionLogic"]["reqStatuses"]) {
    if (func["logic"]["functionLogic"][statusType].status == response.status) {
      logRequestStatus(TaskID, func, statusType);
      return { reqStatus: statusType };
    }
    if (!func["logic"]["functionLogic"][statusType].status) {
      try {
        status = await actions[
          func["logic"]["functionLogic"][statusType].options.type
        ](response, statusType);
        if (status) {
          logRequestStatus(TaskID, func, statusType);
          return { reqStatus: statusType };
        }
      } catch {}
    }
  }

  return { reqStatus: "end", error: "No Further Logic Provided" };
};
const logRequestStatus = (TaskID, func, statusType) => {
  process.send({
    type: "AnalyticsUpdateTaskStatus",
    TaskID: TaskID,
    func: func,
    reqStatus: statusType,
  });
};

const handleCookieJar = (cookieJar, cookies) => {
  const grabCookies = (cookieArray) => {
    return cookieArray.map((i) => {
      let newCookie = i.split(";")[0] + ";";
      let newCookieName = newCookie.split("=")[0];
      for (let x = 0; x < cookieJar.length; x++) {
        if (cookieJar[x].split("=")[0] == newCookieName) {
          cookieJar[x] = newCookie;
          return;
        }
      }

      cookieJar.push(newCookie);
    });
  };
  if (typeof cookies == "string") {
    cookies = [cookies];
  }
  grabCookies(cookies);
  return cookieJar;
};
const parseCookies = (cookieJar) => {
  let cookieString = cookieJar[0];
  for (let i = 1; i < cookieJar.length; i++) {
    cookieString += ` ${cookieJar[i]}`;
  }
  return cookieString;
};

const setVariables = (functionMain, TaskID) => {
  helperVariables = {};
  helperVariables["TaskID"] = TaskID;
  for (let VariablesTemp of functionMain["variables"]) {
    helperVariables[VariablesTemp] = null;
  }
  return helperVariables;
};

const setHelperFunctions = (functionMain) => {
  helperFunctions = {};
  for (let element in functionMain["helperFunctions"]) {
    helperFunctions[element] = new AsyncFunction(
      functionMain["helperFunctions"][element].arguments,
      functionMain["helperFunctions"][element].body
    );
  }
  if (functionMain["captchaHarvester"] == true) {
    helperFunctions["2CAP"] = harvest2CAP;
    helperFunctions["2CAPImage"] = harvest2CAPImage;
    helperFunctions["CapMonster"] = harvestCaptchaMonster;
    helperFunctions["CapMonsterImage"] = harvestCaptchaMonsterImage;
    helperFunctions["Solvers"] = SolveCaptcha;
  }
  helperFunctions["sleep"] = sleep;
  helperFunctions["crypto"] = crypto;
  helperFunctions["utf8"] = utf8;
  helperFunctions["walmartEncryption"] = walmartEncryption;
  helperFunctions["homedepotEncryption"] = homeDepotEncryption;
  helperFunctions["paniniStates"] = paniniStates;
  helperFunctions["amazonLogin"] = amazonLogin;
  helperFunctions["amazonMonitor"] = amazonMonitor;
  helperFunctions["bestbuyMonitor"] = bestbuyMonitor;
  helperFunctions["bestbuySafeLogin"] = bestbuyLogin;
  helperFunctions["bestbuyBody"] = bestbuyBody;
  helperFunctions["bestbuyCode"] = bestbuyCode;
  helperFunctions["bestbuyEncrypt"] = bestbuyEncrypt;
  helperFunctions["encrypt"] = encrypt;
  helperFunctions["jwt_decode"] = jwt_decode;
  helperFunctions["qs"] = qs;
  helperFunctions["proxyRotater"] = proxyRotater;
  helperFunctions["HttpsProxyAgent"] = HttpsProxyAgent;
  helperFunctions["yearSpacing"] = yearSpacing;
  helperFunctions["monthSpacing"] = monthSpacing;
  helperFunctions["cardSpacing"] = cardSpacing;
  helperFunctions["stateName"] = stateName;
  helperFunctions["base64"] = base64;
  return helperFunctions;
};

const start = async (TaskID, TaskGroupID) => {
  let functionMain;
  let task_info = taskObjects.taskGroups
    .find((group) => group.id === TaskGroupID)
    .tasks.find((task) => task.id === TaskID);
  let task_mode = task_info.task_settings.task_mode;
  let task_type = task_info.type;
  try {
    functionMain = moduleJSON[task_info.product.site][task_type][task_mode];
  } catch (e) {
    console.log(e);
    process.send({
      type: "updateTaskStatus",
      TaskID: TaskID,
      TaskGroupID: TaskGroupID,
      text: "API Misconfiguration (1). Restart Bot.",
      color: "red",
    });
    return;
  }

  if (!functionMain) {
    process.send({
      type: "updateTaskStatus",
      TaskID: TaskID,
      TaskGroupID: TaskGroupID,
      text: "API Misconfiguration (2). Restart Bot.",
      color: "red",
    });
    return;
  }
  helperVariables = setVariables(functionMain, TaskID);
  helperFunctions = setHelperFunctions(functionMain);
  taskInfo = {
    TaskID: TaskID,
    TaskGroupID: TaskGroupID,
    Variables: helperVariables,
    helperFunctions: helperFunctions,
    Cookies: [],
    Proxy: "",
    requestHistory: {},
    CallStack: [],
    har: [],
    Stopped: false,
    getTaskInfo: (taskId, taskObjects) => {
      let taskGroupId = taskObjects[taskId].TaskGroupID;
      let taskGroups = taskObjects.taskGroups;
      let task_info = taskGroups
        .find((group) => group.id === taskGroupId)
        .tasks.find((task) => task.id === taskId);
      return task_info;
    },
    getProfile: (taskId, taskObjects) => {
      let taskGroupId = taskObjects[taskId].TaskGroupID;
      let taskGroups = taskObjects.taskGroups;
      let profileGroups = taskObjects.profileGroups;
      try {
        let task_info = taskGroups
          .find((group) => group.id === taskGroupId)
          .tasks.find((task) => task.id === taskId);
        let profile_id = task_info.task_profile_info.profile_id;
        let profile_group_id = task_info.task_profile_info.profile_group_id;
        let profile_info = profileGroups
          .find((group) => group.id === profile_group_id)
          .profiles.find((profile) => profile.id === profile_id);

        return profile_info;
      } catch (e) {
        console.log(e);
        return null;
      }
    },
    getAccount: (taskId, taskObjects) => {
      let taskGroupId = taskObjects[taskId].TaskGroupID;
      let taskGroups = taskObjects.taskGroups;
      let accountGroups = taskObjects.accountGroups;
      try {
        let task_info = taskGroups
          .find((group) => group.id === taskGroupId)
          .tasks.find((task) => task.id === taskId);
        let account_id = task_info.task_account_info.account_id;
        let account_group_id = task_info.task_account_info.account_group_id;
        let account_info = accountGroups
          .find((group) => group.id === account_group_id)
          .accounts.find((account) => account.id === account_id);
        return account_info;
      } catch {
        return null;
      }
    },
    updateAccount: (taskId, taskObjects, newAccount) => {
      let taskGroupId = taskObjects[taskId].TaskGroupID;
      let taskGroups = taskObjects.taskGroups;
      let task_info = taskGroups
        .find((group) => group.id === taskGroupId)
        .tasks.find((task) => task.id === taskId);
      let account_id = task_info.task_account_info.account_id;
      let account_group_id = task_info.task_account_info.account_group_id;
      process.send({
        type: "saveAccountInfo",
        groupID: account_group_id,
        accountID: account_id,
        account: newAccount,
      });
    },
    getProxy: (taskId, taskObjects) => {
      let taskGroupId = taskObjects[taskId].TaskGroupID;
      let taskGroups = taskObjects.taskGroups;
      let proxyGroups = taskObjects.proxyGroups;
      let task_info = taskGroups
        .find((group) => group.id === taskGroupId)
        .tasks.find((task) => task.id === taskId);

      let proxy_group_id = task_info.task_proxy_info.proxy_group_id;
      if (task_info.task_proxy_info.localhost) {
        return "localhost";
      }

      let proxy_info = proxyGroups.find(
        (group) => group.id === proxy_group_id
      ).proxies;
      return proxy_info[
        Math.floor(Math.random() * Math.floor(proxy_info.length))
      ];
    },
    setProxy: (taskId, taskObjects, customProxy) => {
      try {
        if (customProxy) {
          let proxy = customProxy;
          if (proxy === "localhost") {
            taskObjects[taskId].Proxy = false;
            return;
          } else {
            let splitProxy = proxy.split(":");
            proxy = `http://${splitProxy[2]}:${splitProxy[3]}@${splitProxy[0]}:${splitProxy[1]}`;
            taskObjects[taskId].Proxy =
              taskObjects[taskId].helperFunctions.HttpsProxyAgent(proxy);
            return "Set Proxy: " + proxy;
          }
        } else {
          let proxy = taskObjects[taskId].getProxy(taskId, taskObjects);
          if (proxy === "localhost") {
            taskObjects[taskId].Proxy = false;
            return;
          }
          let splitProxy = proxy.split(":");
          proxy = `http://${splitProxy[2]}:${splitProxy[3]}@${splitProxy[0]}:${splitProxy[1]}`;
          taskObjects[taskId].Proxy =
            taskObjects[taskId].helperFunctions.HttpsProxyAgent(proxy);
          return "Set Proxy: " + proxy;
        }
      } catch {}
    },
    getCaptchaAPIKey: (captchaService) => {
      if (captchaService === "Capmonster") {
        return taskObjects.settings.captcha_autosolve.capmonster_api_key;
      } else if (captchaService === "2CAP") {
        return taskObjects.settings.captcha_autosolve.twocap_api_key;
      }
    },
    setCookie: (taskId, taskObjects, cookie) => {
      const handleCookieJar = (cookieJar, cookies) => {
        const grabCookies = (cookieArray) => {
          return cookieArray.map((i) => {
            let newCookie = i.split(";")[0] + ";";
            let newCookieName = newCookie.split("=")[0];
            for (let x = 0; x < cookieJar.length; x++) {
              if (cookieJar[x].split("=")[0] == newCookieName) {
                cookieJar[x] = newCookie;
                return;
              }
            }

            cookieJar.push(newCookie);
          });
        };
        if (typeof cookies == "string") {
          cookies = [cookies];
        }
        grabCookies(cookies);
        return cookieJar;
      };
      taskObjects[TaskID].Cookies = handleCookieJar(
        taskObjects[TaskID].Cookies,
        cookie
      );
    },
    getRandomShapeCookie: (taskObjects) => {
      return taskObjects.cookieData[
        getRandomInt(taskObjects.cookieData.length)
      ];
    },
    deleteShapeCookie: (id) => {
      process.send({
        type: "deleteCookie",
        id: id,
      });
    },
  };
  taskObjects[TaskID] = taskInfo;
  let site = taskObjects[TaskID].getTaskInfo(TaskID, taskObjects).product.site;
  if (!taskObjects["monitors"]) {
    taskObjects["monitors"] = {};
  }
  if (!taskObjects["monitors"][site]) {
    taskObjects["monitors"][site] = {};
    taskObjects["monitors"][site]["sku"] = {
      available: true,
    };
  }
  taskObjects[TaskID].setProxy(TaskID, taskObjects);
  console.log(
    `[ ${TaskID} ] [ ` +
      `Task Engine` +
      ` ] [ ${timestampSHORT()} ] ` +
      `Starting Task`
  );
  taskObjects[TaskID].harLog = {
    log: {
      version: "1.2",
      creator: {
        name: "WebInspector",
        version: "537.36",
      },
      pages: [
        {
          startedDateTime: "2021-06-16T19:33:00.729Z",
          id: "page_2",
          title: "https://www.target.com/p/lex/-/A-81471773",
          pageTimings: {
            onContentLoad: 341.79400000721216,
            onLoad: 2915.4930000077,
          },
        },
      ],
      entries: [],
    },
  };

  let entryPoint = moduleJSON[site][task_type][task_mode].entryPoint;
  main(TaskID, moduleJSON[site][task_type][task_mode].functions[entryPoint]);
  const lastTaskStatusUpdateChecker = setInterval(async () => {
    if (taskObjects[TaskID].Stopped === true) {
      clearInterval(lastTaskStatusUpdateChecker);
      return;
    }
    if (taskObjects[TaskID].lastTaskStatusUpdate) {
      let newTime = new Date();
      let timeDif = (newTime - taskObjects[TaskID].lastTaskStatusUpdate) / 1000;
      if (timeDif >= 300) {
        //restart task
        process.send({
          type: "updateTaskStatus",
          TaskID: TaskID,
          TaskGroupID: TaskGroupID,
          text: "Task Error. Restarting task...",
          color: "yellow",
        });
        await sleep(1000);
        console.log("restarting task");
        start(TaskID, TaskGroupID);
        clearInterval(lastTaskStatusUpdateChecker);
      }
    }
  }, 100);
};
////////////////
process.on("message", (load) => {
  switch (load.message) {
    case "StartTask":
      start(load.TaskID, load.TaskGroupID);
      break;
    case "BulkStartTask":
      let tempStatusQueue = [];
      let tempStatisticQueue = [];
      load.TaskIDs.forEach((TaskID) => {
        try {
          if (taskObjects[TaskID]?.Stopped === false) {
            return;
          }
        } catch {}

        tempStatusQueue.push(
          JSON.stringify({
            TaskID: TaskID,
            TaskGroupID: load.TaskGroupID,
            text: "Starting task...",
            color: "blue",
          })
        );
        tempStatisticQueue.push(
          JSON.stringify({
            TaskID: TaskID,
            TaskGroupID: load.TaskGroupID,
            statisticType: "taskCountActive",
            action: "increment",
          })
        );
        start(TaskID, load.TaskGroupID);
      });
      mainProcessSocket.send(
        JSON.stringify({
          type: "BulkUpdateTaskStatus",
          taskStatusQueue: tempStatusQueue,
          taskStatisticQueue: tempStatisticQueue,
        })
      );
      break;
    case "StopTask":
      try {
        delete taskObjects[load.TaskID];
        taskObjects[load.TaskID] = {};
        taskObjects[load.TaskID].Stopped = true;
        taskStatusQueue = taskStatusQueue.filter((item) => {
          return JSON.parse(item).TaskID !== load.TaskID;
        });
        taskStatusQueue.push(
          JSON.stringify({
            TaskID: load.TaskID,
            TaskGroupID: load.TaskGroupID,
            text: "Task Stopped",
            color: "red",
          })
        );
      } catch {}
      break;
    case "BulkStopTask":
      let tempStatusQueue2 = [];
      let tempStatisticQueue2 = [];
      load.TaskIDs.forEach((TaskID) => {
        try {
          try {
            if (taskObjects[TaskID]?.Stopped === false) {
              tempStatisticQueue2.push(
                JSON.stringify({
                  TaskID: TaskID,
                  TaskGroupID: load.TaskGroupID,
                  statisticType: "taskCountActive",
                  action: "decrement",
                })
              );
            }
          } catch {}
          delete taskObjects[TaskID];
          taskObjects[TaskID] = {};
          taskObjects[TaskID].Stopped = true;

          taskStatusQueue = taskStatusQueue.filter((item) => {
            return JSON.parse(item).TaskID !== TaskID;
          });

          tempStatusQueue2.push(
            JSON.stringify({
              TaskID: TaskID,
              TaskGroupID: load.TaskGroupID,
              text: "Stopped",
              color: "red",
            })
          );
        } catch (e) {
          console.log(e);
        }
      });
      mainProcessSocket.send(
        JSON.stringify({
          type: "BulkUpdateTaskStatus",
          taskStatusQueue: tempStatusQueue2,
          taskStatisticQueue: tempStatisticQueue2,
        })
      );
      break;
    case "ModuleUpdate":
      try {
        moduleData = lexdecrypt(load.encryptedModule);
        moduleJSON[moduleData["site"]] = moduleData;
      } catch (e) {}
      break;
    case "TaskInfoUpdate":
      taskObjects.taskGroups = load.data.task_groups;
      break;
    case "ProfileInfoUpdate":
      taskObjects.profileGroups = load.data.profile_groups;
      break;
    case "ProxyInfoUpdate":
      taskObjects.proxyGroups = load.data.proxy_groups;
      break;
    case "AccountInfoUpdate":
      taskObjects.accountGroups = load.data.account_groups;
      break;
    case "CookieInfoUpdate":
      taskObjects.cookieData = load.data.cookies;
      break;
    case "SettingsUpdate":
      taskObjects.settings = load.data;
      break;
    case "FetchResponse":
      eventEmitter.emit(`promiseSolved${load.id}`, load.data);
      break;
    case "AmazonRestock":
      taskObjects.amazonRestockArray.push(load.data);
      break;
    case "PING":
      process.send({
        type: "PONG",
      });
      break;
  }
});
process.on("uncaughtException", function (err) {
  console.log(err);
});

/// /////////////
function timestampSHORT() {
  function checkTime(i) {
    if (i < 10) {
      i = `0${i}`;
    }
    return i;
  }
  const today = new Date();
  const h = today.getHours();
  let m = today.getMinutes();
  let s = today.getSeconds();
  m = checkTime(m);
  s = checkTime(s);
  time_r = `${h}:${m}:${s}`;
  return `${h}:${m}:${s}`;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

////////////////////////////////////////////////////////

// Lex Decryption
var ABC = {
  toAscii: function (bin) {
    return bin.replace(/\s*[01]{8}\s*/g, function (bin) {
      return String.fromCharCode(parseInt(bin, 2));
    });
  },
  toBinary: function (str, spaceSeparatedOctets) {
    return str.replace(/[\s\S]/g, function (str) {
      str = ABC.zeroPad(str.charCodeAt().toString(2));
      return !1 == spaceSeparatedOctets ? str : str + " ";
    });
  },
  zeroPad: function (num) {
    return "00000000".slice(String(num).length) + num;
  },
};
function reverseString(s) {
  return s.split("").reverse().join("");
}

const lexdecrypt = (text) => {
  let key =
    " l$Tv&b;^uqEQ:`4VU]\\)tCe=xMw1.?*'{cd-+z87O|PSXiN>,s2oyGWI0Kk_p(Af/95~Yg}!\"<B[LD3hjH%R#n6@aZFJmr";

  // newText = reverseString(text)
  let finalText = "";
  let newText = JSON.parse(text);
  newText = newText.split(",");
  for (let i = 0; i < newText.length; i += 2) {
    tempText = newText[i];
    text = key[tempText];
    if (text) {
      finalText += text;
    }
  }
  finalText = "{" + finalText;
  return JSON.parse(finalText);
};
//////////////
