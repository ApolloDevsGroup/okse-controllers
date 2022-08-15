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
exports.CurrencyRateController = void 0;
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const { Mutex } = require('await-semaphore');
/**
 * Controller that passively polls on a set interval for an exchange rate from the current base
 * asset to the current currency
 */
class CurrencyRateController extends BaseController_1.default {
    /**
     * Creates a CurrencyRateController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.activeCurrency = '';
        this.activeNativeCurrency = '';
        this.mutex = new Mutex();
        /**
         * Name of this controller used during composition
         */
        this.name = 'CurrencyRateController';
        this.defaultConfig = {
            currentCurrency: this.getCurrentCurrencyFromState(state),
            disabled: true,
            interval: 180000,
            nativeCurrency: 'ETH',
            includeUSDRate: false,
        };
        this.defaultState = {
            conversionDate: 0,
            conversionRate: 0,
            currentCurrency: this.defaultConfig.currentCurrency,
            nativeCurrency: this.defaultConfig.nativeCurrency,
            usdConversionRate: 0,
        };
        this.initialize();
        this.configure({ disabled: false }, false, false);
        this.poll();
    }
    getCurrentCurrencyFromState(state) {
        return state && state.currentCurrency ? state.currentCurrency : 'usd';
    }
    getPricingURL(currentCurrency, nativeCurrency, includeUSDRate) {
        return (`https://min-api.cryptocompare.com/data/price?fsym=` +
            `${nativeCurrency.toUpperCase()}&tsyms=${currentCurrency.toUpperCase()}` +
            `${includeUSDRate && currentCurrency.toUpperCase() !== 'USD' ? ',USD' : ''}` + `&api_key=e9667fa9ffb7990c6cc2ad7cf58f815764b520a57aa5fa06c766f1d66336e165`);
    }
    /**
     * Sets a currency to track
     *
     * @param currentCurrency - ISO 4217 currency code
     */
    set currentCurrency(currentCurrency) {
        this.activeCurrency = currentCurrency;
        util_1.safelyExecute(() => this.updateExchangeRate());
    }
    /**
     * Sets a new native currency
     *
     * @param symbol - Symbol for the base asset
     */
    set nativeCurrency(symbol) {
        this.activeNativeCurrency = symbol;
        util_1.safelyExecute(() => this.updateExchangeRate());
    }
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to fetch new exchange rate
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            interval && this.configure({ interval }, false, false);
            this.handle && clearTimeout(this.handle);
            yield util_1.safelyExecute(() => this.updateExchangeRate());
            this.handle = setTimeout(() => {
                this.poll(this.config.interval);
            }, this.config.interval);
        });
    }

    fetchBSCExchangeRate() {
        return __awaiter(this, void 0, void 0, function* () {
            return util_1.handleFetch('https://api-v1.julswap.com/summary');
        });
    }

    /**
     * Fetches the exchange rate for a given currency
     *
     * @param currency - ISO 4217 currency code
     * @param nativeCurrency - Symbol for base asset
     * @param includeUSDRate - Whether to add the USD rate to the fetch
     * @returns - Promise resolving to exchange rate for given currency
     */
    fetchExchangeRate(currency, nativeCurrency = this.activeNativeCurrency, includeUSDRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const json = yield util_1.handleFetch(this.getPricingURL(currency, nativeCurrency, includeUSDRate));
            const conversionRate = Number(json[currency.toUpperCase()]);
            const usdConversionRate = Number(json.USD);
            // console.log(' *** conversionRate, currency: ', conversionRate, currency)

            if (false && !Number.isFinite(conversionRate)) {
                if (nativeCurrency === 'BNB') {
                    const bscprices = yield this.fetchBSCExchangeRate();
                    const bnb_price = bscprices['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c_0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56']
                    if (bnb_price['last_price']) {
                        const _bnb = parseFloat(bnb_price['last_price']);
                        console.log('_bnb', _bnb)
                        return {
                            conversionDate: Date.now() / 1000,
                            conversionRate: _bnb,
                            currentCurrency: currency,
                            nativeCurrency,
                            usdConversionRate,
                        };
                    }
                }


                if (nativeCurrency === 'ETH') {
                    const bscprices = yield this.fetchBSCExchangeRate();
                    const bnb_price = bscprices['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c_0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56']
                    const eth_price = bscprices['0x2170Ed0880ac9A755fd29B2688956BD959F933F8_0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c']

                    if (bnb_price['last_price'] && eth_price['last_price']) {
                        const _bnb = parseFloat(bnb_price['last_price']);
                        const eth_rate = parseFloat(eth_price['last_price']);
                        const _eth = _bnb * eth_rate;
                        console.log('_eth', _eth)
                        return {
                            conversionDate: Date.now() / 1000,
                            conversionRate: _eth,
                            currentCurrency: currency,
                            nativeCurrency,
                            usdConversionRate,
                        };
                    }
                }
            }


            if (!Number.isFinite(conversionRate)) {
                throw new Error(`Invalid response for ${currency.toUpperCase()}: ${json[currency.toUpperCase()]}`);
            }
            if (includeUSDRate && !Number.isFinite(usdConversionRate)) {
                throw new Error(`Invalid response for usdConversionRate: ${json.USD}`);
            }
            return {
                conversionDate: Date.now() / 1000,
                conversionRate,
                currentCurrency: currency,
                nativeCurrency,
                usdConversionRate,
            };
        });
    }
    /**
     * Updates exchange rate for the current currency
     *
     * @returns Promise resolving to currency data or undefined if disabled
     */
    updateExchangeRate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.disabled || !this.activeCurrency || !this.activeNativeCurrency) {
                return;
            }
            const releaseLock = yield this.mutex.acquire();
            try {
                const { conversionDate, conversionRate, usdConversionRate } = yield this.fetchExchangeRate(this.activeCurrency, this.activeNativeCurrency, this.includeUSDRate);
                const newState = {
                    conversionDate,
                    conversionRate,
                    currentCurrency: this.activeCurrency,
                    nativeCurrency: this.activeNativeCurrency,
                    usdConversionRate: this.includeUSDRate ? usdConversionRate : this.defaultState.usdConversionRate,
                };
                this.update(newState);
                return this.state;
            }
            finally {
                releaseLock();
            }
        });
    }
}
exports.CurrencyRateController = CurrencyRateController;
exports.default = CurrencyRateController;
//# sourceMappingURL=CurrencyRateController.js.map