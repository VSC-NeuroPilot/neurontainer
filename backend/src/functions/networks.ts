import { CONT } from '../consts';
import { PermissionLevel, type ActionResult, type RCEAction } from '../types/rce.d'
import { defineAction } from '../utils/misc';

export const networkActions: RCEAction[] = [
    defineAction({
        name: 'list_networks',
        description: 'Gets a list of networks in Docker.',
        async handler() {
            const volumes = await CONT.docker?.networkList()
            return {
                success: true,
                message: ''
            }
        },
        defaultPermission: PermissionLevel.AUTOPILOT,
    })
];
