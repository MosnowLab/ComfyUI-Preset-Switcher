import json
import os
from pathlib import Path
import folder_paths

# 预设目录
current_dir = Path(__file__).parent
presets_dir = current_dir / "presets"
presets_dir.mkdir(parents=True, exist_ok=True)

# 图片目录
images_dir = presets_dir / "images"
images_dir.mkdir(parents=True, exist_ok=True)


class StylePresetManager:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "预设触发": ("STRING", {"default": "", "forceInput": True})
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("当前预设",)
    FUNCTION = "execute"
    CATEGORY = "Preset"
    OUTPUT_NODE = False

    def execute(self, 预设触发="", unique_id=None, prompt=None, extra_pnginfo=None):
        return ("",)


class LoRAPresetManager:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "预设触发": ("STRING", {"default": "", "forceInput": True})
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("当前预设",)
    FUNCTION = "execute"
    CATEGORY = "Preset"
    OUTPUT_NODE = False

    def execute(self, 预设触发="", unique_id=None, prompt=None, extra_pnginfo=None):
        return ("",)


class PresetGallery:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "目标节点": ("STRING", {"default": "", "forceInput": True})
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

    def execute(self, 目标节点="", unique_id=None, prompt=None, extra_pnginfo=None):
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


# ============ API路由 ============
from aiohttp import web
import server


