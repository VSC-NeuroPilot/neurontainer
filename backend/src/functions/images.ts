import { CONT } from "../consts";
import { PermissionLevel, type ActionData, type ActionResult, type RCEAction } from "../types/rce.d";

export const imageActions: RCEAction[] = [
    {
        name: 'list_images',
        description: 'List all containers created in Docker.',
        defaultPermission: PermissionLevel.OFF,
        handler: handleListImages,
    }
];

export async function handleListImages(_actionData: ActionData): Promise<ActionResult> {
    const images = await CONT.docker!.imageList()
    const imageInfo = images.map((img) => ({
        tags: img.RepoTags || ['<none>'],
        size: (img.Size / 1024 / 1024).toFixed(2) + ' MB'
    }))

    return {
        success: true,
        message: `Found ${images.length} images: ${imageInfo.map(i => i.tags[0]).join(', ')}`
    }
}
