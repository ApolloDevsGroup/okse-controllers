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
exports.AccountTrackerController = void 0;
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const EthQuery = require('eth-query');
const { Mutex } = require('await-semaphore');
const { BN } = require("ethereumjs-util");
/**
 * Controller that tracks information for all accounts in the current keychain
 */
class AccountTrackerController extends BaseController_1.default {
    /**
     * Creates an AccountTracker instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.mutex = new Mutex();
        /**
         * Name of this controller used during composition
         */
        this.name = 'AccountTrackerController';
        /**
         * List of required sibling controllers this controller needs to function
         */
        this.requiredControllers = ['NetworkController', 'PreferencesController', 'AssetsContractController'];
        this.defaultConfig = {
            interval: 10000,
        };
        this.defaultState = { accounts: {} };
        this.initialize();
    }
    /**
     * Refreshes all accounts in the current keychain
     */
    refresh() {
        __awaiter(this, void 0, void 0, function* () {
            if (!this?.syncAccounts) return;
            this.syncAccounts();
            const assetsContractController = this.context.AssetsContractController;
            const newAccounts = JSON.parse(JSON.stringify(this.state.accounts))
            try {
                const multicallContract = assetsContractController.getMulticallContract()
                if (!multicallContract) {
                    for (const address in newAccounts) {
                        yield util_1.safelyExecuteWithTimeout(() => __awaiter(this, void 0, void 0, function* () {
                            const balance = yield util_1.query(this.ethQuery, 'getBalance', [address]);
                            newAccounts[address] = { balance: util_1.BNToHex(balance) };
                            this.update({ accounts: newAccounts })
                        }));
                    }
                } else {
                    const callDataArray = []
                    for (const address in newAccounts) {
                        callDataArray.push({
                            contract: multicallContract, functionName: 'getEthBalance', param: [address]
                        })
                        newAccounts[address] = { balance: '0x0' };
                    }
                    if (!callDataArray.length) throw new Error(' --- Account list not exist');
                    const balanceResult = yield assetsContractController.getMulticallResult(callDataArray)
                    for (const i in callDataArray) {
                        const address = callDataArray[i].param[0]
                        if (!balanceResult[i]) continue;
                        newAccounts[address] = { balance: util_1.BNToHex(new BN(balanceResult[i]?.toString())) };
                    }
                    // console.log(' --- AccountTrackerController refresh done(resLen) : ', balanceResult.length)
                    this.update({ accounts: newAccounts });
                }
            } catch (error) {
                // console.log(' --- AccountTrackerController refresh multicall read error', error)
            }
            // console.log(' --- newContractBalances: ', newContractBalances)
        });
    }

    syncAccounts() {
        const { state: { identities }, } = this.context.PreferencesController;
        const { accounts } = this.state;
        const addresses = Object.keys(identities);
        const existing = Object.keys(accounts);
        const newAddresses = addresses.filter((address) => existing.indexOf(address) === -1);
        const oldAddresses = existing.filter((address) => addresses.indexOf(address) === -1);
        newAddresses.forEach((address) => {
            if (!accounts?.[address]?.balance) accounts[address] = { balance: '0x0' };
        });
        oldAddresses.forEach((address) => {
            delete accounts[address];
        });
        this.update({ accounts: Object.assign({}, accounts) });
    }
    /**
     * Sets a new provider
     *
     * @param provider - Provider used to create a new underlying EthQuery instance
     */
    set provider(provider) {
        this.ethQuery = new EthQuery(provider);
        // console.log(' -- AccountTrackerController/ethQuery: ', this.ethQuery)
    }
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed() {
        super.onComposed();
        const preferences = this.context.PreferencesController;
        preferences.subscribe(this.refresh);
        // this.poll();
    }
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval trigger a 'refresh'
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            interval && this.configure({ interval }, false, false);
            this.handle && clearTimeout(this.handle);
            yield this.refresh();
            this.handle = setTimeout(() => {
                this.poll(this.config.interval);
            }, this.config.interval);
            releaseLock();
        });
    }
}
exports.AccountTrackerController = AccountTrackerController;
exports.default = AccountTrackerController;
//# sourceMappingURL=AccountTrackerController.js.map