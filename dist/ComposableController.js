"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposableController = void 0;
const BaseController_1 = require("./BaseController");
/**
 * Controller that can be used to compose multiple controllers together
 */
class ComposableController extends BaseController_1.default {
    /**
     * Creates a ComposableController instance
     *
     * @param controllers - Map of names to controller instances
     * @param initialState - Initial state keyed by child controller name
     */
    constructor(controllers = [], initialState) {
        super();
        this.internalControllers = [];
        /**
         * Map of stores to compose together
         */
        this.context = {};
        /**
         * Name of this controller used during composition
         */
        this.name = 'ComposableController';
        this.initialize();
        this.cachedState = initialState;
        this.controllers = controllers;
        this.cachedState = undefined;
    }
    /**
     * Get current list of child composed store instances
     *
     * @returns - List of names to controller instances
     */
    get controllers() {
        return this.internalControllers;
    }
    /**
     * Set new list of controller instances
     *
     * @param controllers - List of names to controller instsances
     */
    set controllers(controllers) {
        this.internalControllers = controllers;
        const initialState = {};
        controllers.forEach((controller) => {
            const { name } = controller;
            this.context[name] = controller;
            controller.context = this.context;
            this.cachedState && this.cachedState[name] && controller.update(this.cachedState[name]);
            initialState[name] = controller.state;
            controller.subscribe((state) => {
                this.update({ [name]: state });
            });
        });
        controllers.forEach((controller) => {
            controller.onComposed();
        });
        this.update(initialState, true);
    }
    /**
     * Flat state representation, one that isn't keyed
     * of controller name. Instead, all child controller state is merged
     * together into a single, flat object.
     *
     * @returns - Merged state representation of all child controllers
     */
    get flatState() {
        let flatState = {};
        for (const name in this.context) {
            flatState = Object.assign(Object.assign({}, flatState), this.context[name].state);
        }
        return flatState;
    }
}
exports.ComposableController = ComposableController;
exports.default = ComposableController;
//# sourceMappingURL=ComposableController.js.map