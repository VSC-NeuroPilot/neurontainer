import { PermissionLevel, type ActionResult, type RCEAction } from "../types/rce.d";
import z from "zod";

export const miscActions: RCEAction[] = [
    {
        name: 'get_cookie',
        description: 'Get a cookie! You can even choose the flavor.',
        schema: z.object({
            flavor: z.string().optional()
        }),
        defaultPermission: PermissionLevel.AUTOPILOT,
        async handler(actionData) {
            const flavor = actionData.params?.flavor ?? 'test';
            return { success: true, message: `You got a ${flavor} cookie!` };
        },
    },
    {
        name: 'get_changelog',
        description: 'Get the changelog. You can even specify the version.',
        defaultPermission: PermissionLevel.AUTOPILOT,
        async handler() {
            return {
                success: true,
                message: 'Mocking successful return'
            }
        },
    }
]
