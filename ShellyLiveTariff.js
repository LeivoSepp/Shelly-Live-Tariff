/*
This Shelly script is designed to retrieve energy market prices from Elering and
update Shelly cloud energy price Live Tariff. 

The script executes daily after 23:00 to send Live Tariffs for the following day.

created by Leivo Sepp, 07.01.2025
https://github.com/LeivoSepp/Shelly-Live-Tariff 
*/


/* Electricity transmission fees (EUR/MWh) without VAT
Elektrilevi https://elektrilevi.ee/en/vorguleping/vorgupaketid/eramu 
Imatra https://imatraelekter.ee/vorguteenus/vorguteenuse-hinnakirjad/
*/
let VORK1 = { dayRate: 77.2, nightRate: 77.2, dayMaxRate: 77.2, holidayMaxRate: 77.2 };
let VORK2 = { dayRate: 60.7, nightRate: 35.1, dayMaxRate: 60.7, holidayMaxRate: 35.1 };
let VORK4 = { dayRate: 36.9, nightRate: 21, dayMaxRate: 36.9, holidayMaxRate: 21 };
let VORK5 = { dayRate: 52.9, nightRate: 30.3, dayMaxRate: 81.8, holidayMaxRate: 47.4 };
let Partner24 = { dayRate: 60.7, nightRate: 60.7, dayMaxRate: 60.7, holidayMaxRate: 60.7 };
let Partner24Plus = { dayRate: 38.6, nightRate: 38.6, dayMaxRate: 38.6, holidayMaxRate: 38.6 };
let Partner12 = { dayRate: 72.4, nightRate: 42, dayMaxRate: 72.4, holidayMaxRate: 42 };
let Partner12Plus = { dayRate: 46.4, nightRate: 27.1, dayMaxRate: 46.4, holidayMaxRate: 27.1 };
let NONE = { dayRate: 0, nightRate: 0, dayMaxRate: 0, holidayMaxRate: 0 };

/****** PROGRAM INITIAL SETTINGS ******/
/* 
After the initial run, all user settings are stored in the Shelly 1) KVS or 2) Virtual components (in case virtual components are supported).
To modify these user settings later, you’ll need to access the Shelly KVS via: Menu → Advanced → KVS on the Shelly web page.
Once you’ve updated the settings, restart the script to apply the changes or wait for the next scheduled run.
If the Shelly supports Virtual components, the script will automatically create them and store the settings there.
Virtual Components allows you to modify settings directly from the Shelly web page or Shelly mobile app.
Updating script code is easy, you only need to copy-paste new code as all the settings are pulled from the KVS or Virtual components.
*/
let s = {
    networkPacket: "VORK2",      // ELEKTRILEVI/IMATRA transmission fee: VORK1 / VORK2 / VORK4 /VORK5 / Partner24 / Partner24Plus / Partner12 / Partner12Plus / NONE
    country: "ee",              // Estonia-ee, Finland-fi, Lithuania-lt, Latvia-lv
    apiUrl: "",                  // Shelly Cloud token
}
/****** PROGRAM INITIAL SETTINGS ******/
let _ = {
    elering: "https://dashboard.elering.ee/api/nps/price/csv?fields=",
    isUpdateRequired: false,
    loopFreq: 300, //300 seconds / 5 min
    loopRunning: false,
    dayInSec: 60 * 60 * 24,
    tsPrices: '',
    updtDelay: Math.floor(Math.random() * 46), //delay for server requests (max 45min)
    sId: Shelly.getCurrentScriptId(),
    pId: "Id" + Shelly.getCurrentScriptId() + ": ",
    networkProvider: "None",
    rpcCl: 1,
    oldVersion: 0,
    version: 1.0,
};
let cntr = 0;

