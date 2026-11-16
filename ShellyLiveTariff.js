/*
Created by Leivo Sepp, 07.01.2025
Licensed under the MIT License
https://github.com/LeivoSepp/Shelly-Live-Tariff 

This feature allows you to view the exact cost of your electricity usage 
if you have any Shelly power monitoring device installed.
(https://www.shelly.com/collections/energy-metering)

This Shelly script automates electricity tariffs in the Shelly cloud 
by retrieving energy market prices from Elering and updating the Live Tariff hourly.

Electricity transmission fees (EUR/MWh) without VAT
Elektrilevi https://elektrilevi.ee/en/vorguleping/vorgupaketid/eramu 
Imatra https://imatraelekter.ee/vorguteenus/vorguteenuse-hinnakirjad/
*/
function pack() {
    return {
        VORK1: { dRt: 77.2, nRt: 77.2, dMRt: 77.2, hMRt: 77.2 },
        VORK2: { dRt: 60.7, nRt: 35.1, dMRt: 60.7, hMRt: 35.1 },
        VORK4: { dRt: 36.9, nRt: 21, dMRt: 36.9, hMRt: 21 },
        VORK5: { dRt: 52.9, nRt: 30.3, dMRt: 81.8, hMRt: 47.4 },
        PARTN24: { dRt: 60.7, nRt: 60.7, dMRt: 60.7, hMRt: 60.7 },
        PARTN24PL: { dRt: 38.6, nRt: 38.6, dMRt: 38.6, hMRt: 38.6 },
        PARTN12: { dRt: 72.4, nRt: 42, dMRt: 72.4, hMRt: 42 },
        PARTN12PL: { dRt: 46.4, nRt: 27.1, dMRt: 46.4, hMRt: 27.1 },
        PAMATA1: { dRt: 39.62, nRt: 39.62, dMRt: 39.62, hMRt: 39.62 },
        SPECIAL1: { dRt: 158.48, nRt: 158.48, dMRt: 158.48, hMRt: 158.48 },
        NONE: { dRt: 0, nRt: 0, dMRt: 0, hMRt: 0 },
    }
}
/*
Charges billed on top of the market price and the network fee, EUR/MWh without VAT, and the VAT rate.
Estonia 2026: renewable energy 8.4, excise 2.1, security of supply 7.58, balancing capacity 3.73.
*/
function tax() {
    return {
        ee: { fix: 21.81, vat: 0.24 },    //Estonia
        fi: { fix: 0, vat: 0.255 },       //Finland
        lt: { fix: 0, vat: 0.21 },        //Lithuania
        lv: { fix: 0, vat: 0.21 },        //Latvia
    }
}
/****** PROGRAM INITIAL SETTINGS ******/
/* 
After the initial run, all user settings are stored in the Shelly 1) KVS or 2) Virtual components (in case virtual components are supported).
To modify these user settings later, you’ll need to access the Shelly KVS via: Menu → Advanced → KVS on the Shelly web page.
Once you’ve updated the settings, restart the script to apply the changes or wait for the next scheduled run.
*/
let c = {
    pack: "VORK2",     // ELEKTRILEVI/IMATRA transmission fee: NONE, VORK1, VORK2, VORK4, VORK5, PARTN24, PARTN24PL, PARTN12, PARTN12PL, PAMATA1, SPECIAL1
    is15: false,       // 1h or 15min measurements
    cnty: "ee",        // Estonia-ee, Finland-fi, Lithuania-lt, Latvia-lv
    api: "API_url",    // Shelly Cloud token
    mnKv: false,       // Forcing KVS mode in case of Virtual components support
}
/****** PROGRAM INITIAL SETTINGS ******/
let s = {
    last: 0,        // Get elering timestamp
    live: 0,        // live tariff updated
    vers: 0,
}
let _ = {
    upRq: false,
    freq: 300, //300 seconds / 5 min
    isLp: false,
    run: false,     //the price sending timer is running
    tsPr: '',
    updD: Math.floor(Math.random() * 13) + 46, //minute of the hour for the Elering request (random between 46-58)
    sId: Shelly.getCurrentScriptId(),
    pId: "Id" + Shelly.getCurrentScriptId() + ": ",
    prov: "None",
    fee: null,      //transfer fees of the network package
    qSec: 900,      //one Elering price row is a quarter-hour
    sl: 3600,       //slot length (s): 1h or 15min
    smr: false,     //device clock is on summer time (Imatra tariff)
    eler: null,     //price slots [start epoch, EUR/MWh with the transfer fee, length (s)] of the current and the next hour
    newV: 1.9,
    cdOk: false,    //conf OK
    sdOk: false,    //sys OK
};
let cntr = 0;

