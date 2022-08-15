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
exports.TokenBalancesController = exports.BN = void 0;
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const { BN } = require('ethereumjs-util');
exports.BN = BN;
const { Mutex } = require('await-semaphore');
/**
 * Controller that passively polls on a set interval token balances
 * for tokens stored in the AssetsController
 */
const DEFAULT_POLL_INTERVAL = 12000;
class TokenBalancesController extends BaseController_1.default {
    /**
     * Creates a TokenBalancesController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        /**
         * Name of this controller used during composition
         */
        this.name = 'TokenBalancesController';
        this.mutex = new Mutex();
        /**
         * List of required sibling controllers this controller needs to function
         */
        this.requiredControllers = ['AssetsContractController', 'AssetsController', 'NetworkController'];
        this.defaultConfig = {
            interval: 15000,
            tokens: [],
        };
        this.defaultState = { contractBalances: {} };
        this.initialize();
        this.poll();
    }
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to fetch new token balances
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!interval) interval = DEFAULT_POLL_INTERVAL
            if (this.handle) clearTimeout(this.handle);
            yield util_1.safelyExecute(() => this.updateBalances());
            this.handle = setTimeout(() => {
                this.poll(interval);
            }, interval);
        });
    }
    /**
     * Updates balances for all tokens
     *
     * @returns Promise resolving when this operation completes
     */
    updateBalances() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.disabled) {
                return;
            }
            const that = this;
            return new Promise(async (resolve, reject) => {
                const assetsContractController = that.context.AssetsContractController;
                const assets = that.context.AssetsController;
                if (!assets?.config) return resolve(false)

                const selectedAddress = assets?.config?.selectedAddress;
                if (!selectedAddress) return resolve(false)

                const { tokens } = that.config;
                const newContractBalances = JSON.parse(JSON.stringify(that.state.contractBalances))
                const curChainId = that.context.NetworkController.state.provider.chainId
                const whitelistedTokens = assets.getWhiteListedTokens(curChainId)
                // console.log(' 111111111 TokenBalances updateBalance started(addr,chain)', selectedAddress, curChainId)
                if (!selectedAddress || selectedAddress === '0x') return resolve(false);

                let isBalancingError = false;

                const multicallContract = assetsContractController.getMulticallContract()
                try {
                    if (!multicallContract) throw new Error(' --- multicall not defined')
                    const callDataArray = []
                    for (const i in tokens) {
                        const { address, symbol, chainId, } = tokens[i];
                        newContractBalances[address] = 0;
                        if (whitelistedTokens && !whitelistedTokens?.[address?.toLowerCase()]) continue;
                        if (parseInt(chainId) !== parseInt(curChainId)) continue;
                        if (!address || address === '0x') continue;
                        const assetContract = assetsContractController.getAssetContract(address)
                        callDataArray.push({
                            contract: assetContract, functionName: 'balanceOf', param: [selectedAddress]
                        })
                    }
                    callDataArray.push({
                        contract: multicallContract, functionName: 'getBlockNumber', params: []
                    })
                    if (!callDataArray.length) throw new Error(' --- Token list not exist');
                    const balanceResult = await assetsContractController.getMulticallResult(callDataArray)
                    if (!balanceResult || balanceResult === '0') throw new Error('Fetched Balance invalid')
                    for (const i in callDataArray) {
                        const address = callDataArray[i].contract.address
                        if (!balanceResult[i]) continue;
                        newContractBalances[address] = new BN(balanceResult[i]?.toString())
                    }
                    // console.log(' 22222222 updateBalances multicall done(resLen) : ', tokens.length, balanceResult.length)
                } catch (error) {
                    console.log(' *** updateBalances multicall read error', error.message)
                    isBalancingError = true;
                }
                try {
                    for (const i in tokens) {
                        const { address, symbol, chainId, isCustomToken } = tokens[i];
                        if (parseInt(chainId) !== parseInt(curChainId)) continue;
                        if (!isBalancingError && whitelistedTokens && whitelistedTokens?.[address?.toLowerCase()]) continue;
                        if (isBalancingError || isCustomToken) {
                            // console.log(' --- updateBalances fetch balance', selectedAddress, address, symbol)
                            try {
                                newContractBalances[address] = await assetsContractController.getBalanceOf(address, selectedAddress);
                                tokens[i].balanceError = null;
                            } catch (error) {
                                // console.log(' --- updateBalances balance read error: ', address, tokens[i])
                                newContractBalances[address] = 0;
                                tokens[i].balanceError = error;
                            }
                        }
                        // console.log(' --- read balance', address, chainId)
                    }
                } catch (error) {
                    console.log(' *** updateBalances read error', error)
                }
                that.update({ contractBalances: newContractBalances });
                // const logData = Object.keys(newContractBalances).map(key => ([key, newContractBalances[key].toString(10)]))
                // console.log(' 3333333333 UpdateBalances write done: ', newContractBalances?.[multicallContract.address]?.toString(10))

                resolve(true)
            })
        });
    }
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed() {
        super.onComposed();
        const assets = this.context.AssetsController;
        assets.subscribe(({ tokens }) => {
            this.configure({ tokens });
        });
    }
}
exports.TokenBalancesController = TokenBalancesController;
exports.default = TokenBalancesController;
//# sourceMappingURL=TokenBalancesController.js.map