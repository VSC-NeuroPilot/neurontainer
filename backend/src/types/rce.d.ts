import type { JSONSchema7Object, JSONSchema7 } from 'json-schema'
import type { Action, ActionData } from 'neuro-game-sdk';
import type z from 'zod';

export interface ActionResult {
    success: boolean;
    message: string;
    silent?: boolean;
};

export interface RCEAction<TSchema extends z.ZodObject = z.ZodObject> extends Omit<Action, 'schema'> {
    schema?: TSchema;
    displayName?: string;
    validators?: ((actionData: RCEActionData<TSchema>) => ActionValidationResult | Promise<ActionValidationResult>)[];
    handler: RCEHandler<TSchema>;
    defaultPermission: PermissionLevel;
};

export type RCEActionData<TSchema extends z.ZodObject = z.ZodObject> =
    TSchema extends undefined
        ? Omit<ActionData, 'params'> & { params?: undefined }
        : Omit<ActionData, 'params'> & { params: z.input<TSchema> };

/** Permission level enums */
export enum PermissionLevel {
    AUTOPILOT,
    FORCE,
    OFF,
}

type RCEHandler<TSchema extends z.ZodObject> = (actionData: RCEActionData<TSchema>) => Promise<ActionResult>;

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
