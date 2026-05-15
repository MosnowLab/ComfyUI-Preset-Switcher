from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
import os
from aiohttp import web

WEB_DIRECTORY = os.path.join(os.path.dirname(os.path.realpath(__file__)), "js")

IMAGES_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "presets", "images")
LOCALES_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "locales")

from server import PromptServer

@PromptServer.instance.routes.get("/preset-switcher/images/{filename}")
async def serve_preset_switcher_image(request):
    filename = request.match_info["filename"]
    filepath = os.path.join(IMAGES_DIR, filename)
    if not os.path.isfile(filepath):
        return web.Response(status=404)
    return web.FileResponse(filepath)

@PromptServer.instance.routes.get("/preset-switcher/locales/{filename}")
async def serve_preset_switcher_locale(request):
    filename = request.match_info["filename"]
    filepath = os.path.join(LOCALES_DIR, filename)
    if not os.path.isfile(filepath):
        return web.Response(status=404)
    return web.FileResponse(filepath)

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
