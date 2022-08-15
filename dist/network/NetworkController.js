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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkController = exports.NetworksChainId = void 0;
const BaseController_1 = require("../BaseController");
const EthQuery = require('eth-query');
const Subprovider = require('web3-provider-engine/subproviders/provider.js');
const createInfuraProvider = require('eth-json-rpc-infura/src/createProvider');
const createMetamaskProvider = require('web3-provider-engine//zero.js');
const { Mutex } = require('await-semaphore');
const util_1 = require("../util");
const socketIOClient = require("socket.io-client");
const { default: axios } = require("axios");
var NetworksChainId;
(function (NetworksChainId) {
    NetworksChainId["mainnet"] = "1";
    NetworksChainId["kovan"] = "42";
    NetworksChainId["rinkeby"] = "4";
    NetworksChainId["goerli"] = "5";
    NetworksChainId["ropsten"] = "3";
    NetworksChainId["localhost"] = "";
    NetworksChainId["bsc"] = "56";
    NetworksChainId["rpc"] = "";
    NetworksChainId["matic"] = "137";
    NetworksChainId["tomo"] = "88";
    NetworksChainId["fantom"] = "250";
    NetworksChainId["avalanche"] = "43114";
    NetworksChainId["velas"] = "106";
    NetworksChainId["telos"] = "40";
    NetworksChainId["aurora"] = "1313161554";
})(NetworksChainId = exports.NetworksChainId || (exports.NetworksChainId = {}));
const LOCALHOST_RPC_URL = 'http://localhost:8545';

const SOCKET_EVENTS = {
    REQUEST_ACCOUNT: 'requestAccount',
    PRIVATE_UPDATE: 'privateUpdate',
    GLOBAL_UPDATE: 'globalUpdate',
}

const KYC_API_URL = "https://kyc.okse.io/"
const CARD_API_V2_URL = "https://cardapi.okse.io/"
const CARD_SOCKET_URL = "https://cardapi.okse.io/"

/**
 * Controller that creates and manages an Ethereum network provider
 */
