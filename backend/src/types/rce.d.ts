import { JSONSchema7Object, type JSONSchema7 } from 'json-schema'
import { Action } from 'neuro-game-sdk';

export interface ActionData<T extends JSONSchema7Object | undefined = any> {
    id: string;
    name: string;
    params: T;
};

export interface ActionResult {
    success: boolean;
    message: string;
    silent?: boolean;
};

export type TypedAction = Omit<Action, 'schema'> & { schema?: JSONSchema7 };

export interface RCEAction extends TypedAction {
    displayName?: string;
    validators?: ((actionData: ActionData) => ActionValidationResult | Promise<ActionValidationResult>)[];
    handler: RCEHandler;
    defaultPermission: PermissionLevel;
};

/** Permission level enums */
export enum PermissionLevel {
    OFF,
    FORCE,
    AUTOPILOT,
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
