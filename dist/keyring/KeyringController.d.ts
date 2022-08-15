import BaseController, { BaseConfig, BaseState, Listener } from '../BaseController';
import { Transaction } from '../transaction/TransactionController';
import { PersonalMessageParams } from '../message-manager/PersonalMessageManager';
import { TypedMessageParams } from '../message-manager/TypedMessageManager';
/**
 * Available keyring types
 */
export declare enum KeyringTypes {
    simple = "Simple Key Pair",
    hd = "HD Key Tree"
}
/**
 * @type KeyringObject
 *
 * Keyring object
 *
 * @property type - Keyring type
 * @property accounts - Associated accounts
 * @function getAccounts - Get associated accounts
 */
export interface KeyringObject {
    type: string;
    accounts: string[];
    getAccounts(): string[];
}
/**
 * @type KeyringState
 *
 * Keyring controller state
 *
 * @property vault - Encrypted string representing keyring data
 * @property keyrings - Group of accounts
 */
export interface KeyringState extends BaseState {
    vault?: string;
    keyrings: Keyring[];
}
/**
 * @type KeyringMemState
 *
 * Keyring mem controller state
 *
 * @property isUnlocked - Whether vault is unlocked
 * @property keyringTypes - Account types
 * @property keyrings - Group of accounts
 */
export interface KeyringMemState extends BaseState {
    isUnlocked: boolean;
    keyringTypes: string[];
    keyrings: Keyring[];
}
/**
 * @type KeyringConfig
 *
 * Keyring controller configuration
 *
 * @property encryptor - Keyring encryptor
 */
export interface KeyringConfig extends BaseConfig {
    encryptor?: any;
}
/**
 * @type Keyring
 *
 * Keyring object to return in fullUpdate
 *
 * @property type - Keyring type
 * @property accounts - Associated accounts
 * @property index - Associated index
 */
export interface Keyring {
    accounts: string[];
    type: string;
    index?: number;
}
/**
 * Controller responsible for establishing and managing user identity
 */
export declare class KeyringController extends BaseController<KeyringConfig, KeyringState> {
    private mutex;
    /**
     * Name of this controller used during composition
     */
    name: string;
    /**
     * List of required sibling controllers this controller needs to function
     */
    requiredControllers: string[];
    /**
     * Creates a KeyringController instance
     *
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor(config?: Partial<KeyringConfig>, state?: Partial<KeyringState>);
    /**
     * Adds a new account to the default (first) HD seed phrase keyring
     *
     * @returns - Promise resolving to current state when the account is added
     */
    addNewAccount(): Promise<KeyringMemState>;
    /**
     * Adds a new account to the default (first) HD seed phrase keyring without updating identities in preferences
     *
     * @returns - Promise resolving to current state when the account is added
     */
    addNewAccountWithoutUpdate(): Promise<KeyringMemState>;
    /**
     * Effectively the same as creating a new keychain then populating it
     * using the given seed phrase
     *
     * @param password - Password to unlock keychain
     * @param seed - Seed phrase to restore keychain
     * @returns - Promise resolving to th restored keychain object
     */
    createNewVaultAndRestore(password: string, seed: string): Promise<any>;
    /**
     * Create a new primary keychain and wipe any previous keychains
     *
     * @param password - Password to unlock the new vault
     * @returns - Newly-created keychain object
     */
    createNewVaultAndKeychain(password: string): Promise<any>;
    /**
     * Returns the status of the vault
     *
     * @returns - Boolean returning true if the vault is unlocked
     */
    isUnlocked(): boolean;
    /**
     * Gets the seed phrase of the HD keyring
     *
     * @param password - Password of the keyring
     * @returns - Promise resolving to the seed phrase
     */
    exportSeedPhrase(password: string): any;
    /**
     * Gets the private key from the keyring controlling an address
     *
     * @param password - Password of the keyring
     * @param address - Address to export
     * @returns - Promise resolving to the private key for an address
     */
    exportAccount(password: string, address: string): Promise<string>;
    /**
     * Returns the public addresses of all accounts for the current keyring
     *
     * @returns - A promise resolving to an array of addresses
     */
    getAccounts(): Promise<string[]>;
    /**
     * Imports an account with the specified import strategy
     *
     * @param strategy - Import strategy name
     * @param args - Array of arguments to pass to the underlying stategy
     * @returns - Promise resolving to current state when the import is complete
     */
    importAccountWithStrategy(strategy: string, args: any[]): Promise<KeyringMemState>;
    /**
     * Removes an account from keyring state
     *
     * @param address - Address of the account to remove
     * @returns - Promise resolving current state when this account removal completes
     */
    removeAccount(address: string): Promise<KeyringMemState>;
    /**
     * Deallocates all secrets and locks the wallet
     *
     * @returns - Promise resolving to current state
     */
    setLocked(): Promise<KeyringMemState>;
    /**
     * Signs message by calling down into a specific keyring
     *
     * @param messageParams - PersonalMessageParams object to sign
     * @returns - Promise resolving to a signed message string
     */
    signMessage(messageParams: PersonalMessageParams): any;
    /**
     * Signs personal message by calling down into a specific keyring
     *
     * @param messageParams - PersonalMessageParams object to sign
     * @returns - Promise resolving to a signed message string
     */
    signPersonalMessage(messageParams: PersonalMessageParams): any;
    /**
     * Signs typed message by calling down into a specific keyring
     *
     * @param messageParams - TypedMessageParams object to sign
     * @param version - Compatibility version EIP712
     * @returns - Promise resolving to a signed message string or an error if any
     */
    signTypedMessage(messageParams: TypedMessageParams, version: string): Promise<string | undefined>;
    /**
     * Signs a transaction by calling down into a specific keyring
     *
     * @param transaction - Transaction object to sign
     * @param from - Address to sign from, should be in keychain
     * @returns - Promise resolving to a signed transaction string
     */
    signTransaction(transaction: Transaction, from: string): any;
    /**
     * Attempts to decrypt the current vault and load its keyrings
     *
     * @param password - Password to unlock the keychain
     * @returns - Promise resolving to the current state
     */
    submitPassword(password: string): Promise<KeyringMemState>;
    /**
     * Adds new listener to be notified of state changes
     *
     * @param listener - Callback triggered when state changes
     */
    subscribe(listener: Listener<KeyringState>): void;
    /**
     * Removes existing listener from receiving state changes
     *
     * @param listener - Callback to remove
     * @returns - True if a listener is found and unsubscribed
     */
    unsubscribe(listener: Listener<KeyringState>): any;
    /**
     * Adds new listener to be notified when the wallet is locked
     *
     * @param listener - Callback triggered when wallet is locked
     * @returns - EventEmitter if listener added
     */
    onLock(listener: () => void): any;
    /**
     * Adds new listener to be notified when the wallet is unlocked
     *
     * @param listener - Callback triggered when wallet is unlocked
     * @returns - EventEmitter if listener added
     */
    onUnlock(listener: () => void): any;
    /**
     * Verifies the that the seed phrase restores the current keychain's accounts
     *
     * @returns - Promise resolving if the verification succeeds
     */
    verifySeedPhrase(): Promise<string>;
    /**
     * Update keyrings in state and calls KeyringController fullUpdate method returning current state
     *
     * @returns - Promise resolving to current state
     */
    fullUpdate(): Promise<KeyringMemState>;
}
export default KeyringController;