// map kvs to virtual components
function mpVC() {
    return [
        { val: "pack", vc: "enum:200" },
        { val: "is15", vc: "boolean:200" },
        { val: "cnty", vc: "enum:201" },
        { val: "api", vc: "text:200" },
        { val: "mnKv", vc: "" },
    ]
}

// Virtual components settings
function dtVc() {
    return [
        {
            type: "group", id: 200, config: {
                name: "Shelly Live Tariff"
            }
        },
        {
            type: "text", id: 200, config: {
                name: "Shelly API URL",
                default_value: "API_url",
                persisted: true,
                meta: { ui: { view: "field" } }
            }
        },
        {
            type: "text", id: 201, config: {
                name: "Live Tariff updated",
                default_value: "",
                persisted: true,
                meta: { ui: { view: "label", webIcon: 13 } }
            }
        },
        {
            type: "enum", id: 200, config: {
                name: "Network Package",
                options: ["NONE", "VORK1", "VORK2", "VORK4", "VORK5", "PARTN24", "PARTN24PL", "PARTN12", "PARTN12PL", "PAMATA1", "SPECIAL1"],
                default_value: "VORK2",
                persisted: true,
                meta: { ui: { view: "dropdown", webIcon: 22, titles: { "NONE": "No package", "VORK1": "Võrk1 Base", "VORK2": "Võrk2 DayNight", "VORK4": "Võrk4 DayNight", "VORK5": "Võrk5 DayNightPeak", "PARTN24": "Partner24 Base", "PARTN24PL": "Partner24Plus Base", "PARTN12": "Partner12 DayNight", "PARTN12PL": "Partner12Plus DayNight", "PAMATA1": "Pamata-1", "SPECIAL1": "Speciālais 1" } } }
            }
        },
        {
            type: "boolean", id: 200, config: {
                name: "Meter supports",
                default_value: false,
                persisted: true,
                meta: { ui: { view: "toggle", webIcon: 7, titles: ["1h", "15min"] } }
            }
        },

        {
            type: "enum", id: 201, config: {
                name: "Market Price Country",
                options: ["ee", "fi", "lv", "lt"],
                default_value: "ee",
                persisted: true,
                meta: { ui: { view: "dropdown", webIcon: 9, titles: { "ee": "Estonia", "fi": "Finland", "lv": "Latvia", "lt": "Lithuania" } } }
            }
        },
    ];
}
function strt() {
    sAut();
    gKvs();
}
//set autostart
function sAut() {
    if (!Shelly.getComponentConfig("script", _.sId).enable) {
        Shelly.call('Script.SetConfig', { id: _.sId, config: { enable: true } },
            function (res, err, msg) {
                if (err != 0) {
                    console.log(_.pId, "Live Tariff script autostart is not enabled.", msg);
                }
            });
    }
}
// check Virtual components support
function isVC() {
    const info = Shelly.getDeviceInfo();
    if (c.mnKv === true) {
        print(_.pId, "ManualKVS=true → forcing KVS mode");
        return false;
    }

    // Gen4 ja Gen3 OK; Gen2 ainult Pro + min FW 1.4.3
    const gen2ok = (info.gen === 2 && (info.app || "").substring(0, 3) === "Pro" && verC('1.4.3', info.ver));
    return (info.gen === 4 || info.gen === 3 || gen2ok);
}
// compare Shelly FW versions
function verC(old, newV) {
    const oldP = old.split('.');
    const newP = newV.split('.');
    for (var i = 0; i < newP.length; i++) {
        let a = ~~newP[i]; // parse int
        let b = ~~oldP[i]; // parse int
        if (a > b) return true;
        if (a < b) return false;
    }
    return false;
}
// Get KVS ConfigurationData into memory
function memC(dt) {
    c.api = dt.API;
    c.pack = dt.EnergyProvider;
    c.is15 = typeof dt.IsEnergy15min === "boolean" ? dt.IsEnergy15min : c.is15;
    c.cnty = dt.Country;
    c.mnKv = typeof dt.ManualKVS === "boolean" ? dt.ManualKVS : c.mnKv;
    return c;
}
// ConfigurationData data to KVS store
function kvsC() {
    let cdat = {};
    cdat.API = c.api;
    cdat.EnergyProvider = c.pack;
    cdat.IsEnergy15min = c.is15;
    cdat.Country = c.cnty;
    cdat.ManualKVS = c.mnKv;
    return cdat;
}
// Get KVS SystemData into memory
function memS(dt) {
    s.vers = dt.Version;
    return s;
}
// SystemData data to KVS store
function kvsS() {
    let sdat = {};
    sdat.TariffUpdated = s.live;
    sdat.LastCalculation = s.last;
    sdat.Version = s.vers;
    return sdat;
}
// Get KVS ConfigurationData and SystemData
function gKvs() {
    cntr = 2;
    Shelly.call('KVS.Get', { key: "LiveTariffConf" + _.sId },
        function (res, err) {
            cntr--;
            if (err !== 0) {
                return;
            }
            c = memC(JSON.parse(res.value));
            _.cdOk = true;
        });

    Shelly.call('KVS.Get', { key: "LiveTariffSys" + _.sId },
        function (res, err) {
            cntr--;
            if (err !== 0) {
                return;
            }
            s = memS(JSON.parse(res.value));
            _.sdOk = true;
        });
    wait(inst);
}

