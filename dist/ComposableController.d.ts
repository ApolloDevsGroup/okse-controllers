import BaseController from './BaseController';
/**
 * Child controller instances keyed by controller name
 */
export interface ChildControllerContext {
    [key: string]: BaseController<any, any>;
}
/**
 * List of child controller instances
 */
export declare type ControllerList = BaseController<any, any>[];
/**
 * Controller that can be used to compose multiple controllers together
 */
export declare class ComposableController extends BaseController<any, any> {
    private cachedState;
    private internalControllers;
    /**
     * Map of stores to compose together
     */
    context: ChildControllerContext;
    /**
     * Name of this controller used during composition
     */
    name: string;
    /**
     * Creates a ComposableController instance
     *
     * @param controllers - Map of names to controller instances
     * @param initialState - Initial state keyed by child controller name
     */
    constructor(controllers?: ControllerList, initialState?: any);
    /**
     * Get current list of child composed store instances
     *
     * @returns - List of names to controller instances
     */
    get controllers(): ControllerList;
    /**
     * Set new list of controller instances
     *
     * @param controllers - List of names to controller instsances
     */
    set controllers(controllers: ControllerList);
    /**
     * Flat state representation, one that isn't keyed
     * of controller name. Instead, all child controller state is merged
     * together into a single, flat object.
     *
     * @returns - Merged state representation of all child controllers
     */
    get flatState(): {};
}
export default ComposableController;
