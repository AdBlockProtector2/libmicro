"use strict";
var Micro;
(function (Micro_1) {
    let usedNames = [];
    const TypeNormalizer = {
        "main_frame": "main_frame",
        "document": "main_frame",
        "sub_frame": "sub_frame",
        "subdocument": "sub_frame",
        "stylesheet": "stylesheet",
        "css": "stylesheet",
        "script": "script",
        "js": "script",
        "image": "image",
        "img": "image",
        "font": "font",
        "object": "object",
        "object-subrequest": "object",
        "xmlhttprequest": "xmlhttprequest",
        "xhr": "xmlhttprequest",
        "ping": "ping",
        "csp_report": "csp_report",
        "csp-report": "csp_report",
        "cspreport": "csp_report",
        "media": "media",
        "websocket": "websocket",
        "socket": "websocket",
        "other": "other",
        "beacon": "beacon",
    };
    class Filter {
        constructor(filter) {
            this._domainMatch = [];
            this._domainUnmatch = [];
            this._typeMatch = [];
            this._typeUnmatch = [];
            this._type = 0;
            this._data = "";
            this._domainExtractor = /^https?:\/\/([^/]+)/;
            const optionAnchor = filter.lastIndexOf("$");
            let matcher;
            let options;
            if (optionAnchor === -1) {
                matcher = filter;
                options = [];
            }
            else {
                matcher = filter.substring(0, optionAnchor).trim();
                options = filter.substring(optionAnchor + 1).trim().split(",");
                options = options.map((x) => x.trim());
            }
            if (matcher.startsWith("@@")) {
                throw new Error("libmicro does not handle white list");
            }
            options.forEach((o) => {
                const negated = o.startsWith("~");
                if (negated) {
                    o = o.substring(1);
                }
                if (o === "libmicro" || o === "important") {
                    return;
                }
                if (o === "first-party") {
                    if (negated) {
                        this._domainUnmatch.push("'self'");
                    }
                    else {
                        this._domainMatch.push("'self'");
                    }
                    return;
                }
                if (o === "third-party") {
                    if (negated) {
                        this._domainMatch.push("'self'");
                    }
                    else {
                        this._domainUnmatch.push("'self'");
                    }
                    return;
                }
                if (o.startsWith("redirect=") || o.startsWith("replace=") || o.startsWith("inject=")) {
                    if (this._type !== 0) {
                        throw new Error("libmicro only accept one of 'redirect=', 'replace=', and 'inject=' option");
                    }
                }
                if (o.startsWith("redirect=")) {
                    this._type = 1;
                    this._data = o.substring("redirect=".length);
                    return;
                }
                if (o.startsWith("replace=")) {
                    this._type = 2;
                    this._data = o.substring("replace=".length);
                    return;
                }
                if (o.startsWith("inject=")) {
                    this._type = 3;
                    this._data = o.substring("inject=".length);
                    return;
                }
                if (o.startsWith("domain=")) {
                    o = o.substring("domain=".length);
                    o.split(",").map((x) => x.trim()).forEach((d) => {
                        if (d.startsWith("~")) {
                            this._domainUnmatch.push(d.substring(1));
                        }
                        else {
                            this._domainMatch.push(d);
                        }
                    });
                    return;
                }
                if (TypeNormalizer.hasOwnProperty(o)) {
                    if (negated) {
                        this._typeUnmatch.push(TypeNormalizer[o]);
                    }
                    else {
                        this._typeMatch.push(TypeNormalizer[o]);
                    }
                    return;
                }
                throw new Error("libmicro does not accept '" + o + "' option");
            });
            if (this._domainMatch.includes("'self'") && this._domainUnmatch.includes("'self'")) {
                throw new Error("libmicro only accepts one of 'first-party' and 'third-party' option");
            }
            if (this._domainMatch.includes("'self'") && this._domainMatch.length > 1) {
                throw new Error("libmicro only accepts one of 'first-party' and 'domain' option");
            }
            if (this._domainUnmatch.includes("'self'") && this._domainUnmatch.length > 1) {
                throw new Error("libmicro only accepts one of 'third-party' and 'domain' option");
            }
            if (/firefox/i.test(navigator.userAgent) && this._type === 0) {
                let typeMatched = true;
                if (this._typeMatch.length > 0) {
                    typeMatched = this._typeMatch.includes("main_frame") || this._typeMatch.includes("sub_frame");
                }
                let typeUnmatched = false;
                if (this._typeUnmatch.length > 0) {
                    typeUnmatched = this._typeUnmatch.includes("main_frame") || this._typeUnmatch.includes("sub_frame");
                }
                if (typeMatched && !typeUnmatched) {
                    this._type = 1;
                    this._data = "libmicro-frame-blocked";
                }
            }
            if (/^\**$/.test(matcher)) {
                this._re = /[\s\S]/;
            }
            else if (matcher.length > 2 && matcher.startsWith("/") && matcher.endsWith("/")) {
                this._re = new RegExp(matcher.slice(1, -1), "i");
            }
            else {
                let reStrStart = "";
                let reStrEnd = "";
                if (matcher.startsWith("|")) {
                    reStrStart += "^";
                    matcher = matcher.substring(1);
                }
                if (matcher.startsWith("|")) {
                    reStrStart += "https?:\\/\\/(?:[^./]+(?:\\.))*";
                    matcher = matcher.substring(1);
                }
                if (matcher.endsWith("|")) {
                    reStrEnd = "$" + reStrEnd;
                    matcher = matcher.slice(0, -1);
                }
                matcher = matcher.replace(/[\\$+?.()|[\]{}]/g, '\\$&');
                matcher = matcher.replace(/\*/g, "[\\s\\S]*");
                matcher = matcher.replace(/\^/g, "(?:[/:?=&]|$)");
                this._re = new RegExp(reStrStart + matcher + reStrEnd, "i");
            }
        }
        get type() {
            return this._type;
        }
        get data() {
            return this._data;
        }
        _domCmp(a, b) {
            return a.endsWith(b) && (a.length === b.length || a.charAt(a.length - b.length - 1) === ".");
        }
        _sameOrigin(a, b) {
            if (a.length >= b.length) {
                return this._domCmp(a, b);
            }
            else {
                return this._domCmp(b, a);
            }
        }
        match(requester, destination, type) {
            let requesterDomain = this._domainExtractor.exec(requester);
            if (requesterDomain === null) {
                return false;
            }
            else {
                requesterDomain = requesterDomain[1];
            }
            let destinationDomain = this._domainExtractor.exec(destination);
            if (destinationDomain === null) {
                return false;
            }
            else {
                destinationDomain = destinationDomain[1];
            }
            if (this._domainMatch[0] === "'self'" && !this._sameOrigin(requesterDomain, destinationDomain)) {
                return false;
            }
            if (this._domainUnmatch[0] === "'self'" && this._sameOrigin(requesterDomain, destinationDomain)) {
                return false;
            }
            let typeMatched = true;
            if (this._typeMatch.length > 0) {
                typeMatched = this._typeMatch.includes(type);
            }
            let typeUnmatched = false;
            if (this._typeUnmatch.length > 0) {
                typeUnmatched = this._typeUnmatch.includes(type);
            }
            if (!typeMatched || typeUnmatched) {
                return false;
            }
            let domainMatched = true;
            if (this._domainMatch.length > 0) {
                domainMatched = this._domainMatch.some((d) => {
                    return this._sameOrigin(requesterDomain, d);
                });
            }
            let domainUnmatched = false;
            if (this._domainUnmatch.length > 0) {
                domainUnmatched = this._domainUnmatch.some((d) => {
                    return this._sameOrigin(requesterDomain, d);
                });
            }
            if (!domainMatched || domainUnmatched) {
                return false;
            }
            return this._re.test(destination);
        }
    }
    class Micro {
        constructor(name = "") {
            this._name = "";
            this._initialized = false;
            this.debug = false;
            this._assets = [];
            this._filters = [];
            this._tabs = {};
            this._thisOnCommitted = undefined;
            this._thisOnRemoved = undefined;
            this._thisOnBeforeRequest = undefined;
            if (usedNames.includes(name)) {
                throw new Error("This instance was already constructed");
            }
            usedNames.push(name);
            this._name = name;
        }
        get initialized() {
            return this._initialized;
        }
        async init() {
            if (this._initialized) {
                this.teardown();
            }
            this._initialized = true;
            let assets = "";
            let filters = "";
            try {
                await new Promise((resolve, reject) => {
                    chrome.storage.local.get([
                        "libmicro_assets_" + this._name,
                        "libmicro_filters_" + this._name,
                    ], (items) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        }
                        else {
                            assets = items["libmicro_assets_" + this._name] || "";
                            filters = items["libmicro_filters_" + this._name] || "";
                            resolve();
                        }
                    });
                });
            }
            catch (e) {
                console.error("libmicro could not read database, an empty database will be used");
                console.error(e);
            }
            let assetBuffer = [];
            assets += "\n";
            assets.split("\n").forEach((line) => {
                line = line.trim();
                if (line.startsWith("#")) {
                    return;
                }
                if (line.length === 0) {
                    if (assetBuffer.length > 0) {
                        const meta = assetBuffer.shift().split(" ");
                        const raw = assetBuffer.join("");
                        let payload = "data:" + meta[1];
                        if (meta[1].includes(";base64")) {
                            payload += "," + raw;
                        }
                        else {
                            payload += ";base64," + btoa(raw);
                        }
                        this._assets.push({
                            name: meta[0],
                            raw: raw,
                            payload: payload,
                        });
                        assetBuffer = [];
                    }
                }
                else {
                    assetBuffer.push(line);
                }
            });
            let invalidFilters = 0;
            filters.split("\n").forEach((filter) => {
                filter = filter.trim();
                if (filter.length === 0) {
                    return;
                }
                if (filter.charAt(0) === "!") {
                    return;
                }
                if (filter.charAt(0) === "#" && filter.charAt(1) !== "#") {
                    return;
                }
                try {
                    this._filters.push(new Filter(filter));
                }
                catch (e) {
                    console.error("libmicro failed to parse '" + filter + "'");
                    console.error(e);
                }
            });
            if (invalidFilters > 0) {
                console.error("libmicro could not parse " + invalidFilters.toString() + " of the filters");
            }
            try {
                await new Promise((resolve, reject) => {
                    let runningQueries = 0;
                    chrome.tabs.query({}, (existingTabs) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        }
                        for (let i = 0; i < existingTabs.length; i++) {
                            const tid = existingTabs[i].id;
                            if (typeof tid === "undefined") {
                                continue;
                            }
                            if (tid === chrome.tabs.TAB_ID_NONE) {
                                continue;
                            }
                            if (!this._tabs[tid]) {
                                this._tabs[tid] = {};
                            }
                            this._tabs[tid][0] = this._tabs[tid][0] || existingTabs[i].url;
                            runningQueries++;
                            chrome.webNavigation.getAllFrames({ tabId: tid }, (frames) => {
                                if (chrome.runtime.lastError) {
                                    return;
                                }
                                if (this._tabs[tid]) {
                                    for (let ii = 0; ii < frames.length; ii++) {
                                        const fid = frames[ii].frameId;
                                        this._tabs[tid][fid] = this._tabs[tid][fid] || frames[ii].url;
                                    }
                                }
                                runningQueries--;
                                if (runningQueries === 0) {
                                    resolve();
                                }
                            });
                        }
                    });
                });
            }
            catch (e) {
                console.error("libmicro could not load existing tabs, an empty tab store will be used");
                console.error(e);
            }
            if (typeof this._thisOnCommitted === "undefined") {
                this._thisOnCommitted = this._onCommitted.bind(this);
                this._thisOnRemoved = this._onRemoved.bind(this);
                this._thisOnBeforeRequest = this._onBeforeRequest.bind(this);
            }
            chrome.webNavigation.onCommitted.addListener(this._thisOnCommitted);
            chrome.tabs.onRemoved.addListener(this._thisOnRemoved);
            chrome.webRequest.onBeforeRequest.addListener(this._thisOnBeforeRequest, { urls: ["<all_urls>"] }, ["blocking"]);
        }
        teardown() {
            if (!this._initialized) {
                throw new Error("libmicro is not initialized");
            }
            this._initialized = false;
            this._assets = [];
            this._filters = [];
            this._tabs = {};
            chrome.webNavigation.onCommitted.removeListener(this._thisOnCommitted);
            chrome.tabs.onRemoved.removeListener(this._thisOnRemoved);
            chrome.webRequest.onBeforeRequest.removeListener(this._thisOnBeforeRequest);
        }
        setFilters(filters) {
            return new Promise((resolve, reject) => {
                let payload = {};
                payload["libmicro_filters_" + this._name] = filters;
                chrome.storage.local.set(payload, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
        setAssets(assets) {
            return new Promise((resolve, reject) => {
                let payload = {};
                payload["libmicro_assets_" + this._name] = assets;
                chrome.storage.local.set(payload, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
        _getTabURL(tab, frame) {
            if (this._tabs[tab]) {
                return this._tabs[tab][frame] || "";
            }
            else {
                return "";
            }
        }
        _findAsset(name) {
            for (let i = 0; i < this._assets.length; i++) {
                if (this._assets[i].name === name) {
                    return this._assets[i];
                }
            }
            return null;
        }
        _onCommitted(details) {
            if (!this._tabs[details.tabId]) {
                this._tabs[details.tabId] = {};
            }
            this._tabs[details.tabId][details.frameId] = details.url;
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                if (filter.type !== 3) {
                    continue;
                }
                if (filter.match(details.url, details.url, "main_frame")) {
                    let asset = this._findAsset(filter.data);
                    if (asset) {
                        chrome.tabs.executeScript(details.tabId, {
                            frameId: details.frameId,
                            code: "Micro.exec(`" + asset.raw.replace(/`/g, "\\`") + "`);",
                            runAt: "document_start",
                        });
                    }
                    else {
                        console.error("libmicro could not find asset '" + filter.data + "', the scriptlet is not injected");
                    }
                }
            }
        }
        _onRemoved(id) {
            delete this._tabs[id];
        }
        _onBeforeRequest(details) {
            let requester = details.documentUrl || details.originUrl;
            if (!requester) {
                requester = this._getTabURL(details.tabId, details.frameId);
            }
            if (requester.length > 0 && !/^https?:\/\//.test(requester)) {
                return;
            }
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                if (filter.type === 3) {
                    continue;
                }
                if (filter.match(requester, details.url, details.type)) {
                    switch (filter.type) {
                        case 0:
                            if (this.debug) {
                                console.log("libmicro canceled a request to '" + details.url + "'");
                            }
                            return { cancel: true };
                        case 1:
                            let asset = this._findAsset(filter.data);
                            if (asset) {
                                if (this.debug) {
                                    console.log("libmicro performed a redirect, from '" + details.url + "' to '" + filter.data + "'");
                                }
                                return { redirectUrl: asset.payload };
                            }
                            else {
                                if (this.debug) {
                                    console.error("libmicro could not find asset '" + filter.data + "', the request is blocked as a fallback");
                                }
                                return { cancel: true };
                            }
                        case 2:
                            console.warn("libmicro does not yet have implementation of request replacement");
                            break;
                    }
                }
            }
        }
    }
    Micro_1.Micro = Micro;
})(Micro || (Micro = {}));
