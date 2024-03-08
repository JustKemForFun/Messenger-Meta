'use strict';

/!-[ Set Variable For Process ]-!/
// Max Core CPU
const os = require('os');
process.env.UV_THREADPOOL_SIZE = os.cpus().length;

var utils = require("./utils");
var cheerio = require("cheerio");
var log = require("npmlog");
var logger = require('./logger');
var fs = require('fs');
var StateCrypt = require('./utils/StateCrypt');
var { prompt } = require('./utils/ReadLine');

var extension = require('./utils/Extension');
var { getKeyValue, setKeyValue } = require('./utils/Database');

var checkVerified = null;

var defaultLogRecordSize = 100;
log.maxRecordSize = defaultLogRecordSize;

var configPath = process.cwd() + '/Meta_Config.json';

const defaultConfig = require("./Meta_Config.json");

if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}
var config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));



function setOptions(globalOptions, options) {
    Object.keys(options).map(function (key) {
        switch (key) {
            case 'pauseLog':
                if (options.pauseLog) log.pause();
                break;
            case 'online':
                globalOptions.online = Boolean(options.online);
                break;
            case 'logLevel':
                log.level = options.logLevel;
                globalOptions.logLevel = options.logLevel;
                break;
            case 'logRecordSize':
                log.maxRecordSize = options.logRecordSize;
                globalOptions.logRecordSize = options.logRecordSize;
                break;
            case 'selfListen':
                globalOptions.selfListen = Boolean(options.selfListen);
                break;
            case 'listenEvents':
                globalOptions.listenEvents = Boolean(options.listenEvents);
                break;
            case 'pageID':
                globalOptions.pageID = options.pageID.toString();
                break;
            case 'updatePresence':
                globalOptions.updatePresence = Boolean(options.updatePresence);
                break;
            case 'forceLogin':
                globalOptions.forceLogin = Boolean(options.forceLogin);
                break;
            case 'userAgent':
                globalOptions.userAgent = options.userAgent;
                break;
            case 'autoMarkDelivery':
                globalOptions.autoMarkDelivery = Boolean(options.autoMarkDelivery);
                break;
            case 'autoMarkRead':
                globalOptions.autoMarkRead = Boolean(options.autoMarkRead);
                break;
            case 'listenTyping':
                globalOptions.listenTyping = Boolean(options.listenTyping);
                break;
            case 'proxy':
                if (typeof options.proxy != "string") {
                    delete globalOptions.proxy;
                    utils.setProxy();
                } else {
                    globalOptions.proxy = options.proxy;
                    utils.setProxy(globalOptions.proxy);
                }
                break;
            case 'autoReconnect':
                globalOptions.autoReconnect = Boolean(options.autoReconnect);
                break;
            case 'emitReady':
                globalOptions.emitReady = Boolean(options.emitReady);
                break;
            default:
                log.warn("setOptions", "Unrecognized option given to setOptions: " + key);
                break;
        }
    });
}

/!-[ Function BuildAPI ]-!/

  /** 
 * @param {{ getCookies: (arg0: string) => any[]; }} jar
 */

