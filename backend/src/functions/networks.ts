import { CONT } from '../consts';
import { PermissionLevel, type ActionResult, type RCEAction } from '../types/rce.d'

export const networkActions: RCEAction[] = [
    {
        name: 'list_networks',
        description: 'Gets a list of networks in Docker.',
        handler: handleListNetworks,
        defaultPermission: PermissionLevel.AUTOPILOT,
    }
];

async function handleListNetworks(): Promise<ActionResult> {
    const volumes = await CONT.docker?.networkList()
    return {
        success: true,
        message: ''
    }
}