let virtualComponents = [
    {
        type: "group", id: 200, config: {
            name: "Shelly Live Tariff"
        }
    },
    {
        type: "text", id: 200, config: {
            name: "Shelly API URL",
            default_value: "",
            persisted: true,
            meta: { ui: { view: "field" } }
        }
    },
    {
        type: "enum", id: 200, config: {
            name: "Network Package",
            options: ["NONE", "VORK1", "VORK2", "VORK4", "VORK5", "Partner24", "Partner24Plus", "Partner12", "Partner12Plus"],
            default_value: "VORK2",
            persisted: true,
            meta: { ui: { view: "dropdown", webIcon: 22, titles: { "NONE": "No package", "VORK1": "Võrk1 Base", "VORK2": "Võrk2 DayNight", "VORK4": "Võrk4 DayNight", "VORK5": "Võrk5 DayNightPeak", "Partner24": "Partner24 Base", "Partner24Plus": "Partner24Plus Base", "Partner12": "Partner12 DayNight", "Partner12Plus": "Partner12Plus DayNight" } } }
        }
    },
    {
        type: "enum", id: 201, config: {
            name: "Market Price Country",
            options: ["ee", "fi", "lv", "lt"],
            default_value: "ee",
            persisted: true,
            meta: { ui: { view: "dropdown", webIcon: 9, titles: { "ee": "Estonia", "fi": "Findland", "lv": "Latvia", "lt": "Lithuania" } } }
        }
    },
];

