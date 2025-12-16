import type { ActionData, ActionResult } from "./types/rce";
import { CONT, ERROR_MSG_REFERENCE } from "./consts";
import { actions } from "./functions";
import { validate } from "jsonschema";

export async function RCEActionHandler(actionData: ActionData): Promise<void> {
    console.log(`Received action from Neuro: ${actionData.name}`, actionData.params);
    if (!CONT.docker) {
        CONT.neuro.sendContext(`Docker client not initialized, ${ERROR_MSG_REFERENCE}`, true);
        return;
    };

    const action = actions.find((a) => a.name === actionData.name);

    if (!action) {
        CONT.neuro.sendActionResult(actionData.id, true, 'Unknown action.');
        return;
    };

    if (action.schema) {
        const result = validate(actionData.params, action.schema, { required: true });
        if (!result.valid) {
            const messagesArray: string[] = [];
            result.errors.map((erm) => {
                if (erm.stack.startsWith('instance.')) messagesArray.push(erm.stack.substring(9));
                else messagesArray.push(erm.stack);
            });
            if (messagesArray.length === 0) messagesArray.push('Unknown schema validation error.');
            const schemaFailures = `- ${messagesArray.join('\n- ')}`;
            const message = 'Action failed, your inputs did not pass schema validation due to these problems:\n\n' + schemaFailures + '\n\nPlease pay attention to the schema and the above errors if you choose to retry.';
            CONT.neuro.sendActionResult(actionData.id, false, message);
            return;
        }
    }

    if (action.validators) {
        for (const v of action.validators) {
            const result = await v(actionData);
            if (!result.success) {
                CONT.neuro.sendActionResult(actionData.id, !result.retry, result.message);
                return;
            }
        }
    }

    CONT.neuro.sendActionResult(actionData.id, true);

    try {
        const actionResult: ActionResult = await action.handler(actionData);
        if (!actionResult.success) CONT.logger.error(`Action ${actionData.name} failed! Full reason: ${actionResult.message}`)
        CONT.neuro.sendContext(actionResult.success ? actionResult.message : `Action failed: ${actionResult.message}`, actionResult.silent);
    } catch (erm) {
        CONT.neuro.sendContext(`Action threw an exception during execution! ${ERROR_MSG_REFERENCE}`)
    }
    return;
}