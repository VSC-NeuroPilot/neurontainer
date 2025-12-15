import { CONT } from "../consts";
import type { ActionData, ActionResult, RCEAction } from "../types/rce";

export const containerActions: RCEAction[] = [
    {
        name: 'list_containers',
        description: 'List all Docker containers with their current status.',
        handler: handleListContainers,
    },
    {
        name: 'start_container',
        description: 'Start a stopped Docker container by name or ID.',
        handler: handleStartContainer,
    },
    {
        name: 'stop_container',
        description: 'Stop a running Docker container by name or ID.',
        handler: handleStopContainer,
    },
    {
        name: 'restart_container',
        description: 'Restart a running Docker container by name or ID.',
        handler: handleRestartContainer,
    },
    {
        name: 'remove_container',
        description: 'Remove an existing Docker container by name or ID.',
        handler: handleRemoveContainer,
    }
];

export async function handleListContainers(_actionData: ActionData): Promise<ActionResult> {
    const containers = await CONT.docker.containerList({ all: true })
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

export async function handleStartContainer(actionData: ActionData): Promise<ActionResult> {
    const containerId = actionData.params.container
    await CONT.docker.containerStart(containerId)
    return { success: true, message: `Container ${containerId} started.` }
}

export async function handleStopContainer(actionData: ActionData): Promise<ActionResult> {
    const containerId = actionData.params.container
    await CONT.docker.containerStop(containerId)
    return { success: true, message: `Container ${containerId} stopped.` }
}

export async function handleRestartContainer(actionData: ActionData): Promise<ActionResult> {
    const containerId = actionData.params.container
    await CONT.docker.containerRestart(containerId)
    return { success: true, message: `Container ${containerId} restarted.` }
}

export async function handleRemoveContainer(actionData: ActionData): Promise<ActionResult> {
    const containerId = actionData.params.container
    await CONT.docker.containerDelete(containerId, { force: true })
    return { success: true, message: `Container ${containerId} removed.` }
}
