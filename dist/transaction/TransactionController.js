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
exports.TransactionController = exports.SPEED_UP_RATE = exports.CANCEL_RATE = exports.WalletDevice = exports.TransactionStatus = void 0;
const events_1 = require("events");
const ethereumjs_util_1 = require("ethereumjs-util");
const eth_rpc_errors_1 = require("eth-rpc-errors");
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const MethodRegistry = require('eth-method-registry');
const EthQuery = require('eth-query');
const Transaction = require('ethereumjs-tx');
const random = require('uuid/v1');
const { BN } = require('ethereumjs-util');
const { Mutex } = require('await-semaphore');
const Web3 = require('web3');

/**
 * The status of the transaction. Each status represents the state of the transaction internally
 * in the wallet. Some of these correspond with the state of the transaction on the network, but
 * some are wallet-specific.
 */
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["approved"] = "approved";
    TransactionStatus["cancelled"] = "cancelled";
    TransactionStatus["confirmed"] = "confirmed";
    TransactionStatus["failed"] = "failed";
    TransactionStatus["rejected"] = "rejected";
    TransactionStatus["signed"] = "signed";
    TransactionStatus["submitted"] = "submitted";
    TransactionStatus["unapproved"] = "unapproved";
})(TransactionStatus = exports.TransactionStatus || (exports.TransactionStatus = {}));

/**
 * Options for wallet device.
 */
var WalletDevice;
(function (WalletDevice) {
    WalletDevice["MM_MOBILE"] = "julwallet_mobile";
    WalletDevice["MM_EXTENSION"] = "julwallet_extension";
    WalletDevice["OTHER"] = "other_device";
})(WalletDevice = exports.WalletDevice || (exports.WalletDevice = {}));


/**
 * Multiplier used to determine a transaction's increased gas fee during cancellation
 */
exports.CANCEL_RATE = 1.5;
/**
 * Multiplier used to determine a transaction's increased gas fee during speed up
 */
exports.SPEED_UP_RATE = 1.1;
/**
 * Controller responsible for submitting and managing transactions
 */
