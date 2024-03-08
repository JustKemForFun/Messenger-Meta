/* eslint-disable linebreak-style */
"use strict";

module.exports = function (_defaultFuncs, _ctx) {
    return function getUID(callback) {
        var resolveFunc = function () { };
        var rejectFunc = function () { };
        var returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        if (!callback) {
            callback = function (err, data) {
                if (err) return rejectFunc(err);
                resolveFunc(data);
            };
        }

        try {
            if (!require(process.cwd() + "/MetaCord_Config.json").Count_Online_Time.Enable) return callback(null, "Not Enable Count Online Time");
            const extension = require('../utils/Extension');
            const { day, hour, minute } = extension.GetCountOnlineTime();
            callback((require(process.cwd() + "/MetaCord_Config.json").Count_Online_Time.Format).replace("{day}", day).replace("{hour}", hour).replace("{minute}", minute), null);
        }
        catch (e) {
            return callback(null, e);
        }
        return returnPromise;
    };
};