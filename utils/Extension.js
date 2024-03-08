const express = require('express');
const app = express();
const logger = require('../logger');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
var { readFileSync } = require('fs-extra');
const { execSync } = require('child_process');
const { setKeyValue } = require('./Database');

function Auto_Uptime() {
    switch (process.platform) {
        case 'win32':
        case 'darwin':
            logger("Your Operating System does not currently support Auto Uptime !");
            break;
        case 'linux':
            if (process.env.REPL_SLUG) {
                const url = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`.toLowerCase();
                logger(`Activating uptime for ${chalk.underline(`'${url}'`)}`);
                return setInterval(function () {
                    axios.get(url).then(() => { }).catch(() => { });
                }, 10 * 1000);
            } else {
                logger("Your Operating System does not currently support Auto Uptime !");
            }
            break;
        default:
            logger("Your Operating System does not currently support Auto Uptime !");
    }
}

function CreateSiteHtml(port) {
    app.use(express.static(path.join(__dirname, "/Html")));

    app.get('/', function (req, res) {
        res.sendFile(path.join(__dirname, '/Html/index.html'));
    });

    app.get('/', (req, res) => res.sendStatus(200));

    const listen_port = port || 3000;

    app.listen(listen_port, () => {
        logger(`Bot is running on port: ${listen_port}`);
    });

    app.on('error', (error) => {
        logger(`An error occurred while starting the server: ${error}`);
    });
}

async function getUIDSlow(url) {
    var FormData = require("form-data");
    var Form = new FormData();
    var Url = new URL(url);
    Form.append('username', Url.pathname.replace(/\//g, ""));
    try {
        var response = await axios.post('https://api.findids.net/api/get-uid-from-username', Form, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.79 Safari/537.36'
            }
        });
        var data = response.data;
        if (data.status !== 200) {
            throw new Error('Error!');
        }
        if (typeof data.error === 'string') {
            throw new Error("errr");
        } else {
            return data.data.id || "Not Found";
        }
    } catch (e) {
        throw e;
    }
}

async function getUIDFast(url) {
    var FormData = require("form-data");
    var Form = new FormData();
    var Url = new URL(url);
    Form.append('link', Url.href);
    try {
        var response = await axios.post('https://id.traodoisub.com/api.php', Form);
        var data = response.data;
        if (data.error) {
            throw new Error(data.error);
        } else {
            return data.id || "Not Found";
        }
    } catch (e) {
        throw e;
    }
}

async function getUID(url, callback) {
    try {
        var getUID = await getUIDFast(url);
        if (!isNaN(getUID)) {
            callback(null, getUID);
        } else {
            let getUIDSlowResult = await getUIDSlow(url);
            if (!isNaN(getUIDSlowResult)) {
                callback(null, getUIDSlowResult);
            } else {
                callback("UID not found", null);
            }
        }
    } catch (error) {
        callback(error.message, null);
    }
}

function StartCountOnlineTime() {
    if (!fs.existsSync(process.cwd() + "/Online.json")) {
        fs.writeFileSync(process.cwd() + "/Online.json", JSON.stringify(0, null, 2));
    }
    setInterval(function () {
        const data = Number(fs.readFileSync(process.cwd() + '/Online.json', 'utf8'));
        const time = data + 1;
        fs.writeFileSync(process.cwd() + "/Online.json", JSON.stringify(time, null, 2));
    }, 1000);
}

function GetCountOnlineTime() {
    let second = Number(fs.readFileSync(process.cwd() + '/Online.json', 'utf8'));
    const day = Math.floor(second / (3600 * 24));
    second %= 3600 * 24;
    const hour = Math.floor(second / 3600);
    second %= 3600;
    const minute = Math.floor(second / 60);
    return { day, hour, minute };
}

async function Change_Environment() {
    const main = fs.readFileSync(process.cwd() + "/replit.nix", { encoding: 'utf8' });
    const newnix = fs.readFileSync(__dirname, + "/replit.nix", { encoding: 'utf8' });
    if (main != newnix) {
        logger("Changing replit.nix to support node v14!")
        fs.writeFileSync(process.cwd() + "/replit.nix", newnix, { encoding: 'utf8' });
        logger("Successfully changed replit.nix, go ahead and restart!");
        return console.clear(), process.exit(1);
    }
}

async function Auto_Update(config) {
    logger('Auto Check Update ...', "[ Meta ]");
    axios.get('https://raw.githubusercontent.com/JustKemForFun/Messendger-Meta/main/Meta_Config.json').then(async (res) => {
        if (res.data.Config_Version != config.Config_Version) {
            logger(`New Config Version Published: ${config.Config_Version} => ${res.data.Config_Version}`, "[ Meta ]");
            logger(`Perform Automatic Update Config to the Latest Version !`, "[ Meta ]");
            await fs.writeFileSync(configPath, JSON.stringify(res.data, null, 2));
            logger("Config Version Upgrade Successful!", "[ Meta ]")
            logger('Restarting...', '[ Meta ]');
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            console.clear(), process.exit(1);
        }
    });
    axios.get('https://raw.githubusercontent.com/JustKemForFun/Messendger-Meta/main/package.json').then(async (res) => {
        const localbrand = JSON.parse(readFileSync('./node_modules/messendger-meta/package.json')).version;
        if (localbrand != res.data.version) {
            logger(`New Version Published: ${JSON.parse(readFileSync('./node_modules/messendger-meta/package.json')).version} => ${res.data.version}`, "[ messendger-meta ]");
            logger(`Perform Automatic Update to the Latest Version !`, "[ Meta ]");
            try {
                fs.rmdirSync((process.cwd() + "/node_modules/messendger-meta" || __dirname + '../../../messendger-meta'), { recursive: true });
                execSync('npm install messendger-meta@latest', { stdio: 'inherit' });
                logger("Version Upgrade Successful!", "[ Meta ]")
                logger('Restarting...', '[ Meta ]');
                await new Promise(resolve => setTimeout(resolve, 5 * 1000));
                console.clear(), process.exit(1);
            }
            catch (err) {
                logger('Auto Update error ! ' + err, "[ Meta ]");
            }
        }
        else {
            logger(`You Are Currently Using Version: ` + localbrand + ' !', "[ Meta ]");
            logger(`And Config Version: ` + config.Config_Version + ' !', "[ Meta ]");
            logger(`Kem and Zeid_Team is a dev!`);
            logger(`Have a good day !`);
        }
    });
}

async function Auto_Login(Email, PassWord) {
    require('../index')({ email: Email, password: PassWord }, async (error, api) => {
        if (error) {
            setKeyValue("Email", null);
            setKeyValue("Password", null);
            
            return logger("Auto Login Failed!"), process.exit(1);
        } else {
            return console.log("Auto Login Successful!") ,process.exit(1);
        }
    });
}

module.exports = {
    CreateSiteHtml,
    Auto_Uptime,
    getUID,
    StartCountOnlineTime,
    GetCountOnlineTime,
    Change_Environment,
    Auto_Update,
    Auto_Login
};