function start() {
    setAutoStart();
    getKvsData();
}
/* set the script to sart automatically on boot */
function setAutoStart() {
    if (!Shelly.getComponentConfig("script", _.sId).enable) {
        Shelly.call('Script.SetConfig', { id: _.sId, config: { enable: true } },
            function (res, err, msg, data) {
                if (err != 0) {
                    console.log(_.pId, "Live Tariff script autostart is not enabled.", msg, ". After Shelly restart, this script will not start and Live Tariff does not work.");
                }
            });
    }
}
// check if Shelly supports Virtual components
function isVirtualComponentsAvailable() {
    const info = Shelly.getDeviceInfo();
    return (info.gen === 3 || (info.gen === 2 && info.app.substring(0, 3) == "Pro")) && isNewerVersion('1.4.3', info.ver);
}
// compare versions
function isNewerVersion(oldVer, newVer) {
    const oldParts = oldVer.split('.')
    const newParts = newVer.split('.')
    for (var i = 0; i < newParts.length; i++) {
        let a = ~~newParts[i] // parse int
        let b = ~~oldParts[i] // parse int
        if (a > b) return true
        if (a < b) return false
    }
    return false
}
function getKvsData() {
    Shelly.call('KVS.GetMany', null, processKVSData);
}
function processKVSData(res, err, msg, data) {
    let kvsData;
    if (res) {
        kvsData = res.items;
        res = null;
    }
    //old version number is used to maintain backward compatibility
    _.oldVersion = (kvsData["version" + _.sId] != null && typeof JSON.parse(kvsData["version" + _.sId].value) === "number") ? JSON.parse(kvsData["version" + _.sId].value) : 0;

    if (isVirtualComponentsAvailable()) {
        if (_.oldVersion < 1) {
            console.log(_.pId, "New virtual component installation.");
            getAllVirtualComponents();
        } else {
            // Script already in Virtual components mode
            readAllVirtualComponents();
        }
    } else { // this is the KVS path if Shelly doesn't support Virtual components
        // Script in KVS mode
        let isExistInKvs = false;
        let userCongfigNotInKvs = [];
        //iterate settings and then KVS
        for (var k in s) {
            for (var i in kvsData) {
                //check if settings found in KVS
                if (i == k + _.sId) {
                    s[k] = kvsData[i].value; //do not convert strings
                    isExistInKvs = true;
                    break;
                }
            }
            if (isExistInKvs) {
                isExistInKvs = false;
            } else if (typeof s[k] === "object") {
                userCongfigNotInKvs.push([k, JSON.stringify(s[k])]);
            } else {
                userCongfigNotInKvs.push([k, s[k]]);
            }
        }
        storeSettingsKvs(userCongfigNotInKvs);
    }
}
function storeSettingsKvs(userCongfigNotInKvs) {
    if (cntr < 6 - _.rpcCl) {
        for (let i = 0; i < _.rpcCl && i < userCongfigNotInKvs.length; i++) {
            let value = userCongfigNotInKvs[0][1];
            let key = userCongfigNotInKvs.splice(0, 1)[0][0] + _.sId;
            cntr++;
            Shelly.call("KVS.set", { key: key, value: value },
                function (res, error_code, error_message, data) {
                    if (error_code !== 0) {
                        console.log(_.pId, "Store settings", data.key, data.value, "in KVS failed.");
                    } else {
                        console.log(_.pId, "Store settings", data.key, data.value, "to KVS is OK");
                    }
                    cntr--;
                },
                { key: key, value: value }
            );
        }
    }
    if (userCongfigNotInKvs.length > 0) {
        Timer.set(1000, false, storeSettingsKvs, userCongfigNotInKvs);
    } else {
        waitForRpcCalls(main);
    }
}
// Function to get all virtual components and delete them all before creating new -> this step only for new installations
function getAllVirtualComponents() {
    Shelly.call("Shelly.GetComponents", { dynamic_only: true, include: ["status"] }, function (result, error_code, error_message) {
        if (error_code === 0) {
            if (result.components && result.components.length > 0) {
                deleteVirtualComponents(result.components);
            } else {
                addVirtualComponent(virtualComponents);
            }
        } else {
            console.log(_.pId, "Failed to get virtual components. Error: " + error_message);
        }
    });
}
// Function to delete all virtual components
function deleteVirtualComponents(vComponents) {
    if (cntr < 6 - _.rpcCl) {
        for (let i = 0; i < _.rpcCl && i < vComponents.length; i++) {
            let key = vComponents.splice(0, 1)[0].key;
            cntr++;
            Shelly.call("Virtual.Delete", { key: key },
                function (res, error_code, error_message, data) {
                    if (error_code === 0) {
                        console.log(_.pId, "Deleted " + data.key + " virtual component");
                    } else {
                        console.log(_.pId, "Failed to delete " + data.key + " virtual component. Error: " + error_message);
                    }
                    cntr--;
                },
                { key: key }
            );
        }
    }
    if (vComponents.length > 0) {
        Timer.set(1000, false, deleteVirtualComponents, vComponents);
    } else {
        waitForRpcCalls([addVirtualComponent, virtualComponents]);
    }
}
//add all new virtual components
function addVirtualComponent(virtualComponents) {
    if (cntr < 6 - _.rpcCl) {
        for (let i = 0; i < _.rpcCl && i < virtualComponents.length; i++) {
            let component = virtualComponents.splice(0, 1)[0];
            let type = component.type;
            let id = component.id;
            let config = component.config;
            cntr++;
            Shelly.call("Virtual.Add", { type: type, id: id, config: config },
                function (res, error_code, error_message, data) {
                    if (error_code === 0) {
                        console.log(_.pId, "Added virtual component: " + data.type + ":" + data.id);
                    } else {
                        console.log(_.pId, "Failed to add virtual component: " + data.type + ":" + data.id + ". Error: " + error_message);
                    }
                    cntr--;
                },
                { type: type, id: id, config: config }
            );
        }
    }
    if (virtualComponents.length > 0) {
        Timer.set(1000, false, addVirtualComponent, virtualComponents);
    } else {
        waitForRpcCalls(setGroupConfig);
    }
}
function setGroupConfig() {
    const groupConfig = {
        id: 200,
        value: [
            "text:200",
            "enum:200",
            "enum:201"
        ]
    };
    Shelly.call("Group.Set", groupConfig, function (result, error_code, error_message) {
        if (error_code !== 0) {
            console.log(_.pId, "Failed to set group config. Error: " + error_message);
        }
    });
    readAllVirtualComponents();
}
function readAllVirtualComponents() {

    //this function reads all virtual components and stores the values to memory
    Shelly.call("Shelly.GetComponents", { dynamic_only: true, include: ["status"] }, function (result, error_code, error_message) {
        if (error_code === 0) {
            const components = result.components;
            result = null;
            if (components && components.length > 0) {
                for (let i in components) {
                    switch (components[i].key) {
                        case "text:200":
                            s.apiUrl = components[i].status.value;
                            break;
                        case "enum:200":
                            s.networkPacket = components[i].status.value;
                            break;
                        case "enum:201":
                            s.country = components[i].status.value;
                            break;
                        default:
                            break;
                    }
                }
                waitForRpcCalls(main);
            } else {
                console.log(_.pId, "No virtual components found.");
            }
        } else {
            console.log(_.pId, "Failed to get virtual components. Error: " + error_message);
        }
    });
}

