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
function vat() {
    return {
        ee: 1.24,   //Estonia
        fi: 1.24,   //Finland
        lt: 1.21,   //Lithuania
        lv: 1.21,   //Latvia
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
    tsPr: '',
    updD: Math.floor(Math.random() * 46) + 5, //delay for server requests (random between 23:05-23:50)
    sId: Shelly.getCurrentScriptId(),
    pId: "Id" + Shelly.getCurrentScriptId() + ": ",
    prov: "None",
    newV: 1.5,
    cdOk: false,    //conf OK
    sdOk: false,    //sys OK
};
let cntr = 0;

// map kvs to virtual components
function mpVC() {
    return [
        { val: "pack", vc: "enum:200" },
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
            type: "enum", id: 201, config: {
                name: "Market Price Country",
                options: ["ee", "fi", "lv", "lt"],
                default_value: "ee",
                persisted: true,
                meta: { ui: { view: "dropdown", webIcon: 9, titles: { "ee": "Estonia", "fi": "Findland", "lv": "Latvia", "lt": "Lithuania" } } }
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
    return (info.gen === 3 || (info.gen === 2 && info.app.substring(0, 3) == "Pro")) && isNewerVersion('1.4.3', info.ver) && !c.mnKv;
}
// compare versions
function isNewerVersion(oldV, newV) {
    const oldP = oldV.split('.')
    const newP = newV.split('.')
    for (var i = 0; i < newP.length; i++) {
        let a = ~~newP[i] // parse int
        let b = ~~oldP[i] // parse int
        if (a > b) return true
        if (a < b) return false
    }
    return false
}
// Get KVS ConfigurationData into memory
function memC(dt) {
    c.api = dt.API;
    c.pack = dt.EnergyProvider;
    c.cnty = dt.Country;
    c.mnKv = typeof dt.ManualKVS === "boolean" ? dt.ManualKVS : c.mnKv;
    return c;
}
// ConfigurationData data to KVS store
function kvsC() {
    let cdat = {};
    cdat.API = c.api;
    cdat.EnergyProvider = c.pack;
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
    gEle();
}

// Get electricity market price CSV file from Elering
function gEle() {
    const epch = Shelly.getComponentStatus("sys").unixtime;
    const shHr = new Date(epch * 1000).getHours();
    // After 23:00 tomorrow's energy prices are used
    // before 23:00 today's energy prices are used.
    const addD = shHr >= 23 ? 0 : -1;
    const isoT = new Date((epch + gTz() + 60 * 60 * 24 * addD) * 1000).toISOString().slice(0, 10);
    const isoN = new Date((epch + gTz() + (60 * 60 * 24 * (addD + 1))) * 1000).toISOString().slice(0, 10);
    const dtSt = isoT + "T" + (24 - gTz() / 3600) + ":00Z";
    const dtEn = isoN + "T" + (24 - gTz() / 3600) + ":00Z";

    let url = "https://dashboard.elering.ee/api/nps/price/csv?fields=";
    url += c.cnty + "&start=" + dtSt + "&end=" + dtEn;
    print(_.pId, "Elering query: ", url);
    Shelly.call("HTTP.GET", { url: url, timeout: 5, ssl_ca: "*" }, function (res, err) {
        url = null;
        if (err != 0 || res === null || res.code != 200 || !res.body_b64) {
            hErr("Elering HTTP.GET error, check again in " + _.freq / 60 + " min.");
            return;
        }
        c.pack = eval("pack()." + c.pack);      //load the transfer fee 

        // Convert base64 to text and discard header
        res.body_b64 = atob(res.body_b64);
        let body = res.body_b64.substring(res.body_b64.indexOf("\n") + 1);
        res = null;
        let eler = [];
        let aPos = 0;
        while (aPos >= 0) {
            body = body.substring(aPos);
            aPos = 0;
            let row = [0, 0];
            aPos = body.indexOf("\"", aPos) + 1;
            if (aPos === 0) {
                break; // End of data
            }
            // Epoch
            row[0] = Number(body.substring(aPos, body.indexOf("\"", aPos)));
            let pric = 0;
            let hr = new Date(row[0] * 1000).getHours();
            let hr15 = hr;
            let avg = 0;
            while (hr === hr15 && hr15 < 24) //sum 1 hour prices
            {
                avg++;
                aPos = body.indexOf(";\"", aPos) + 2; //skip ;
                aPos = body.indexOf(";\"", aPos) + 2; //find price
                pric += Number(body.substring(aPos, body.indexOf("\"", aPos)).replace(",", "."));

                aPos = body.indexOf("\n", aPos);        //next line
                let nxt = body.indexOf("\"", aPos) + 1; //next epoch
                if (nxt === 0) {
                    break; // EOF
                }
                hr15 = new Date(Number(body.substring(nxt, body.indexOf("\"", nxt))) * 1000).getHours();
            }
            row[1] = pric / avg;  //avg price for the hour
            row[1] += fFee(row[0]);     //add transfer fee
            eler.push(row);
        }
        //if API returns less than 24 rows, the script will try to download the data again in 5 minutes
        if (eler.length < 24) {
            hErr("Elering API didn't return prices, check again in " + _.freq / 60 + " min.");
            return;
        }
        //store the timestamp into memory
        _.tsPr = Math.floor(Date.now() / 1000.0);

        print(_.pId, "We got market prices from Elering ", new Date().toString());

        trif(eler);
    });
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
            return c.pack.hMRt;
        } else if ((mnth >= 10 || mnth <= 2) && ((hour >= 9 && hour < 12) || (hour >= 16 && hour < 20))) {
            // peak daytime: Nov-Mar: MO-FR at 09:00–12:00 and at 16:00–20:00
            return c.pack.dMRt;
        } else if (hour < 7 || hour >= 22 || day === 6 || day === 0) {
            //night-time: MO-FR at 22:00–07:00, SA-SU all day
            return c.pack.nRt;
        } else {
            //daytime: MO-FR at 07:00–22:00
            return c.pack.dRt;
        }
    } else if (_.prov === "Imatra") {
        if (gTz() / 60 / 60 === 3) { //summer time
            if (hour < 8 || day === 6 || day === 0) {
                //summer-night-time: MO-FR at 00:00–08:00, SA-SU all day
                return c.pack.nRt;
            } else {
                //daytime: MO-FR at 08:00–24:00
                return c.pack.dRt;
            }
        } else {
            if (hour < 7 || hour >= 23 || day === 6 || day === 0) {
                //winter-night-time: MO-FR at 23:00–07:00, SA-SU all day
                return c.pack.nRt;
            } else {
                //daytime: MO-FR at 07:00–23:00
                return c.pack.dRt;
            }
        }
    } else if (_.prov === "Lv") {
        return c.pack.dRt;
    } else {
        return 0;
    }
}

// send the live tariff to Shelly cloud
let l_hd;
function trif(eler) {
    let cHr = new Date(Shelly.getComponentStatus("sys").unixtime * 1000).getHours();
    let cPrc = eler[cHr][1];    //get the current price
    cPrc = cPrc / 1000;         //convert EUR/MWh to EUR/kWh
    cPrc = cPrc * eval("vat()." + c.cnty);         //add VAT
    cPrc = Math.round(cPrc * 1000) / 1000; //round to 3 decimals

    Shelly.call(
        "HTTP.POST", {
        "url": dUri(c.api),
        "content_type": " application/json",
        "body": JSON.stringify({ price: cPrc }),
    }, function (res, err, msg) {
        if (err != 0 || res === null || res.code != 200) {
            hErr("Send Live Tariff to Shelly cloud error, try again in " + _.freq / 60 + " min. " + err + " " + msg);
            erMs = null;
            return;
        }
        let json = JSON.parse(res.body);
        res = null;
        const nxMn = Math.round(sNxH() / 60);
        // schedule the next price update
        l_hd = Timer.set(1000 * sNxH(), false, trif, eler);
        fKvs(json.price);
        _.upRq = false;
        print(_.pId, "Live Tariff of " + json.price + " EUR/kWh incl. VAT has been sent to the Shelly cloud. The next update will be sent in " + nxMn + " minutes.");
        json = null;
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
}

function frmT(date) {
    return (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":"
        + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + " "
        + date.getDate() + "."
        + (date.getMonth() + 1) + "."
        + date.getFullYear();
}
// seconds to next hour
function sNxH() {
    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes();
    const rSec = 60 - sec;
    const rMin = 59 - min;
    return rSec + (rMin * 60);
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
    Timer.clear(l_hd);
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

/* Next hour for fetching Elering prices */
function nxHr(adHr) {
    const chkT = 24;
    const hr = (Math.ceil((new Date(Date.now() + (adHr * 60 * 60 * 1000)).getHours() + 1) / chkT) * chkT) - 1;
    return hr > 23 ? 23 : hr;
}
//check if update is needed 
function updt(ts) {
    const nHr = nxHr(0);                                //next hour for calculation
    const now = new Date();                             //now
    const yDt = new Date(now - 60 * 60 * 24 * 1000);    //yesterday
    const tDt = new Date(ts * 1000);                    //timestamp
    const tTd = tDt.getFullYear() === now.getFullYear() && tDt.getMonth() === now.getMonth() && tDt.getDate() === now.getDate();
    const tYd = tDt.getFullYear() === yDt.getFullYear() && tDt.getMonth() === yDt.getMonth() && tDt.getDate() === yDt.getDate();
    const tAft = tDt.getHours() === nHr && tTd;
    const isTm = now.getHours() === nHr && now.getMinutes() >= _.updD;
    return (isTm && !tAft) || !(tTd || tYd);
}

function loop() {
    if (_.isLp) {
        return;
    }
    _.isLp = true;
    if (updt(_.tsPr) || _.upRq) {
        strt();
    } else {
        _.isLp = false;
    }
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
    } else {
        return;
    }
}

//start 1sec loop-timer to check Shelly time 
t_hd = Timer.set(1000, true, fcTm);

//start the main loop component
Timer.set(_.freq * 1000, true, loop);