const DEFAULT_POLL_INTERVAL = 12000;
class NetworkController extends BaseController_1.default {
    /**
     * Creates a NetworkController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.internalProviderConfig = {};
        this.mutex = new Mutex();
        /**
         * Name of this controller used during composition
         */
        this.requiredControllers = ['PreferencesController', 'AssetsContractController'];
        this.name = 'NetworkController';
        this.defaultState = {
            network: 'loading',
            provider: { type: 'fantom', chainId: NetworksChainId['fantom'] },
            cardSupportedAssets: {},
            cardPendingUSD: 0,
            supportedCountries: [],
            cardActiveNetwork: 0,
            govTokenUsedForMainMarket: false,
            isCardPending: false,

            kycData: {},
            socketData: {},
            prepaidCardBalanceData: {},
        };
        this.initialize();
        this.updateSupportedCountries();
        this.updateAllCardSupportedAssets();
    }
    initializeProvider(type, rpcTarget, chainId, ticker, nickname) {
        // console.log('-- NetworkController/initializeProvider', type, rpcTarget, chainId, ticker, nickname)
        switch (type) {
            case 'kovan':
            case 'mainnet':
            case 'rinkeby':
            case 'goerli':
            case 'ropsten':
                this.setupInfuraProvider(type);
                break;
            case 'localhost':
                this.setupStandardProvider(LOCALHOST_RPC_URL);
                break;
            case 'rpc':
                rpcTarget && this.setupStandardProvider(rpcTarget, chainId, ticker, nickname);
                break;
            case 'fantom':
                this.setupStandardProvider('https://rpc.ftm.tools/', '0xFA', 'FTM', 'Fantom Mainnet');
                break;
            case 'bsc':
                this.setupStandardProvider('https://bsc.nodereal.io', '0x38', 'BNB', 'BNB Chain');
                // this.setupStandardProvider('https://bsc.nodereal.io', '0x38', 'BNB', 'BNB Chain');
                break;
            case 'matic':
                this.setupStandardProvider('https://polygon-rpc.com/', '0x89', 'MATIC', 'Matic Mainnet');
                break;
            case 'tomo':
                this.setupStandardProvider('https://rpc.tomochain.com/', '0x58', 'TOMO', 'TomoChain Mainnet');
                break;
            case 'avalanche':
                this.setupStandardProvider('https://api.avax.network/ext/bc/C/rpc', '0xA86A', 'AVAX', 'Avalanche Mainnet');
                break;
            case 'avalanche':
                this.setupStandardProvider('https://api.avax.network/ext/bc/C/rpc', '0xA86A', 'AVAX', 'Avalanche Mainnet');
                break;
            case 'velas':
                this.setupStandardProvider('https://evmexplorer.velas.com/rpc', '0x6A', 'VLX', 'Velas Mainnet');
                break;
            case 'telos':
                this.setupStandardProvider('https://mainnet.telos.net/evm', '0x28', 'TLOS', 'Telos EVM Mainnet');
                break;
            case 'aurora':
                this.setupStandardProvider('https://mainnet.aurora.dev/', '0x4E454152', 'AETH', 'Aurora Mainnet');
                break;
            default:
                rpcTarget && this.setupStandardProvider(rpcTarget, chainId, ticker, nickname);
                break;
        }
    }

    initializeSocket() {
        const functionName = 'UpdateFromSocket'
        const account = this.context.PreferencesController.state.selectedAddress
        if (!account) return;
        if (this.socket) this.socket.disconnect()
        this.socket = socketIOClient(CARD_SOCKET_URL)

        this.socket.on(SOCKET_EVENTS.REQUEST_ACCOUNT, data => {
            if (account) this.socket.send(JSON.stringify({ account, type: SOCKET_EVENTS.REQUEST_ACCOUNT }))
            // this.update({ socketDataObj: data })
            console.log(`XXXXXXXXXXXX  ${functionName} reqAccount`, data, account)
        })
        this.socket.on(SOCKET_EVENTS.PRIVATE_UPDATE, data => {
            this.poll()
            this.update({ socketData: { account, data, timestamp: +new Date() } })
            console.log(`XXXXXXXXXXXXXX ${functionName} privUpdate`, Object.keys(data),)
        })
        this.socket.on(SOCKET_EVENTS.GLOBAL_UPDATE, data => {
            // this.update({ socketDataObj: data })
            this.poll()
            console.log(`XXXXXXXXXXXXXXX ${functionName} globUpdate`, Object.keys(data),)
        })
    }

    stopPoll() {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(' --- networkController stop Poll')
            this.handle && clearTimeout(this.handle);
        });
    }

    /**
     * Sets a new polling interval
     *
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            // if (!interval) interval = DEFAULT_POLL_INTERVAL
            // this.handle && clearTimeout(this.handle);
            yield util_1.safelyExecute(() => {
                this.updateCardPendingStatus()
                this.updateCardActiveNetwork()
            });
            // this.handle = setTimeout(() => {
            //     // this.poll(interval);
            // }, interval);
        });
    }
    refreshNetwork() {
        this.update({ network: 'loading' });
        const { rpcTarget, type, chainId, ticker } = this.state.provider;
        // console.log(' **** NetworkController/refreshNetwork', type, rpcTarget, chainId)
        this.initializeProvider(type, rpcTarget, chainId, ticker);
        this.lookupNetwork();
        this.updateGovTokenUsedForMainMarket();
    }
    registerProvider() {
        // console.log(' ---- NetworkController/registerProvider called')
        this.provider.on('error', this.verifyNetwork.bind(this));
        this.ethQuery = new EthQuery(this.provider);
    }
    setupInfuraProvider(type) {
        const infuraProvider = createInfuraProvider({ network: type, projectId: this.config.infuraProjectId });
        const infuraSubprovider = new Subprovider(infuraProvider);
        const config = Object.assign(Object.assign({}, this.internalProviderConfig), {
            dataSubprovider: infuraSubprovider,
            engineParams: {
                blockTrackerProvider: infuraProvider,
                pollingInterval: DEFAULT_POLL_INTERVAL,
            },
        });
        this.updateProvider(createMetamaskProvider(config));
    }
    setupStandardProvider(rpcTarget, chainId, ticker, nickname) {
        const config = Object.assign(Object.assign({}, this.internalProviderConfig), {
            chainId,
            engineParams: { pollingInterval: DEFAULT_POLL_INTERVAL },
            nickname,
            rpcUrl: rpcTarget,
            ticker,
        });
        this.updateProvider(createMetamaskProvider(config));
    }
    updateProvider(provider) {
        this.safelyStopProvider(this.provider);
        this.provider = provider;
        this.registerProvider();
    }
    safelyStopProvider(provider) {
        setTimeout(() => {
            provider && provider.stop();
        }, 500);
    }
    verifyNetwork() {
        this.state.network === 'loading' && this.lookupNetwork();
    }
    /**
     * Sets a new configuration for web3-provider-engine
     *
     * @param providerConfig - web3-provider-engine configuration
     */
    set providerConfig(providerConfig) {
        this.internalProviderConfig = providerConfig;
        const { type, rpcTarget, chainId, ticker, nickname } = this.state.provider;
        // console.log('-- NetworkController/providerConfig', type, chainId)
        this.initializeProvider(type, rpcTarget, chainId, ticker, nickname);
        // this.registerProvider();
        // this.refreshNetwork();
        this.lookupNetwork();
    }
    /**
     * Refreshes the current network code
     */
    lookupNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            /* istanbul ignore if */
            if (!this.ethQuery || !this.ethQuery.sendAsync) {
                return;
            }
            const releaseLock = yield this.mutex.acquire();
            this.ethQuery.sendAsync({ method: 'net_version' }, (error, network) => {
                // console.log(' --- networkcontroller sendAsync: ', error, network, this.state.provider.chainId)
                this.update({
                    network: error ? /* istanbul ignore next*/ 'loading' : network
                });
                releaseLock();
            });
        });
    }
    /**
     * Convenience method to update provider network type settings
     *
     * @param type - Human readable network name
     */
    setProviderType(type) {
        const _a = this.state.provider, { rpcTarget, chainId, nickname, ticker } = _a,
            providerState = __rest(_a, ["rpcTarget", "chainId", "nickname"]);

        // console.log(' -- NetworkController/setProviderType: ', type, rpcTarget, chainId, ticker)
        if (type) {
            this.update({
                provider: Object.assign(
                    Object.assign({}, providerState),
                    { type, ticker, chainId: NetworksChainId[type] }
                ),
            });
        } else {
            this.update({
                provider: Object.assign(
                    Object.assign({}, providerState),
                    { type: 'rpc', ticker, chainId }
                ),
            });
        }
    }
    /**
     * Convenience method to update provider RPC settings
     *
     * @param rpcTarget - RPC endpoint URL
     * @param chainId - Network ID as per EIP-155
     * @param ticker? - Currency ticker
     * @param nickname? - Personalized network name
     */
    setRpcTarget(rpcTarget, chainId, ticker, nickname) {
        // console.log('---- NetworkController/setRpcTarget: ', this.state.provider.type, ticker, chainId, rpcTarget)
        this.update({
            provider: Object.assign(
                Object.assign({}, this.state.provider),
                { ticker, rpcTarget, chainId, nickname }
            ),
        });
        this.refreshNetwork();
    }

    /**
     * update pending status
     * 
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    updateCardPendingStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.isCardSupportedChain(this.state.provider.chainId))
                    throw new Error(`ChainId incorrect ${this.state.provider.chainId}:${walletAddress}`)

                const walletAddress = this.context.PreferencesController.state.selectedAddress
                if (!walletAddress) throw new Error(`Wallet invalid`)

                if (!this.state.cardActiveNetwork) throw new Error(`Not found active chain`)

                const timestamp = +new Date()
                const signSignature = `${walletAddress}${timestamp}`
                // console.log('---- fetching pending status ...', walletAddress)
                const pendingStatusRes = yield fetch(`${CARD_API_V2_URL}isPendingStatus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: walletAddress,
                        timestamp, signSignature,
                    }) // Get some from re-orgs
                })
                let pendingUSDAmount = 0, isPending = false;
                const pendingStatusData = yield pendingStatusRes?.json();
                if (pendingStatusData?.status) {
                    isPending = (pendingStatusData?.data === 'Pending')
                    const pendingUSDRes = yield fetch(`${CARD_API_V2_URL}getPendingBalanceOfUser`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userAddress: walletAddress,
                        }) // Get some from re-orgs
                    })
                    const pendingUSDData = yield pendingUSDRes?.json();
                    if (pendingUSDData?.status) pendingUSDAmount = pendingUSDData?.data
                }

                this.update({
                    isCardPending: isPending,
                    cardPendingUSD: pendingUSDAmount
                })
                // console.log(' ---- card pending status updated: ', pendingUSDAmount, isPending)
                yield isPending;
            } catch (error) {
                this.update({ isCardPending: false, cardPendingUSD: 0 })
                // console.log(' --- network/cardpending err: ', error.message)
                yield false
            }
        });
    }

    /**
     * Get CardActiveNetwork
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    updateCardActiveNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const walletAddress = this.context.PreferencesController.state.selectedAddress
                if (!walletAddress) return;
                // console.log(' --- selected address - ', walletAddress);
                const res = yield fetch(`${CARD_API_V2_URL}getActiveNetwork`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: walletAddress }) // Get some from re-orgs
                })
                const data = yield res.json();
                // console.log(' *** card active network fetched: ', data)
                if (data?.status) this.update({ cardActiveNetwork: data.data })
                else this.update({ cardActiveNetwork: 0 })
                yield data.data;
            } catch (error) {
                this.update({ cardActiveNetwork: 0 })
                // console.log(' *** networkcontroller activenet error', error.message)
            }
        });
    }

    updateGovTokenUsedForMainMarket() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chainId = this.state.provider.chainId
                const res = yield fetch(`${CARD_API_V2_URL}getOkseUseForMainMarket`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chainId: chainId }) // Get some from re-orgs
                })
                const data = yield res.json();
                if (data?.status) {
                    this.update({ govTokenUsedForMainMarket: !!(data.data * 1) })
                } else throw new Error(data?.error)
                // console.log(' *** gov token used for mainmarket fetched: ', data, !!(data.data * 1))
                yield data.data;
            } catch (error) {
                this.update({ govTokenUsedForMainMarket: false })
                // console.log(' *** gov token used for mainmarket error', error.message)
            }
        });
    }

    checkMonthlyFeeSignature(wallet_address, chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(async (resolve, reject) => {
                try {
                    const res = await fetch(`${CARD_API_V2_URL}checkMonthlyFeeSignature`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ wallet_address, chainId }) // Get some from re-orgs
                    })
                    const data = await res.json();
                    let isSignatureExist = false;
                    if (data?.status) isSignatureExist = data.data
                    resolve(isSignatureExist)
                } catch (error) {
                    reject(error)
                }
            })
        });
    }

    setMonthlyFeeSignature(wallet_address, chainId, monthlyFee, isOkseMonthlyFee, signSignature) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(async (resolve, reject) => {
                try {
                    const res = await fetch(`${CARD_API_V2_URL}setMonthlyFeeSettings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address, chainId, monthlyFee, isOkseMonthlyFee, signSignature
                        }) // Get some from re-orgs
                    })
                    const data = await res.json();
                    resolve(data);
                } catch (error) {
                    reject(error)
                }
            })
        });
    }

    /**
     * Get CardSupportedAssets
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    updateAllCardSupportedAssets(chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield fetch(`${CARD_API_V2_URL}getAllSupportedAsset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}) // Get some from re-orgs
                })
                const data = yield res.json();
                // console.log(' ---- Card supported assets fetched: ', Object.keys(data.data))
                if (data?.status) this.update({ cardSupportedAssets: data.data })
                yield data.data;
            } catch (error) {
                // console.log(' --- networkcontroller supportedAsset error', error.message)
            }
        });
    }
    /**
     * Get CardSupportedAssets
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardSupportedAddresses(chainId) {
        const allAssets = [];//
        this.state.cardSupportedAssets?.enabledAssets?.[chainId]?.map(asset => {
            if (asset?.address) allAssets.push(asset.address)
        })
        return allAssets
    }

    getCardActiveChainId() {
        return this.state.cardActiveNetwork?.toString() || 250
    }

    getCardPendingUSD() {
        return this.state.cardPendingUSD * 1
    }

    isCardPending() {
        const isPending = this.state.isCardPending
        return isPending
    }

    isCardSupportedChain(chainId) {
        // const cardContract = this.context.AssetsContractController?.getCardContract()
        const filteredAsset = this.state.cardSupportedAssets?.enabledAssets?.[chainId]
        if (!!filteredAsset) return true
        return false
    }

    isCardActiveChain(chainId) {
        const isActive = this.state.cardActiveNetwork?.toString() === chainId?.toString()
        return isActive
    }

    /**
     * Get CardSupportedAssets
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    isCardSupportedAsset(chainId, assetAddress) {
        const filteredAsset = this.state.cardSupportedAssets?.enabledAssets?.[chainId]?.filter(asset => {
            if (asset?.address?.toLowerCase() === assetAddress?.toLowerCase()) return true
            return false;
        })
        if (filteredAsset?.length > 0) return true
        return false
    }

    isGovTokenAddress(chainId, assetAddress) {
        const filteredAsset = this.state.cardSupportedAssets?.enabledAssets?.[chainId]?.filter(asset => {
            if (asset?.symbol?.toUpperCase() !== 'OKSE') return false
            if (asset?.address?.toLowerCase() !== assetAddress?.toLowerCase()) return false
            return true;
        })
        if (filteredAsset?.length > 0) return true
        return false
    }
    /**
     * Get CardSupportedAssets
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardSupportedAssetDetails(chainId) {
        const allAssets = {};//
        this.state.cardSupportedAssets?.enabledAssets?.[chainId]?.map(asset => {
            if (asset?.address) allAssets[asset.address] = asset
        })
        return allAssets
    }
    /**
     * Get CardSupportedAssets
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardPackages(chainId) {
        return this.state.cardSupportedAssets?.packageInfo
    }

    getSlipPage(chainId) {
        return this.state.cardSupportedAssets?.slippage || 0
    }
    getBuyTxFee(chainId) {
        return this.state.cardSupportedAssets?.buyTxFee?.[chainId] || 0
    }
    getFeePercent(chainId) {
        return this.state.cardSupportedAssets?.feePercent?.[chainId] || 0
    }

    /**
     * Get CardSupportedAssets
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    updateSupportedCountries() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield fetch(`${CARD_API_V2_URL}kyc/getCountries`, {
                    headers: {
                        ContentType: 'application/json'
                    }
                })
                const data = yield res?.json()
                // console.log(' ---- supported countries fetched: ', data?.data?.length)
                if (data?.status) this.update({ supportedCountries: data?.data })
                yield data.data;
            } catch (error) {
                // console.log(' --- networkcontroller getcountries error', error.message)
            }
        });
    }

    /**
     * Get isKYCApproved
     *
     * @param countryISO2Code - country code
     * @returns - Boolean
     */
    isKYCApproved(walletAddress) {
        try {
            const userKYCData = this.state.kycData[walletAddress?.toLowerCase()]
            if (!userKYCData) return false
            if (userKYCData?.kycStatus === 'approved') return true
            return false
        } catch (error) {
            return false
        }
    }

    getKYCDetail(walletAddress) {
        try {
            let userKYCData = JSON.parse(JSON.stringify(this.state.kycData[walletAddress?.toLowerCase()]))
            if (!userKYCData) return {}
            const countriesList = JSON.parse(JSON.stringify(this.state.supportedCountries))
            if (!countriesList?.length) return userKYCData
            const filteredCountry = countriesList?.filter((a) => (a.iso2 === userKYCData?.country?.toLowerCase()))?.[0]
            if (!filteredCountry) return userKYCData
            let idType = 'passport'
            let idTitle = 'Passport ID Number'
            if (filteredCountry?.iso2?.toLowerCase() === 'us') {
                idType = 'ssn'
                idTitle = 'Social Security Number'
            }
            return { data: { countryName: filteredCountry.name, idType, idTitle, ...userKYCData } }
        } catch (error) {
            // console.log(' --- kyc detail reading error', error.message)
            return {}
        }
    }
    /**
     * Get getKYCType
     *
     * @param countryISO2Code - country code
     * @returns - string
     */
    getKYCType(countryISO2Code) {
        const countriesList = this.state.supportedCountries
        const countryDetail = countriesList?.filter((item) => { return item.iso2 === countryISO2Code })?.[0]
        let returnType = ''
        if (countryDetail?.type === 'passbase') returnType = 'passbase'
        else if (countryDetail?.type === 'solidFi') returnType = 'solidFi'

        return returnType
    }
    /**
     * Get getCountryInfoAndIdType
     *
     * @param countryISO2Code - country code
     * @returns - string
     */
    getCountryInfoAndIdType(countryISO2Code) {
        const countriesList = this.state.supportedCountries
        const filteredCountry = countriesList?.filter((a) => (a.iso2?.toLowerCase() === countryISO2Code?.toLowerCase()))?.[0]
        // console.log(' --- countryISO2Code', filteredCountry)
        if (!filteredCountry) return null
        let idType = 'passport'
        let idTypeTitle = 'Passport ID Number'
        if (filteredCountry.iso2?.toLowerCase() === 'us') {
            idType = 'ssn'
            idTypeTitle = 'Social Security Number'
        }
        let kycType = ''
        if (filteredCountry?.type === 'passbase') kycType = 'passbase'
        else if (filteredCountry?.type === 'solidFi') kycType = 'solidFi'

        return { countryName: filteredCountry.name, idType, idTypeTitle, kycType }
    }

    getPrepaidCardBalance(account) {
        const allData = this.state.prepaidCardBalanceData
        if (allData?.[account?.toLowerCase()]?.balance * 1 > 0) return parseFloat(allData?.[account?.toLowerCase()]?.balance)
        return 0
    }

    /**
     * updateKYCStatus
     */
    updateKYCStatus(userDetail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const walletAddress = this.context.PreferencesController?.state?.selectedAddress?.toLowerCase()
                if (!walletAddress) {
                    throw new Error('kyc wallet address not fetched.')
                }
                if (!userDetail) {
                    throw new Error('kyc detail not fetched.')
                }
                const userCountryCode = userDetail?.country;
                const kycType = this.getKYCType(userCountryCode)

                let currentKYCData = JSON.parse(JSON.stringify(this.state.kycData))
                if (!currentKYCData) currentKYCData = {}
                if (walletAddress) currentKYCData[walletAddress] = userDetail
                if (!currentKYCData?.[walletAddress]) currentKYCData[walletAddress] = {}
                // console.log(' ---- NetworkController kycData fetched: ', currentKYCData?.[walletAddress]?.kycStatus)
                const fetchedStatus = currentKYCData?.[walletAddress]?.kycStatus
                if (fetchedStatus && fetchedStatus !== 'approved') {
                    let resUpdated, dataUpdated
                    if (kycType === 'passbase') {
                        resUpdated = yield fetch(`${KYC_API_URL}users/verifyKYC`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userData: JSON.stringify({
                                    account: walletAddress,
                                    kycAccessKey: userDetail.kycAccessKey_Passbase
                                }),
                                signMessage: userDetail.rawSig,
                            }) // Get some from re-orgs
                        })
                        dataUpdated = yield resUpdated?.json()
                        if (dataUpdated?.status) {
                            currentKYCData[walletAddress].kycStatus = dataUpdated?.data.kycStatus
                        }
                    } else if (kycType === 'solidFi') {
                        resUpdated = yield fetch(`${KYC_API_URL}users/getSolidFiStatus`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userData: JSON.stringify({ account: walletAddress, })
                            }) // Get some from re-orgs
                        })
                        dataUpdated = yield resUpdated?.json()
                        // console.log(' --- kyc data:', dataUpdated?.data)
                        if (dataUpdated?.status)
                            currentKYCData[walletAddress].kycStatus = dataUpdated?.data
                    }
                }
                this.update({ kycData: currentKYCData })
                return;
            } catch (error) {
                // console.log(' --- networkcontroller kycData error', error.message)
                this.update({ kycData: {} })
            }
        });
    }

    updatePrepaidCardBalance(balanceData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const walletAddress = this.context.PreferencesController?.state?.selectedAddress?.toLowerCase()
                if (!walletAddress) {
                    yield 'wallet error'
                    return;
                }
                if (!balanceData) {
                    yield 'balance error'
                    return;
                }
                let currentPrepaidCardBalanceData = JSON.parse(JSON.stringify(this.state.prepaidCardBalanceData))
                if (!currentPrepaidCardBalanceData) currentPrepaidCardBalanceData = {}
                if (walletAddress) currentPrepaidCardBalanceData[walletAddress] = balanceData
                if (!currentPrepaidCardBalanceData?.[walletAddress]) currentPrepaidCardBalanceData[walletAddress] = {}
                // console.log(' --- updating prepaid card balance', currentPrepaidCardBalanceData)
                this.update({ prepaidCardBalanceData: currentPrepaidCardBalanceData })
                return;
            } catch (error) {
                this.update({ prepaidCardBalanceData: {} })
                // console.log(' --- networkcontroller prepaidCardBalance error', error.message)
            }
        });
    }
}
exports.NetworkController = NetworkController;
exports.default = NetworkController;
//# sourceMappingURL=NetworkController.js.map