/**
This is the main script where all the logic starts.
*/
function main() {
    setKVS();
    if (_.oldVersion === 0 || s.apiUrl === "") {
        console.log(_.pId, "Please set API URL value in KVS or Virtual components and then restart the script.");
        return;
    }
    //check if Shelly has time
    if (!isShellyTimeOk) {
        handleError("Shelly has no time.");
        return;
    }
    if (s.networkPacket.substring(0, 4) == "VORK") {
        _.networkProvider = "Elektrilevi";
    } else if (s.networkPacket.substring(0, 4) == "Part") {
        _.networkProvider = "Imatra";
    }
    console.log(_.pId, "Network provider: ", _.networkProvider, s.networkPacket);

    getElering();
}
//store the version and last calculation time to KVS
function setKVS() {
    //schedulers are created, store the IDs to KVS
    Shelly.call("KVS.set", { key: "version" + _.sId, value: _.version });
    Shelly.call("KVS.set", { key: "lastcalculation" + _.sId, value: new Date().toString() },
        function () {
            console.log(_.pId, "Script v" + _.version, " next fetch for Elering prices at", nextChkHr(1) + (_.updtDelay < 10 ? ":0" : ":") + _.updtDelay);
            _.loopRunning = false;
        });
}

/* Get electricity market price CSV file from Elering.  */
function getElering() {
    const tzInSec = getShellyTimezone();
    // Determine the date range for Elering query
    const dtRange = getEleringDateRange(tzInSec);
    // Build Elering URL
    const elUrl = buildEleringUrl(dtRange[0], dtRange[1]);

    console.log(_.pId, "Elering query: ", elUrl);
    try {
        Shelly.call("HTTP.GET", { url: elUrl, timeout: 5, ssl_ca: "*" }, priceCalc);
    } catch (error) {
        handleError("Elering HTTP.GET error" + error + "check again in " + _.loopFreq / 60 + " min.");
    }
}
function getShellyTimezone() {
    const shEpochUtc = Shelly.getComponentStatus("sys").unixtime;
    const shDt = new Date(shEpochUtc * 1000);
    const shHr = shDt.getHours();
    const shUtcHr = shDt.toISOString().slice(11, 13);
    let tz = shHr - shUtcHr;
    if (tz > 12) { tz -= 24; }
    if (tz < -12) { tz += 24; }
    return tz * 60 * 60;
}
function getEleringDateRange(tzInSec) {
    const shEpochUtc = Shelly.getComponentStatus("sys").unixtime;
    const shHr = new Date(shEpochUtc * 1000).getHours();
    // After 23:00 tomorrow's energy prices are used
    // before 23:00 today's energy prices are used.
    const addDays = shHr >= 23 ? 0 : -1;
    const isoTime = new Date((shEpochUtc + tzInSec + _.dayInSec * addDays) * 1000).toISOString().slice(0, 10);
    const isoTimePlusDay = new Date((shEpochUtc + tzInSec + (_.dayInSec * (addDays + 1))) * 1000).toISOString().slice(0, 10);
    const dtStart = isoTime + "T" + (24 - tzInSec / 3600) + ":00Z";
    const dtEnd = isoTimePlusDay + "T" + (24 - tzInSec / 3600 - 1) + ":00Z";
    return [dtStart, dtEnd];
}
function buildEleringUrl(dtStart, dtEnd) {
    return _.elering + s.country + "&start=" + dtStart + "&end=" + dtEnd;
}
/**
Price calculation logic.
*/
function priceCalc(res, err, msg) {
    if (err != 0 || res === null || res.code != 200 || !res.body_b64) {
        handleError("Elering JSON error, check again in " + _.loopFreq / 60 + " min.");
        return;
    }
    //convert the networkPacket value to variable
    s.networkPacket = eval(s.networkPacket);

    // Convert base64 to text and discard header
    res.body_b64 = atob(res.body_b64);
    const csvData = res.body_b64.substring(res.body_b64.indexOf("\n") + 1);
    res = null; //clear memory
    let eleringPrices = parseEleringPrices(csvData);
    //if elering API returns less than 23 rows, the script will try to download the data again after set of minutes
    if (eleringPrices.length < 23) {
        handleError("Elering API didn't return prices, check again in " + _.loopFreq / 60 + " min.");
        return;
    }
    //store the timestamp into memory
    _.tsPrices = epoch();
    console.log(_.pId, "We got market prices from Elering ", new Date().toString());

    for (let a = 0; a < eleringPrices.length; a++) {
        let hour = new Date(eleringPrices[a][0] * 1000).getHours();
        eleringPrices[a][0] = hour;
    }
    scheduleTariffs(eleringPrices);
}
/**
 * Parse Elering prices from the response body.
 */
