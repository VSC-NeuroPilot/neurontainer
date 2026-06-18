import { CONT } from "../consts";
import { PermissionLevel, type ActionResult, type RCEAction } from "../types/rce.d";
import { defineAction } from "../utils/misc";

export const imageActions: RCEAction[] = [
    defineAction({
        name: 'list_images',
        description: 'List all images created in Docker.',
        defaultPermission: PermissionLevel.OFF,
        async handler() {
            const images = await CONT.docker!.imageList()
            const imageInfo = images.map((img) => ({
                tags: img.RepoTags || ['<none>'],
                size: (img.Size / 1024 / 1024).toFixed(2) + ' MB'
            }))

            return {
                success: true,
                message: `Found ${images.length} images: ${imageInfo.map(i => i.tags[0]).join(', ')}`
            }
        },
    })
];