// Select running mode like KVS or Virtual components
function inst() {
    if (isVC()) {
        if (_.sdOk && !(s.vers < 1.2)) {
            print(_.pId, "Existing Virtual Component mode");
            rVc();
        } else {
            print(_.pId, "New Virtual Component installation");
            gVc();
        }
    } else {
        print(_.pId, "Script in KVS mode");
        tKvs();
    }
}
// Store configuration data to KVS
function tKvs() {
    Shelly.call("KVS.set", { key: "LiveTariffConf" + _.sId, value: JSON.stringify(kvsC()) },
        function (res, err, msg) {
            if (err !== 0) {
                console.log(_.pId, "Configuration not stored in KVS:", err, msg);
            } else {
                console.log(_.pId, "Configuration settings stored in KVS");
            }
        }
    );
    main();
}
// Get all virtual components and delete them before new installation
function gVc() {
    s.vers = _.newV;
    Shelly.call("KVS.set", { key: "LiveTariffSys" + _.sId, value: JSON.stringify(kvsS()) });
    Shelly.call("Shelly.GetComponents", { dynamic_only: true, include: ["status"] }, function (res, err, msg) {
        if (err === 0) {
            if (res.components && res.components.length > 0) {
                dVc(res.components);
            } else {
                aVc(dtVc());
            }
        } else {
            print(_.pId, "Failed to get virtual components: " + msg);
        }
    });
}

// Delete virtual components -> new installation
function dVc(vCom) {
    if (cntr < 6 - 1) {
        for (let i = 0; i < 1 && i < vCom.length; i++) {
            let key = vCom.splice(0, 1)[0].key;
            cntr++;
            Shelly.call("Virtual.Delete", { key: key },
                function (res, err, msg) {
                    if (err === 0) {
                        print(_.pId, "Clean Virtual Components");
                    } else {
                        print(_.pId, "Virtual component is not deleted: " + msg);
                    }
                    cntr--;
                }
            );
        }
    }
    if (vCom.length > 0) {
        Timer.set(1000, false, dVc, vCom);
    } else {
        wait([aVc, dtVc()]);
    }
}

// Add virtual components - new installation
function aVc(vCom) {
    if (cntr < 6 - 1) {
        for (let i = 0; i < 1 && i < vCom.length; i++) {
            let comp = vCom.splice(0, 1)[0];
            cntr++;
            Shelly.call("Virtual.Add", { type: comp.type, id: comp.id, config: comp.config },
                function (res, err, msg) {
                    if (err === 0) {
                        print(_.pId, "Added new virtual component: " + res.id);
                    } else {
                        print(_.pId, "Virtual component is not added: " + msg);
                    }
                    cntr--;
                }
            );
        }
    }
    if (vCom.length > 0) {
        Timer.set(1000, false, aVc, vCom);
    } else {
        wait(sGrp);
    }
}
// Set group - new installation
function sGrp() {
    let gCnf = {
        id: 200,
        value: [
            "text:201",
            "boolean:200",
            "text:200",
            "enum:200",
            "enum:201"
        ]
    };
    Shelly.call("Group.Set", gCnf, function (res, err, msg) {
        if (err !== 0) {
            console.log(_.pId, "Failed to set group config. Error: " + msg);
        }
    });
    gCnf = null;
    rVc();
}