function parseEleringPrices(body) {
    let eleringPrices = [];
    let activePos = 0;
    while (activePos >= 0) {
        body = body.substring(activePos);
        activePos = 0;
        let row = [0, 0];
        activePos = body.indexOf("\"", activePos) + 1;
        if (activePos === 0) {
            break; // End of data
        }
        // Epoch
        row[0] = Number(body.substring(activePos, body.indexOf("\"", activePos)));
        // Skip "; after timestamp
        activePos = body.indexOf("\"", activePos) + 2;
        // Price
        activePos = body.indexOf(";\"", activePos) + 2;
        row[1] = Number(body.substring(activePos, body.indexOf("\"", activePos)).replace(",", "."));
        // Add transfer fees
        row[1] += calculateTransferFees(row[0]);

        eleringPrices.push(row);
        activePos = body.indexOf("\n", activePos);
    }
    return eleringPrices;
}
/**
 * Calculate transfer fees based on the timestamp.
 */
function calculateTransferFees(epoch) {
    if (_.networkProvider === "Elektrilevi") {
        return calculateElektrileviTransferFees(epoch);
    } else if (_.networkProvider === "Imatra") {
        return calculateImatraTransferFees(epoch);
    } else {
        return 0;
    }
}
function calculateElektrileviTransferFees(epoch) {
    const hour = new Date(epoch * 1000).getHours();
    const day = new Date(epoch * 1000).getDay();
    const month = new Date(epoch * 1000).getMonth();
    if ((month >= 10 || month <= 2) && (day === 0 || day === 6) && hour >= 16 && hour < 20) {
        // peak holiday: Nov-Mar, SA-SU at 16:00–20:00
        return s.networkPacket.holidayMaxRate;
    } else if ((month >= 10 || month <= 2) && ((hour >= 9 && hour < 12) || (hour >= 16 && hour < 20))) {
        // peak daytime: Nov-Mar: MO-FR at 09:00–12:00 and at 16:00–20:00
        return s.networkPacket.dayMaxRate;
    } else if (hour < 7 || hour >= 22 || day === 6 || day === 0) {
        //night-time: MO-FR at 22:00–07:00, SA-SU all day
        return s.networkPacket.nightRate;
    } else {
        //daytime: MO-FR at 07:00–22:00
        return s.networkPacket.dayRate;
    }
}
function isSummerTime() {
    return getShellyTimezone() / 60 / 60 === 3;
}
function calculateImatraTransferFees(epoch) {
    const hour = new Date(epoch * 1000).getHours();
    const day = new Date(epoch * 1000).getDay();
    if (isSummerTime()) {
        if (hour < 8 || day === 6 || day === 0) {
            //summer-night-time: MO-FR at 00:00–08:00, SA-SU all day
            return s.networkPacket.nightRate;
        } else {
            //daytime: MO-FR at 08:00–24:00
            return s.networkPacket.dayRate;
        }
    } else {
        if (hour < 7 || hour >= 23 || day === 6 || day === 0) {
            //winter-night-time: MO-FR at 23:00–07:00, SA-SU all day
            return s.networkPacket.nightRate;
        } else {
            //daytime> MO-FR at 07:00–23:00
            return s.networkPacket.dayRate;
        }
    }
}

