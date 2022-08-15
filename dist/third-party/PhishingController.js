"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhishingController = void 0;
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const DEFAULT_PHISHING_RESPONSE = require('eth-phishing-detect/src/config.json');
const PhishingDetector = require('eth-phishing-detect/src/detector');
/**
 * Controller that passively polls on a set interval for approved and unapproved website origins
 */
class PhishingController extends BaseController_1.default {
    /**
     * Creates a PhishingController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.configUrl = 'https://cdn.jsdelivr.net/gh/MetaMask/eth-phishing-detect@master/src/config.json';
        /**
         * Name of this controller used during composition
         */
        this.name = 'PhishingController';
        this.defaultConfig = { interval: 60 * 60 * 1000 };
        this.defaultState = {
            phishing: DEFAULT_PHISHING_RESPONSE,
            whitelist: [],
        };
        this.detector = new PhishingDetector(this.defaultState.phishing);
        this.initialize();
        this.poll();
    }
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to fetch new approval lists
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            interval && this.configure({ interval }, false, false);
            this.handle && clearTimeout(this.handle);
            yield util_1.safelyExecute(() => this.updatePhishingLists());
            this.handle = setTimeout(() => {
                this.poll(this.config.interval);
            }, this.config.interval);
        });
    }
    /**
     * Determines if a given origin is unapproved
     *
     * @param origin - Domain origin of a website
     * @returns - True if the origin is an unapproved origin
     */
    test(origin) {
        if (this.state.whitelist.indexOf(origin) !== -1) {
            return false;
        }
        return this.detector.check(origin).result;
    }
    /**
     * Temporarily marks a given origin as approved
     */
    bypass(origin) {
        const { whitelist } = this.state;
        if (whitelist.indexOf(origin) !== -1) {
            return;
        }
        this.update({ whitelist: [...whitelist, origin] });
    }
    /**
     * Updates lists of approved and unapproved website origins
     *
     * @returns Promise resolving when this operation completes
     */
    updatePhishingLists() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.disabled) {
                return;
            }
            const phishingOpts = yield this.queryConfig(this.configUrl);
            if (phishingOpts) {
                this.detector = new PhishingDetector(phishingOpts);
                this.update({
                    phishing: phishingOpts,
                });
            }
        });
    }
    queryConfig(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(input, { cache: 'no-cache' });
            switch (response.status) {
                case 200: {
                    return yield response.json();
                }
                case 304:
                case 403: {
                    return null;
                }
                default: {
                    throw new Error(`Fetch failed with status '${response.status}' for request '${input}'`);
                }
            }
        });
    }
}
exports.PhishingController = PhishingController;
exports.default = PhishingController;
//# sourceMappingURL=PhishingController.js.map