//read virtual components - existing installation
function rVc() {
    for (let i in Object.keys(c)) {
        for (let j in mpVC()) {
            if (Object.keys(c)[i] === mpVC()[j].val) {
                c[Object.keys(c)[i]] = Virtual.getHandle(mpVC()[j].vc) !== null ? Virtual.getHandle(mpVC()[j].vc).getValue() : c[Object.keys(c)[i]];
                break;
            }
        }
    }
    main();
}

// Main function
function main() {
    if (c.api === "API_url") {
        console.log(_.pId, "Please set API URL value in KVS or Virtual components and then restart the script.");
        Shelly.call('Script.Stop', { id: _.sId });
        return;
    }
    if (!isTm) {
        hErr("Shelly has no time");
        return;
    }
    // set the network provider
    if (c.pack.substring(0, 4) == "VORK") {
        _.prov = "Elektlevi";
    } else if (c.pack.substring(0, 4) == "PART") {
        _.prov = "Imatra";
    } else if (c.pack.substring(0, 4) == "PAMA" || c.pack.substring(0, 7) == "SPECIAL") {
        _.prov = "Lv";
    }
    print(_.pId, "Network provider: ", _.prov, c.pack);
    const st = fHr(Shelly.getComponentStatus("sys").unixtime);
    if (st) {
        gEle(st);
    } else {
        trif();
    }
}

// Price slot that covers the epoch, null if none
function slot(t) {
    for (let i = 0; _.eler !== null && i < _.eler.length; i++) {
        if (_.eler[i][0] <= t && t < _.eler[i][0] + _.eler[i][2]) {
            return _.eler[i];
        }
    }
    return null;
}

// Start of the hour to request from Elering, 0 if no request is needed:
// the current hour when it has no prices, else the next hour from minute _.updD on
function fHr(now) {
    const hr = now - now % 3600;
    if (slot(now) === null) {
        return hr;
    }
    return now - hr >= _.updD * 60 && slot(hr + 3600) === null ? hr + 3600 : 0;
}

// Get the prices of one hour (four quarter-hours) starting at st from Elering
function gEle(st) {
    _.fee = pack()[c.pack] || pack().NONE;  //load the transfer fee
    _.sl = c.is15 ? 900 : 3600;
    _.smr = gTz() === 3 * 60 * 60;
    let url = "https://dashboard.elering.ee/api/nps/price/csv?fields=" + c.cnty;
    url += "&start=" + new Date(st * 1000).toISOString() + "&end=" + new Date((st + 3600) * 1000).toISOString();
    print(_.pId, "Elering query: ", url);

    Shelly.call("HTTP.GET", { url: url, timeout: 5, ssl_ca: "*" }, function (res, err) {
        url = null;
        if (err != 0 || res === null || res.code != 200 || !res.body_b64) {
            hErr("Elering HTTP.GET error, check again in " + _.freq / 60 + " min.");
            return;
        }
        let body = atob(res.body_b64);  //decode base64 to text
        res = null;
        const rows = pCsv(body, st);
        body = null;
        //if Elering returns less than four quarter-hour prices, the script will try to download the data again in 5 minutes
        if (rows === null) {
            hErr("Elering API didn't return prices, check again in " + _.freq / 60 + " min.");
            return;
        }
        // keep the slots of the current and the next hours, replace the requested hour
        const now = Shelly.getComponentStatus("sys").unixtime;
        let keep = [];
        for (let i = 0; _.eler !== null && i < _.eler.length; i++) {
            const sl = _.eler[i];
            if (sl[0] + sl[2] > now && (sl[0] < st || sl[0] >= st + 3600)) {
                keep.push(sl);
            }
        }
        for (let i = 0; i < rows.length; i++) {
            keep.push(rows[i]);
        }
        _.eler = keep;
        _.tsPr = now;
        print(_.pId, "We got market prices from Elering ", new Date().toString());
        if (_.run && st > now) {    //next hour's prices: the sending timer picks them up at the start of the hour
            _.upRq = false;
            _.isLp = false;
        } else {
            trif();
        }
    });
}

