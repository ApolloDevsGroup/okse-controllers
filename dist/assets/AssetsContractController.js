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
exports.AssetsContractController = void 0;
const BaseController_1 = require("../BaseController");
// TODO: Destructuring this line introduces a compilation error
// eslint-disable-next-line prefer-destructuring
const BN = require('ethereumjs-util').BN;
const Web3 = require('web3');
const { ethers, BigNumber } = require('ethers');
const abiERC20 = require('human-standard-token-abi');
const abiERC721 = require('human-standard-collectible-abi');
const abiSingleCallBalancesContract = require('single-call-balance-checker-abi');
const abiMulticallContract = require('./Multicall2.json');
const abiCardContract = require('./OkseCard.json');
const abiLevelManagerContract = require('./LevelManager.json');
const abiLimitManagerContract = require('./LimitManager.json');
const abiMarketManagerContract = require('./MarketManager.json');
const abiPriceOracleContract = require('./AggregatorV3Interface.json');
const ERC721METADATA_INTERFACE_ID = '0x5b5e139f';
const ERC721ENUMERABLE_INTERFACE_ID = '0x780e9d63';
const SINGLE_CALL_BALANCES_ADDRESS = '0xb1f8e55c7f64d203c1400b9d8555d050f94adf39';
const MULTICALL_ADDRESSES = {
    1: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
    3: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
    4: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
    5: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
    42: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
    56: '0x41B90b73a88804f2aed1C4672b3dbA74eb9A92ce',
    137: '0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507',
    250: '0xbb804a896E1A6962837c0813a5F89fDb771d808f',
    43114: '0x84514BeaaF8f9a4cbe25A9C5a7EBdd16B4FE7154',
};
const CARD_ADDRESSES = {
    56: '0x40F5a9Bfd79585FFe39E93Efed59b84D27d6d593',
    250: '0x08B1fC2B48e5871354AF138B7909E9d1a04A89DD',
    43114: '0xe47C751c72EF1d2723e021F8153567Bd3e076a70',
};

export const CARD_LEVEL_MANAGER_ADDRESS = {
    56: '0x25994d5f8b7984AfDEb8c935B0b12CA8a6956D37',
    250: '0xD962e220ED470084cC2dbF425784E8ccBCFE7Ce9',
    43114: '0x40F5a9Bfd79585FFe39E93Efed59b84D27d6d593',
}

export const CARD_LIMIT_MANAGER_ADDRESS = {
    56: '0x9666657d324F866DA07E418C91628Fd399088f37',
    250: '0x682C09d078f52Ae34Df2fA38EDf0BfB158d332d4',
    43114: '0x25994d5f8b7984AfDEb8c935B0b12CA8a6956D37',
}

export const CARD_MARKET_MANAGER_ADDRESS = {
    56: '0x4fc6321F218C1eb8E959F97bD6F918AC738e7f7c',
    250: '0xC71438f3b31D133ff79F5Ad3ff5C0C0aF9AA4835',
    43114: '0x30342EBb1fa044A9BBFd4256973B5f551e654103',
}

export const PRICE_ORACLE_ADDRESS = {
    56: '0x515695578eECd92d7747897df7756967912E678a',
    250: '0x606FB7969fC1b5CAd58e64b12Cf827FB65eE4875',
    43114: '0x4141c9420DF74d2379c1D3CD983a8c306Aa1A6b4',
}
/**
 * Controller that interacts with contracts on mainnet through web3
 */
