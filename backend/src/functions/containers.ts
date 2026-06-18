import type { Action } from "neuro-game-sdk";
import { CONT } from "../consts";
import { PermissionLevel } from "../types/rce.d";
import z from "zod";
import { defineAction } from "../utils/misc";

const containerTargetSchema: Action['schema'] = {
    type: "object",
    properties: {
        container: {
            type: "string"
        }
    },
    required: ['container']
};

const _containerTargetSchema = z.object({
    container: z.string(),
})

export const containerActions = [
    defineAction({
        name: 'list_containers',
        description: 'List all Docker containers with their current status.',
        defaultPermission: PermissionLevel.OFF,
        async handler() {
            const containers = await CONT.docker!.containerList({ all: true })
            const containerInfo = containers.map((c) => ({
                name: c.Names?.[0]?.replace('/', '') || c.Id?.substring(0, 12) || 'Unknown container',
                state: c.State,
                status: c.Status,
                image: c.Image
            }))

            return {
                success: true,
                message: `Found ${containers.length} containers: ${containerInfo.map(c => `${c.name} (${c.state})`).join(', ')}`
            }
        },
    }),
    defineAction({
        name: 'start_container',
        description: 'Start a stopped Docker container by name or ID.',
        schema: _containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        async handler(actionData) {
            const { container } = actionData.params;
            await CONT.docker!.containerStart(container);
            return { success: true, message: `Container ${container} started.` };
        },
    }),
    defineAction({
        name: 'stop_container',
        description: 'Stop a running Docker container by name or ID.',
        schema: _containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        async handler(actionData) {
            const { container } = actionData.params!;
            await CONT.docker!.containerStop(container);
            return { success: true, message: `Container ${container} stopped.` };
        },
    }),
    defineAction({
        name: 'restart_container',
        description: 'Restart a running Docker container by name or ID.',
        schema: _containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        async handler(actionData) {
            const { container } = actionData.params!;
            await CONT.docker!.containerRestart(container);
            return { success: true, message: `Container ${container} restarted.` };
        },
    }),
    defineAction({
        name: 'remove_container',
        description: 'Remove an existing Docker container by name or ID.',
        schema: _containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        async handler(actionData) {
            const { container } = actionData.params!;
            await CONT.docker!.containerDelete(container, { force: true });
            return { success: true, message: `Container ${container} removed.` };
        },
    }),
    defineAction({
        name: 'pause_container',
        description: 'Pause a currently running container by name or ID.',
        schema: _containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        async handler(actionData) {
            const { container } = actionData.params!
            await CONT.docker!.containerPause(container);
            return { success: true, message: `Container ${container} paused.` };
        },
    }),
    defineAction({
        name: 'unpause_container',
        description: 'Unpause a currently paused container by name or ID.',
        schema: _containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        async handler(actionData) {
            const { container } = actionData.params!
            await CONT.docker!.containerUnpause(container);
            return { success: true, message: `Container ${container} unpaused.` };
        },
    })
];
