import type { JSONSchema7Object, JSONSchema7 } from 'json-schema'
import { Action } from 'neuro-game-sdk';

export interface ActionResult {
    success: boolean;
    message: string;
    silent?: boolean;
};

export interface RCEAction extends Action {
    displayName?: string;
    validators?: ((actionData: ActionData) => ActionValidationResult | Promise<ActionValidationResult>)[];
    handler: RCEHandler;
    defaultPermission: PermissionLevel;
};

/** Permission level enums */
export enum PermissionLevel {
    AUTOPILOT,
    FORCE,
    OFF,
}

type RCEHandler = (actionData: ActionData) => Promise<ActionResult>;

/** The result of attempting to execute an action client-side. */
export interface ActionValidationResult {
    /**
     * If `false`, the action handler is not executed.
     * Warning: This is *not* the success parameter of the action result.
     */
    success: boolean;
    /**
     * The message to send Neuro.
     * If success is `true`, this is optional, otherwise it should be an error message.
     */
    message?: string;
    /** If `true`, Neuro should retry the action if it was forced. */
    retry?: boolean;
};
