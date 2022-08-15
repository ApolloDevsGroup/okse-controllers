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
exports.AssetsDetectionController = void 0;
const ethereumjs_util_1 = require("ethereumjs-util");
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const contractMap = require('@metamask/contract-metadata');
const DEFAULT_INTERVAL = 180000;
const MAINNET = 'mainnet';
/**
 * Controller that passively polls on a set interval for assets auto detection
 */
class AssetsDetectionController extends BaseController_1.default {
    /**
     * Creates a AssetsDetectionController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        /**
         * Name of this controller used during composition
         */
        this.name = 'AssetsDetectionController';
        /**
         * List of required sibling controllers this controller needs to function
         */
        this.requiredControllers = ['AssetsContractController', 'AssetsController', 'NetworkController', 'PreferencesController'];
        this.defaultConfig = {
            interval: DEFAULT_INTERVAL,
            networkType: 'mainnet',
            selectedAddress: '',
            tokens: [],
        };
        this.initialize();
        this.poll();
    }
    getOwnerCollectiblesApi(address) {
        return `https://api.opensea.io/api/v1/assets?owner=${address}&limit=300`;
    }
    getOwnerCollectibles() {
        return __awaiter(this, void 0, void 0, function* () {
            const { selectedAddress } = this.config;
            const api = this.getOwnerCollectiblesApi(selectedAddress);
            const assetsController = this.context.AssetsController;
            let response;
            try {
                /* istanbul ignore if */
                if (assetsController.openSeaApiKey) {
                    response = yield util_1.timeoutFetch(api, { headers: { 'X-API-KEY': assetsController.openSeaApiKey } }, 15000);
                }
                else {
                    response = yield util_1.timeoutFetch(api, {}, 15000);
                }
            }
            catch (e) {
                /* istanbul ignore next */
                return [];
            }
            const collectiblesArray = yield response.json();
            const collectibles = collectiblesArray.assets;
            return collectibles;
        });
    }
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to auto detect assets
     */
    poll(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            interval && this.configure({ interval }, false, false);
            this.handle && clearTimeout(this.handle);
            yield this.detectAssets();
            this.handle = setTimeout(() => {
                this.poll(this.config.interval);
            }, this.config.interval);
        });
    }
    /**
     * Checks whether network is mainnet or not
     *
     * @returns - Whether current network is mainnet
     */
    isMainnet() {
        if (this.config.networkType !== MAINNET || this.disabled) {
            return false;
        }
        return true;
    }
    /**
     * Detect assets owned by current account on mainnet
     */
    detectAssets() {
        return __awaiter(this, void 0, void 0, function* () {
            /* istanbul ignore if */
            if (!this.isMainnet()) {
                return;
            }
            this.detectTokens();
            this.detectCollectibles();
        });
    }
    /**
     * Triggers asset ERC20 token auto detection for each contract address in contract metadata on mainnet
     */
    detectTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            /* istanbul ignore if */
            if (!this.isMainnet()) {
                return;
            }
            const tokensAddresses = this.config.tokens.filter(/* istanbul ignore next*/ (token) => token.address);
            const tokensToDetect = [];
            for (const address in contractMap) {
                const contract = contractMap[address];
                if (contract.erc20 && !(address in tokensAddresses)) {
                    tokensToDetect.push(address);
                }
            }
            const assetsContractController = this.context.AssetsContractController;
            const { selectedAddress } = this.config;
            /* istanbul ignore else */
            if (!selectedAddress) {
                return;
            }
            yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                const balances = yield assetsContractController.getBalancesInSingleCall(selectedAddress, tokensToDetect);
                const assetsController = this.context.AssetsController;
                const { ignoredTokens } = assetsController.state;
                for (const tokenAddress in balances) {
                    let ignored;
                    /* istanbul ignore else */
                    if (ignoredTokens.length) {
                        ignored = ignoredTokens.find((token) => token.address === ethereumjs_util_1.toChecksumAddress(tokenAddress));
                    }
                    if (!ignored) {
                        yield assetsController.addToken(tokenAddress, contractMap[tokenAddress].symbol, contractMap[tokenAddress].decimals);
                    }
                }
            }));
        });
    }
    /**
     * Triggers asset ERC721 token auto detection on mainnet
     * adding new collectibles and removing not owned collectibles
     */
    detectCollectibles() {
        return __awaiter(this, void 0, void 0, function* () {
            /* istanbul ignore if */
            if (!this.isMainnet()) {
                return;
            }
            const { selectedAddress } = this.config;
            /* istanbul ignore else */
            if (!selectedAddress) {
                return;
            }
            yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                const assetsController = this.context.AssetsController;
                const { ignoredCollectibles } = assetsController.state;
                let collectiblesToRemove = assetsController.state.collectibles;
                const apiCollectibles = yield this.getOwnerCollectibles();
                const addCollectiblesPromises = apiCollectibles.map((collectible) => __awaiter(this, void 0, void 0, function* () {
                    const { token_id, image_original_url, name, description, asset_contract: { address }, } = collectible;
                    let ignored;
                    /* istanbul ignore else */
                    if (ignoredCollectibles.length) {
                        ignored = ignoredCollectibles.find((c) => {
                            /* istanbul ignore next */
                            return c.address === ethereumjs_util_1.toChecksumAddress(address) && c.tokenId === Number(token_id);
                        });
                    }
                    /* istanbul ignore else */
                    if (!ignored) {
                        yield assetsController.addCollectible(address, Number(token_id), {
                            description,
                            image: image_original_url,
                            name,
                        }, true);
                    }
                    collectiblesToRemove = collectiblesToRemove.filter((c) => {
                        return !(c.tokenId === Number(token_id) && c.address === ethereumjs_util_1.toChecksumAddress(address));
                    });
                }));
                yield Promise.all(addCollectiblesPromises);
                collectiblesToRemove.forEach(({ address, tokenId }) => {
                    assetsController.removeCollectible(address, tokenId);
                });
            }));
        });
    }
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed() {
        super.onComposed();
        const preferences = this.context.PreferencesController;
        const network = this.context.NetworkController;
        const assets = this.context.AssetsController;
        assets.subscribe(({ tokens }) => {
            this.configure({ tokens });
        });
        preferences.subscribe(({ selectedAddress }) => {
            const actualSelectedAddress = this.config.selectedAddress;
            if (selectedAddress !== actualSelectedAddress) {
                this.configure({ selectedAddress });
                this.detectAssets();
            }
        });
        network.subscribe(({ provider }) => {
            this.configure({ networkType: provider.type });
        });
    }
}
exports.AssetsDetectionController = AssetsDetectionController;
exports.default = AssetsDetectionController;
//# sourceMappingURL=AssetsDetectionController.js.map