//this function is called when the Elering prices are fetched
let liveTariffTimer;
function scheduleTariffs(eleringPrices) {
    // send the current price to Shelly cloud
    setShellyTariff(eleringPrices);
    // schedule the next price update to be sent to Shelly cloud
    liveTariffTimer = Timer.set(1000 * secondsToNextHour(), true, setShellyTariff, eleringPrices);
}
function secondsToNextHour() {
    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const remainingSecondsInMinute = 60 - seconds;
    const remainingMinutes = 59 - minutes;
    return remainingSecondsInMinute + (remainingMinutes * 60);
}
// function to send the live tariff to Shelly cloud
function setShellyTariff(eleringPrices) {
    const shEpochUtc = Shelly.getComponentStatus("sys").unixtime;
    const shHr = new Date(shEpochUtc * 1000).getHours();
    let decodedURL = manualDecodeURI(s.apiUrl); //decode the URL
    let currentPrice = eleringPrices[shHr][1]; //get the current price
    currentPrice = currentPrice / 1000; //convert EUR/MWh to s/kWh
    currentPrice = currentPrice * 1.22; //add VAT
    currentPrice = Math.round(currentPrice * 1000) / 1000; //round to 3 decimals
    Shelly.call(
        "HTTP.POST", {
        "url": decodedURL,
        "content_type": " application/json",
        "body": JSON.stringify({ price: currentPrice })
    },
        function (res, err, msg) {
            if (err != 0 || res === null || res.code != 200) {
                handleError("Send Live Tariff to Shelly cloud error, try again in " + _.loopFreq / 60 + " min. "
                    + (res === null ? "No response" : JSON.parse(res.body).error));
                Timer.clear(liveTariffTimer);
                return;
            }
            let result = JSON.parse(res.body);
            _.isUpdateRequired = false;
            console.log("Live Tariff of " + Math.floor(result.price * 1000) / 1000 + " s/kWh has been sent to the Shelly cloud. The next update will be sent in " + Math.round(secondsToNextHour() / 60) + " minutes.");
        }
    );
}
// Function to manually decode URI (Shelly doesn't support regex or decodeURI)
function manualDecodeURI(encodedURI) {
    let decodedURI = '';
    for (let i = 0; i < encodedURI.length; i++) {
        if (encodedURI[i] === '%' && i + 2 < encodedURI.length) {
            let hex = encodedURI.slice(i + 1, i + 3);
            decodedURI += String.fromCharCode(parseInt(hex, 16));
            i += 2;
        } else {
            decodedURI += encodedURI[i];
        }
    }
    return decodedURI;
}

/**
 * Handle errors.
 */
function handleError(error_message) {
    console.log(_.pId, "# Internet error ", error_message);
    _.isUpdateRequired = true;
    _.loopRunning = false;
}
/**
 * Wait for the RPC calls to be completed before starting next function.
 */
function waitForRpcCalls(userdata) {
    if (cntr !== 0) {
        Timer.set(1000, false, waitForRpcCalls, userdata);
        return;
    }
    if (typeof userdata === "function") {
        userdata();
    } else {
        userdata[0](userdata[1]);
    }
}

function epoch() {
    return Math.floor(Date.now() / 1000.0);
}

/* Next hour for fetching Elering prices */
function nextChkHr(addHr) {
    const chkT = 24;
    const hr = (Math.ceil((new Date(Date.now() + (addHr * 60 * 60 * 1000)).getHours() + 1) / chkT) * chkT) - 1;
    return hr > 23 ? 23 : hr;
}
//check if the update is required
function isUpdtReq(ts) {
    const nextHour = nextChkHr(0);
    const now = new Date();
    const yestDt = new Date(now - _.dayInSec * 1000);
    const tsDt = new Date(ts * 1000);
    const isToday = tsDt.getFullYear() === now.getFullYear() && tsDt.getMonth() === now.getMonth() && tsDt.getDate() === now.getDate();
    const isYesterday = tsDt.getFullYear() === yestDt.getFullYear() && tsDt.getMonth() === yestDt.getMonth() && tsDt.getDate() === yestDt.getDate();
    const isTsAfterChkT = tsDt.getHours() === nextHour && isToday;
    const isChkT = now.getHours() === nextHour && now.getMinutes() >= _.updtDelay;
    return (isChkT && !isTsAfterChkT) || !(isToday || isYesterday);
}

//main loop function
function loop() {
    if (_.loopRunning) {
        return;
    }
    _.loopRunning = true;
    if (isUpdtReq(_.tsPrices) || _.isUpdateRequired) {
        start();
    } else {
        _.loopRunning = false;
    }
}

let isShellyTimeOk = false;
let timer_handle;
//check if Shelly has time
function checkShellyTime() {
    const shEpochUtc = Shelly.getComponentStatus("sys").unixtime;
    if (shEpochUtc > 0) {
        //if time is OK, then stop the timer
        Timer.clear(timer_handle);
        isShellyTimeOk = true;
    } else {
        //waiting timeserver response
        return;
    }
}
//execute the checkShellyTime when the script starts
checkShellyTime();
//start 1 sec loop-timer to check Shelly time 
//if Shelly has already time, then this timer will be closed immediately
timer_handle = Timer.set(1000, true, checkShellyTime);

//start the loop component
Timer.set(_.loopFreq * 1000, true, loop);

loop();