import type { JSONSchema7 } from "json-schema";
import type { Action } from "neuro-game-sdk";
import type { RCEAction } from "../types/rce";

/**
 * Strips an action to the form expected by the API.
 * @param action The action to strip to its basic form.
 * @returns The action stripped to its basic form, without the handler and permissions.
 */
export function stripToAction({ name, description, schema }: RCEAction): Action {
    return {
        name,
        description,
        schema,
    };
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