@server.PromptServer.instance.routes.get("/preset-switcher/presets")
async def get_presets_list(request):
    """获取所有预设列�?""
    presets = []
    try:
        for json_file in presets_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data["filename"] = json_file.name
                    presets.append(data)
            except Exception as e:
                print(f"读取预设失败 {json_file}: {e}")
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
    
    return web.json_response({"presets": presets})


@server.PromptServer.instance.routes.post("/preset-switcher/presets/save")
async def save_preset(request):
    """保存预设"""
    try:
        data = await request.json()
        filename = data.get("filename", "preset.json")
        
        # 确保文件名合�?        filename = filename.replace("<", "").replace(">", "").replace(":", "").replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "")
        
        file_path = presets_dir / filename
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data.get("preset", {}), f, ensure_ascii=False, indent=2)
        
        return web.json_response({"success": True, "filename": filename})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/preset-switcher/presets/delete")
async def delete_preset(request):
    """删除预设"""
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
    """通过 graph_id 查找工作流名�?""
    try:
        data = await request.json()
        graph_id = data.get("graph_id", "")
        
        if not graph_id:
            return web.json_response({"success": False, "error": "缺少 graph_id"})
        
        # 尝试多个可能的工作流目录
        possible_workflow_dirs = [
            # 常见�?ComfyUI 工作流目�?            Path(folder_paths.base_path) / "user" / "default" / "workflows",
            Path(folder_paths.base_path) / "user" / "workflows",
            Path(folder_paths.base_path) / "workflows",
            current_dir.parent.parent / "user" / "default" / "workflows",
        ]
        
        workflow_name = None
        
        for workflows_dir in possible_workflow_dirs:
            if not workflows_dir.exists():
                continue
            
            print(f"【调试】正在查找工作流目录: {workflows_dir}")
            
            # 遍历所�?JSON 文件
            for json_file in workflows_dir.glob("*.json"):
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        wf_data = json.load(f)
                        
                        # 检�?id 是否匹配
                        if wf_data.get("id") == graph_id:
                            # 找到匹配的工作流，去�?.json 后缀
                            workflow_name = json_file.stem
                            print(f"【调试】找到匹配的工作�? {workflow_name}")
                            break
                except Exception as e:
                    print(f"【调试】读取文件失�?{json_file}: {e}")
                    continue
            
            if workflow_name:
                break
        
        if workflow_name:
            return web.json_response({"success": True, "workflow_name": workflow_name})
        else:
            print(f"【调试】未找到匹配 graph_id 的工作流: {graph_id}")
            return web.json_response({"success": False, "error": "未找到匹配的工作�?, "graph_id": graph_id})
            
    except Exception as e:
        print(f"【调试】get-workflow-name 异常: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


# ============ 图片API ============

@server.PromptServer.instance.routes.get("/preset-switcher/images/list")
async def list_images(request):
    """获取所有预设图片列�?""
    try:
        images = []
        for img_file in images_dir.glob("*"):
            if img_file.is_file():
                images.append({
                    "filename": img_file.name,
                    "url": f"/preset-switcher/images/{img_file.name}"
                })
        print(f"【DEBUG】图片列�? {len(images)} 个文�? 目录: {images_dir}")
        for img in images:
            print(f"  - {img['filename']}")
        return web.json_response({"success": True, "images": images})
    except Exception as e:
        print(f"【调试】获取图片列表异�? {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.get("/preset-switcher/images/{filename}")
async def get_image(request):
    """获取预设图片"""
    try:
        from urllib.parse import unquote
        raw = request.match_info["filename"]
        filename = unquote(raw)

        print(f"【DEBUG】请求图�? raw={raw} | decoded={filename}")

        file_path = images_dir / filename

        print(f"【DEBUG】查找路�? {file_path} | exists={file_path.exists()}")

        if not file_path.exists():
            for f in images_dir.glob("*"):
                if f.is_file() and f.name == filename:
                    file_path = f
                    break

        if file_path.exists():
            print(f"【DEBUG】返回图�? {file_path} ({file_path.stat().st_size} bytes)")
            return web.FileResponse(file_path)
        else:
            files_in_dir = list(images_dir.glob("*"))
            file_names = [f.name for f in files_in_dir if f.is_file()]
            print(f"【DEBUG】图片不存在! 目录内容: {file_names}")
            return web.Response(status=404, text=f"图片不存�? {filename}")

    except Exception as e:
        print(f"【ERROR】获取图片异�? {e}")
        import traceback
        traceback.print_exc()
        return web.Response(status=500, text=str(e))


@server.PromptServer.instance.routes.post("/preset-switcher/images/upload")
async def upload_image(request):
    """上传预设图片"""
    try:
        data = await request.post()

        image_field = data.get("image")
        preset_name = data.get("presetName")
        node_type = data.get("nodeType")

        if image_field is None:
            return web.json_response({"success": False, "error": "没有找到图片字段"}, status=400)

        if not preset_name or not node_type:
            return web.json_response({"success": False, "error": f"缺少参数"}, status=400)

        safe_preset = preset_name.replace("<", "").replace(">", "").replace(":", "").replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "")
        safe_node = node_type.replace("<", "").replace(">", "").replace(":", "").replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "")

        if isinstance(image_field, str):
            return web.json_response({"success": False, "error": "图片字段是文�?}, status=400)

        orig_ext = Path(image_field.filename).suffix.lower()
        ext = orig_ext if orig_ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"] else ".png"

        final_filename = f"{safe_node}_{safe_preset}{ext}"
        file_path = images_dir / final_filename

        content = image_field.file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        print(f"【DEBUG】图片上传成�? {final_filename} | 大小: {len(content)} bytes | 路径: {file_path}")

        return web.json_response({
            "success": True,
            "url": f"/preset-switcher/images/{final_filename}",
            "filename": final_filename
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"【调试】上传图片异�? {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


@server.PromptServer.instance.routes.delete("/preset-switcher/images/{filename}")
async def delete_image(request):
    """删除预设图片"""
    try:
        from urllib.parse import unquote
        filename = unquote(request.match_info["filename"])
        file_path = images_dir / filename

        if file_path.exists():
            file_path.unlink()
            print(f"【DEBUG】图片已删除: {filename}")
            return web.json_response({"success": True})
        else:
            return web.json_response({"success": False, "error": "文件不存�?}, status=404)
    except Exception as e:
        print(f"【调试】删除图片异�? {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)
