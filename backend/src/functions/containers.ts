import type { Action, ActionData } from "neuro-game-sdk";
import { CONT } from "../consts";
import { PermissionLevel, type ActionResult, type RCEAction } from "../types/rce.d";

const containerTargetSchema: Action['schema'] = {
    type: "object",
    properties: {
        container: {
            type: "string"
        }
    },
    required: ['container']
};

export const containerActions: RCEAction[] = [
    {
        name: 'list_containers',
        description: 'List all Docker containers with their current status.',
        defaultPermission: PermissionLevel.OFF,
        handler: handleListContainers,
    },
    {
        name: 'start_container',
        description: 'Start a stopped Docker container by name or ID.',
        schema: containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        handler: handleStartContainer,
    },
    {
        name: 'stop_container',
        description: 'Stop a running Docker container by name or ID.',
        schema: containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        handler: handleStopContainer,
    },
    {
        name: 'restart_container',
        description: 'Restart a running Docker container by name or ID.',
        schema: containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        handler: handleRestartContainer,
    },
    {
        name: 'remove_container',
        description: 'Remove an existing Docker container by name or ID.',
        schema: containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        handler: handleRemoveContainer,
    },
    {
        name: 'pause_container',
        description: 'Pause a currently running container by name or ID.',
        schema: containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        handler: handlePauseContainer,
    },
    {
        name: 'unpause_container',
        description: 'Unpause a currently paused container by name or ID.',
        schema: containerTargetSchema,
        defaultPermission: PermissionLevel.OFF,
        handler: handleUnpauseContainer,
    }
];

export async function handleListContainers(): Promise<ActionResult> {
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
}

export async function handleStartContainer(actionData: ActionData<{ container: string }>): Promise<ActionResult> {
    const { container } = actionData.params!;
    await CONT.docker!.containerStart(container);
    return { success: true, message: `Container ${container} started.` };
}

export async function handleStopContainer(actionData: ActionData<{ container: string }>): Promise<ActionResult> {
    const { container } = actionData.params!;
    await CONT.docker!.containerStop(container);
    return { success: true, message: `Container ${container} stopped.` };
}

export async function handleRestartContainer(actionData: ActionData<{ container: string }>): Promise<ActionResult> {
    const { container } = actionData.params!;
    await CONT.docker!.containerRestart(container);
    return { success: true, message: `Container ${container} restarted.` };
}

export async function handleRemoveContainer(actionData: ActionData<{ container: string }>): Promise<ActionResult> {
    const { container } = actionData.params!;
    await CONT.docker!.containerDelete(container, { force: true });
    return { success: true, message: `Container ${container} removed.` };
}

export async function handlePauseContainer(actionData: ActionData<{ container: string }>): Promise<ActionResult> {
    const { container } = actionData.params!
    await CONT.docker!.containerPause(container);
    return { success: true, message: `Container ${container} paused.` };
}

export async function handleUnpauseContainer(actionData: ActionData<{ container: string }>): Promise<ActionResult> {
    const { container } = actionData.params!
    await CONT.docker!.containerUnpause(container);
    return { success: true, message: `Container ${container} unpaused.` };
}
