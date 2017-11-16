"use strict";


/**
 * libmicro main namespace.
 * @const {Namespace}
 */
var Micro = {};


/**
 * The chrome namespace.
 * @const {Namespace}
 */
Micro.chrome = window.chrome || window.browser;
/**
 * Configuration and assets.
 * @var {Array.<Micro.Filter>}
 * @var {Array.<Micro.Scriptlet>}
 */
Micro.config = [];
Micro.assets = [];


/**
 * Initialize libmicro.
 * @async @function
 */
Micro.init = async () => {
    const chrome = Micro.chrome;

    const [config, assets] = await Micro.fetch();

    Micro.config = [];
    Micro.assets = [];

    config.split("\n").map((x) => x.trim()).filter((x) => x.length).forEach((line) => {
        try {
            Micro.config.push(new Micro.Filter(line));
        } catch (err) {
            console.error("libmicro could not parse the configuration " + line + " because");
            console.error(err);
        }
    });

    // TODO Parse assets

    chrome
};
/**
 * Teardown libmicro, optionally clear parsed objects.
 * @function
 * @param {boolean} [clear=false] - Whether parsed objects should be cleared
 */
Micro.teardown = (clear = false) => {


    if (clear) {
        Micro.config = [];
        Micro.assets = [];
    }
};


/**
 * Read from database.
 * @async @function
 */
Micro.fetch = () => {
    const chrome = Micro.chrome;

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["libmicro_config", "libmicro_assets"], (items) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve([
                    items.libmicro_config || "",
                    items.libmicro_assets || "",
                ]);
            }
        });
    });
};


/**
 * Filter class.
 * @class
 */
Micro.Filter = class {
    /**
     * Constructor of the filter class.
     * @constructor
     * @param {string} str - The filter string
     */
    constructor(str) {
        /**
         * The domain matcher.
         * @private @prop
         * @const {RegExp}
         */
        this.re;
        /**
         * Domain restriction.
         * @private @prop
         * @const {Array.<string>}
         */
        this.domainsMatch = [];
        this.domainsUnmatch = [];
        /**
         * Type restriction.
         * @private @prop
         * @const {Array.<string>}
         */
        this.types = [];


        const optionAnchor = str.lastIndexOf("$");
        if (optionAnchor === -1) {
            throw new Error("libmicro expects 'important' option");
        }

        let matcher = str.substring(0, optionAnchor).trim();
        let options = str.substring(optionAnchor + 1).trim().split(",").map((x) => x.trim());

        if (matcher.startsWith("@@")) {
            throw new Error("libmicro does not handle white list");
        }


        processOptions: {
            if (!options.includes("important")) {
                throw new Error("libmicro expects 'important' option");
            }

            options.forEach((o) => {
                const negated = o.startsWith("~");
                o = o.replace(/^~/, "");

                if (o === "first-party") {
                    if (negated) {
                        this.domainsUnmatch.push("'self'");
                    } else {
                        this.domainsMatch.push("'self'");
                    }
                    return;
                }
                if (o === "third-party") {
                    if (negated) {
                        this.domainsMatch.push("'self'");
                    } else {
                        this.domainsUnmatch.push("'self'");
                    }
                    return;
                }

                if (o.startsWith("redirect=")) {
                    //TODO
                    throw new Error("libmicro does not yet support 'redirect' option");
                }
                if (o.startsWith("domain=")) {
                    o = o.substring(7);
                    o.split(",").map((x) => x.trim()).forEach((d) => {
                        if (d.startsWith("~")) {
                            this.domainsUnmatch.push(d.substring(1));
                        } else {
                            this.domainsMatch.push(d);
                        }
                    });
                    return;
                }

                throw new Error("libmicro does not accept '" + o + "' option");
            });

            if (this.domainsMatch.includes("'self'") && this.domainsUnmatch.includes("'self'")) {
                throw new Error("libmicro only accepts one of 'first-party' and 'third-party' options");
            }
            if (this.domainsMatch.includes("'self'") && this.domainsMatch.length > 1) {
                throw new Error("libmicro only accepts one of 'first-party' and 'domain' options");
            }
            if (this.domainsUnmatch.includes("'self'") && this.domainsUnmatch.length > 1) {
                throw new Error("libmicro only accepts one of 'third-party' and 'domain' options");
            }
        }


        processMatcher: {
            if (matcher === "" || matcher === "*") {
                this.re = /[\s\S]/;
                break processMatcher;
            }

            if (matcher.length > 2 && matcher.startsWith("/") && matcher.endsWith("/")) {
                this.re = new RegExp(matcher.slice(1, -1), "i");
                break processMatcher;
            }

            // Start anchor
            matcher = matcher.replace(/^\|/, "^");
            // End anchor
            matvher = matcher.replace(/\|$/, "$");
            // Domain anchor, must be processed after start anchor
            matcher = matcher.replace(/^\^\|\.?/, "^https?:\\/\\/(?:[^./]+(?:\\.|\/))*");
            // Wildcard matcher
            matcher = matcher.replace(/\*/g, "[\\s\\S]*");
            // Special character matcher
            matcher = matcher.replace(/\^/g, "(?:[^%.0-9a-z_-]|$)");
            // General RegExp escape
            matcher = matcher.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');

            this.re = new RegExp(matcher, "i");
        }
    }

    /**
     * Check if two origin are the same.
     * @private @method
     * @param {string} a - The first origin.
     * @param {string} b - The second origin.
     * @return {boolean} Whether the two origins are the same.
     */
    areSameOrigin(a, b) {
        if (b.length > a.length) {
            const temp = a;
            a = b;
            b = temp;
        }

        if (a === b) {
            return true;
        }
        if (a.endsWith(b) && a.charAt(a.length - b.length - 1) === '.') {
            return true;
        }

        return false;
    }
    /**
     * Check if a request should be blocked.
     * @method
     * @param {string} requester - The requester URL.
     * @param {string} destination - The destination (requested) URL.
     * @return {boolean} Whether this request should be blocked.
     */
    match(requester, destination) {
        const domainExtractor = /^https?:\/\/([^/])/;

        let requesterOrigin = domainExtractor.match(requester);
        if (requesterOrigin === null) {
            return false;
        } else {
            requesterOrigin = requesterOrigin[1];
        }

        let destinationOrigin = domainExtractor.match(destination);
        if (destinationOrigin === null) {
            return false;
        } else {
            destinationOrigin = destinationOrigin[1];
        }

        if (this.domainsMatch[0] === "'self'" && !this.areSameOrigin(requesterOrigin, destinationOrigin)) {
            return false;
        }
        if (this.domainsUnmatch[0] === "'self'" && this.areSameOrigin(requesterOrigin, destinationOrigin)) {
            return false;
        }

        const matched = this.domainsMatch.some((d) => {
            if (this.areSameOrigin(d, requesterOrigin)) {
                return true;
            }
        });
        const unmatched = this.domainsUnmatch.some((d) => {
            if (this.areSameOrigin(d, requesterOrigin)) {
                return true;
            }
        });

        if (!matched || unmatched) {
            return false;
        }

        return this.re.test(destination);
    }
};
