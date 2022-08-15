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
exports.AssetsController = void 0;
const events_1 = require("events");
const ethereumjs_util_1 = require("ethereumjs-util");
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const { Mutex } = require('await-semaphore');
const random = require('uuid/v1');
const { NetworksChainId } = require('../');
const { toChecksumAddress } = require("ethereumjs-util");
const { default: axios } = require("axios");
const BITQUERY_URL = "https://graphql.bitquery.io/"
const FANTOMQUERY_URL = "https://xapi-nodea.fantom.network/"
/**
 * Controller that stores assets and exposes convenience methods
 */
class AssetsController extends BaseController_1.default {
    /**
     * Creates a AssetsController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        this.mutex = new Mutex();
        /**
         * EventEmitter instance used to listen to specific EIP747 events
         */
        this.hub = new events_1.EventEmitter();
        /**
         * Name of this controller used during composition
         */
        this.name = 'AssetsController';
        /**
         * List of required sibling controllers this controller needs to function
         */
        this.requiredControllers = ['AssetsContractController', 'NetworkController', 'PreferencesController'];
        this.defaultConfig = {
            networkType: '250',
            selectedAddress: '',
        };
        this.defaultState = {
            allCollectibleContracts: {},
            allCollectibles: {},
            allTokens: {},
            collectibleContracts: [],
            collectibles: [],
            ignoredCollectibles: [],
            ignoredTokens: [],
            suggestedAssets: [],
            tokenWhitelistStore: {},
            tokens: [],

        };
        this.initialize();
    }
    getCollectibleApi(contractAddress, tokenId) {
        return `https://api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}`;
    }
    getCollectibleContractInformationApi(contractAddress) {
        return `https://api.opensea.io/api/v1/asset_contract/${contractAddress}`;
    }
    failSuggestedAsset(suggestedAssetMeta, error) {
        suggestedAssetMeta.status = 'failed';
        suggestedAssetMeta.error = {
            message: error.toString(),
            stack: error.stack,
        };
        this.hub.emit(`${suggestedAssetMeta.id}:finished`, suggestedAssetMeta);
    }
    /**
     * Get collectible tokenURI API following ERC721
     *
     * @param contractAddress - ERC721 asset contract address
     * @param tokenId - ERC721 asset identifier
     * @returns - Collectible tokenURI
     */
    getCollectibleTokenURI(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const assetsContract = this.context.AssetsContractController;
            const supportsMetadata = yield assetsContract.contractSupportsMetadataInterface(contractAddress);
            /* istanbul ignore if */
            if (!supportsMetadata) {
                return '';
            }
            const tokenURI = yield assetsContract.getCollectibleTokenURI(contractAddress, tokenId);
            return tokenURI;
        });
    }
    /**
     * Request individual collectible information from OpenSea api
     *
     * @param contractAddress - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleInformationFromApi(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenURI = this.getCollectibleApi(contractAddress, tokenId);
            let collectibleInformation;
            /* istanbul ignore if */
            if (this.openSeaApiKey) {
                collectibleInformation = yield util_1.handleFetch(tokenURI, { headers: { 'X-API-KEY': this.openSeaApiKey } });
            }
            else {
                collectibleInformation = yield util_1.handleFetch(tokenURI);
            }
            const { name, description, image_original_url } = collectibleInformation;
            return { image: image_original_url, name, description };
        });
    }
    /**
     * Request individual collectible information from contracts that follows Metadata Interface
     *
     * @param contractAddress - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleInformationFromTokenURI(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenURI = yield this.getCollectibleTokenURI(contractAddress, tokenId);
            const object = yield util_1.handleFetch(tokenURI);
            const image = object.hasOwnProperty('image') ? 'image' : /* istanbul ignore next */ 'image_url';
            return { image: object[image], name: object.name };
        });
    }
    /**
     * Request individual collectible information (name, image url and description)
     *
     * @param contractAddress - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleInformation(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            let information;
            // First try with OpenSea
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleInformationFromApi(contractAddress, tokenId);
            }));
            if (information) {
                return information;
            }
            // Then following ERC721 standard
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleInformationFromTokenURI(contractAddress, tokenId);
            }));
            /* istanbul ignore next */
            if (information) {
                return information;
            }
            /* istanbul ignore next */
            return {};
        });
    }
    /**
     * Request collectible contract information from OpenSea api
     *
     * @param contractAddress - Hex address of the collectible contract
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleContractInformationFromApi(contractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const api = this.getCollectibleContractInformationApi(contractAddress);
            let collectibleContractObject;
            /* istanbul ignore if */
            if (this.openSeaApiKey) {
                collectibleContractObject = yield util_1.handleFetch(api, { headers: { 'X-API-KEY': this.openSeaApiKey } });
            }
            else {
                collectibleContractObject = yield util_1.handleFetch(api);
            }
            const { name, symbol, image_url, description, total_supply } = collectibleContractObject;
            return { name, symbol, image_url, description, total_supply };
        });
    }
    /**
     * Request collectible contract information from the contract itself
     *
     * @param contractAddress - Hex address of the collectible contract
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleContractInformationFromContract(contractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const assetsContractController = this.context.AssetsContractController;
            const name = yield assetsContractController.getAssetName(contractAddress);
            const symbol = yield assetsContractController.getAssetSymbol(contractAddress);
            return { name, symbol };
        });
    }
    /**
     * Request collectible contract information from OpenSea api
     *
     * @param contractAddress - Hex address of the collectible contract
     * @returns - Promise resolving to the collectible contract name, image and description
     */
    getCollectibleContractInformation(contractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            let information;
            // First try with OpenSea
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleContractInformationFromApi(contractAddress);
            }));
            if (information) {
                return information;
            }
            // Then following ERC721 standard
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleContractInformationFromContract(contractAddress);
            }));
            if (information) {
                return information;
            }
            /* istanbul ignore next */
            return {};
        });
    }
    /**
     * Adds an individual collectible to the stored collectible list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @param opts - Collectible optional information (name, image and description)
     * @returns - Promise resolving to the current collectible list
     */
    addIndividualCollectible(address, tokenId, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                address = ethereumjs_util_1.toChecksumAddress(address);
                const { allCollectibles, collectibles } = this.state;
                const { networkType, selectedAddress } = this.config;
                const existingEntry = collectibles.find((collectible) => collectible.address === address && collectible.tokenId === tokenId);
                if (existingEntry) {
                    return collectibles;
                }
                const { name, image, description } = opts || (yield this.getCollectibleInformation(address, tokenId));
                const newEntry = { address, tokenId, name, image, description };
                const newCollectibles = [...collectibles, newEntry];
                const addressCollectibles = allCollectibles[selectedAddress];
                const newAddressCollectibles = Object.assign(Object.assign({}, addressCollectibles), { [networkType]: newCollectibles });
                const newAllCollectibles = Object.assign(Object.assign({}, allCollectibles), { [selectedAddress]: newAddressCollectibles });
                this.update({ allCollectibles: newAllCollectibles, collectibles: newCollectibles });
                return newCollectibles;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Adds a collectible contract to the stored collectible contracts list
     *
     * @param address - Hex address of the collectible contract
     * @param detection? - Whether the collectible is manually added or auto-detected
     * @returns - Promise resolving to the current collectible contracts list
     */
    addCollectibleContract(address, detection) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                address = ethereumjs_util_1.toChecksumAddress(address);
                const { allCollectibleContracts, collectibleContracts } = this.state;
                const { networkType, selectedAddress } = this.config;
                const existingEntry = collectibleContracts.find((collectibleContract) => collectibleContract.address === address);
                if (existingEntry) {
                    return collectibleContracts;
                }
                const contractInformation = yield this.getCollectibleContractInformation(address);
                const { name, symbol, image_url, description, total_supply } = contractInformation;
                // If being auto-detected opensea information is expected
                // Oherwise at least name and symbol from contract is needed
                if ((detection && !image_url) || Object.keys(contractInformation).length === 0) {
                    return collectibleContracts;
                }
                const newEntry = {
                    address,
                    description,
                    logo: image_url,
                    name,
                    symbol,
                    totalSupply: total_supply,
                };
                const newCollectibleContracts = [...collectibleContracts, newEntry];
                const addressCollectibleContracts = allCollectibleContracts[selectedAddress];
                const newAddressCollectibleContracts = Object.assign(Object.assign({}, addressCollectibleContracts), { [networkType]: newCollectibleContracts });
                const newAllCollectibleContracts = Object.assign(Object.assign({}, allCollectibleContracts), { [selectedAddress]: newAddressCollectibleContracts });
                this.update({
                    allCollectibleContracts: newAllCollectibleContracts,
                    collectibleContracts: newCollectibleContracts,
                });
                return newCollectibleContracts;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Removes an individual collectible from the stored token list and saves it in ignored collectibles list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeAndIgnoreIndividualCollectible(address, tokenId) {
        address = ethereumjs_util_1.toChecksumAddress(address);
        const { allCollectibles, collectibles, ignoredCollectibles } = this.state;
        const { networkType, selectedAddress } = this.config;
        const newIgnoredCollectibles = [...ignoredCollectibles];
        const newCollectibles = collectibles.filter((collectible) => {
            if (collectible.address === address && collectible.tokenId === tokenId) {
                const alreadyIgnored = newIgnoredCollectibles.find((c) => c.address === address && c.tokenId === tokenId);
                !alreadyIgnored && newIgnoredCollectibles.push(collectible);
                return false;
            }
            return true;
        });
        const addressCollectibles = allCollectibles[selectedAddress];
        const newAddressCollectibles = Object.assign(Object.assign({}, addressCollectibles), { [networkType]: newCollectibles });
        const newAllCollectibles = Object.assign(Object.assign({}, allCollectibles), { [selectedAddress]: newAddressCollectibles });
        this.update({
            allCollectibles: newAllCollectibles,
            collectibles: newCollectibles,
            ignoredCollectibles: newIgnoredCollectibles,
        });
    }
    /**
     * Removes an individual collectible from the stored token list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeIndividualCollectible(address, tokenId) {
        address = ethereumjs_util_1.toChecksumAddress(address);
        const { allCollectibles, collectibles } = this.state;
        const { networkType, selectedAddress } = this.config;
        const newCollectibles = collectibles.filter((collectible) => !(collectible.address === address && collectible.tokenId === tokenId));
        const addressCollectibles = allCollectibles[selectedAddress];
        const newAddressCollectibles = Object.assign(Object.assign({}, addressCollectibles), { [networkType]: newCollectibles });
        const newAllCollectibles = Object.assign(Object.assign({}, allCollectibles), { [selectedAddress]: newAddressCollectibles });
        this.update({ allCollectibles: newAllCollectibles, collectibles: newCollectibles });
    }
    /**
     * Removes a collectible contract to the stored collectible contracts list
     *
     * @param address - Hex address of the collectible contract
     * @returns - Promise resolving to the current collectible contracts list
     */
    removeCollectibleContract(address) {
        address = ethereumjs_util_1.toChecksumAddress(address);
        const { allCollectibleContracts, collectibleContracts } = this.state;
        const { networkType, selectedAddress } = this.config;
        const newCollectibleContracts = collectibleContracts.filter((collectibleContract) => !(collectibleContract.address === address));
        const addressCollectibleContracts = allCollectibleContracts[selectedAddress];
        const newAddressCollectibleContracts = Object.assign(Object.assign({}, addressCollectibleContracts), { [networkType]: newCollectibleContracts });
        const newAllCollectibleContracts = Object.assign(Object.assign({}, allCollectibleContracts), { [selectedAddress]: newAddressCollectibleContracts });
        this.update({
            allCollectibleContracts: newAllCollectibleContracts,
            collectibleContracts: newCollectibleContracts,
        });
        return newCollectibleContracts;
    }
    /**
     * Sets an OpenSea API key to retrieve collectible information
     *
     * @param openSeaApiKey - OpenSea API key
     */
    setApiKey(openSeaApiKey) {
        this.openSeaApiKey = openSeaApiKey;
    }
    /**
     * Adds a token to the stored token list
     *
     * @param address - Hex address of the token contract
     * @param symbol - Symbol of the token
     * @param decimals - Number of decimals the token uses
     * @param chainId - Image of the token
     * @param image - Image of the token
     * @returns - Current token list
     */
    addToken(address, symbol, decimals, chainId, image, isCustomToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                if (!address) throw new Error('Address invalid')
                if (!isCustomToken) isCustomToken = false

                const whitelistedTokens = this.getWhiteListedTokens(chainId)
                if (!isCustomToken && whitelistedTokens && !whitelistedTokens[address.toLowerCase()]) {
                    throw new Error('Token is not whitelisted')
                }
                address = ethereumjs_util_1.toChecksumAddress(address);
                const { allTokens, tokens } = this.state;
                const { networkType, selectedAddress } = this.config;
                const newEntry = { address, symbol, decimals, chainId, image, isCustomToken };
                const previousEntry = tokens.find((token) => token.address === address);
                if (previousEntry) {
                    const previousIndex = tokens.indexOf(previousEntry);
                    tokens[previousIndex] = newEntry;
                }
                else {
                    tokens.push(newEntry);
                }
                const addressTokens = allTokens[selectedAddress];
                const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [networkType]: tokens });
                const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
                const newTokens = [...tokens];
                this.update({ allTokens: newAllTokens, tokens: newTokens });
                return newTokens;
            }
            finally {
                releaseLock();
            }
        });
    }

    fetchBitQueryResult(address, networkName) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(' -- appending bitquery token')
            const assetsQuery = {
                query: `{
                                ethereum(network: ${networkName}) {
                                address(address: {is: "${address}"}) {
                                    balances {
                                    currency {
                                        address
                                        symbol
                                        decimals
                                        tokenType
                                    }
                                    value
                                    }
                                }
                                }
                            }`,
                variables: `{}`
            }
            let result = [];
            try {
                result = yield fetch(BITQUERY_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': 'BQYir5dgTIB9fHtmfJ0QUaz6a8RkmX7a'
                    },
                    body: JSON.stringify(assetsQuery) // Get some from re-orgs
                })
                result = yield result.json()
                // console.log(' --- bitquery result:', result)
                result = result?.data?.ethereum?.address?.[0]?.balances
            } catch (error) {
                console.log(' -- fetch bitquery error', error)
            }
            return result;
        });
    }

    fetchFantomQueryResult(address) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(' -- appending fantomquery token')
            const assetsQuery = {
                operationName: 'Erc20Assets',
                query: `query Erc20Assets($owner: Address!) {
                                erc20Assets(owner: $owner) {
                                  address
                                  name
                                  symbol
                                  decimals
                                  totalSupply
                                  logoURL
                                  balanceOf(owner: $owner)
                                }
                              }`,
                variables: {
                    "owner": `${address}`
                }
            }
            let result = [];
            try {
                result = yield fetch(FANTOMQUERY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(assetsQuery) // Get some from re-orgs
                })
                result = yield result.json()
                result = result?.data?.erc20Assets
            } catch (error) {
                console.log(' --- fetch fantomquery error', error.message);
            }
            return result;
        });
    }

    getWhiteListedTokens(chainId) {
        try {
            const whitelistStore = JSON.parse(JSON.stringify(this.state.tokenWhitelistStore))
            if (whitelistStore?.[chainId]) return whitelistStore[chainId]
            return null
        } catch (error) {
            return null
        }
    }

    updateTokenWhitelistStore(tokenWhitelistObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const { NetworkController } = this.context
            const chainId = NetworkController.state.provider.chainId
            const cardSupportedAssetDetails = NetworkController.getCardSupportedAssetDetails(chainId)
            let whitelistedTokens = {}
            if (cardSupportedAssetDetails) whitelistedTokens = JSON.parse(JSON.stringify(cardSupportedAssetDetails))
            if (tokenWhitelistObj) {
                try {
                    console.log(' --- tokenListJson: ', tokenWhitelistObj?.endpoint)
                    const tokenListRaw = yield fetch(tokenWhitelistObj?.endpoint, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    })
                    const tokenListJSON = yield tokenListRaw?.json()
                    tokenWhitelistObj?.parser(tokenListJSON)?.map((item) => {
                        const tokenAddr = item?.address?.toLowerCase()
                        if (tokenAddr) whitelistedTokens[tokenAddr] = tokenAddr
                    })
                } catch (error) {
                    console.log(' --- token whitelist error', error.message)
                }
            }
            let whitelistStore = JSON.parse(JSON.stringify(this.state.tokenWhitelistStore))
            if (Object.keys(whitelistedTokens)?.length > 0) whitelistStore[chainId] = whitelistedTokens
            this.update({ tokenWhitelistStore: whitelistStore })
            console.log(' --- whitelist store length: ', chainId, Object.keys(whitelistedTokens).length)
            return whitelistedTokens
        });
    }

    isValidToken(asset, tokenWhitelistObj, whitelistedTokens) {
        if (!asset?.address) return false
        if (asset.address === '-') return false;
        if (asset.address === '0x') return false;

        if (asset?.cardSupported) return true
        if (asset?.isCustomToken) return true
        if (!tokenWhitelistObj) return true
        if (whitelistedTokens?.[asset?.address?.toLowerCase()]) return true

        return false;
    }

    filterProcessToken(asset, tokenWhitelistObj, whitelistedTokens) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!asset?.address) return;

            if (this.isValidToken(asset, tokenWhitelistObj, whitelistedTokens)) {
                const assetAddress = toChecksumAddress(asset?.address)
                yield this.addToken(
                    asset?.address, asset?.symbol, asset?.decimals,
                    asset?.chainId, `${tokenWhitelistObj.assetroot}${assetAddress}/logo.png`
                );
            } else {
                this.removeToken(asset?.address)
            }
            return;
        });
    }

    addDefaultToken(type, address, tokenWhitelistObj) {
        return __awaiter(this, void 0, void 0, function* () {
            let that = this;
            const { NetworkController } = this.context
            const chainId = parseInt(NetworksChainId[type])
            const isQueryAssets = true;
            const cardSupportedAssetDetails = NetworkController.getCardSupportedAssetDetails(chainId)
            console.log(' -- AssetsController addDefaultToken isQueryAssets: ', type, chainId, tokenWhitelistObj?.endpoint)

            yield this.updateTokenWhitelistStore(tokenWhitelistObj)
            let totalLen = 0;
            let whitelistedTokens = that.getWhiteListedTokens(chainId)
            switch (type) {
                case 'bsc':
                case 'mainnet':
                case 'avalanche':
                case 'matic':
                    {
                        if (isQueryAssets) {
                            let networkName = type;
                            if (type === 'mainnet') networkName = 'ethereum'
                            const result = yield this.fetchBitQueryResult(address, networkName)
                            let ret = [];
                            if (NetworkController.isCardSupportedChain(chainId)) {
                                let result1 = cardSupportedAssetDetails;
                                if (result1) {
                                    Object.keys(result1)?.map((key) => {
                                        ret.push({ currency: { ...result1[key] } })
                                        return true;
                                    })
                                }
                            }
                            console.log(' **** card supported: ', ret.length)

                            if (result?.length) {
                                ret = [...ret, ...result];
                            }
                            for (var i = 0; i < ret?.length; i++) {
                                var item = ret[i]?.currency
                                item.chainId = chainId
                                yield this.filterProcessToken(item, tokenWhitelistObj, whitelistedTokens)
                            }
                            totalLen = ret?.length;
                            console.log(' --- appended bitquery tokens:', ret?.length);
                        }
                    }
                    break;
                case 'fantom': {
                    if (isQueryAssets) {
                        let result = yield that.fetchFantomQueryResult(address)
                        let result1 = cardSupportedAssetDetails;
                        let ret = [];
                        if (result1) {
                            Object.keys(result1)?.map((key) => {
                                ret.push({ ...result1[key] })
                                return true;
                            })
                        }
                        if (result?.length) {
                            ret = [...ret, ...result]
                        }
                        for (var i = 0; i < ret?.length; i++) {
                            var item = ret[i]
                            item.chainId = chainId
                            yield this.filterProcessToken(item, tokenWhitelistObj, whitelistedTokens)
                        }
                        console.log(' --- appended tokens: ', ret?.length)
                        totalLen = ret?.length;
                    }
                }
                    break;

                default:
                    console.log(` -- add default token log: Network of type ${type} not supported`);
                    break;
            }
            console.log(' -- addDefaultToken append done')
        });
    }

    /**
     * Adds a new suggestedAsset to state. Parameters will be validated according to
     * asset type being watched. A `<suggestedAssetMeta.id>:pending` hub event will be emitted once added.
     *
     * @param asset - Asset to be watched. For now only ERC20 tokens are accepted.
     * @param type - Asset type
     * @returns - Object containing a promise resolving to the suggestedAsset address if accepted
     */
    watchAsset(asset, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const suggestedAssetMeta = {
                asset,
                id: random(),
                status: 'pending',
                time: Date.now(),
                type,
            };
            try {
                switch (type) {
                    case 'ERC20':
                        util_1.validateTokenToWatch(asset);
                        break;
                    default:
                        throw new Error(`Asset of type ${type} not supported`);
                }
            }
            catch (error) {
                this.failSuggestedAsset(suggestedAssetMeta, error);
                return Promise.reject(error);
            }
            const result = new Promise((resolve, reject) => {
                this.hub.once(`${suggestedAssetMeta.id}:finished`, (meta) => {
                    switch (meta.status) {
                        case 'accepted':
                            return resolve(meta.asset.address);
                        case 'rejected':
                            return reject(new Error('User rejected to watch the asset.'));
                        case 'failed':
                            return reject(new Error(meta.error.message));
                    }
                });
            });
            const { suggestedAssets } = this.state;
            suggestedAssets.push(suggestedAssetMeta);
            this.update({ suggestedAssets: [...suggestedAssets] });
            this.hub.emit('pendingSuggestedAsset', suggestedAssetMeta);
            return { result, suggestedAssetMeta };
        });
    }
    /**
     * Accepts to watch an asset and updates it's status and deletes the suggestedAsset from state,
     * adding the asset to corresponding asset state. In this case ERC20 tokens.
     * A `<suggestedAssetMeta.id>:finished` hub event is fired after accepted or failure.
     *
     * @param suggestedAssetID - ID of the suggestedAsset to accept
     * @returns - Promise resolving when this operation completes
     */
    acceptWatchAsset(suggestedAssetID) {
        return __awaiter(this, void 0, void 0, function* () {
            const { suggestedAssets } = this.state;
            const { NetworkController } = this.context
            const chainId = NetworkController.state.provider.chainId
            const index = suggestedAssets.findIndex(({ id }) => suggestedAssetID === id);
            const suggestedAssetMeta = suggestedAssets[index];

            try {
                switch (suggestedAssetMeta.type) {
                    case 'ERC20':
                        const { address, symbol, decimals, image } = suggestedAssetMeta.asset;
                        yield this.addToken(address, symbol, decimals, chainId, image);
                        suggestedAssetMeta.status = 'accepted';
                        this.hub.emit(`${suggestedAssetMeta.id}:finished`, suggestedAssetMeta);
                        break;
                    default:
                        throw new Error(`Asset of type ${suggestedAssetMeta.type} not supported`);
                }
            }
            catch (error) {
                this.failSuggestedAsset(suggestedAssetMeta, error);
            }
            const newSuggestedAssets = suggestedAssets.filter(({ id }) => id !== suggestedAssetID);
            this.update({ suggestedAssets: [...newSuggestedAssets] });
        });
    }
    /**
     * Rejects a watchAsset request based on its ID by setting its status to "rejected"
     * and emitting a `<suggestedAssetMeta.id>:finished` hub event.
     *
     * @param suggestedAssetID - ID of the suggestedAsset to accept
     */
    rejectWatchAsset(suggestedAssetID) {
        const { suggestedAssets } = this.state;
        const index = suggestedAssets.findIndex(({ id }) => suggestedAssetID === id);
        const suggestedAssetMeta = suggestedAssets[index];
        if (!suggestedAssetMeta) {
            return;
        }
        suggestedAssetMeta.status = 'rejected';
        this.hub.emit(`${suggestedAssetMeta.id}:finished`, suggestedAssetMeta);
        const newSuggestedAssets = suggestedAssets.filter(({ id }) => id !== suggestedAssetID);
        this.update({ suggestedAssets: [...newSuggestedAssets] });
    }
    /**
     * Adds a collectible and respective collectible contract to the stored collectible and collectible contracts lists
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @param opts - Collectible optional information (name, image and description)
     * @param detection? - Whether the collectible is manually added or autodetected
     * @returns - Promise resolving to the current collectible list
     */
    addCollectible(address, tokenId, opts, detection) {
        return __awaiter(this, void 0, void 0, function* () {
            address = ethereumjs_util_1.toChecksumAddress(address);
            const newCollectibleContracts = yield this.addCollectibleContract(address, detection);
            // If collectible contract was not added, do not add individual collectible
            const collectibleContract = newCollectibleContracts.find((contract) => contract.address === address);
            // If collectible contract information, add individual collectible
            if (collectibleContract) {
                yield this.addIndividualCollectible(address, tokenId, opts);
            }
        });
    }
    /**
     * Removes a token from the stored token list and saves it in ignored tokens list
     *
     * @param address - Hex address of the token contract
     */
    removeAndIgnoreToken(address) {
        address = ethereumjs_util_1.toChecksumAddress(address);
        const { allTokens, tokens, ignoredTokens } = this.state;
        const { networkType, selectedAddress } = this.config;
        const newIgnoredTokens = [...ignoredTokens];
        const newTokens = tokens.filter((token) => {
            if (token.address === address) {
                const alreadyIgnored = newIgnoredTokens.find((t) => t.address === address);
                !alreadyIgnored && newIgnoredTokens.push(token);
                return false;
            }
            return true;
        });
        const addressTokens = allTokens[selectedAddress];
        const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [networkType]: newTokens });
        const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
        this.update({ allTokens: newAllTokens, tokens: newTokens, ignoredTokens: newIgnoredTokens });
    }
    /**
     * Removes a token from the stored token list
     *
     * @param address - Hex address of the token contract
     */
    removeToken(address) {
        const { NetworkController } = this.context
        const chainId = NetworkController.state.provider.chainId
        const whitelistedTokens = this.getWhiteListedTokens(chainId)
        address = ethereumjs_util_1.toChecksumAddress(address);
        const { allTokens, tokens } = this.state;
        const { networkType, selectedAddress } = this.config;
        const newTokens = tokens.filter((token) => {
            // if user added token, then keep it.
            if (token.isCustomToken) return true
            // if address is not whitelisted, then remove it
            if (whitelistedTokens && !whitelistedTokens[token.address?.toLowerCase()]) return false;
            // if address is different, then keep it.
            return token.address !== address
        });
        const addressTokens = allTokens[selectedAddress];
        const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [networkType]: newTokens });
        const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
        this.update({ allTokens: newAllTokens, tokens: newTokens });
    }
    /**
     * Removes a collectible from the stored token list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeCollectible(address, tokenId) {
        address = ethereumjs_util_1.toChecksumAddress(address);
        this.removeIndividualCollectible(address, tokenId);
        const { collectibles } = this.state;
        const remainingCollectible = collectibles.find((collectible) => collectible.address === address);
        if (!remainingCollectible) {
            this.removeCollectibleContract(address);
        }
    }
    /**
     * Removes a collectible from the stored token list and saves it in ignored collectibles list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeAndIgnoreCollectible(address, tokenId) {
        address = ethereumjs_util_1.toChecksumAddress(address);
        this.removeAndIgnoreIndividualCollectible(address, tokenId);
        const { collectibles } = this.state;
        const remainingCollectible = collectibles.find((collectible) => collectible.address === address);
        if (!remainingCollectible) {
            this.removeCollectibleContract(address);
        }
    }
    /**
     * Removes all tokens from the ignored list
     */
    clearIgnoredTokens() {
        this.update({ ignoredTokens: [] });
    }
    /**
     * Removes all collectibles from the ignored list
     */
    clearIgnoredCollectibles() {
        this.update({ ignoredCollectibles: [] });
    }
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed() {
        super.onComposed();
        const preferences = this.context.PreferencesController;
        const network = this.context.NetworkController;
        // console.log(' -- AssetsController onComposed:', network.state.provider.rpcTarget, preferences.state.selectedAddress)
        preferences.subscribe(({ selectedAddress }) => {
            const { allCollectibleContracts, allCollectibles, allTokens } = this.state;
            const { networkType } = this.config;
            this.configure({ selectedAddress });
            this.update({
                collectibleContracts: (allCollectibleContracts[selectedAddress] && allCollectibleContracts[selectedAddress][networkType]) || [],
                collectibles: (allCollectibles[selectedAddress] && allCollectibles[selectedAddress][networkType]) || [],
                tokens: (allTokens[selectedAddress] && allTokens[selectedAddress][networkType]) || [],
            });
        });
        network.subscribe(({ provider }) => {
            const { allCollectibleContracts, allCollectibles, allTokens } = this.state;
            const { selectedAddress } = this.config;
            const networkType = String(provider.chainId);
            this.configure({ networkType });
            this.update({
                collectibleContracts: (allCollectibleContracts[selectedAddress] && allCollectibleContracts[selectedAddress][networkType]) || [],
                collectibles: (allCollectibles[selectedAddress] && allCollectibles[selectedAddress][networkType]) || [],
                tokens: (allTokens[selectedAddress] && allTokens[selectedAddress][networkType]) || [],
            });
        });
    }
}
exports.AssetsController = AssetsController;
exports.default = AssetsController;
//# sourceMappingURL=AssetsController.js.map