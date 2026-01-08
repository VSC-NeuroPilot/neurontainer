import type { ActionData, ActionResult, RCEAction } from "../types/rce";

export const miscActions: RCEAction[] = [
    {
        name: 'get_cookie',
        description: 'Get a cookie! You can even choose the flavor.',
        schema: {
            type: 'object',
            properties: {
                flavor: {
                    type: 'string'
                }
            }
        },
        handler: handleGetCookie,
    }
]

export async function handleGetCookie(actionData: ActionData<{ flavor?: string } | undefined>): Promise<ActionResult> {
    const flavor = actionData.params?.flavor ?? 'test';
    return { success: true, message: `You got a ${flavor} cookie!` }
}