function buildAPI(globalOptions, html, jar) {
    var maybeCookie = jar.getCookies("https://www.facebook.com").filter(function (val) {
        return val.cookieString().split("=")[0] === "c_user";
    });
    //var maybeCookie = jar.getCookies("https://www.facebook.com").filter(function(/** @type {{ cookieString: () => string; }} */val) { return val.cookieString().split("=")[0] === "c_user"; });

    if (maybeCookie.length === 0) {
        if (config.Auto_Login) {
            log.warn("login", "The account has been logged out, proceed to automatically log back");
            if (getKeyValue('Email') || getKeyValue('Password')) {
                const email = getKeyValue('Email');
                const password = getKeyValue('Password');

                return extension.Auto_Login(email, password);
            } else {
                logger("Please enter the email and password");
                process.exit(1);
            }
        } else {
            throw { error: "AppState - Your Cookie Is Wrong, Please Replace It, Or Go To Incognito Browser Then Sign In And Try Again!" }
        }
    }

    if (html.indexOf("/checkpoint/block/?next") > -1) log.warn("login", "CheckPoint Detected - Can't Login, Try Logout Then Login And Get Appstate - Cookie");

                                                        /* Tính Năng */
                                                // Account Rất Bình Thường V1 //
    var userID = Object.values(jar._jar.store.idx['facebook.com']['/']).map($=>$.toString()).join(';').match(/i_user=([^;]+);/)?.[1]||maybeCookie[0].cookieString().split("=")[1].toString();
                                                // Account Bình Thường V2 //
    // var userID = maybeCookie[0].cookieString().split("=")[1].toString();
    // var userID = maybeCookie[0].cookieString().split("=")[1].toString();
    logger(`Login At ID: ${userID}`, "[ Meta ]");
    process.env['UID'] = userID;
    try {
        clearInterval(checkVerified);
    } catch (e) {
        console.log(e);
    }

    var clientID = (Math.random() * 2147483648 | 0).toString(16);

    let oldFBMQTTMatch = html.match(/irisSeqID:"(.+?)",appID:219994525426954,endpoint:"(.+?)"/);
    let mqttEndpoint = null;
    let region = null;
    let irisSeqID = null;
    var noMqttData = null;

    if (oldFBMQTTMatch) {
        irisSeqID = oldFBMQTTMatch[1];
        mqttEndpoint = oldFBMQTTMatch[2];
        region = new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
        logger(`Area Of Account Is: ${region}`, "[ Meta ]");
    } else {
        let newFBMQTTMatch = html.match(/{"app_id":"219994525426954","endpoint":"(.+?)","iris_seq_id":"(.+?)"}/);
        if (newFBMQTTMatch) {
            irisSeqID = newFBMQTTMatch[2];
            mqttEndpoint = newFBMQTTMatch[1].replace(/\\\//g, "/");
            region = new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
            logger(`Area Of Account Is:  ${region}`, "[ Meta ]");
        } else {
            let legacyFBMQTTMatch = html.match(/(\["MqttWebConfig",\[\],{fbid:")(.+?)(",appID:219994525426954,endpoint:")(.+?)(",pollingEndpoint:")(.+?)(3790])/);
            if (legacyFBMQTTMatch) {
                mqttEndpoint = legacyFBMQTTMatch[4];
                region = new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
                log.warn("login", `Cannot get sequence ID with new RegExp. Fallback to old RegExp (without seqID)...`);
                logger(`Area Of Account Is: ${region}`, "[ Meta ]");
                logger("login", `[Unused] Polling endpoint: ${legacyFBMQTTMatch[6]}`);
            } else {
                log.warn("login", "Can't Get ID Try Again !");
                noMqttData = html;
            }
        }
    }

    // All data available to api functions
    var ctx = {
        userID: userID,
        jar: jar,
        clientID: clientID,
        globalOptions: globalOptions,
        loggedIn: true,
        access_token: 'NONE',
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: irisSeqID,
        syncToken: undefined,
        mqttEndpoint,
        region,
        firstListen: true
    };

    var api = {
        setOptions: setOptions.bind(null, globalOptions),
        getAppState: function getAppState() {
            return utils.getAppState(jar);
        }
    };

    if (noMqttData) api["htmlData"] = noMqttData;

    const apiFuncNames = [
        'addExternalModule',
        'addUserToGroup',
        'changeAdminStatus',
        'changeArchivedStatus',
        'changeBio',
        'changeBlockedStatus',
        'changeGroupImage',
        'changeNickname',
        'changeThreadColor',
        'changeThreadEmoji',
        'createNewGroup',
        'createPoll',
        'deleteMessage',
        'deleteThread',
        'forwardAttachment',
        'getCurrentUserID',
        'getEmojiUrl',
        'getFriendsList',
        'getThreadHistory',
        'getThreadInfo',
        'getThreadList',
        'getThreadPictures',
        'getUserID',
        'getUserInfo',
        'handleMessageRequest',
        'listenMqtt',
        'logout',
        'markAsDelivered',
        'markAsRead',
        'markAsReadAll',
        'markAsSeen',
        'muteThread',
        'removeUserFromGroup',
        'resolvePhotoUrl',
        'searchForThread',
        'sendMessage',
        'sendTypingIndicator',
        'setMessageReaction',
        'setTitle',
        'threadColors',
        'unsendMessage',
        'unfriend',
        'setPostReaction',
        'handleFriendRequest',
        'handleMessageRequest',

        // HTTP
        'httpGet',
        'httpPost',
        'httpPostFormData',

        //Modding Meta
        'getUID',
        'getOnlineTime'
    ];

    var defaultFuncs = utils.makeDefaults(html, userID, ctx);
  api.postFormData = function(url, body) {
    return defaultFuncs.postFormData(url, ctx.jar, body);
  };

    // Load all api functions in a loop
    apiFuncNames.map(v => api[v] = require('./src/' + v)(defaultFuncs, api, ctx));

    return [ctx, defaultFuncs, api];
}

function makeLogin(jar, email, password, loginOptions, callback, prCallback) {
    return function (res) {
        var html = res.body;
        var $ = cheerio.load(html);
        var arr = [];

        // This will be empty, but just to be sure we leave it
        $("#login_form input").map((i, v) => arr.push({ val: $(v).val(), name: $(v).attr("name") }));

        arr = arr.filter(function (v) {
            return v.val && v.val.length;
        });

        var form = utils.arrToForm(arr);
        form.lsd = utils.getFrom(html, "[\"LSD\",[],{\"token\":\"", "\"}");
        form.lgndim = Buffer.from("{\"w\":1440,\"h\":900,\"aw\":1440,\"ah\":834,\"c\":24}").toString('base64');
        form.email = email;
        form.pass = password;
        form.default_persistent = '0';
        form.lgnrnd = utils.getFrom(html, "name=\"lgnrnd\" value=\"", "\"");
        form.locale = 'en_US';
        form.timezone = '240';
        form.lgnjs = ~~(Date.now() / 1000);


        // Getting cookies from the HTML page... (kill me now plz)
        // we used to get a bunch of cookies in the headers of the response of the
        // request, but FB changed and they now send those cookies inside the JS.
        // They run the JS which then injects the cookies in the page.
        // The "solution" is to parse through the html and find those cookies
        // which happen to be conveniently indicated with a _js_ in front of their
        // variable name.
        //
        // ---------- Very Hacky Part Starts -----------------
        var willBeCookies = html.split("\"_js_");
        willBeCookies.slice(1).map(function (val) {
            var cookieData = JSON.parse("[\"" + utils.getFrom(val, "", "]") + "]");
            jar.setCookie(utils.formatCookie(cookieData, "facebook"), "https://www.facebook.com");
        });
        // ---------- Very Hacky Part Ends -----------------

        logger("Logging...", "[ Meta ]");
        return utils
            .post("https://www.facebook.com/login/device-based/regular/login/?login_attempt=1&lwv=110", jar, form, loginOptions)
            .then(utils.saveCookies(jar))
            .then(function (res) {
                var headers = res.headers;
                if (!headers.location) throw { error: "Wrong Password Or Account !" };

                // This means the account has login approvals turned on.
                if (headers.location.indexOf('https://www.facebook.com/checkpoint/') > -1) {
                    logger("You Are On 2 Security !", "[ Meta ]");
                    var nextURL = 'https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php';

                    return utils
                        .get(headers.location, jar, null, loginOptions)
                        .then(utils.saveCookies(jar))
                        .then(function (res) {
                            var html = res.body;
                            // Make the form in advance which will contain the fb_dtsg and nh
                            var $ = cheerio.load(html);
                            var arr = [];
                            $("form input").map((i, v) => arr.push({ val: $(v).val(), name: $(v).attr("name") }));

                            arr = arr.filter(function (v) {
                                return v.val && v.val.length;
                            });

                            var form = utils.arrToForm(arr);
                            if (html.indexOf("checkpoint/?next") > -1) {
                                setTimeout(() => {
                                    checkVerified = setInterval((_form) => { }, 5000, {
                                        fb_dtsg: form.fb_dtsg,
                                        jazoest: form.jazoest,
                                        dpr: 1
                                    });
                                }, 2500);
                                throw {
                                    error: 'login-approval',
                                    continue: function submit2FA(code) {
                                        form.approvals_code = code;
                                        form['submit[Continue]'] = $("#checkpointSubmitButton").html(); //'Continue';
                                        var prResolve = null;
                                        var prReject = null;
                                        var rtPromise = new Promise(function (resolve, reject) {
                                            prResolve = resolve;
                                            prReject = reject;
                                        });
                                        if (typeof code == "string") {
                                            utils
                                                .post(nextURL, jar, form, loginOptions)
                                                .then(utils.saveCookies(jar))
                                                .then(function (res) {
                                                    var $ = cheerio.load(res.body);
                                                    var error = $("#approvals_code").parent().attr("data-xui-error");
                                                    if (error) {
                                                        throw {
                                                            error: 'login-approval',
                                                            errordesc: "Invalid 2FA code.",
                                                            lerror: error,
                                                            continue: submit2FA
                                                        };
                                                    }
                                                })
                                                .then(function () {
                                                    // Use the same form (safe I hope)
                                                    delete form.no_fido;
                                                    delete form.approvals_code;
                                                    form.name_action_selected = 'dont_save'; //'save_device';

                                                    return utils.post(nextURL, jar, form, loginOptions).then(utils.saveCookies(jar));
                                                })
                                                .then(function (res) {
                                                    var headers = res.headers;
                                                    if (!headers.location && res.body.indexOf('Review Recent Login') > -1) throw { error: "Something went wrong with login approvals." };

                                                    var appState = utils.getAppState(jar);

                                                    if (callback === prCallback) {
                                                        callback = function (err, api) {
                                                            if (err) return prReject(err);
                                                            return prResolve(api);
                                                        };
                                                    }

                                                    // Simply call loginHelper because all it needs is the jar
                                                    // and will then complete the login process
                                                    return loginHelper(appState, email, password, loginOptions, callback);
                                                })
                                                .catch(function (err) {
                                                    // Check if using Promise instead of callback
                                                    if (callback === prCallback) prReject(err);
                                                    else callback(err);
                                                });
                                        } else {
                                            utils
                                                .post("https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php", jar, form, loginOptions, null, { "Referer": "https://www.facebook.com/checkpoint/?next" })
                                                .then(utils.saveCookies(jar))
                                                .then(res => {
                                                    try {
                                                        JSON.parse(res.body.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, ""));
                                                    } catch (ex) {
                                                        clearInterval(checkVerified);
                                                        logger("Confirm From Browser, Logging In...", "[ Meta ]");
                                                        if (callback === prCallback) {
                                                            callback = function (err, api) {
                                                                if (err) return prReject(err);
                                                                return prResolve(api);
                                                            };
                                                        }
                                                        return loginHelper(utils.getAppState(jar), email, password, loginOptions, callback);
                                                    }
                                                })
                                                .catch(ex => {
                                                    log.error("login", ex);
                                                    if (callback === prCallback) prReject(ex);
                                                    else callback(ex);
                                                });
                                        }
                                        return rtPromise;
                                    }
                                };
                            } else {
                                if (!loginOptions.forceLogin) throw { error: "Couldn't login. Facebook might have blocked this account. Please login with a browser or enable the option 'forceLogin' and try again." };

                                if (html.indexOf("Suspicious Login Attempt") > -1) form['submit[This was me]'] = "This was me";
                                else form['submit[This Is Okay]'] = "This Is Okay";

                                return utils
                                    .post(nextURL, jar, form, loginOptions)
                                    .then(utils.saveCookies(jar))
                                    .then(function () {
                                        // Use the same form (safe I hope)
                                        form.name_action_selected = 'save_device';

                                        return utils.post(nextURL, jar, form, loginOptions).then(utils.saveCookies(jar));
                                    })
                                    .then(function (res) {
                                        var headers = res.headers;

                                        if (!headers.location && res.body.indexOf('Review Recent Login') > -1) throw { error: "Something went wrong with review recent login." };

                                        var appState = utils.getAppState(jar);

                                        // Simply call loginHelper because all it needs is the jar
                                        // and will then complete the login process
                                        return loginHelper(appState, email, password, loginOptions, callback);
                                    })
                                    .catch(e => callback(e));
                            }
                        });
                }

                return utils.get('https://www.facebook.com/', jar, null, loginOptions).then(utils.saveCookies(jar));
            });
    };
}

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

// Helps the login
async function loginHelper(appState, email, password, globalOptions, callback, prCallback) {
    var mainPromise = null;
    var jar = utils.getJar();

    if (config.Create_Html_Site.Enable) {
        extension.CreateSiteHtml(config.Create_Html_Site.Port);
    }

    if (config.Auto_Uptime) {
        extension.Auto_Uptime();
    }

    if (config.Change_Environment) {
        await extension.Change_Environment();
    }

    if (config.Auto_Update) {
        await extension.Auto_Update(config);
    }

    if (config.Auto_Login) {
        if (!getKeyValue("Email") || !getKeyValue("Password")) {
            const email = await prompt('Enter your email: ');
            const password = await prompt('Enter your password: ');

            setKeyValue('Email', email);
            setKeyValue('Password', password);

            logger('Email and Password saved successfully!');
        }
    }

    // If we're given an appState we loop through it and save each cookie
    // back into the jar.    
    try {
        if (appState) {

            if (!getKeyValue("AppstateKey1") || !getKeyValue("AppstateKey2") || !getKeyValue("AppstateKey2")) {
                try {
                    setKeyValue("AppstateKey1", makeid(50));
                    setKeyValue("AppstateKey2", makeid(50));
                    setKeyValue("AppstateKey3", makeid(50));
                    logger("Generate Random Password Success !");
                }
                catch (e) {
                    console.log(e);
                    logger("An Error Was Found While Trying to Generate Random Password", "[ Meta ]");
                }
            }


            if (getKeyValue("AppstateKey1") || getKeyValue("AppstateKey2") || getKeyValue("AppstateKey2")) {
                try {
                    appState = JSON.stringify(appState);
                    if (appState.includes('[')) {
                        logger('Not ready for decryption', '[ Meta ]')
                    } else {
                        try {
                            appState = JSON.parse(appState);
                            appState = StateCrypt.decryptState(appState, getKeyValue("AppstateKey1"), getKeyValue("AppstateKey2"), getKeyValue("AppstateKey3"));
                            logger('Decrypt Appstate Success !', '[ Meta ]');
                        }
                        catch (e) {
                            logger('Replace AppState !', '[ Meta ]');
                            console.log(e);
                        }
                    }
                }
                catch (e) {
                    console.log(e);
                }
            }

            try {
                appState = JSON.parse(appState);
            }
            catch (e) {
                try {
                    appState = appState;
                }
                catch (e) {
                    console.log(e);
                    return logger('Replace AppState !', '[ Meta ]')
                }
            }
            try {
                appState.map(function (c) {
                    var str = c.key + "=" + c.value + "; expires=" + c.expires + "; domain=" + c.domain + "; path=" + c.path + ";";
                    jar.setCookie(str, "http://" + c.domain);
                });

                // Load the main page.
                mainPromise = utils.get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true }).then(utils.saveCookies(jar));
            } catch (e) {
                console.log(e);
                return logger('Replace AppState !', '[ Meta ]')
            }
        } else {
            // Open the main page, then we login with the given credentials and finally
            // load the main page again (it'll give us some IDs that we need)
            mainPromise = utils
                .get("https://www.facebook.com/", null, null, globalOptions, { noRef: true })
                .then(utils.saveCookies(jar))
                .then(makeLogin(jar, email, password, globalOptions, callback, prCallback))
                .then(function () {
                    return utils.get('https://www.facebook.com/', jar, null, globalOptions).then(utils.saveCookies(jar));
                });
        }
    } catch (e) {
        console.log(e);
    }
    var ctx = null;
    var _defaultFuncs = null;
    var api = null;

    mainPromise = mainPromise
        .then(function (res) {
            // Hacky check for the redirection that happens on some ISPs, which doesn't return statusCode 3xx
            var reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
            var redirect = reg.exec(res.body);
            if (redirect && redirect[1]) return utils.get(redirect[1], jar, null, globalOptions).then(utils.saveCookies(jar));
            return res;
        })
        .then(function (res) {
            var html = res.body;
            var stuff = buildAPI(globalOptions, html, jar);
            ctx = stuff[0];
            _defaultFuncs = stuff[1];
            api = stuff[2];
            return res;
        });

    // given a pageID we log in as a page
    if (globalOptions.pageID) {
        mainPromise = mainPromise
            .then(function () {
                return utils.get('https://www.facebook.com/' + ctx.globalOptions.pageID + '/messages/?section=messages&subsection=inbox', ctx.jar, null, globalOptions);
            })
            .then(function (resData) {
                var url = utils.getFrom(resData.body, 'window.location.replace("https:\\/\\/www.facebook.com\\', '");').split('\\').join('');
                url = url.substring(0, url.length - 1);
                return utils.get('https://www.facebook.com' + url, ctx.jar, null, globalOptions);
            });
    }


    // At the end we call the callback or catch an exception
    mainPromise
        .then(function () {
            logger('Complete the Login Process!', "[ Meta ]");
            return callback(null, api);
        }).catch(function (e) {
            log.error("login", e.error || e);
            callback(e);
        });
}

function login(loginData, options, callback) {
    if (utils.getType(options) === 'Function' || utils.getType(options) === 'AsyncFunction') {
        callback = options;
        options = {};
    }

    var globalOptions = {
        selfListen: false,
        listenEvents: true,
        listenTyping: true,
        updatePresence: false,
        forceLogin: false,
        autoMarkDelivery: true,
        autoMarkRead: true,
        autoReconnect: true,
        logRecordSize: defaultLogRecordSize,
        online: true,
        emitReady: false,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/600.3.18 (KHTML, like Gecko) Version/8.0.3 Safari/600.3.18"
    };

    //! bằng 1 cách nào đó tắt online sẽ đánh lừa được facebook :v
    //! phải có that có this chứ :v

    setOptions(globalOptions, options);

    var prCallback = null;
    if (utils.getType(callback) !== "Function" && utils.getType(callback) !== "AsyncFunction") {
        var rejectFunc = null;
        var resolveFunc = null;
        var returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });
        prCallback = function (error, api) {
            if (error) return rejectFunc(error);
            return resolveFunc(api);
        };
        callback = prCallback;
    }
    loginHelper(loginData.appState, loginData.email, loginData.password, globalOptions, callback, prCallback);
    return returnPromise;
}

module.exports = login;
