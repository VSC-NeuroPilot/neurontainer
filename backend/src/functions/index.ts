import { CONT } from "../consts";
import type { RCEAction } from "../types/rce";
import { stripToActions } from "../utils/misc";
import { containerActions } from "./containers";
import { imageActions } from "./images";

export const actions: RCEAction[] = [
    ...containerActions,
    ...imageActions,
]

export function reregisterAllActions() {
    const seen = new Map<string, number>();
    actions.forEach((action, index) => {
        if (seen.has(action.name)) {
            CONT.logger.error(`Duplicate action name: "${action.name}" at indices ${seen.get(action.name)} and ${index}`);
        } else {
            seen.set(action.name, index);
        }
    });

    CONT.neuro.unregisterActions(actions.map((a) => a.name));
    CONT.neuro.registerActions(stripToActions(actions));
};
