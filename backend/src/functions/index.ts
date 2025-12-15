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
    CONT.neuro.unregisterActions(actions.map((a) => a.name));
    CONT.neuro.registerActions(stripToActions(actions));
};
