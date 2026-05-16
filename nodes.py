import json
import os
from pathlib import Path
import folder_paths

current_dir = Path(__file__).parent
presets_dir = current_dir / "presets"
presets_dir.mkdir(parents=True, exist_ok=True)

images_dir = presets_dir / "images"
images_dir.mkdir(parents=True, exist_ok=True)


class StylePresetManager:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "preset_trigger": ("STRING", {"default": "", "forceInput": True})
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("current_preset",)
    FUNCTION = "execute"
    CATEGORY = "Preset"
    OUTPUT_NODE = False

    def execute(self, preset_trigger="", unique_id=None, prompt=None, extra_pnginfo=None):
        return ("",)


class LoRAPresetManager:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "preset_trigger": ("STRING", {"default": "", "forceInput": True})
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("current_preset",)
    FUNCTION = "execute"
    CATEGORY = "Preset"
    OUTPUT_NODE = False

    def execute(self, preset_trigger="", unique_id=None, prompt=None, extra_pnginfo=None):
        return ("",)


class PresetGallery:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "target_node": ("STRING", {"default": "", "forceInput": True})
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "Preset"
    OUTPUT_NODE = True

    def execute(self, target_node="", unique_id=None, prompt=None, extra_pnginfo=None):
        return ()


NODE_CLASS_MAPPINGS = {
    "Preset Switcher (Style)": StylePresetManager,
    "Preset Switcher (LoRA)": LoRAPresetManager,
    "Preset Gallery": PresetGallery,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Preset Switcher (Style)": "Preset Switcher (Style)",
    "Preset Switcher (LoRA)": "Preset Switcher (LoRA)",
    "Preset Gallery": "Preset Gallery",
}


from aiohttp import web
import server


@server.PromptServer.instance.routes.get("/preset-switcher/presets")
async def get_presets_list(request):
    presets = []
    try:
        for json_file in presets_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data["filename"] = json_file.name
                    presets.append(data)
            except Exception as e:
                print(f"Failed to read preset {json_file}: {e}")
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

    return web.json_response({"presets": presets})


@server.PromptServer.instance.routes.post("/preset-switcher/presets/save")
async def save_preset(request):
    try:
        data = await request.json()
        filename = data.get("filename", "preset.json")

        filename = filename.replace("<", "").replace(">", "").replace(":", "").replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "")

        file_path = presets_dir / filename

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data.get("preset", {}), f, ensure_ascii=False, indent=2)

        return web.json_response({"success": True, "filename": filename})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/preset-switcher/presets/delete")
async def delete_preset(request):
    try:
        data = await request.json()
        filename = data.get("filename", "")

        if filename:
            file_path = presets_dir / filename
            if file_path.exists():
                file_path.unlink()

        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/preset-switcher/get-workflow-name")
async def get_workflow_name(request):
    try:
        data = await request.json()
        graph_id = data.get("graph_id", "")

        if not graph_id:
            return web.json_response({"success": False, "error": "missing graph_id"})

        possible_workflow_dirs = [
            Path(folder_paths.base_path) / "user" / "default" / "workflows",
            Path(folder_paths.base_path) / "user" / "workflows",
            Path(folder_paths.base_path) / "workflows",
            current_dir.parent.parent / "user" / "default" / "workflows",
        ]

        workflow_name = None

        for workflows_dir in possible_workflow_dirs:
            if not workflows_dir.exists():
                continue

            for json_file in workflows_dir.glob("*.json"):
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        wf_data = json.load(f)

                        if wf_data.get("id") == graph_id:
                            workflow_name = json_file.stem
                            break
                except Exception as e:
                    continue

            if workflow_name:
                break

        if workflow_name:
            return web.json_response({"success": True, "workflow_name": workflow_name})
        else:
            return web.json_response({"success": False, "error": "workflow not found", "graph_id": graph_id})

    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.get("/preset-switcher/images/list")
async def list_images(request):
    try:
        images = []
        for img_file in images_dir.glob("*"):
            if img_file.is_file():
                images.append({
                    "filename": img_file.name,
                    "url": f"/preset-switcher/images/{img_file.name}"
                })
        return web.json_response({"success": True, "images": images})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.get("/preset-switcher/images/{filename}")
async def get_image(request):
    try:
        from urllib.parse import unquote
        raw = request.match_info["filename"]
        filename = unquote(raw)

        file_path = images_dir / filename

        if not file_path.exists():
            for f in images_dir.glob("*"):
                if f.is_file() and f.name == filename:
                    file_path = f
                    break

        if file_path.exists():
            return web.FileResponse(file_path)
        else:
            return web.Response(status=404, text=f"image not found: {filename}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.Response(status=500, text=str(e))


@server.PromptServer.instance.routes.post("/preset-switcher/images/upload")
async def upload_image(request):
    try:
        data = await request.post()

        image_field = data.get("image")
        preset_name = data.get("presetName")
        node_type = data.get("nodeType")

        if image_field is None:
            return web.json_response({"success": False, "error": "no image field"}, status=400)

        if not preset_name or not node_type:
            return web.json_response({"success": False, "error": "missing parameters"}, status=400)

        safe_preset = preset_name.replace("<", "").replace(">", "").replace(":", "").replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "")
        safe_node = node_type.replace("<", "").replace(">", "").replace(":", "").replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "")

        if isinstance(image_field, str):
            return web.json_response({"success": False, "error": "image field is text"}, status=400)

        orig_ext = Path(image_field.filename).suffix.lower()
        ext = orig_ext if orig_ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"] else ".png"

        final_filename = f"{safe_node}_{safe_preset}{ext}"
        file_path = images_dir / final_filename

        content = image_field.file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        return web.json_response({
            "success": True,
            "url": f"/preset-switcher/images/{final_filename}",
            "filename": final_filename
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.delete("/preset-switcher/images/{filename}")
async def delete_image(request):
    try:
        from urllib.parse import unquote
        filename = unquote(request.match_info["filename"])
        file_path = images_dir / filename

        if file_path.exists():
            file_path.unlink()
            return web.json_response({"success": True})
        else:
            return web.json_response({"success": False, "error": "file not found"}, status=404)
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)