class TransactionController extends BaseController_1.default {
    /**
     * Creates a TransactionController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.mutex = new Mutex();
        /**
         * Normalizes the transaction information from alethio
         * to be compatible with the TransactionMeta interface
         *
         * @param txMeta - Object containing the transaction information
         * @param currentNetworkID - string representing the current network id
         * @returns - TransactionMeta
         */
        this.normalizeTxFromAlehio = (txMeta, currentNetworkID) => {
            const {
                attributes: { symbol, blockCreationTime, decimals, transactionGasLimit, transactionGasPrice, value },
                relationships: { to, from, transaction, token },
            } = txMeta;
            const time = parseInt(blockCreationTime, 10) * 1000;
            return {
                id: random({ msecs: time }),
                isTransfer: true,
                networkID: currentNetworkID,
                status: 'confirmed',
                time: parseInt(blockCreationTime, 10) * 1000,
                transaction: {
                    chainId: 1,
                    from: from.data.id,
                    gas: transactionGasLimit,
                    gasPrice: transactionGasPrice,
                    to: to.data.id,
                    value,
                },
                transactionHash: transaction.data.id,
                transferInformation: {
                    contractAddress: token.data.id,
                    decimals,
                    symbol,
                },
            };
        };
        /**
         * EventEmitter instance used to listen to specific transactional events
         */
        this.hub = new events_1.EventEmitter();
        /**
         * Name of this controller used during composition
         */
        this.name = 'TransactionController';
        /**
         * List of required sibling controllers this controller needs to function
         */
        this.requiredControllers = ['NetworkController', 'AssetsContractController'];
        this.defaultConfig = {
            interval: 5000,
            provider: undefined,
        };
        this.defaultState = {
            methodData: {},
            transactions: [],
        };
        this.initialize();
        this.poll();
    }
    failTransaction(transactionMeta, error) {
        transactionMeta.status = 'failed';
        transactionMeta.error = error;
        this.updateTransaction(transactionMeta);
        this.hub.emit(`${transactionMeta.id}:finished`, transactionMeta);
    }
    registryLookup(fourBytePrefix) {
        return __awaiter(this, void 0, void 0, function* () {
            const registryMethod = yield this.registry.lookup(fourBytePrefix);
            const parsedRegistryMethod = this.registry.parse(registryMethod);
            return { registryMethod, parsedRegistryMethod };
        });
    }
    /**
     * Normalizes the transaction information from etherscan
     * to be compatible with the TransactionMeta interface
     *
     * @param txMeta - Object containing the transaction information
     * @param currentNetworkID - string representing the current network id
     * @returns - TransactionMeta
     */
    normalizeTxFromEtherscan(txMeta, currentNetworkID) {
        const time = parseInt(txMeta.timeStamp, 10) * 1000;
        /* istanbul ignore next */
        const status = txMeta.isError === '0' ? 'confirmed' : 'failed';
        return {
            blockNumber: txMeta.blockNumber,
            id: random({ msecs: time }),
            networkID: currentNetworkID,
            status,
            time,
            transaction: {
                data: txMeta.input,
                from: txMeta.from,
                gas: util_1.BNToHex(new BN(txMeta.gas)),
                gasPrice: util_1.BNToHex(new BN(txMeta.gasPrice)),
                nonce: util_1.BNToHex(new BN(txMeta.nonce)),
                to: txMeta.to,
                value: util_1.BNToHex(new BN(txMeta.value)),
            },
            transactionHash: txMeta.hash,
        };
    }
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to fetch new transaction statuses
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            interval && this.configure({ interval }, false, false);
            this.handle && clearTimeout(this.handle);
            yield util_1.safelyExecute(() => this.queryTransactionStatuses());
            this.handle = setTimeout(() => {
                this.poll(this.config.interval);
            }, this.config.interval);
        });
    }
    /**
     * Handle new method data request
     *
     * @param fourBytePrefix - String corresponding to method prefix
     * @returns - Promise resolving to method data object corresponding to signature prefix
     */
    handleMethodData(fourBytePrefix) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                const { methodData } = this.state;
                const knownMethod = Object.keys(methodData).find((knownFourBytePrefix) => fourBytePrefix === knownFourBytePrefix);
                if (knownMethod) {
                    return methodData[fourBytePrefix];
                }
                const registry = yield this.registryLookup(fourBytePrefix);
                this.update({ methodData: Object.assign(Object.assign({}, methodData), { [fourBytePrefix]: registry }) });
                return registry;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Add a new unapproved transaction to state. Parameters will be validated, a
     * unique transaction id will be generated, and gas and gasPrice will be calculated
     * if not provided. If A `<tx.id>:unapproved` hub event will be emitted once added.
     *
     * @param transaction - Transaction object to add
     * @param origin - Domain origin to append to the generated TransactionMeta
     * @returns - Object containing a promise resolving to the transaction hash if approved
     */
    addTransaction(transaction, origin) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const network = this.context.NetworkController;
            const { transactions } = this.state;
            transaction = util_1.normalizeTransaction(transaction);
            util_1.validateTransaction(transaction);
            /* istanbul ignore next */
            const networkID = (_b = (_a = network === null || network === void 0 ? void 0 : network.state) === null || _a === void 0 ? void 0 : _a.provider) === null || _b === void 0 ? void 0 : _b.chainId;

            console.log(' --- txController addTx networkID: ', networkID)
            const transactionMeta = {
                id: random(),
                networkID,
                origin,
                status: 'unapproved',
                time: Date.now(),
                transaction,
            };
            try {
                const { gas, gasPrice } = yield this.estimateGas(transaction);
                transaction.gas = gas;
                transaction.gasPrice = gasPrice;
            }
            catch (error) {
                this.failTransaction(transactionMeta, error);
                return Promise.reject(error);
            }
            let result;
            try {
                result = new Promise((resolve, reject) => {
                    this.hub.once(`${transactionMeta.id}:finished`, (meta) => {
                        switch (meta.status) {
                            case 'submitted':
                                return resolve(meta.transactionHash);
                            case 'rejected':
                                // return resolve(meta.status)
                                return reject(eth_rpc_errors_1.ethErrors.provider.userRejectedRequest('User rejected the transaction'));
                            case 'cancelled':
                                // return resolve(meta.status)
                                return reject(eth_rpc_errors_1.ethErrors.rpc.internal('User cancelled the transaction'));
                            case 'failed':
                                // return resolve(meta.status)
                                return reject(eth_rpc_errors_1.ethErrors.rpc.internal(meta.error.message));
                            /* istanbul ignore next */
                            default:
                                return reject(eth_rpc_errors_1.ethErrors.rpc.internal(`MetaMask Tx Signature: Unknown problem: ${JSON.stringify(meta)}`));
                        }
                    });
                });
            } catch (error) {
                this.failTransaction(transactionMeta, error);
                return Promise.reject(error);
            }
            transactions.push(transactionMeta);
            this.update({ transactions: [...transactions] });
            this.hub.emit(`unapprovedTransaction`, transactionMeta);
            return { result, transactionMeta };
        });
    }
    /**
     * Approves a transaction and updates it's status in state. If this is not a
     * retry transaction, a nonce will be generated. The transaction is signed
     * using the sign configuration property, then published to the blockchain.
     * A `<tx.id>:finished` hub event is fired after success or failure.
     *
     * @param transactionID - ID of the transaction to approve
     * @returns - Promise resolving when this operation completes
     */
    approveTransaction(transactionID) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { transactions } = this.state;
            const network = this.context.NetworkController;
            /* istanbul ignore next */
            const currentChainId = (_b = (_a = network === null || network === void 0 ? void 0 : network.state) === null || _a === void 0 ? void 0 : _a.provider) === null || _b === void 0 ? void 0 : _b.chainId;
            const index = transactions.findIndex(({ id }) => transactionID === id);
            const transactionMeta = transactions[index];
            const { from } = transactionMeta.transaction;

            if (!this.sign) {
                this.failTransaction(transactionMeta, new Error('No sign method defined.'));
                return;
            }
            else if (!currentChainId) {
                this.failTransaction(transactionMeta, new Error('No chainId defined.'));
                return;
            }
            try {
                transactionMeta.status = 'approved';
                transactionMeta.transaction.nonce = yield util_1.query(this.ethQuery, 'getTransactionCount', [from, 'pending']);
                transactionMeta.transaction.chainId = parseInt(currentChainId, undefined);
                const ethTransaction = new Transaction(Object.assign({}, transactionMeta.transaction));
                yield this.sign(ethTransaction, transactionMeta.transaction.from);
                transactionMeta.status = 'signed';
                this.updateTransaction(transactionMeta);
                const rawTransaction = ethereumjs_util_1.bufferToHex(ethTransaction.serialize());
                transactionMeta.rawTransaction = rawTransaction;
                this.updateTransaction(transactionMeta);
                const transactionHash = yield util_1.query(this.ethQuery, 'sendRawTransaction', [rawTransaction]);
                transactionMeta.transactionHash = transactionHash;
                console.log(' --- transaction submitted: ', transactionHash)
                transactionMeta.status = 'submitted';

                this.updateTransaction(transactionMeta);
                this.hub.emit(`${transactionMeta.id}:finished`, transactionMeta);
            }
            catch (error) {
                this.failTransaction(transactionMeta, error);
            }
        });
    }
    /**
     * Cancels a transaction based on its ID by setting its status to "rejected"
     * and emitting a `<tx.id>:finished` hub event.
     *
     * @param transactionID - ID of the transaction to cancel
     */
    cancelTransaction(transactionID) {
        const transactionMeta = this.state.transactions.find(({ id }) => id === transactionID);
        if (!transactionMeta) {
            return;
        }
        transactionMeta.status = 'rejected';
        this.hub.emit(`${transactionMeta.id}:finished`, transactionMeta);
        const transactions = this.state.transactions.filter(({ id }) => id !== transactionID);
        this.update({ transactions: [...transactions] });
    }
    /**
     * Attempts to cancel a transaction based on its ID by setting its status to "rejected"
     * and emitting a `<tx.id>:finished` hub event.
     *
     * @param transactionID - ID of the transaction to cancel
     */
    stopTransaction(transactionID) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionMeta = this.state.transactions.find(({ id }) => id === transactionID);
            if (!transactionMeta) {
                return;
            }
            if (!this.sign) {
                throw new Error('No sign method defined.');
            }
            const existingGasPrice = transactionMeta.transaction.gasPrice;
            /* istanbul ignore next */
            const existingGasPriceDecimal = parseInt(existingGasPrice === undefined ? '0x0' : existingGasPrice, 16);
            const gasPrice = ethereumjs_util_1.addHexPrefix(`${parseInt(`${existingGasPriceDecimal * exports.CANCEL_RATE}`, 10).toString(16)}`);
            const ethTransaction = new Transaction({
                from: transactionMeta.transaction.from,
                gas: transactionMeta.transaction.gas,
                gasPrice,
                nonce: transactionMeta.transaction.nonce,
                to: transactionMeta.transaction.from,
                value: '0x0',
            });
            yield this.sign(ethTransaction, transactionMeta.transaction.from);
            const rawTransaction = ethereumjs_util_1.bufferToHex(ethTransaction.serialize());
            yield util_1.query(this.ethQuery, 'sendRawTransaction', [rawTransaction]);
            transactionMeta.status = 'cancelled';
            this.hub.emit(`${transactionMeta.id}:finished`, transactionMeta);
        });
    }
    /**
     * Attemps to speed up a transaction increasing transaction gasPrice by ten percent
     *
     * @param transactionID - ID of the transaction to speed up
     */
    speedUpTransaction(transactionID) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionMeta = this.state.transactions.find(({ id }) => id === transactionID);
            /* istanbul ignore next */
            if (!transactionMeta) {
                return;
            }
            /* istanbul ignore next */
            if (!this.sign) {
                throw new Error('No sign method defined.');
            }
            const { transactions } = this.state;
            const existingGasPrice = transactionMeta.transaction.gasPrice;
            /* istanbul ignore next */
            const existingGasPriceDecimal = parseInt(existingGasPrice === undefined ? '0x0' : existingGasPrice, 16);
            const gasPrice = ethereumjs_util_1.addHexPrefix(`${parseInt(`${existingGasPriceDecimal * exports.SPEED_UP_RATE}`, 10).toString(16)}`);
            const ethTransaction = new Transaction(Object.assign(Object.assign({}, transactionMeta.transaction), { gasPrice }));
            yield this.sign(ethTransaction, transactionMeta.transaction.from);
            const rawTransaction = ethereumjs_util_1.bufferToHex(ethTransaction.serialize());
            const transactionHash = yield util_1.query(this.ethQuery, 'sendRawTransaction', [rawTransaction]);
            const newTransactionMeta = Object.assign(Object.assign({}, transactionMeta), { id: random(), time: Date.now(), transaction: Object.assign(Object.assign({}, transactionMeta.transaction), { gasPrice }), transactionHash });
            transactions.push(newTransactionMeta);
            this.update({ transactions: [...transactions] });
            this.hub.emit(`${transactionMeta.id}:speedup`, newTransactionMeta);
        });
    }
    /**
     * Estimates required gas for a given transaction
     *
     * @param transaction - Transaction object to estimate gas for
     * @returns - Promise resolving to an object containing gas and gasPrice
     */
    estimateGas(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const estimatedTransaction = Object.assign({}, transaction);
            const { gasLimit } = yield util_1.query(this.ethQuery, 'getBlockByNumber', ['latest', false]);
            const { gas, gasPrice: providedGasPrice, to, value, data } = estimatedTransaction;
            const gasPrice = typeof providedGasPrice === 'undefined' ? yield util_1.query(this.ethQuery, 'gasPrice') : providedGasPrice;
            // 1. If gas is already defined on the transaction, use it
            if (typeof gas !== 'undefined') {
                return { gas, gasPrice };
            }
            // 2. If to is not defined or this is not a contract address, and there is no data use 0x5208 / 21000
            /* istanbul ignore next */
            const code = to ? yield util_1.query(this.ethQuery, 'getCode', [to]) : undefined;
            /* istanbul ignore next */
            if (!to || (to && !data && (!code || code === '0x'))) {
                return { gas: '0x5208', gasPrice };
            }
            // if data, should be hex string format
            estimatedTransaction.data = !data ? data : /* istanbul ignore next */ ethereumjs_util_1.addHexPrefix(data);
            // 3. If this is a contract address, safely estimate gas using RPC
            estimatedTransaction.value = typeof value === 'undefined' ? '0x0' : /* istanbul ignore next */ value;
            const gasLimitBN = util_1.hexToBN(gasLimit);
            estimatedTransaction.gas = util_1.BNToHex(util_1.fractionBN(gasLimitBN, 19, 20));
            const gasHex = yield util_1.query(this.ethQuery, 'estimateGas', [estimatedTransaction]);
            // 4. Pad estimated gas without exceeding the most recent block gasLimit
            const gasBN = util_1.hexToBN(gasHex);
            const maxGasBN = gasLimitBN.muln(0.9);
            const paddedGasBN = gasBN.muln(1.5);
            console.log(' ******************* TransactionController maxGasBN: ', paddedGasBN?.toString(), gasBN?.toString(), maxGasBN?.toString())
            /* istanbul ignore next */
            if (gasBN.gt(maxGasBN)) { /// if estimated gas > block max gas *0.9 => estimated gas
                // updated code by us
                // return { gas: ethereumjs_util_1.addHexPrefix(gasHex), gasPrice };
                return { gas: ethereumjs_util_1.addHexPrefix(util_1.BNToHex(gasBN.muln(1.1))), gasPrice };
            }
            /* istanbul ignore next */
            if (paddedGasBN.lt(maxGasBN)) { /// if estimated gas * 1.5 < block max gas => estimated gas * 1.5
                return { gas: ethereumjs_util_1.addHexPrefix(util_1.BNToHex(paddedGasBN)), gasPrice };
            }
            // return block max gas
            return { gas: ethereumjs_util_1.addHexPrefix(util_1.BNToHex(maxGasBN)), gasPrice };
        });
    }
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed() {
        super.onComposed();
        const network = this.context.NetworkController;
        const onProviderUpdate = () => {
            const networkProvider = this.context.NetworkController.provider
            this.ethQuery = networkProvider ? new EthQuery(networkProvider) : /* istanbul ignore next */ null;
            this.registry = networkProvider
                ? new MethodRegistry({ provider: networkProvider }) /* istanbul ignore next */
                : null;
        };
        onProviderUpdate();
        network.subscribe(onProviderUpdate);
    }

    getTransactionStatus(txHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const network = this.context.NetworkController;
                const web3 = new Web3(network.provider);
                web3.eth.getTransactionReceipt(txHash, (error, result) => {
                    if (error) {
                        reject(error)
                        return;
                    }
                    resolve(result)
                });
            })
        })
    }
    /**
     * Resiliently checks all submitted transactions on the blockchain
     * and verifies that it has been included in a block
     * when that happens, the tx status is updated to confirmed
     *
     * @returns - Promise resolving when this operation completes
     */
    queryTransactionStatuses() {
        return __awaiter(this, void 0, void 0, function* () {
            const { transactions } = this.state;
            let gotUpdates = false;
            const network = this.context.NetworkController;
            const currentNetworkID = network.state.provider.chainId;
            yield util_1.safelyExecute(() => Promise.all(
                transactions.map((meta, index) =>
                    __awaiter(this, void 0, void 0, function* () {
                        if (meta.status === 'submitted' && meta.networkID === currentNetworkID && this.ethQuery) {
                            // const txObj = yield util_1.query(network.ethQuery, 'getTransactionByHash', [meta.transactionHash]);
                            const txObj = yield this.getTransactionStatus(meta.transactionHash)
                            console.log(' --- tx controller meta:', currentNetworkID, meta.transactionHash, txObj.blockNumber)
                            /* istanbul ignore else */
                            if (txObj && txObj.blockNumber) {
                                transactions[index].transactionHash = meta.transactionHash;
                                if (txObj.status === '0x1') {
                                    transactions[index].status = 'confirmed';
                                    this.hub.emit(`${meta.id}:confirmed`, meta);
                                } else if (txObj.status === '0x0') {
                                    transactions[index].status = 'failed';
                                    this.hub.emit(`${meta.id}:failed`, meta);
                                }
                                gotUpdates = true;
                            }
                        }
                    })
                )
            ));
            /* istanbul ignore else */
            if (gotUpdates) {
                this.update({ transactions: [...transactions] });
            }
            return;
        });
    }
    /**
     * Updates an existing transaction in state
     *
     * @param transactionMeta - New transaction meta to store in state
     */
    updateTransaction(transactionMeta) {
        const { transactions } = this.state;
        transactionMeta.transaction = util_1.normalizeTransaction(transactionMeta.transaction);
        util_1.validateTransaction(transactionMeta.transaction);
        const index = transactions.findIndex(({ id }) => transactionMeta.id === id);
        transactions[index] = transactionMeta;
        this.update({ transactions: [...transactions] });
    }
    /**
     * Removes all transactions from state, optionally based on the current network
     *
     * @param ignoreNetwork - Ignores network
     */
    wipeTransactions(ignoreNetwork) {
        /* istanbul ignore next */
        if (ignoreNetwork) {
            this.update({ transactions: [] });
            return;
        }
        const network = this.context.NetworkController;
        if (!network) {
            return;
        }
        const currentNetworkID = network.state.provider.chainId;
        const newTransactions = this.state.transactions.filter(({ networkID }) => networkID !== currentNetworkID);
        this.update({ transactions: newTransactions });
    }
    /**
     * Gets all transactions from etherscan for a specific address
     * optionally starting from a specific block
     *
     * @param address - string representing the address to fetch the transactions from
     * @param opt - Object containing optional data, fromBlock and Alethio API key
     * @returns - Promise resolving to an string containing the block number of the latest incoming transaction.
     */
    fetchAll(address, opt) {
        return __awaiter(this, void 0, void 0, function* () {
            const network = this.context.NetworkController;
            const { state: { network: currentNetworkID, provider: { type: networkType }, }, } = network;
            const supportedNetworkIds = ['1', '3', '4', '42'];
            /* istanbul ignore next */
            if (supportedNetworkIds.indexOf(currentNetworkID) === -1) {
                return;
            }
            const [etherscanResponse, alethioResponse] = yield util_1.handleTransactionFetch(networkType, address, opt);
            const remoteTxList = {};
            const remoteTxs = [];
            etherscanResponse.result.forEach((tx) => {
                /* istanbul ignore next */
                if (!remoteTxList[tx.hash]) {
                    remoteTxs.push(this.normalizeTxFromEtherscan(tx, currentNetworkID));
                    remoteTxList[tx.hash] = 1;
                }
            });
            alethioResponse.data.forEach((tx) => {
                const cleanTx = this.normalizeTxFromAlehio(tx, currentNetworkID);
                remoteTxs.push(cleanTx);
                /* istanbul ignore next */
                remoteTxList[cleanTx.transactionHash || ''] = 1;
            });
            const localTxs = this.state.transactions.filter(
                /* istanbul ignore next */
                (tx) => !remoteTxList[`${tx.transactionHash}`]);
            const allTxs = [...remoteTxs, ...localTxs];
            allTxs.sort((a, b) => (a.time < b.time ? -1 : 1));
            let latestIncomingTxBlockNumber;
            allTxs.forEach((tx) => __awaiter(this, void 0, void 0, function* () {
                /* istanbul ignore next */
                if (tx.networkID === currentNetworkID &&
                    tx.transaction.to &&
                    tx.transaction.to.toLowerCase() === address.toLowerCase()) {
                    if (tx.blockNumber &&
                        (!latestIncomingTxBlockNumber || parseInt(latestIncomingTxBlockNumber, 10) < parseInt(tx.blockNumber, 10))) {
                        latestIncomingTxBlockNumber = tx.blockNumber;
                    }
                }
                /* istanbul ignore else */
                if (tx.toSmartContract === undefined) {
                    // If not `to` is a contract deploy, if not `data` is send eth
                    if (tx.transaction.to && (!tx.transaction.data || tx.transaction.data !== '0x')) {
                        const code = yield util_1.query(this.ethQuery, 'getCode', [tx.transaction.to]);
                        tx.toSmartContract = util_1.isSmartContractCode(code);
                    }
                    else {
                        tx.toSmartContract = false;
                    }
                }
            }));
            // Update state only if new transactions were fetched
            if (allTxs.length > this.state.transactions.length) {
                this.update({ transactions: allTxs });
            }
            return latestIncomingTxBlockNumber;
        });
    }
}
exports.TransactionController = TransactionController;
exports.default = TransactionController;
//# sourceMappingURL=TransactionController.js.map