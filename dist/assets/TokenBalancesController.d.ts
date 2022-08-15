import BaseController, { BaseConfig, BaseState } from '../BaseController';
import { Token } from './TokenRatesController';
declare const BN: any;
export { BN };
/**
 * @type TokenBalancesConfig
 *
 * Token balances controller configuration
 *
 * @property interval - Polling interval used to fetch new token balances
 * @property tokens - List of tokens to track balances for
 */
export interface TokenBalancesConfig extends BaseConfig {
    interval: number;
    tokens: Token[];
}
/**
 * @type TokenBalancesState
 *
 * Token balances controller state
 *
 * @property contractBalances - Hash of token contract addresses to balances
 */
export interface TokenBalancesState extends BaseState {
    contractBalances: {
        [address: string]: typeof BN;
    };
}
/**
 * Controller that passively polls on a set interval token balances
 * for tokens stored in the AssetsController
 */
export declare class TokenBalancesController extends BaseController<TokenBalancesConfig, TokenBalancesState> {
    private handle?;
    /**
     * Name of this controller used during composition
     */
    name: string;
    /**
     * List of required sibling controllers this controller needs to function
     */
    requiredControllers: string[];
    /**
     * Creates a TokenBalancesController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config?: Partial<TokenBalancesConfig>, state?: Partial<TokenBalancesState>);
    /**
     * Starts a new polling interval
     *
     * @param interval - Polling interval used to fetch new token balances
     */
    poll(interval?: number): Promise<void>;
    /**
     * Updates balances for all tokens
     *
     * @returns Promise resolving when this operation completes
     */
    updateBalances(): Promise<void>;
    /**
     * Extension point called if and when this controller is composed
     * with other controllers using a ComposableController
     */
    onComposed(): void;
}
export default TokenBalancesController;
