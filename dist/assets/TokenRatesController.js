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
exports.TokenRatesController = void 0;
const ethereumjs_util_1 = require("ethereumjs-util");
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
/**
 * Controller that passively polls on a set interval for token-to-fiat exchange rates
 * for tokens stored in the AssetsController
 */
class TokenRatesController extends BaseController_1.default {
    /**
     * Creates a TokenRatesController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.tokenList = [];
        /**
         * Name of this controller used during composition
         */
        this.name = 'TokenRatesController';
        /**
         * List of required sibling controllers this controller needs to function
         */
        this.requiredControllers = ['AssetsController', 'CurrencyRateController'];
        this.defaultConfig = {
            disabled: true,
            interval: 180000,
            nativeCurrency: 'eth',
            tokens: [],
        };
        this.defaultState = { contractExchangeRates: {} };
        this.initialize();
        this.configure({ disabled: false }, false, false);
        this.poll();
    }
    getPricingURL(query) {
        return `https://api.coingecko.com/api/v3/simple/token_price/ethereum?${query}`;
    }

    getPricingBSCURL(query) {
        return `https://api.coingecko.com/api/v3/simple/token_price/ethereum?${query}`;
    }

    /**
     * Sets a new polling interval
     *
     * @param interval - Polling interval used to fetch new token rates
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            interval && this.configure({ interval }, false, false);
            this.handle && clearTimeout(this.handle);
            yield util_1.safelyExecute(() => this.updateExchangeRates());
            this.handle = setTimeout(() => {
                this.poll(this.config.interval);
            }, this.config.interval);
        });
    }
    /**
     * Sets a new token list to track prices
     *
     * @param tokens - List of tokens to track exchange rates for
     */
    set tokens(tokens) {
        this.tokenList = tokens;
        !this.disabled && util_1.safelyExecute(() => this.updateExchangeRates());
    }
    /**
     * Fetches a pairs of token address and native currency
     *
     * @param query - Query according to tokens in tokenList and native currency
     * @returns - Promise resolving to exchange rates for given pairs
     */
    fetchExchangeRate(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return util_1.handleFetch(this.getPricingURL(query));
        });
    }
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed() {
        super.onComposed();
        const assets = this.context.AssetsController;
        const currencyRate = this.context.CurrencyRateController;
        // console.log(' -- TokenRateController onComposed:', currencyRate.state.nativeCurrency)
        assets.subscribe(() => {
            this.configure({ tokens: assets.state.tokens });
        });
        currencyRate.subscribe(() => {
            this.configure({ nativeCurrency: currencyRate.state.nativeCurrency });
        });
    }

    fetchBSCExchangeRate() {
        return __awaiter(this, void 0, void 0, function* () {
            return util_1.handleFetch('https://api-v1.julswap.com/summary');
        });
    }

    /**
     * Updates exchange rates for all tokens
     *
     * @returns Promise resolving when this operation completes
     */
    updateExchangeRates() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.tokenList.length === 0) {
                return;
            }
            const newContractExchangeRates = {};
            const { nativeCurrency } = this.config;
            const pairs = this.tokenList.map((token) => token.address).join(',');
            const query = `contract_addresses=${pairs}&vs_currencies=${nativeCurrency.toLowerCase()}`;
            const prices = yield this.fetchExchangeRate(query);

            let bscTokens = false;

            this.tokenList.forEach((token) => {
                const address = ethereumjs_util_1.toChecksumAddress(token.address);
                const price = prices[token.address.toLowerCase()];
                newContractExchangeRates[address] = price ? price[nativeCurrency.toLowerCase()] : 0;
                if (token.symbol === 'JULb') {
                    bscTokens = true;
                }
            });

            // if (nativeCurrency === 'BNB' || bscTokens) {
            //     const bscprices = yield this.fetchBSCExchangeRate();

            //     const julb_price = bscprices['0x32dFFc3fE8E3EF3571bF8a72c0d0015C5373f41D_0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c']
            //     const juld_price = bscprices['0x5A41F637C3f7553dBa6dDC2D3cA92641096577ea_0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c']
            //     const bnb_price = bscprices['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c_0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56']
            //     const ethb_price = bscprices['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c_0xc5137E8e017799e71A65e0cFe3F340d719AF17D3']

            //     if (bnb_price['last_price']) {
            //         const _bnb = parseFloat(bnb_price['last_price']);
            //         const _juld = juld_price['last_price']
            //         const _julb = julb_price['last_price']
            //         const _ethb = ethb_price['last_price']

            //         this.tokenList.forEach((token) => {
            //             const address = ethereumjs_util_1.toChecksumAddress(token.address);
            //             const price_pair = `${address}_0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`;
            //             const price = bscprices[price_pair] ? parseFloat(bscprices[price_pair]['last_price']) : undefined;
            //             newContractExchangeRates[address] = price;
            //             // console.log('Token Rate token',token.symbol,token.address,price)

            //             if (price === undefined) {
            //                 const price_pair1 = `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c_${address}`;
            //                 const price1 = bscprices[price_pair1] ? parseFloat(bscprices[price_pair1]['last_price']) : undefined;
            //                 if (price1 && price1 !== 0) {

            //                 }
            //                 newContractExchangeRates[address] = 1 / price1;
            //             }
            //         });

            //         if (_juld !== undefined) {
            //             newContractExchangeRates['0x5A41F637C3f7553dBa6dDC2D3cA92641096577ea'] = parseFloat(_juld);
            //         }

            //         if (_ethb !== undefined) {
            //             let ethb_rate = parseFloat(_ethb)
            //             if (!isNaN(ethb_rate) && ethb_rate !== 0) {
            //                 newContractExchangeRates['0xc5137E8e017799e71A65e0cFe3F340d719AF17D3'] = 1 / ethb_rate;
            //             }
            //         }

            //         if (_julb !== undefined) {
            //             newContractExchangeRates['0x32dFFc3fE8E3EF3571bF8a72c0d0015C5373f41D'] = parseFloat(_julb);
            //         }

            //         newContractExchangeRates['0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'] = 1 / _bnb;
            //     }
            // }

            this.update({ contractExchangeRates: newContractExchangeRates });
        });
    }
}
exports.TokenRatesController = TokenRatesController;
exports.default = TokenRatesController;
//# sourceMappingURL=TokenRatesController.js.map