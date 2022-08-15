import BaseController, { BaseConfig, BaseState } from '../BaseController';
/**
 * @type CurrencyRateConfig
 *
 * Currency rate controller configuration
 *
 * @property currentCurrency - Currently-active ISO 4217 currency code
 * @property interval - Polling interval used to fetch new currency rate
 * @property nativeCurrency - Symbol for the base asset used for conversion
 * @property includeUSDRate - Whether to include the usd rate in addition to the currentCurrency
 */
export interface CurrencyRateConfig extends BaseConfig {
    currentCurrency: string;
    interval: number;
    nativeCurrency: string;
    includeUSDRate?: boolean;
}
/**
 * @type CurrencyRateState
 *
 * Currency rate controller state
 *
 * @property conversionDate - Timestamp of conversion rate expressed in ms since UNIX epoch
 * @property conversionRate - Conversion rate from current base asset to the current currency
 * @property currentCurrency - Currently-active ISO 4217 currency code
 * @property nativeCurrency - Symbol for the base asset used for conversion
 * @property usdConversionRate - Conversion rate from usd to the current currency
 */
export interface CurrencyRateState extends BaseState {
    conversionDate: number;
    conversionRate: number;
    currentCurrency: string;
    nativeCurrency: string;
    usdConversionRate?: number;
}
/**
 * Controller that passively polls on a set interval for an exchange rate from the current base
 * asset to the current currency
 */
export declare class CurrencyRateController extends BaseController<CurrencyRateConfig, CurrencyRateState> {
    includeUSDRate?: boolean;
    private activeCurrency;
    private activeNativeCurrency;
    private mutex;
    private handle?;
    private getCurrentCurrencyFromState;
    private getPricingURL;
    /**
     * Name of this controller used during composition
     */
    name: string;
    /**
     * Creates a CurrencyRateController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config?: Partial<CurrencyRateConfig>, state?: Partial<CurrencyRateState>);
    /**
     * Sets a currency to track
     *
     * @param currentCurrency - ISO 4217 currency code
     */
    set currentCurrency(currentCurrency: string);
    /**
     * Sets a new native currency
     *
     * @param symbol - Symbol for the base asset
     */
    set nativeCurrency(symbol: string);
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to fetch new exchange rate
     */
    poll(interval?: number): Promise<void>;
    /**
     * Fetches the exchange rate for a given currency
     *
     * @param currency - ISO 4217 currency code
     * @param nativeCurrency - Symbol for base asset
     * @param includeUSDRate - Whether to add the USD rate to the fetch
     * @returns - Promise resolving to exchange rate for given currency
     */
    fetchExchangeRate(currency: string, nativeCurrency?: string, includeUSDRate?: boolean): Promise<CurrencyRateState>;
    /**
     * Updates exchange rate for the current currency
     *
     * @returns Promise resolving to currency data or undefined if disabled
     */
    updateExchangeRate(): Promise<CurrencyRateState | void>;
}
export default CurrencyRateController;