// Read the CSV rows "epoch";"local time";"price" of the hour starting at st, null if a row is missing, extra or unreadable.
// A slot (1h or 15min) is the average price plus the average transfer fee of its quarter-hours.
function pCsv(body, st) {
    const n = _.sl / _.qSec;            //quarter-hours in one slot
    let rows = [];
    let nRw = 0;
    let acc = 0;
    let fAc = 0;
    let pos = body.indexOf("\n");       //skip the header
    while (pos >= 0 && nRw < 4) {
        let aPos = body.indexOf("\"", pos) + 1;
        if (aPos === 0) {
            break; // End of data
        }
        const ts = Number(body.substring(aPos, body.indexOf("\"", aPos)));
        if (ts !== st + nRw * _.qSec) {
            break; // unexpected row
        }
        aPos = body.indexOf(";\"", aPos) + 2; //skip ;
        aPos = body.indexOf(";\"", aPos) + 2; //find price
        const raw = body.substring(aPos, body.indexOf("\"", aPos)).replace(",", ".");
        const pric = Number(raw);
        if (raw === "" || pric !== pric) {
            break; // unreadable price
        }
        acc += pric;
        fAc += fFee(ts);
        nRw++;
        if (nRw % n === 0) {
            rows.push([ts - (n - 1) * _.qSec, (acc + fAc) / n, _.sl]);
            acc = 0;
            fAc = 0;
        }
        pos = body.indexOf("\n", aPos);       //next line
    }
    return nRw === 4 ? rows : null;
}
// Get timezone offset in seconds 
function gTz() {
    const shDt = new Date(Shelly.getComponentStatus("sys").unixtime * 1000);
    const shHr = shDt.getHours();
    const utcH = shDt.toISOString().slice(11, 13);  //UTC hour
    let tz = shHr - utcH;                           //timezone offset
    if (tz > 12) { tz -= 24; }
    if (tz < -12) { tz += 24; }
    return tz * 60 * 60;
}
// Calculate transfer fee 
function fFee(epoch) {
    const hour = new Date(epoch * 1000).getHours();
    const day = new Date(epoch * 1000).getDay();
    const mnth = new Date(epoch * 1000).getMonth();
    if (_.prov === "Elektlevi") {
        if ((mnth >= 10 || mnth <= 2) && (day === 0 || day === 6) && hour >= 16 && hour < 20) {
            // peak holiday: Nov-Mar, SA-SU at 16:00–20:00
            return _.fee.hMRt;
        } else if ((mnth >= 10 || mnth <= 2) && day > 0 && day < 6 && ((hour >= 9 && hour < 12) || (hour >= 16 && hour < 20))) {
            // peak daytime: Nov-Mar: MO-FR at 09:00–12:00 and at 16:00–20:00
            return _.fee.dMRt;
        } else if (hour < 7 || hour >= 22 || day === 6 || day === 0) {
            //night-time: MO-FR at 22:00–07:00, SA-SU all day
            return _.fee.nRt;
        } else {
            //daytime: MO-FR at 07:00–22:00
            return _.fee.dRt;
        }
    } else if (_.prov === "Imatra") {
        if (_.smr) { //summer time
            if (hour < 8 || day === 6 || day === 0) {
                //summer-night-time: MO-FR at 00:00–08:00, SA-SU all day
                return _.fee.nRt;
            } else {
                //daytime: MO-FR at 08:00–24:00
                return _.fee.dRt;
            }
        } else {
            if (hour < 7 || hour >= 23 || day === 6 || day === 0) {
                //winter-night-time: MO-FR at 23:00–07:00, SA-SU all day
                return _.fee.nRt;
            } else {
                //daytime: MO-FR at 07:00–23:00
                return _.fee.dRt;
            }
        }
    } else if (_.prov === "Lv") {
        return _.fee.dRt;
    } else {
        return 0;
    }
}

