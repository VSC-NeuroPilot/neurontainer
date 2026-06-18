import type { Action } from "neuro-game-sdk";
import type { RCEAction } from "../types/rce";
import z from "zod";

/* @__NO_SIDE_EFFECTS__ */
export function defineAction<const TSchema extends z.ZodObject>(action: RCEAction<TSchema>) {
    return action
}

/**
 * Strips an action to the form expected by the API.
 * @param action The action to strip to its basic form.
 * @returns The action stripped to its basic form, without the handler and permissions.
 */
export function stripToAction({ name, description, schema }: RCEAction): Action {
    let convertedSchema = undefined
    if (schema) convertedSchema = convertToJSONSchema(schema) as Action['schema'];

    return {
        name,
        description,
        schema: convertedSchema,
    };
}

export function convertToJSONSchema(schema: z.ZodObject) {
    return z.toJSONSchema(schema, {
        target: 'draft-07',
        override: (ctx) => zodSchemaOverride(ctx.jsonSchema),
    })
}

function zodSchemaOverride(jsonSchema: z.core.JSONSchema.JSONSchema): void {
    if (jsonSchema.type === 'integer') {
        // Delete redundant minima / maxima
        if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER)
            delete jsonSchema.maximum;
        if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER)
            delete jsonSchema.minimum;
    }
}

/**
 * Strips an array of actions to the form expected by the API.
 * (Calls {@link stripToAction} for each action in the array.)
 * @param actions The actions to strip to their basic form.
 * @returns An array of actions stripped to their basic form, without the handler and permissions.
 */
export function stripToActions(actions: RCEAction[]): Action[] {
    return actions.map(stripToAction);
}