import BaseController, { BaseConfig, BaseState } from '../BaseController';
/**
 * @type CoinGeckoResponse
 *
 * CoinGecko API response representation
 *
 */
export interface CoinGeckoResponse {
    [address: string]: {
        [currency: string]: number;
    };
}
/**
 * @type Token
 *
 * Token representation
 *
 * @property address - Hex address of the token contract
 * @property decimals - Number of decimals the token uses
 * @property symbol - Symbol of the token
 * @property image - Image of the token, url or bit32 image
 */
export interface Token {
    address: string;
    decimals: number;
    symbol: string;
    image?: string;
    balanceError?: Error | null;
}
/**
 * @type TokenRatesConfig
 *
 * Token rates controller configuration
 *
 * @property interval - Polling interval used to fetch new token rates
 * @property tokens - List of tokens to track exchange rates for
 */
export interface TokenRatesConfig extends BaseConfig {
    interval: number;
    nativeCurrency: string;
    tokens: Token[];
}
/**
 * @type TokenRatesState
 *
 * Token rates controller state
 *
 * @property contractExchangeRates - Hash of token contract addresses to exchange rates
 */
export interface TokenRatesState extends BaseState {
    contractExchangeRates: {
        [address: string]: number;
    };
}
/**
 * Controller that passively polls on a set interval for token-to-fiat exchange rates
 * for tokens stored in the AssetsController
 */
export declare class TokenRatesController extends BaseController<TokenRatesConfig, TokenRatesState> {
    private handle?;
    private tokenList;
    private getPricingURL;
    /**
     * Name of this controller used during composition
     */
    name: string;
    /**
     * List of required sibling controllers this controller needs to function
     */
    requiredControllers: string[];
    /**
     * Creates a TokenRatesController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config?: Partial<TokenRatesConfig>, state?: Partial<TokenRatesState>);
    /**
     * Sets a new polling interval
     *
     * @param interval - Polling interval used to fetch new token rates
     */
    poll(interval?: number): Promise<void>;
    /**
     * Sets a new token list to track prices
     *
     * @param tokens - List of tokens to track exchange rates for
     */
    set tokens(tokens: Token[]);
    /**
     * Fetches a pairs of token address and native currency
     *
     * @param query - Query according to tokens in tokenList and native currency
     * @returns - Promise resolving to exchange rates for given pairs
     */
    fetchExchangeRate(query: string): Promise<CoinGeckoResponse>;
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed(): void;
    /**
     * Updates exchange rates for all tokens
     *
     * @returns Promise resolving when this operation completes
     */
    updateExchangeRates(): Promise<void>;
}
export default TokenRatesController;