// send the live tariff to Shelly cloud
let l_hd;
function trif() {
    Timer.clear(l_hd);
    _.run = false;
    const now = Shelly.getComponentStatus("sys").unixtime;
    const sl = slot(now);
    if (sl === null) {
        hErr("No price for the current " + (c.is15 ? "15 min" : "hour") + ", get the prices again in " + _.freq / 60 + " min.");
        return;
    }
    const tx = tax()[c.cnty];
    let cPrc = sl[1] + tx.fix;  //current price with the network fee plus the charges
    cPrc = cPrc / 1000;         //convert EUR/MWh to EUR/kWh
    cPrc = cPrc * (1 + tx.vat); //add VAT
    cPrc = cPrc.toFixed(5); //round to 5 decimals

    Shelly.call(
        "HTTP.POST", {
        "url": dUri(c.api),
        "content_type": " application/json",
        "body": JSON.stringify({ price: cPrc }),
    }, function (res, err, msg) {
        if (err != 0 || res === null || res.code != 200) {
            hErr("Send Live Tariff to Shelly cloud error, try again in " + _.freq / 60 + " min. " + err + " " + msg);
            return;
        }
        let json = JSON.parse(res.body);
        res = null;
        // schedule the next price update at the start of the next slot
        let rem = sl[0] + sl[2] - Shelly.getComponentStatus("sys").unixtime;
        rem = rem < 1 ? 1 : rem;
        l_hd = Timer.set(1000 * rem, false, trif);
        _.run = true;
        fKvs(json.price);
        _.upRq = false;
        print(_.pId, "Live Tariff of " + json.price + " EUR/kWh incl. VAT has been sent to the Shelly cloud. The next update will be sent in " + Math.round(rem / 60) + " minutes.");
        json = null;
        const scr = Shelly.getComponentStatus("script", _.sId);
        print(_.pId, "Memory used:", scr.mem_used, "peak:", scr.mem_peak);
    });
}

// store data to KVS
function fKvs(pric) {
    s.vers = _.newV;
    s.last = new Date(_.tsPr * 1000).toString();
    s.live = frmT(new Date()) + " (" + pric + " €/kWh" + ")";
    Shelly.call("Text.Set", { id: 201, value: s.live },);
    Shelly.call("KVS.set", { key: "LiveTariffSys" + _.sId, value: JSON.stringify(kvsS()) });
    s.vers, s.last, s.live = null;
    _.isLp = false;
}

function frmT(date) {
    return (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":"
        + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + " "
        + date.getDate() + "."
        + (date.getMonth() + 1) + "."
        + date.getFullYear();
}
// decode URI
function dUri(eUri) {
    let uri = '';
    for (let i = 0; i < eUri.length; i++) {
        if (eUri[i] === '%' && i + 2 < eUri.length) {
            let hex = eUri.slice(i + 1, i + 3);
            uri += String.fromCharCode(parseInt(hex, 16));
            i += 2;
        } else {
            uri += eUri[i];
        }
    }
    return uri;
}

// Error handling
function hErr(err) {
    console.log(_.pId, "# Internet error ", err);
    _.upRq = true;
    _.isLp = false;
}
// wait RPC calls
function wait(data) {
    if (cntr !== 0) {
        Timer.set(1000, false, wait, data);
        return;
    }
    if (typeof data === "function") {   //if function, call it
        data();
    } else {                            //if array, 1st -> function; 2nd -> parameter
        data[0](data[1]);
    }
}

function loop() {
    if (_.isLp) {
        return;
    }
    _.isLp = true;
    if (_.upRq || fHr(Shelly.getComponentStatus("sys").unixtime)) {
        strt();
    } else {
        _.isLp = false;
    }
}

// run the loop every hour at the minute _.updD, the 5 min loop is the retry
function schd() {
    const now = new Date();
    const cur = now.getMinutes() * 60 + now.getSeconds();
    const tgt = _.updD * 60;
    Timer.set(1000 * (cur < tgt ? tgt - cur : 3600 - cur + tgt), false, hrLp);
}
function hrLp() {
    schd();
    loop();
}

let isTm = false;
let t_hd;
//check if Shelly has time
function fcTm() {
    const epch = Shelly.getComponentStatus("sys").unixtime;
    if (epch > 0) {
        Timer.clear(t_hd);
        isTm = true;
        //start the main loop with a random delay (2-7 sec) to avoid the same starting time for concurrent instances
        Timer.set(Math.floor(Math.random() * 5) + 2 * 1000, false, loop);
        schd();
    } else {
        return;
    }
}

//start 1sec loop-timer to check Shelly time 
t_hd = Timer.set(1000, true, fcTm);

//start the main loop component
Timer.set(_.freq * 1000, true, loop);