class AssetsContractController extends BaseController_1.default {
    /**
     * Creates a AssetsContractController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config, state) {
        super(config, state);
        /**
         * Name of this controller used during composition
         */
        this.name = 'AssetsContractController';
        this.defaultConfig = {
            provider: undefined,
        };
        this.defaultState = {
            cardUserMarketAddress: '',
            cardAssetBalances: [],
            cardAssetUSDBalances: [],
            cardAssetUSDRates: [],
            cardAllAssetDetails: [],
            paidAssetAmount: {},
            monthlyFeeAmount: '',
            lastNotifyMessage: ''
        }
        this.initialize();
    }
    /**
     *
     * Query if a contract implements an interface
     *
     * @param address - Asset contract address
     * @param interfaceId - Interface identifier
     * @returns - Promise resolving to whether the contract implements `interfaceID`
     */
    contractSupportsInterface(address, interfaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.supportsInterface(interfaceId, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Sets a new provider
     *
     * @property provider - Provider used to create a new underlying Web3 instance
     */
    set provider(provider) {
        this.web3 = new Web3(provider);
        this.ethersProvider = new ethers.providers.JsonRpcProvider(provider)
    }
    /**
     * Query if contract implements ERC721Metadata interface
     *
     * @param address - ERC721 asset contract address
     * @returns - Promise resolving to whether the contract implements ERC721Metadata interface
     */
    contractSupportsMetadataInterface(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.contractSupportsInterface(address, ERC721METADATA_INTERFACE_ID);
        });
    }
    /**
     * Query if contract implements ERC721Enumerable interface
     *
     * @param address - ERC721 asset contract address
     * @returns - Promise resolving to whether the contract implements ERC721Enumerable interface
     */
    contractSupportsEnumerableInterface(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.contractSupportsInterface(address, ERC721ENUMERABLE_INTERFACE_ID);
        });
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param address - Asset contract address
     * @param selectedAddress - Current account public address
     * @param operator - Operator account public address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    isApprovedForAll(address, selectedAddress, operator) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.isApprovedForAll(selectedAddress, operator, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param selectedAddress - Current selected account public address
     * @param selectedAssetAddress - Current selected Asset address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardEncodeData(method, id, userAddress, marketAddress, amount, validTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const cardContract = this.getCardContract()
            if (!cardContract) return ''
            const callData = cardContract.interface.encodeFunctionData('encodePackedData',
                [[method, id, marketAddress, userAddress, amount, validTime]])
            const that = this;

            return new Promise((resolve, reject) => {
                // console.log(' --- calling contract encodepack: ', userAddress, marketAddress)
                that.web3.eth.call({
                    to: cardContract.address,
                    data: callData
                }, (error, result) => {
                    if (error) {
                        // console.log(' --- encodePacked return error: ', error)
                        resolve([])
                        return;
                    }
                    console.log(' *** encodePacked result: ', result);
                    resolve(result)
                })
            });
        });
    }

    /**
     * Get CardSupportedAssets
     *
     * @param assetAddress - current address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    isCardMainMarket(assetAddress) {
        const isMainMarket = this.state.cardUserMarketAddress?.toLowerCase() === assetAddress?.toLowerCase()
        if (isMainMarket) return true
        return false
    }

    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param marketAddress - Current selected Asset address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardAssetAmount(marketAddress) {
        try {
            if (this.state.cardAssetBalances?.length === 0) return '0'
            const balanceData = this.state.cardAssetBalances?.filter((item) => {
                return item?.marketAddress?.toLowerCase() === marketAddress?.toLowerCase()
            })
            if (balanceData?.length === 0) return '0'
            return balanceData[0]?.assetAmount
        } catch (error) { }
        return '0'
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param selectedAddress - Current selected account public address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardUSDBalance(selectedAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const cardContract = this.getMarketManagerContract()
                if (!cardContract || !this.web3.eth) {
                    resolve('0')
                    return
                }
                const contract = this.web3.eth.contract(cardContract.abi).at(cardContract.address);
                // console.log(' --- calling contract usd balance: ', selectedAddress)
                contract.getUserBalanceInUsd(selectedAddress, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    console.log(' --- web3 contract read result: ', result.toString())
                    resolve(result);
                });
            });
        });
    }

    updateData(data) {
        this.update(data);
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardMonthlyFee() {
        const monthlyFee = this.state.monthlyFeeAmount
        return monthlyFee
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param marketAddress - Current selected asset public address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    updateCardMonthlyFee(marketAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const that = this;
            const cardContract = this.getCardContract()
            if (!cardContract) return '';
            const contract = this.web3.eth.contract(cardContract.abi).at(cardContract.address);
            return new Promise((resolve, reject) => {
                // console.log(' --- calling contract monthlyfee: ', marketAddress)
                contract.getMonthlyFeeAmount(false, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    that.update({ monthlyFeeAmount: result?.toString() })
                    resolve(result);
                });
            });
        });
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param marketAddress - Current selected Asset address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardMainAssetUSDBalance() {
        try {
            if (this.state.cardAssetUSDBalances?.length === 0) return 0
            const marketAddress = this.state.cardUserMarketAddress
            if (!marketAddress) return 0
            const balanceData = this.state.cardAssetUSDBalances?.filter((item) => {
                if (item?.marketAddress?.toLowerCase() !== marketAddress?.toLowerCase()) return false
                return true;
            })
            const balanceRaw = balanceData?.[0]?.usdAmount?.toString()
            if (!balanceRaw) return 0
            return ethers.utils.formatUnits(balanceRaw, 18)?.toString() * 1
        } catch (error) { }
        return 0
    }

    getCardMainAssetAmountRaw() {
        try {
            if (this.state.cardAssetBalances?.length === 0) return '0'
            const marketAddress = this.state.cardUserMarketAddress
            if (!marketAddress) return '0'
            const balanceData = this.state.cardAssetBalances?.filter((item) => {
                if (item?.marketAddress?.toLowerCase() !== marketAddress?.toLowerCase()) return false
                return true;
            })
            const balanceRaw = balanceData?.[0]?.assetAmount?.toString()
            if (!balanceRaw) return '0'
            return balanceRaw?.toString()
        } catch (error) { }
        return 0
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param marketAddress - Current selected Asset address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardAssetUSDBalanceForCardCreate() {
        if (this.state.cardAssetUSDBalances?.length === 0) return '0'
        let usdBalanceReturning = 0
        this.state.cardAssetUSDBalances?.map((item) => {
            const storedUSDReadableBalance = ethers.utils.formatUnits(item.usdAmount, 18)?.toString() * 1
            if (usdBalanceReturning < storedUSDReadableBalance * 1) usdBalanceReturning = storedUSDReadableBalance
            return true;
        })
        return usdBalanceReturning
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param marketAddress - Current selected Asset address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardGovTokenUSDBalance() {
        if (this.state.cardAssetUSDBalances?.length === 0) return '0'
        let usdBalanceReturning = 0
        const networkController = this.context.NetworkController;
        const chainId = networkController.state.provider.chainId
        this.state.cardAssetUSDBalances?.map((item) => {
            const isGovToken = networkController.isGovTokenAddress(chainId, item.marketAddress)
            if (isGovToken) {
                const storedUSDReadableBalance = ethers.utils.formatUnits(item.usdAmount, 18)?.toString() * 1
                usdBalanceReturning = storedUSDReadableBalance
            }
            return true;
        })
        return usdBalanceReturning
    }
    /**
     * Get if operator is Approved For All Collective Transaction
     *
     * @param marketAddress - Current selected Asset address
     * @returns - Promise resolving to Boolean if isApprovedAll
     */
    getCardAssetUSDBalance(marketAddress) {
        try {
            if (this.state.cardAssetUSDBalances?.length === 0) return '0'
            const balanceData = this.state.cardAssetUSDBalances?.filter((item) => {
                return item?.marketAddress?.toLowerCase() === marketAddress?.toLowerCase()
            })
            if (balanceData?.length === 0) return '0'
            return balanceData[0]?.usdAmount
        } catch (error) { }
        return '0'
    }

    getCardAssetUSDRate(marketAddress) {
        try {
            if (this.state.cardAssetUSDRates?.length === 0) return '0'
            const balanceData = this.state.cardAssetUSDRates?.filter((item) => {
                return item?.marketAddress?.toLowerCase() === marketAddress?.toLowerCase()
            })
            if (balanceData?.length === 0) return '0'
            return balanceData[0]?.usdRate
        } catch (error) { }
        return '0'
    }

    isSocketUpdateNeeded(socketReadDataJSON, selectedAddress, chainId) {
        return (
            parseInt(socketReadDataJSON?.data?.chainId) === parseInt(chainId)
            && socketReadDataJSON?.account?.toLowerCase() === selectedAddress?.toLowerCase()
            && socketReadDataJSON?.data?.userData
            && socketReadDataJSON?.timestamp > +new Date() - 15000
        )
    }

    getUserValidTime(selectedAddress, userValidTime) {
        try {
            const networkController = this.context.NetworkController;
            const socketReadData = networkController.state.socketData
            const chainId = networkController.state.provider.chainId
            const socketDataJSON = JSON.parse(socketReadData?.data?.userData)
            const socketGetUserValidTime = (BigNumber.from(socketDataJSON?.userValidTimes?.[0]?.hex?.toString()))?.toString() * 1000
            if (this.isSocketUpdateNeeded(socketReadData, selectedAddress, chainId)) {
                userValidTime = socketGetUserValidTime
            }
            // console.log(' --- socketGetUserValidTime', userValidTime, socketGetUserValidTime)
        } catch (error) { }
        return userValidTime
    }

    updateCardUserMainMarket(selectedAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const that = this;
            const networkController = this.context.NetworkController;
            const socketReadData = networkController.state.socketData
            const chainId = networkController.state.provider.chainId
            const cardContract = this.getMarketManagerContract()
            if (!cardContract) return ''
            try {
                const callDataArray = [
                    { contract: cardContract, functionName: 'getUserMainMarket', param: [selectedAddress] },
                ]

                const marketData = yield that.getMulticallResult(callDataArray)
                let marketAddress = marketData?.[0]?.toString()
                if (!marketAddress) throw new Error('market data invalid')
                if (this.isSocketUpdateNeeded(socketReadData, selectedAddress, chainId)) {
                    const socketDataJSON = JSON.parse(socketReadData?.data?.userData)
                    const socketGetUserMainMarket = socketDataJSON?.getUserMainMarket?.[0]
                    // console.log(' --- getUserMainMarket update socket,', socketGetUserMainMarket, marketAddress)
                    if (marketAddress !== socketGetUserMainMarket) marketAddress = socketGetUserMainMarket
                }
                // console.log(' --- getUserMainMarket update done,', marketAddress)
                that.update({ cardUserMarketAddress: marketAddress, })
            } catch (error) {
                // console.log(' --- getUserMainMarket not updated', error.message)
            }
        });
    }

    updateCardBatchUSDBalance(selectedAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const that = this;
            const networkController = this.context.NetworkController;
            const socketReadData = networkController.state.socketData
            const chainId = networkController.state.provider.chainId
            const cardContract = this.getMarketManagerContract()
            const priceOracleContract = this.getPriceOracleContract()
            if (!cardContract) return ''
            const allSupportedTokenDetails = networkController.getCardSupportedAssetDetails(chainId)
            if (!allSupportedTokenDetails) return ''
            try {
                let callDataArray = [
                    { contract: cardContract, functionName: 'getBatchUserAssetAmount', param: [selectedAddress] },
                    { contract: cardContract, functionName: 'getBatchUserBalanceInUsd', param: [selectedAddress] },
                ]
                Object.keys(allSupportedTokenDetails)?.map((itemAddress, idx) => {
                    const item = allSupportedTokenDetails[itemAddress]
                    callDataArray.push({
                        contract: priceOracleContract,
                        functionName: 'getUnderlyingPrice',
                        param: [itemAddress]
                    })
                })
                // console.log(' --- getBatchBalance started', callDataArray?.length)

                const balanceData = yield that.getMulticallResult(callDataArray)

                const assetBalanceData = []
                const assetBalanceUSDData = []
                const assetUSDRateData = []

                const result = balanceData
                const assetBalances = result?.[0]
                const usdBalances = result?.[1]
                const assetsLen = assetBalances?.[0]?.length
                // console.log(' *** batch balance fetched', JSON.stringify(assetBalances))
                for (var i = 0; i < assetsLen; i++) {
                    const itemAddress = assetBalances?.[0]?.[i]?.toString()?.toLowerCase()
                    if (!itemAddress) continue;
                    let assetAmount = assetBalances?.[1]?.[i]?.toString()
                    let usdAmount = usdBalances?.[1]?.[i]?.toString()

                    if (this.isSocketUpdateNeeded(socketReadData, selectedAddress, chainId)) {
                        const socketDataJSON = JSON.parse(socketReadData?.data?.userData)
                        const socketGetBatchUserAssetAmount = socketDataJSON?.getBatchUserAssetAmount
                        const socketGetBatchUserBalanceInUsd = socketDataJSON?.getBatchUserBalanceInUsd

                        const socketAssetAmount = (BigNumber.from(socketGetBatchUserAssetAmount[1][i].hex.toString()))?.toString()
                        const socketUsdAmount = (BigNumber.from(socketGetBatchUserBalanceInUsd[1][i].hex.toString()))?.toString()
                        if (socketAssetAmount && assetAmount !== socketAssetAmount) {
                            assetAmount = socketAssetAmount
                            usdAmount = socketUsdAmount
                        }
                    }
                    assetBalanceData.push({
                        marketAddress: itemAddress,
                        assetAmount: assetAmount
                    })
                    assetBalanceUSDData.push({
                        marketAddress: itemAddress,
                        usdAmount: usdAmount
                    })
                }
                Object.keys(allSupportedTokenDetails)?.map((itemAddress, idx) => {
                    const item = allSupportedTokenDetails[itemAddress]
                    if (!result[idx + 2]) return;
                    const usdRate = ethers.utils.formatUnits(result[idx + 2]?.toString(), 8 + 18 - item.decimals)?.toString()
                    assetUSDRateData.push({
                        marketAddress: itemAddress,
                        usdRate
                    })
                })
                that.update({
                    cardAssetBalances: assetBalanceData,
                    cardAssetUSDBalances: assetBalanceUSDData,
                    cardAssetUSDRates: assetUSDRateData,
                })
                // console.log(' --- getBatchBalance update done,', callDataArray?.length)
            } catch (error) {
                // console.log(' --- getBatchBalance not updated', error.message)
                throw new Error(error.message)
            }
        });
    }

    getAggregateCalldata(contract, callDataArray) {
        try {
            const callData = callDataArray?.map(item => {
                return (
                    [item?.contract?.address, item?.contract?.interface?.encodeFunctionData(item?.functionName, item?.param)]
                    // { target: item?.contract?.address, callData: item?.contract?.interface?.encodeFunctionData(item?.functionName, item?.param) }
                )
            })
            return contract.interface.encodeFunctionData('aggregate', [callData])
        } catch (error) {
            return { error }
        }
    }

    parseAggregateResult(contract, callDataArray, result) {
        try {
            const parsedResult = contract.interface.decodeFunctionResult('aggregate', result)
            return callDataArray?.map((item, idx) => {
                return item?.contract?.interface
                    ?.decodeFunctionResult(item?.functionName, parsedResult?.returnData?.[idx])
            })
        } catch (error) {
            return { error }
        }
    }

    /**
    
    * Get if operator is Approved For All Collective Transaction
    *
    * @param contractAbi - multicall contract abi
    * @param contractAddress - multicall contract address
    * @param calldata - Current selected Asset address
    * @param assetAmount - Current selected asset amount
    * @returns - Promise resolving to Boolean if isApprovedAll
    */
    getMulticallResult(callDataArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const that = this;
            if (!callDataArray.length) return null;
            // console.log(' *** multicall starting: ', callDataArray?.length);
            return new Promise((resolve, reject) => {
                const contract = that.getMulticallContract()
                if (!contract || !that?.web3?.eth) {
                    resolve([])
                    return;
                }
                const aggregateCallData = that.getAggregateCalldata(contract, callDataArray)

                if (aggregateCallData.error) {
                    // console.log(' --- multicall calldata error', aggregateCallData.error.message)
                    resolve([])
                    return
                }

                that.web3.eth.call({
                    to: contract.address,
                    data: aggregateCallData
                }, (error, result) => {
                    if (error) {
                        // console.log(' --- multicall return error: ', error)
                        resolve([])
                        return;
                    }
                    const returnData = that.parseAggregateResult(contract, callDataArray, result)
                    if (returnData.error) {
                        // console.log(' --- multicall parse error', returnData.error.message)
                        resolve([])
                        return;
                    }
                    // console.log(' ************************* multicall result: ', JSON.stringify(returnData));
                    resolve(returnData)
                })
            })
        })
    }

    getAssetContract(address) {
        try {
            if (!address) return null;
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            if (!MULTICALL_ADDRESSES[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiERC20)
            return {
                address,
                abi: abiERC20,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }

    getMulticallContract() {
        try {
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            // console.log(' --- multicall chainId: ', chainId)
            if (!MULTICALL_ADDRESSES[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiMulticallContract.abi)
            return {
                address: MULTICALL_ADDRESSES[chainId],
                abi: abiMulticallContract.abi,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }

    getCardContract() {
        try {
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            // console.log(' --- multicall chainId: ', chainId)
            if (!CARD_ADDRESSES[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiCardContract.abi)
            return {
                address: CARD_ADDRESSES[chainId],
                abi: abiCardContract.abi,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }

    getLimitManagerContract() {
        try {
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            // console.log(' --- multicall chainId: ', chainId)
            if (!CARD_LIMIT_MANAGER_ADDRESS[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiLimitManagerContract.abi)
            return {
                address: CARD_LIMIT_MANAGER_ADDRESS[chainId],
                abi: abiLimitManagerContract.abi,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }
    getMarketManagerContract() {
        try {
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            // console.log(' --- multicall chainId: ', chainId)
            if (!CARD_MARKET_MANAGER_ADDRESS[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiMarketManagerContract.abi)
            return {
                address: CARD_MARKET_MANAGER_ADDRESS[chainId],
                abi: abiMarketManagerContract.abi,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }
    getLevelManagerContract() {
        try {
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            // console.log(' --- multicall chainId: ', chainId)
            if (!CARD_LEVEL_MANAGER_ADDRESS[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiLevelManagerContract.abi)
            return {
                address: CARD_LEVEL_MANAGER_ADDRESS[chainId],
                abi: abiLevelManagerContract.abi,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }
    getPriceOracleContract() {
        try {
            const networkController = this.context.NetworkController;
            const chainId = networkController.state.provider.chainId
            // console.log(' --- multicall chainId: ', chainId)
            if (!PRICE_ORACLE_ADDRESS[chainId]) return null;
            const contractInterface = new ethers.utils.Interface(abiPriceOracleContract.abi)
            return {
                address: PRICE_ORACLE_ADDRESS[chainId],
                abi: abiPriceOracleContract.abi,
                interface: contractInterface
            };
        } catch (error) {
            return null
        }
    }
    /**
     * Get balance or count for current account on specific asset contract
     *
     * @param address - Asset contract address
     * @param selectedAddress - Current account public address
     * @returns - Promise resolving to BN object containing balance for current account on specific asset contract
     */
    getBalanceOf(address, selectedAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC20).at(address);
            return new Promise((resolve, reject) => {
                contract.balanceOf(selectedAddress, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Get allowance Token Amount on address from operator
     *
     * @param address - Asset contract address
     * @param selectedAddress - Current account public address
     * @param operator - Current account public address
     * @returns - Promise resolving to BN object containing balance for allowance account on specific asset contract
     */
    getAllowance(address, selectedAddress, operator) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC20).at(address);
            return new Promise((resolve, reject) => {
                contract.allowance(selectedAddress, operator, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Enumerate assets assigned to an owner
     *
     * @param address - ERC721 asset contract address
     * @param selectedAddress - Current account public address
     * @param index - A collectible counter less than `balanceOf(selectedAddress)`
     * @returns - Promise resolving to token identifier for the 'index'th asset assigned to 'selectedAddress'
     */
    getCollectibleTokenId(address, selectedAddress, index) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.tokenOfOwnerByIndex(selectedAddress, index, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result.toNumber());
                });
            });
        });
    }
    /**
     * Query for tokenURI for a given asset
     *
     * @param address - ERC721 asset contract address
     * @param tokenId - ERC721 asset identifier
     * @returns - Promise resolving to the 'tokenURI'
     */
    getCollectibleTokenURI(address, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.tokenURI(tokenId, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Query for name for a given ERC20 asset
     *
     * @param address - ERC20 asset contract address
     * @returns - Promise resolving to the 'decimals'
     */
    getTokenDecimals(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC20).at(address);
            return new Promise((resolve, reject) => {
                contract.decimals((error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Query for name for a given asset
     *
     * @param address - ERC721 or ERC20 asset contract address
     * @returns - Promise resolving to the 'name'
     */
    getAssetName(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.name((error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Query for symbol for a given asset
     *
     * @param address - ERC721 or ERC20 asset contract address
     * @returns - Promise resolving to the 'symbol'
     */
    getAssetSymbol(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.symbol((error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Query for owner for a given ERC721 asset
     *
     * @param address - ERC721 asset contract address
     * @param tokenId - ERC721 asset identifier
     * @returns - Promise resolving to the owner address
     */
    getOwnerOf(address, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiERC721).at(address);
            return new Promise((resolve, reject) => {
                contract.ownerOf(tokenId, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }
    /**
     * Returns contract instance of
     *
     * @returns - Promise resolving to the 'tokenURI'
     */
    getBalancesInSingleCall(selectedAddress, tokensToDetect) {
        return __awaiter(this, void 0, void 0, function* () {
            const contract = this.web3.eth.contract(abiSingleCallBalancesContract).at(SINGLE_CALL_BALANCES_ADDRESS);
            return new Promise((resolve, reject) => {
                contract.balances([selectedAddress], tokensToDetect, (error, result) => {
                    /* istanbul ignore if */
                    if (error) {
                        reject(error);
                        return;
                    }
                    const nonZeroBalances = {};
                    /* istanbul ignore else */
                    if (result.length > 0) {
                        tokensToDetect.forEach((tokenAddress, index) => {
                            const balance = result[index];
                            /* istanbul ignore else */
                            if (!balance.isZero()) {
                                nonZeroBalances[tokenAddress] = balance;
                            }
                        });
                    }
                    resolve(nonZeroBalances);
                });
            });
        });
    }
}
exports.AssetsContractController = AssetsContractController;
exports.default = AssetsContractController;
//# sourceMappingURL=AssetsContractController.js.map