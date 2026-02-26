import { PermissionLevel, type ActionData, type ActionResult, type RCEAction } from "../types/rce.d";

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
        defaultPermission: PermissionLevel.AUTOPILOT,
        handler: handleGetCookie,
    }
]

export async function handleGetCookie(actionData: ActionData<{ flavor?: string } | undefined>): Promise<ActionResult> {
    const flavor = actionData.params?.flavor ?? 'test';
    return { success: true, message: `You got a ${flavor} cookie!` };
}
